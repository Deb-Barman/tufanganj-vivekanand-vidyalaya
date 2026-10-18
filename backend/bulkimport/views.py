"""
Super-Admin-only API for bulk import from Excel / CSV.

  GET  /api/imports/                       what can be imported (columns, help, notes)
  GET  /api/imports/<key>/sample/?type=csv|xlsx   a ready-made sample file in the right format
  POST /api/imports/<key>/preview/         upload a file -> row-by-row check, NOTHING is saved
  POST /api/imports/<key>/commit/          upload the same file + the row numbers to save (in small batches)

Nothing is kept on the server between calls: the browser re-sends the file, and every row is re-checked against
the live database right before it is written, so a stale preview can never save something invalid.
"""
import csv
import io
import json
import logging

from django.db import transaction
from django.http import HttpResponse
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin

from .importers import IMPORTERS, column_lookup
from .parsing import MAX_BYTES, MAX_ROWS, UploadError, norm, read_table

logger = logging.getLogger(__name__)


def _importer(request, key):
    cls = IMPORTERS.get(key)
    if cls is None:
        raise NotFound("Unknown import type.")
    return cls(request.user)


def _catalog_entry(imp):
    return {
        "key": imp.key,
        "title": imp.title,
        "description": imp.description,
        "notes": list(imp.notes),
        "chunk_size": imp.chunk_size,
        "columns": [{"key": c.key, "label": c.label, "required": c.required, "help": c.help} for c in imp.columns],
        "example": [{c.key: row.get(c.key, "") for c in imp.columns} for row in imp.samples],
    }


def _no_store(resp):
    resp["Cache-Control"] = "no-store"
    return resp


def analyse(imp, upload):
    """Read the file and validate every row. Returns (file_errors, unknown_columns, present_columns, results)."""
    try:
        headers, body = read_table(upload)
    except UploadError as exc:
        return [str(exc)], [], [], []
    lookup, mapping, unknown, errors = column_lookup(imp), {}, [], []
    for i, h in enumerate(headers):
        if not str(h).strip():
            continue
        key = lookup.get(norm(h))
        if key is None:
            unknown.append(str(h))
        elif key in mapping.values():
            errors.append(f"The column “{h}” appears twice.")
        else:
            mapping[i] = key
    missing = [c.label for c in imp.columns if c.required and c.key not in mapping.values()]
    if missing:
        errors.append("These required columns are missing from the first row: " + ", ".join(missing) + ". Download the sample file to see the exact format.")
    if errors:
        return errors, unknown, [], []
    blank = {c.key: "" for c in imp.columns}
    rows = []
    for number, cells in body:
        raw = dict(blank)
        for i, key in mapping.items():
            raw[key] = cells[i] if i < len(cells) else ""
        rows.append((number, raw))
    imp.prepare([raw for _, raw in rows])
    present = [c.key for c in imp.columns if c.key in mapping.values()]
    return [], unknown, present, [imp.validate(number, raw) for number, raw in rows]


class CatalogView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return Response({"max_rows": MAX_ROWS, "max_mb": MAX_BYTES // (1024 * 1024), "imports": [_catalog_entry(cls(request.user)) for cls in IMPORTERS.values()]})


class SampleView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, key):
        imp = _importer(request, key)
        kind = request.query_params.get("type", "xlsx")
        if kind == "csv":
            buf = io.StringIO()
            w = csv.writer(buf)
            w.writerow([c.label for c in imp.columns])
            for row in imp.samples:
                w.writerow([row.get(c.key, "") for c in imp.columns])
            resp = HttpResponse(("\ufeff" + buf.getvalue()).encode("utf-8"), content_type="text/csv; charset=utf-8")
            resp["Content-Disposition"] = f'attachment; filename="tvv-{imp.key}-sample.csv"'
            return resp
        if kind != "xlsx":
            raise ValidationError({"type": "Use csv or xlsx."})
        resp = HttpResponse(_sample_xlsx(imp), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = f'attachment; filename="tvv-{imp.key}-sample.xlsx"'
        return resp


def _sample_xlsx(imp) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = "Data"
    ws.append([c.label for c in imp.columns])
    for row in imp.samples:
        ws.append([row.get(c.key, "") for c in imp.columns])
    required_fill, optional_fill = PatternFill("solid", fgColor="5D46B9"), PatternFill("solid", fgColor="D2C9F4")
    for idx, col in enumerate(imp.columns, start=1):
        cell = ws.cell(row=1, column=idx)
        cell.fill = required_fill if col.required else optional_fill
        cell.font = Font(bold=True, color="FFFFFF" if col.required else "2B2350")
        ws.column_dimensions[get_column_letter(idx)].width = max(16, len(col.label) + 6)
        for r in range(2, len(imp.samples) + 2):
            ws.cell(row=r, column=idx).number_format = "@"  # keep roll numbers / phones as typed text
    ws.freeze_panes = "A2"

    info = wb.create_sheet("Instructions")
    info.column_dimensions["A"].width = 24
    info.column_dimensions["B"].width = 12
    info.column_dimensions["C"].width = 90
    info.append([imp.title])
    info["A1"].font = Font(bold=True, size=14)
    info.append([imp.description])
    info.append([])
    info.append(["Column (first row of the Data sheet)", "Needed?", "What to type"])
    for cell in info[4]:
        cell.font = Font(bold=True)
    for c in imp.columns:
        info.append([c.label, "REQUIRED" if c.required else "optional", c.help])
    info.append([])
    info.append(["How to use this file"])
    info.cell(row=info.max_row, column=1).font = Font(bold=True)
    steps = [
        "1. Keep the Data sheet's first row exactly as it is (the column names). Dark purple = required, light = optional.",
        "2. Delete the example rows, then type or paste your own — one row per line.",
        "3. Save as Excel (.xlsx) or CSV, then upload it on the website. You will see every row checked BEFORE anything is saved.",
        *imp.notes,
    ]
    for line in steps:
        info.append([line])
    for row in info.iter_rows(min_row=1, max_row=info.max_row):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


class PreviewView(APIView):
    permission_classes = [IsSuperAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, key):
        imp = _importer(request, key)
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Choose a file to upload."})
        file_errors, unknown, present, results = analyse(imp, upload)
        counts = {"valid": 0, "invalid": 0, "create": 0, "update": 0, "skip": 0}
        rows = []
        for r in results:
            counts["valid" if r.ok else "invalid"] += 1
            if r.ok:
                counts[r.action] += 1
            rows.append({"row": r.row, "ok": r.ok, "action": r.action if r.ok else None, "display": r.display, "errors": r.errors, "warnings": r.warnings})
        return _no_store(Response({
            "key": imp.key,
            "file_name": upload.name,
            "file_errors": file_errors,
            "unknown_columns": unknown,
            "total": len(results),
            "counts": counts,
            "chunk_size": imp.chunk_size,
            "columns": [{"key": c.key, "label": c.label} for c in imp.columns if c.key in present],
            "rows": rows,
        }))


class CommitView(APIView):
    permission_classes = [IsSuperAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, key):
        imp = _importer(request, key)
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Choose a file to upload."})
        try:
            wanted = json.loads(request.data.get("rows") or "[]")
            if not isinstance(wanted, list) or not all(isinstance(n, int) for n in wanted):
                raise ValueError
        except ValueError:
            raise ValidationError({"rows": "Send the row numbers as a JSON list of whole numbers."}) from None
        if not wanted:
            raise ValidationError({"rows": "No rows were selected."})
        if len(wanted) > imp.chunk_size:
            raise ValidationError({"rows": f"At most {imp.chunk_size} rows can be saved in one request."})

        file_errors, _, _, results = analyse(imp, upload)
        if file_errors:
            raise ValidationError({"file": file_errors[0]})
        asked = set(wanted)
        todo = [r for r in results if r.row in asked and r.ok]
        rejected = [{"row": r.row, "errors": r.errors} for r in results if r.row in asked and not r.ok]
        with transaction.atomic():
            outcome = imp.commit(todo) if todo else {}
        logger.info("bulk import %s by %s: saved=%s rejected=%s", imp.key, request.user.username, len(todo), len(rejected))
        return _no_store(Response({
            "imported": len(todo),
            "created": outcome.get("created", 0),
            "updated": outcome.get("updated", 0),
            "skipped": outcome.get("skipped", 0),
            "rejected": rejected,
            "credentials": outcome.get("credentials", []),
        }))
