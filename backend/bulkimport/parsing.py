"""
Reads an uploaded Excel (.xlsx) or CSV file into plain text cells.

Safety: the file is size-capped, an .xlsx is checked to be a real zip (and not a zip bomb) before it is opened,
openpyxl runs in read-only mode with defusedxml installed (blocks XML bomb tricks), formulas are never evaluated
(data_only) and macros are refused (.xlsm). Nothing in here touches the database.
"""
import csv
import io
import re
import zipfile
from datetime import date, datetime, time

MAX_BYTES = 2 * 1024 * 1024  # 2 MB is ~20,000 rows of text: far more than a school ever imports at once
MAX_ROWS = 1000
_ZIP_MAGIC = b"PK\x03\x04"
_MAX_UNZIPPED = 40 * 1024 * 1024


class UploadError(Exception):
    """A problem with the FILE itself (not with one row). The message is safe to show to the user."""


def norm(text) -> str:
    """'Full name' / 'full_name' / 'FULL-NAME ' all become 'fullname' so headers match loosely."""
    return re.sub(r"[^a-z0-9]", "", str(text or "").lower())


def cell_to_str(v) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else format(v, ".10g")
    if isinstance(v, datetime):
        if v.date() in (date(1899, 12, 30), date(1900, 1, 1)):  # Excel stores a bare time as a date in 1899/1900
            return v.strftime("%H:%M")
        return v.date().isoformat() if v.time() == time(0, 0) else v.strftime("%Y-%m-%d %H:%M")
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, time):
        return v.strftime("%H:%M")
    return str(v).replace("\xa0", " ").strip()


def _read_xlsx(data: bytes):
    if not data.startswith(_ZIP_MAGIC):
        raise UploadError("This does not look like a real .xlsx file. Open it in Excel and use Save As → Excel Workbook (.xlsx).")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos = z.infolist()
            if len(infos) > 300 or sum(i.file_size for i in infos) > _MAX_UNZIPPED:
                raise UploadError("This Excel file is unusually large inside. Please save a clean copy and try again.")
    except zipfile.BadZipFile:
        raise UploadError("This Excel file is damaged and could not be opened.") from None

    from openpyxl import load_workbook

    try:
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception:  # noqa: BLE001 - any parser failure is "not a usable workbook"
        raise UploadError("This Excel file could not be read. Save it again as .xlsx, or export it as .csv.") from None
    try:
        sheets = [s for s in wb.worksheets if getattr(s, "sheet_state", "visible") == "visible"] or wb.worksheets
        sheet = next((s for s in sheets if s.title.strip().lower() == "data"), sheets[0])
        rows = []
        for r in sheet.iter_rows(values_only=True):
            rows.append([cell_to_str(c) for c in r])
            if len(rows) > MAX_ROWS + 60:
                break
        return rows
    finally:
        wb.close()


def _read_csv(data: bytes):
    for enc in ("utf-8-sig", "cp1252"):
        try:
            text = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:  # pragma: no cover - cp1252 decodes almost everything
        raise UploadError("The file's text encoding is not supported. Save it as CSV UTF-8.")
    sample = text[:4096]
    delim = max(",;\t", key=sample.count) if any(d in sample for d in ",;\t") else ","
    return [[cell_to_str(c) for c in row] for row in csv.reader(io.StringIO(text), delimiter=delim)]


def read_table(upload):
    """Return (headers, rows) where rows = [(sheet_row_number, [cells…])] with blank rows removed."""
    name = (getattr(upload, "name", "") or "").lower()
    if getattr(upload, "size", 0) > MAX_BYTES:
        raise UploadError("The file is larger than 2 MB. Split it into smaller files.")
    data = upload.read()
    if len(data) > MAX_BYTES:
        raise UploadError("The file is larger than 2 MB. Split it into smaller files.")
    if not data.strip():
        raise UploadError("The file is empty.")
    if name.endswith(".xlsx"):
        grid = _read_xlsx(data)
    elif name.endswith((".csv", ".tsv", ".txt")):
        grid = _read_csv(data)
    elif name.endswith(".xls"):
        raise UploadError("Old .xls files are not supported. In Excel choose Save As → Excel Workbook (.xlsx) or CSV.")
    elif name.endswith(".xlsm"):
        raise UploadError("Files with macros (.xlsm) are not accepted. Save a copy as .xlsx.")
    else:
        raise UploadError("Please upload an Excel (.xlsx) or CSV (.csv) file.")

    numbered = [(i, row) for i, row in enumerate(grid, start=1) if any(c for c in row)]
    if not numbered:
        raise UploadError("The file has no data.")
    (_, headers), body = numbered[0], numbered[1:]
    if len(body) > MAX_ROWS:
        raise UploadError(f"The file has more than {MAX_ROWS} rows. Split it into several files.")
    return headers, body
