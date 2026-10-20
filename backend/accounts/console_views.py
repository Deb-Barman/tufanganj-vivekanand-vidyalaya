"""
Super-Admin-only "Database" and "Data view" tools.

They let the head of the school see, inside the dashboard, what the Supabase
website would show: how much of the free plan is used (database + storage
bucket), how big each table is, and the rows themselves — read-only.

Safety rules baked in:
  * every view is IsSuperAdmin (server-side), nothing here writes data;
  * only the school's own apps are listed (an allow-list, not "everything");
  * password hashes, tokens and similar columns are never sent — they are
    replaced with a mask, in the table view and in CSV exports;
  * CSV cells that start with = + - @ are neutralised (spreadsheet formula injection).
"""
import csv
import json
import logging
import os
import re
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from django.apps import apps
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import connection, transaction
from django.db.models import FileField, Q
from django.db.models.deletion import Collector, ProtectedError, RestrictedError
from django.http import Http404, HttpResponse
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Role
from .permissions import IsSuperAdmin

logger = logging.getLogger(__name__)

# The school's own apps. Django internals (sessions, token blacklist, admin log) are deliberately NOT listed.
ALLOWED_APPS = ("accounts", "notices", "academics", "content")
SENSITIVE = re.compile(r"password|passwd|secret|token|session_data|api_key", re.I)
MASK = "••••••••"
MAX_CELL = 400
STORAGE_KEY = "storage.objects"


# ---------------------------------------------------------------- helpers
def _mb(n: int) -> float:
    return round(n / (1024 * 1024), 2)


def _limit_bytes(name: str, default_mb: int) -> int:
    try:
        return int(float(getattr(settings, name, default_mb)) * 1024 * 1024)
    except (TypeError, ValueError):
        return default_mb * 1024 * 1024


def _models():
    out = []
    for label in ALLOWED_APPS:
        try:
            out.extend(apps.get_app_config(label).get_models())
        except LookupError:  # app not installed in this deployment
            continue
    return sorted(out, key=lambda m: (m._meta.app_label, m._meta.model_name))


def _model_for(key: str):
    try:
        app_label, model_name = key.split(".", 1)
    except ValueError as exc:
        raise Http404 from exc
    if app_label not in ALLOWED_APPS:
        raise Http404
    try:
        return apps.get_model(app_label, model_name)
    except LookupError as exc:
        raise Http404 from exc


def _is_pg() -> bool:
    return connection.vendor == "postgresql"


def _fetch(sql: str, params=None):
    """Run a read-only query inside a savepoint so a failure never poisons the request's transaction."""
    try:
        with transaction.atomic(), connection.cursor() as cur:
            cur.execute(sql, params or [])
            return cur.fetchall()
    except Exception:  # noqa: BLE001 - any DB-side problem just means "not available here"
        return None


def _storage_objects_available() -> bool:
    if not _is_pg():
        return False
    rows = _fetch("SELECT to_regclass('storage.objects') IS NOT NULL")
    return bool(rows and rows[0][0])


def _table_bytes(table: str):
    if not _is_pg():
        return None
    rows = _fetch("SELECT pg_total_relation_size(to_regclass(%s))", [connection.ops.quote_name(table)])
    return int(rows[0][0]) if rows and rows[0][0] is not None else None


def _cell(value):
    if value is None or isinstance(value, bool | int | float):
        return value
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, UUID | Decimal):
        return str(value)
    text = str(value)
    return text if len(text) <= MAX_CELL else text[:MAX_CELL] + "…"


def _csv_safe(value) -> str:
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def _supabase_dashboard_url() -> str:
    match = re.match(r"https?://([a-z0-9]+)\.supabase\.(?:co|in)", getattr(settings, "SUPABASE_URL", "") or "")
    return f"https://supabase.com/dashboard/project/{match.group(1)}" if match else "https://supabase.com/dashboard"


# ---------------------------------------------------------------- storage usage
def _storage_usage():
    """Bucket usage: from Supabase's own storage.objects table when reachable, else the file storage itself."""
    if _storage_objects_available():
        rows = _fetch(
            "SELECT bucket_id, count(*), COALESCE(sum((metadata->>'size')::bigint), 0) "
            "FROM storage.objects GROUP BY bucket_id ORDER BY 3 DESC"
        )
        if rows is not None:
            buckets = [{"name": r[0], "files": int(r[1]), "bytes": int(r[2])} for r in rows]
            return {"source": "supabase", "buckets": buckets, "truncated": False}

    # Fallback 1: S3-compatible storage listing (capped so a huge bucket can never hang the page).
    bucket = getattr(default_storage, "bucket", None)
    if bucket is not None:
        total, files, truncated = 0, 0, False
        try:
            for obj in bucket.objects.limit(5000):
                total += obj.size
                files += 1
            truncated = files >= 5000
            return {"source": "s3", "buckets": [{"name": bucket.name, "files": files, "bytes": total}], "truncated": truncated}
        except Exception:  # noqa: BLE001
            return {"source": "unavailable", "buckets": [], "truncated": False}

    # Fallback 2: plain disk (local development).
    root = str(getattr(settings, "MEDIA_ROOT", "") or "")
    if root and os.path.isdir(root):
        total, files = 0, 0
        for base, _dirs, names in os.walk(root):
            for name in names:
                try:
                    total += os.path.getsize(os.path.join(base, name))
                    files += 1
                except OSError:
                    continue
        return {"source": "disk", "buckets": [{"name": "media (local disk)", "files": files, "bytes": total}], "truncated": False}
    return {"source": "unavailable", "buckets": [], "truncated": False}


# ---------------------------------------------------------------- Database overview
class AdminDatabaseView(APIView):
    """GET /api/auth/admin/database/ — how much database + storage the school is using."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        db_limit = _limit_bytes("SUPABASE_DB_LIMIT_MB", 500)
        storage_limit = _limit_bytes("SUPABASE_STORAGE_LIMIT_MB", 1024)

        # --- database size / server facts
        db_bytes = None
        server = {"engine": connection.vendor, "version": None, "connections": None, "max_connections": None, "started_at": None}
        if _is_pg():
            rows = _fetch("SELECT pg_database_size(current_database())")
            db_bytes = int(rows[0][0]) if rows else None
            rows = _fetch("SHOW server_version")
            server["version"] = rows[0][0].split(" ")[0] if rows else None
            rows = _fetch("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()")
            server["connections"] = int(rows[0][0]) if rows else None
            rows = _fetch("SHOW max_connections")
            server["max_connections"] = int(rows[0][0]) if rows else None
            rows = _fetch("SELECT pg_postmaster_start_time()")
            server["started_at"] = rows[0][0].isoformat() if rows else None
        else:
            name = str(connection.settings_dict.get("NAME") or "")
            if name and os.path.isfile(name):
                db_bytes = os.path.getsize(name)

        # --- tables
        tables, file_columns = [], []
        for model in _models():
            meta = model._meta
            size = _table_bytes(meta.db_table)
            tables.append({
                "key": f"{meta.app_label}.{meta.model_name}",
                "name": meta.verbose_name_plural.title(),
                "db_table": meta.db_table,
                "rows": model._base_manager.count(),
                "bytes": size,
            })
            for field in meta.concrete_fields:
                if isinstance(field, FileField):
                    uploaded = model._base_manager.exclude(**{field.name: ""}).exclude(**{f"{field.name}__isnull": True}).count()
                    file_columns.append({"table": meta.verbose_name_plural.title(), "field": field.verbose_name, "uploaded": uploaded})
        tables.sort(key=lambda t: (-(t["bytes"] or 0), -t["rows"]))

        # --- storage bucket
        usage = _storage_usage()
        total_files = sum(b["files"] for b in usage["buckets"])
        total_bytes = sum(b["bytes"] for b in usage["buckets"])

        def pct(used, limit):
            return round(min(100.0, used * 100.0 / limit), 1) if used is not None and limit else None

        return Response({
            "database": {"bytes": db_bytes, "mb": _mb(db_bytes) if db_bytes is not None else None, "limit_mb": _mb(db_limit), "percent": pct(db_bytes, db_limit)},
            "storage": {
                "source": usage["source"], "truncated": usage["truncated"], "bytes": total_bytes, "mb": _mb(total_bytes), "files": total_files,
                "limit_mb": _mb(storage_limit), "percent": pct(total_bytes, storage_limit),
                "buckets": [{**b, "mb": _mb(b["bytes"])} for b in usage["buckets"]],
            },
            "server": server,
            "tables": tables,
            "file_columns": file_columns,
            "totals": {"tables": len(tables), "rows": sum(t["rows"] for t in tables)},
            "dashboard_url": _supabase_dashboard_url(),
            "limits_note": "Limits are the plan sizes set in SUPABASE_DB_LIMIT_MB / SUPABASE_STORAGE_LIMIT_MB (defaults match the Supabase free plan).",
        })


# ---------------------------------------------------------------- Data view
_NUMBER_TYPES = {"IntegerField", "BigIntegerField", "SmallIntegerField", "PositiveIntegerField", "PositiveSmallIntegerField", "PositiveBigIntegerField", "DecimalField", "FloatField"}
_TEXT_TYPES = {"CharField", "TextField", "EmailField", "SlugField", "URLField", "FileField", "ImageField", "GenericIPAddressField"}
_ID_TYPES = {"UUIDField", "ForeignKey", "OneToOneField", "AutoField", "BigAutoField"}
# Which "operators" the Data view's filter builder offers for each kind of column.
OPS = {
    "text": {"contains", "equals", "startswith", "empty", "not_empty"},
    "number": {"eq", "gt", "gte", "lt", "lte", "empty", "not_empty"},
    "bool": {"is_true", "is_false"},
    "date": {"on", "from", "until", "empty", "not_empty"},
    "datetime": {"on", "from", "until", "empty", "not_empty"},
    "choice": {"eq", "empty", "not_empty"},
    "id": {"eq", "empty", "not_empty"},
}
MAX_FILTERS = 8
MAX_DELETE_IDS = 500
MAX_DELETE_FILTERED = 2000


def _filter_type(f):
    """What kind of filter suits this column (None = not filterable)."""
    t = f.get_internal_type()
    if SENSITIVE.search(f.name):
        return None
    if f.choices:
        return "choice"
    if t in _TEXT_TYPES:
        return "text"
    if t in _NUMBER_TYPES:
        return "number"
    if t == "BooleanField":
        return "bool"
    if t == "DateField":
        return "date"
    if t == "DateTimeField":
        return "datetime"
    if t in _ID_TYPES:
        return "id"
    return None


def _columns(model):
    cols = []
    for f in model._meta.concrete_fields:
        cols.append({
            "name": f.attname, "label": f.verbose_name.title() if f.verbose_name else f.name, "type": f.get_internal_type(),
            "redacted": bool(SENSITIVE.search(f.name)), "pk": f.primary_key, "filter": _filter_type(f),
            "choices": [{"value": str(v), "label": str(label)} for v, label in f.choices] if f.choices else None,
        })
    return cols


def _bad(msg):
    raise ValidationError({"filters": msg})


def _parse_filters(raw):
    """The `filters` parameter is a JSON list: [{"field": "status", "op": "eq", "value": "PENDING"}, …]."""
    if raw in (None, "", []):
        return []
    if isinstance(raw, str):
        if len(raw) > 4000:
            _bad("Too many filters.")
        try:
            raw = json.loads(raw)
        except ValueError:
            _bad("Filters could not be read.")
    if not isinstance(raw, list) or len(raw) > MAX_FILTERS:
        _bad(f"Use at most {MAX_FILTERS} filters.")
    items = []
    for it in raw:
        if not isinstance(it, dict):
            _bad("Filters could not be read.")
        items.append((str(it.get("field", "")), str(it.get("op", "")), str(it.get("value", ""))[:200]))
    return items


def _condition(f, ftype, op, value):
    """One filter -> (Q, negate). Raises a 400 for anything that does not make sense."""
    name = f.attname
    if op not in OPS[ftype]:
        _bad(f"“{op}” cannot be used on {f.verbose_name}.")
    if op in ("empty", "not_empty"):
        cond = Q(**{f"{name}__isnull": True})
        if ftype == "text" or ftype == "choice":
            cond |= Q(**{name: ""})
        return cond, op == "not_empty"
    try:
        if ftype == "text":
            return Q(**{f"{name}__{ {'contains': 'icontains', 'equals': 'iexact', 'startswith': 'istartswith'}[op] }": value}), False
        if ftype == "bool":
            return Q(**{name: op == "is_true"}), False
        if ftype == "number":
            from decimal import Decimal, InvalidOperation

            try:
                num = Decimal(value)
            except InvalidOperation:
                _bad(f"“{value}” is not a number.")
            return Q(**{f"{name}{ {'eq': '', 'gt': '__gt', 'gte': '__gte', 'lt': '__lt', 'lte': '__lte'}[op] }": num}), False
        if ftype in ("date", "datetime"):
            try:
                day = date.fromisoformat(value[:10])
            except ValueError:
                _bad(f"“{value}” is not a date (use YYYY-MM-DD).")
            lookup = {"on": "", "from": "__gte", "until": "__lte"}[op]
            return Q(**{f"{name}{'__date' if ftype == 'datetime' else ''}{lookup}": day}), False
        if ftype == "choice":
            if value not in {str(v) for v, _ in f.choices}:
                _bad(f"“{value}” is not one of the options for {f.verbose_name}.")
            return Q(**{name: value}), False
        if ftype == "id":
            return Q(**{name: f.to_python(value)}), False
    except DjangoValidationError:
        _bad(f"“{value}” is not valid for {f.verbose_name}.")
    _bad("Unsupported filter.")


def _apply_filters(model, qs, raw):
    fields = {f.attname: f for f in model._meta.concrete_fields}
    for name, op, value in _parse_filters(raw):
        f = fields.get(name)
        ftype = _filter_type(f) if f is not None else None
        if ftype is None:
            _bad(f"“{name}” cannot be filtered.")
        cond, negate = _condition(f, ftype, op, value)
        qs = qs.exclude(cond) if negate else qs.filter(cond)
    return qs


def _default_ordering(model) -> str:
    names = {f.name for f in model._meta.concrete_fields}
    for cand in ("created_at", "paid_on", "date", "published_at", "submitted_at", "id"):
        if cand in names:
            return f"-{cand}" if cand != "id" else "id"
    return model._meta.pk.name


def _page_args(request, default_size=25):
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        size = min(100, max(1, int(request.query_params.get("page_size", default_size))))
    except (TypeError, ValueError):
        size = default_size
    return page, size


def _search_and_filter(model, q, filters):
    qs = model._base_manager.all()
    q = (q or "").strip()[:80]
    if q:
        cond = Q()
        for f in model._meta.concrete_fields:
            if f.get_internal_type() in ("CharField", "TextField", "EmailField", "SlugField", "URLField") and not SENSITIVE.search(f.name):
                cond |= Q(**{f"{f.name}__icontains": q})
        qs = qs.filter(cond) if cond else qs.none()
    return _apply_filters(model, qs, filters)


def _filtered_qs(model, request):
    qs = _search_and_filter(model, request.query_params.get("q"), request.query_params.get("filters"))
    ordering = request.query_params.get("ordering") or _default_ordering(model)
    allowed = {f.name for f in model._meta.concrete_fields if not SENSITIVE.search(f.name)}
    if ordering.lstrip("-") not in allowed:
        ordering = _default_ordering(model)
    return qs.order_by(ordering, "pk")


def _row(values: dict, cols) -> dict:
    return {c["name"]: (MASK if c["redacted"] and values.get(c["name"]) else _cell(values.get(c["name"]))) for c in cols}


# ---- storage-file helpers (Supabase `storage.objects`)
_STORAGE_COLS = {
    "name": ("name", "text"),
    "bucket_id": ("bucket_id", "text"),
    "size": ("(metadata->>'size')::bigint", "number"),
    "mimetype": ("metadata->>'mimetype'", "text"),
    "created_at": ("created_at", "datetime"),
}


def _referenced_files() -> dict:
    """Every file name that a record in the database still points to -> which table uses it."""
    used = {}
    for model in _models():
        for f in model._meta.concrete_fields:
            if isinstance(f, FileField):
                qs = model._base_manager.exclude(**{f.name: ""}).exclude(**{f"{f.name}__isnull": True})
                for name in qs.values_list(f.name, flat=True):
                    used[str(name)] = model._meta.verbose_name_plural.title()
    return used


def _storage_where(q, filters, unused):
    """WHERE clause (+ parameters) for storage.objects from the search box, the filter builder and "unused files only"."""
    from decimal import Decimal, InvalidOperation

    parts, params = [], []
    q = (q or "").strip()[:80]
    if q:
        parts.append("name ILIKE %s")
        params.append(f"%{q}%")
    for name, op, value in _parse_filters(filters):
        col = _STORAGE_COLS.get(name)
        if col is None:
            _bad(f"“{name}” cannot be filtered.")
        expr, ftype = col
        if op not in OPS[ftype]:
            _bad(f"“{op}” cannot be used on {name}.")
        if op in ("empty", "not_empty"):
            test = f"({expr} IS NULL OR {expr}::text = '')" if ftype == "text" else f"({expr} IS NULL)"
            parts.append(test if op == "empty" else f"NOT {test}")
        elif ftype == "text":
            if op == "equals":
                parts.append(f"lower({expr}) = lower(%s)")
                params.append(value)
            else:
                parts.append(f"{expr} ILIKE %s")
                params.append(f"%{value}%" if op == "contains" else f"{value}%")
        elif ftype == "number":
            try:
                num = Decimal(value)
            except InvalidOperation:
                _bad(f"“{value}” is not a number.")
            parts.append(f"{expr} {({'eq': '=', 'gt': '>', 'gte': '>=', 'lt': '<', 'lte': '<='})[op]} %s")
            params.append(num)
        else:  # datetime
            try:
                day = date.fromisoformat(value[:10])
            except ValueError:
                _bad(f"“{value}” is not a date (use YYYY-MM-DD).")
            parts.append(f"{expr}::date {({'on': '=', 'from': '>=', 'until': '<='})[op]} %s")
            params.append(day)
    if unused:
        parts.append("name <> ALL(%s::text[])")
        params.append(sorted(_referenced_files()))
    return (("WHERE " + " AND ".join(parts)) if parts else ""), params


# ---------------------------------------------------------------- Delete (Data view)
def _friendly(obj) -> str:
    """A readable name for a record ("Riya Das") instead of Django's default "Admission object (uuid)"."""
    text = str(obj)
    if " object (" in text:
        for name in ("full_name", "username", "applicant_name", "name", "title", "caption", "label", "subject", "email"):
            value = getattr(obj, name, None)
            if value:
                return str(value)[:80]
        for f in obj._meta.concrete_fields:
            if f.get_internal_type() == "CharField" and not SENSITIVE.search(f.name) and getattr(obj, f.attname, None):
                return str(getattr(obj, f.attname))[:80]
    return text[:80]


def _guard_user(obj, user):
    if obj.pk == user.pk:
        return "This is your own account."
    if obj.role == Role.SUPER_ADMIN or obj.is_staff or obj.is_superuser:
        return "Super Admin and staff accounts cannot be deleted here."
    return None


def _guard_session(obj, user):
    return "This is the current session. Make another session current first." if obj.is_current else None


# Records that must never be deleted from the Data view (key = "app.model").
PROTECTORS = {"accounts.user": _guard_user, "academics.academicsession": _guard_session}


def _clean_ids(data, limit=MAX_DELETE_IDS):
    ids = data.get("ids")
    if not isinstance(ids, list) or not ids or not all(isinstance(i, str | int) for i in ids):
        raise ValidationError({"ids": "Choose at least one record."})
    if len(ids) > limit:
        raise ValidationError({"ids": f"Choose at most {limit} records at a time."})
    return [str(i) for i in ids]


def _db_targets(model, data, user):
    """Which rows would be deleted, and which are protected. Nothing is deleted here."""
    if data.get("scope") == "filtered":
        qs = _search_and_filter(model, data.get("q"), data.get("filters"))
        total = qs.count()
        if total > MAX_DELETE_FILTERED:
            raise ValidationError({"detail": f"{total:,} records match. Narrow the filters to {MAX_DELETE_FILTERED:,} or fewer, then delete in rounds."})
        objs = list(qs.order_by("pk"))
    else:
        try:
            ids = [model._meta.pk.to_python(i) for i in _clean_ids(data)]
        except DjangoValidationError:
            raise ValidationError({"ids": "One of the IDs is not valid."}) from None
        objs = list(model._base_manager.filter(pk__in=ids))
    guard = PROTECTORS.get(f"{model._meta.app_label}.{model._meta.model_name}")
    deletable, blocked = [], []
    for o in objs:
        reason = guard(o, user) if guard else None
        (blocked if reason else deletable).append({"obj": o, "reason": reason})
    return [d["obj"] for d in deletable], [{"id": str(b["obj"].pk), "label": _friendly(b["obj"]), "reason": b["reason"]} for b in blocked]


def _impact(model, objs):
    """What ELSE disappears with these records (Django's own cascade rules), plus how many files."""
    from collections import Counter

    if not objs:
        return [], 0, None
    collector = Collector(using=connection.alias)
    try:
        collector.collect(objs)
    except (ProtectedError, RestrictedError):
        return [], 0, "Other records still depend on these ones, so they cannot be deleted. Delete the dependent records first."
    counts = Counter()
    files = 0
    for m, instances in collector.data.items():
        counts[m] += len(instances)
        file_fields = [f.attname for f in m._meta.concrete_fields if isinstance(f, FileField)]
        files += sum(1 for i in instances for a in file_fields if getattr(i, a))
    for qs in collector.fast_deletes:
        counts[qs.model] += qs.count()
    counts[model] -= len(objs)
    also = sorted(({"name": m._meta.verbose_name_plural.title(), "count": n} for m, n in counts.items() if n > 0), key=lambda x: -x["count"])
    return also, files, None


def _storage_targets(data):
    if not _storage_objects_available():
        raise Http404
    if data.get("scope") == "filtered":
        where, params = _storage_where(data.get("q"), data.get("filters"), bool(data.get("unused")))
        rows = _fetch(f"SELECT name FROM storage.objects {where} ORDER BY created_at LIMIT %s", [*params, MAX_DELETE_FILTERED + 1])
        names = [r[0] for r in rows or []]
        if len(names) > MAX_DELETE_FILTERED:
            raise ValidationError({"detail": f"More than {MAX_DELETE_FILTERED:,} files match. Narrow the filters, then delete in rounds."})
    else:
        asked = _clean_ids(data)
        if any(n.startswith("/") or ".." in n.split("/") or len(n) > 500 for n in asked):
            raise ValidationError({"ids": "One of the file names is not valid."})
        rows = _fetch("SELECT name FROM storage.objects WHERE name = ANY(%s::text[])", [asked])
        names = [r[0] for r in rows or []]
    used = _referenced_files()
    deletable = [n for n in names if n not in used]
    blocked = [{"id": n, "label": n, "reason": f"Still used by a record in {used[n]}. Delete that record instead — its file is removed with it."} for n in names if n in used]
    return deletable, blocked


class AdminDataDeletePreviewView(APIView):
    """POST /api/auth/admin/data/<key>/delete-preview/ — what a delete WOULD do. Changes nothing."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, key):
        if key == STORAGE_KEY:
            deletable, blocked = _storage_targets(request.data)
            return Response({"count": len(deletable), "blocked": blocked[:20], "blocked_count": len(blocked), "also": [], "files": len(deletable), "error": None, "samples": deletable[:5]})
        model = _model_for(key)
        objs, blocked = _db_targets(model, request.data, request.user)
        also, files, error = _impact(model, objs)
        return Response({"count": len(objs), "blocked": blocked[:20], "blocked_count": len(blocked), "also": also, "files": files, "error": error, "samples": [_friendly(o) for o in objs[:5]]})


class AdminDataDeleteView(APIView):
    """POST /api/auth/admin/data/<key>/delete/ — really delete. Needs {"confirm": "DELETE"}."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, key):
        if request.data.get("confirm") != "DELETE":
            raise ValidationError({"confirm": "Type DELETE to confirm."})
        if key == STORAGE_KEY:
            deletable, blocked = _storage_targets(request.data)
            done, failed = 0, []
            for name in deletable:
                try:
                    default_storage.delete(name)
                    done += 1
                except Exception:  # noqa: BLE001 - one stubborn file must not stop the rest
                    failed.append(name)
            logger.warning("DATA DELETE by=%s table=%s files=%d failed=%d", request.user.username, key, done, len(failed))
            return Response({"deleted": done, "also_deleted": [], "blocked_count": len(blocked), "failed": failed[:20]})
        model = _model_for(key)
        objs, blocked = _db_targets(model, request.data, request.user)
        if not objs:
            return Response({"deleted": 0, "also_deleted": [], "blocked_count": len(blocked), "failed": []})
        _also, _files, error = _impact(model, objs)
        if error:
            raise ValidationError({"detail": error})
        with transaction.atomic():
            _total, per_model = model._base_manager.filter(pk__in=[o.pk for o in objs]).delete()
        mine = per_model.pop(model._meta.label, 0)
        logger.warning("DATA DELETE by=%s table=%s rows=%d cascade=%s", request.user.username, key, mine, per_model)
        return Response({"deleted": mine, "also_deleted": [{"name": k.split(".")[-1], "count": v} for k, v in per_model.items() if v], "blocked_count": len(blocked), "failed": []})


class AdminDataTablesView(APIView):
    """GET /api/auth/admin/data/ — the list of tables the Super Admin can browse."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        out = []
        for model in _models():
            meta = model._meta
            out.append({
                "key": f"{meta.app_label}.{meta.model_name}", "app": meta.app_label, "name": meta.verbose_name_plural.title(),
                "db_table": meta.db_table, "rows": model._base_manager.count(), "columns": len(meta.concrete_fields),
            })
        files = None
        if _storage_objects_available():
            rows = _fetch("SELECT count(*) FROM storage.objects")
            files = int(rows[0][0]) if rows else None
        return Response({"tables": out, "storage_files": files, "storage_key": STORAGE_KEY if files is not None else None})


class AdminDataRowsView(APIView):
    """GET /api/auth/admin/data/<app.model>/?page=&page_size=&q=&ordering= — rows of one table, read-only."""

    permission_classes = [IsSuperAdmin]

    def get(self, request, key):
        page, size = _page_args(request)
        if key == STORAGE_KEY:
            return self._storage(request, page, size)
        model = _model_for(key)
        cols = _columns(model)
        qs = _filtered_qs(model, request)
        count = qs.count()
        start = (page - 1) * size
        rows = [_row(v, cols) for v in qs.values(*[c["name"] for c in cols])[start:start + size]]
        return Response({
            "key": key, "name": model._meta.verbose_name_plural.title(), "db_table": model._meta.db_table,
            "columns": cols, "count": count, "page": page, "page_size": size, "pages": max(1, -(-count // size)), "results": rows,
            "ordering": request.query_params.get("ordering") or _default_ordering(model),
        })

    def _storage(self, request, page, size):
        if not _storage_objects_available():
            raise Http404
        where, params = _storage_where(request.query_params.get("q"), request.query_params.get("filters"), request.query_params.get("unused") == "1")
        total = _fetch(f"SELECT count(*) FROM storage.objects {where}", params)
        rows = _fetch(
            "SELECT name, bucket_id, (metadata->>'size')::bigint, metadata->>'mimetype', created_at, updated_at "
            f"FROM storage.objects {where} ORDER BY created_at DESC NULLS LAST LIMIT %s OFFSET %s",
            [*params, size, (page - 1) * size],
        )
        if total is None or rows is None:
            raise Http404
        count = int(total[0][0])
        cols = [{"name": n, "label": label, "type": t, "redacted": False, "pk": n == "name", "filter": ft, "choices": None} for n, label, t, ft in (
            ("name", "File Path", "CharField", "text"), ("bucket_id", "Bucket", "CharField", "text"), ("size", "Size (Bytes)", "BigIntegerField", "number"),
            ("mimetype", "Type", "CharField", "text"), ("created_at", "Uploaded", "DateTimeField", "datetime"), ("updated_at", "Updated", "DateTimeField", None))]
        keys = [c["name"] for c in cols]
        return Response({
            "key": STORAGE_KEY, "name": "Storage Files", "db_table": "storage.objects", "columns": cols, "count": count, "page": page,
            "page_size": size, "pages": max(1, -(-count // size)), "ordering": "-created_at",
            "results": [{k: _cell(v) for k, v in zip(keys, r)} for r in rows],
        })


class AdminDataExportView(APIView):
    """GET /api/auth/admin/data/<app.model>/export/ — CSV download (up to 10,000 rows, sensitive columns masked)."""

    permission_classes = [IsSuperAdmin]

    def get(self, request, key):
        model = _model_for(key)
        cols = _columns(model)
        names = [c["name"] for c in cols]
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{model._meta.db_table}.csv"'
        response["Cache-Control"] = "no-store"
        writer = csv.writer(response)
        writer.writerow([_csv_safe(n) for n in names])
        for values in _filtered_qs(model, request).values(*names)[:10000]:
            row = _row(values, cols)
            writer.writerow([_csv_safe(row[n]) for n in names])
        return response
