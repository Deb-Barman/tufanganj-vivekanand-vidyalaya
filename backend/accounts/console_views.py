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
import os
import re
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from django.apps import apps
from django.conf import settings
from django.core.files.storage import default_storage
from django.db import connection, transaction
from django.db.models import FileField, Q
from django.http import Http404, HttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsSuperAdmin

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
def _columns(model):
    cols = []
    for f in model._meta.concrete_fields:
        cols.append({"name": f.attname, "label": f.verbose_name.title() if f.verbose_name else f.name, "type": f.get_internal_type(), "redacted": bool(SENSITIVE.search(f.name)), "pk": f.primary_key})
    return cols


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


def _filtered_qs(model, request):
    qs = model._base_manager.all()
    q = (request.query_params.get("q") or "").strip()[:80]
    if q:
        cond = Q()
        for f in model._meta.concrete_fields:
            if f.get_internal_type() in ("CharField", "TextField", "EmailField", "SlugField", "URLField") and not SENSITIVE.search(f.name):
                cond |= Q(**{f"{f.name}__icontains": q})
        qs = qs.filter(cond) if cond else qs.none()
    ordering = request.query_params.get("ordering") or _default_ordering(model)
    allowed = {f.name for f in model._meta.concrete_fields if not SENSITIVE.search(f.name)}
    if ordering.lstrip("-") not in allowed:
        ordering = _default_ordering(model)
    return qs.order_by(ordering, "pk")


def _row(values: dict, cols) -> dict:
    return {c["name"]: (MASK if c["redacted"] and values.get(c["name"]) else _cell(values.get(c["name"]))) for c in cols}


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
        q = (request.query_params.get("q") or "").strip()[:80]
        where, params = ("WHERE name ILIKE %s", [f"%{q}%"]) if q else ("", [])
        total = _fetch(f"SELECT count(*) FROM storage.objects {where}", params)
        rows = _fetch(
            "SELECT name, bucket_id, (metadata->>'size')::bigint, metadata->>'mimetype', created_at, updated_at "
            f"FROM storage.objects {where} ORDER BY created_at DESC NULLS LAST LIMIT %s OFFSET %s",
            [*params, size, (page - 1) * size],
        )
        if total is None or rows is None:
            raise Http404
        count = int(total[0][0])
        cols = [{"name": n, "label": label, "type": t, "redacted": False, "pk": n == "name"} for n, label, t in (
            ("name", "File Path", "CharField"), ("bucket_id", "Bucket", "CharField"), ("size", "Size (Bytes)", "BigIntegerField"),
            ("mimetype", "Type", "CharField"), ("created_at", "Uploaded", "DateTimeField"), ("updated_at", "Updated", "DateTimeField"))]
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
