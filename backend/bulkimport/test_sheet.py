"""V21 — the in-browser "type it like Excel" sheet posts a CSV that looks exactly like this (see sheetHelpers.ts gridToCsv)."""
import json

from django.core.files.uploadedfile import SimpleUploadedFile

from academics.models import StudentProfile
from accounts.models import User

from .tests import Base

HEADER = ["Full name", "Username", "Password", "Class", "Stream", "Session", "Roll number", "Guardian name", "Guardian contact", "Phone", "Email"]


def sheet_csv(rows):
    """Same shape the browser sends: BOM, CRLF, every cell quoted, blank rows kept (so row numbers line up)."""
    q = lambda v: '"' + v.replace('"', '""') + '"'  # noqa: E731
    lines = [",".join(q(h) for h in HEADER)] + [",".join(q(c) for c in r) for r in rows]
    return SimpleUploadedFile("typed-data.csv", ("\ufeff" + "\r\n".join(lines)).encode("utf-8"), content_type="text/csv")


def student(name, username, klass="Class XI", stream="Science", roll="", guardian="", contact="", phone=""):
    return [name, username, "", klass, stream, "", roll, guardian, contact, phone, ""]


class TypedSheetTests(Base):
    def test_row_numbers_follow_the_sheet_even_with_blank_and_bad_rows(self):
        rows = [
            student("Asha Roy", "asha.roy", roll="1", guardian='Mr. "Bimal" Roy, Sr.', contact="+919876543210"),
            [""] * len(HEADER),  # an empty line in the sheet
            student("Wrong Class", "wrong.class", klass="Class XX"),
        ]
        res = self.preview("students", sheet_csv(rows)).json()
        self.assertEqual(res["file_errors"], [])
        by_row = {r["row"]: r for r in res["rows"]}
        self.assertEqual(sorted(by_row), [2, 4])  # grid index 0 -> row 2, grid index 2 -> row 4 (blank row 3 is skipped, not renumbered)
        self.assertTrue(by_row[2]["ok"], by_row[2])
        self.assertFalse(by_row[4]["ok"])
        self.assertTrue(any("Class XX" in m or "class" in m.lower() for m in by_row[4]["errors"]))

    def test_commit_saves_typed_rows_and_keeps_awkward_text_intact(self):
        rows = [student("Asha Roy", "asha.roy", roll="1", guardian='Mr. "Bimal" Roy, Sr.', contact="+919876543210", phone="09876543210")]
        res = self.commit("students", sheet_csv(rows), [2])
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual((body["created"], len(body["credentials"])), (1, 1))
        profile = StudentProfile.objects.get(user__username="asha.roy")
        self.assertEqual(profile.guardian_name, 'Mr. "Bimal" Roy, Sr.')
        self.assertEqual(profile.guardian_contact, "+919876543210")  # no stray apostrophe in front of the +
        self.assertEqual(profile.school_class_id, self.klass.id)

    def test_resending_the_same_sheet_does_not_duplicate(self):
        rows = [student("Asha Roy", "asha.roy", roll="1")]
        self.commit("students", sheet_csv(rows), [2])
        again = self.preview("students", sheet_csv(rows)).json()
        self.assertEqual(again["counts"]["create"], 0)
        self.commit("students", sheet_csv(rows), [2])
        self.assertEqual(User.objects.filter(username="asha.roy").count(), 1)

    def test_only_the_label_row_is_required(self):
        res = self.preview("students", sheet_csv([])).json()
        self.assertEqual(res["total"], 0)

    def test_commit_rows_payload_is_still_validated(self):
        res = self.client.post("/api/imports/students/commit/", {"file": sheet_csv([student("A B", "a.b")]), "rows": json.dumps([])}, format="multipart")
        self.assertEqual(res.status_code, 400)
