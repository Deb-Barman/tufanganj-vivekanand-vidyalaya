import io
import json
from datetime import date, timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from openpyxl import Workbook, load_workbook
from rest_framework.test import APITestCase

from academics.models import AcademicSession, Attendance, Result, SchoolClass, StudentProfile, Subject, TeacherProfile
from accounts.models import Role, User

PW = "Str0ng-Pass-123"


def csv_file(text, name="data.csv", encoding="utf-8"):
    return SimpleUploadedFile(name, text.encode(encoding), content_type="text/csv")


def xlsx_file(rows, name="data.xlsx", sheet="Data"):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return SimpleUploadedFile(name, buf.getvalue(), content_type="application/octet-stream")


class Base(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("head", PW, role=Role.SUPER_ADMIN, full_name="Head Sir", is_staff=True)
        self.session = AcademicSession.objects.create(label="2026-2027", is_current=True)
        self.klass = SchoolClass.objects.create(name="Class XI", stream="Science", session=self.session)
        self.phys = Subject.objects.create(name="Physics", school_class=self.klass)
        self.client.force_authenticate(self.admin)

    def preview(self, key, f):
        return self.client.post(f"/api/imports/{key}/preview/", {"file": f}, format="multipart")

    def commit(self, key, f, rows):
        return self.client.post(f"/api/imports/{key}/commit/", {"file": f, "rows": json.dumps(rows)}, format="multipart")


class AccessAndSamples(Base):
    def test_only_super_admin(self):
        t = User.objects.create_user("t1", PW, role=Role.TEACHER, full_name="T")
        self.client.force_authenticate(t)
        self.assertEqual(self.client.get("/api/imports/").status_code, 403)
        self.assertEqual(self.preview("students", csv_file("a\n1")).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/imports/").status_code, 401)

    def test_catalog_lists_every_importer(self):
        keys = {i["key"] for i in self.client.get("/api/imports/").json()["imports"]}
        self.assertEqual(keys, {"students", "teachers", "classes", "subjects", "results", "attendance", "teacher_attendance", "events", "exams", "timetable"})

    def test_every_sample_downloads_in_both_formats(self):
        for key in self.client.get("/api/imports/").json()["imports"]:
            k = key["key"]
            csv_resp = self.client.get(f"/api/imports/{k}/sample/?type=csv")
            self.assertEqual(csv_resp.status_code, 200)
            self.assertTrue(csv_resp.content.startswith(b"\xef\xbb\xbf"))  # BOM so Excel shows it correctly
            x = self.client.get(f"/api/imports/{k}/sample/?type=xlsx")
            self.assertEqual(x.status_code, 200)
            wb = load_workbook(io.BytesIO(x.content))
            self.assertEqual(wb.sheetnames, ["Data", "Instructions"])
            self.assertGreaterEqual(wb["Data"].max_row, 2)

    def test_sample_roundtrips_through_preview(self):
        # The sample file the site hands out must itself be readable by the importer (no "missing columns").
        x = self.client.get("/api/imports/classes/sample/?type=xlsx").content
        res = self.preview("classes", SimpleUploadedFile("s.xlsx", x)).json()
        self.assertEqual(res["file_errors"], [])
        self.assertEqual(res["counts"]["valid"], 3)

    def test_unknown_import_and_bad_type(self):
        self.assertEqual(self.client.get("/api/imports/nope/sample/").status_code, 404)
        self.assertEqual(self.client.get("/api/imports/students/sample/?type=pdf").status_code, 400)


class FileHandling(Base):
    def test_rejects_wrong_files(self):
        for name, data in [("a.xls", b"x"), ("a.xlsm", b"x"), ("a.exe", b"MZ"), ("a.xlsx", b"not a zip at all"), ("a.csv", b"")]:
            res = self.preview("classes", SimpleUploadedFile(name, data)).json()
            self.assertTrue(res["file_errors"], name)
            self.assertEqual(res["rows"], [])

    def test_missing_required_column_is_explained(self):
        res = self.preview("students", csv_file("Full name,Class\nAsha,Class XI\n")).json()
        self.assertIn("Username", res["file_errors"][0])

    def test_semicolon_cp1252_and_unknown_columns(self):
        f = csv_file("Class;Stream;Colour\nClass XII;Arts;red\n", encoding="cp1252")
        res = self.preview("classes", f).json()
        self.assertEqual(res["unknown_columns"], ["Colour"])
        self.assertEqual(res["counts"]["valid"], 1)

    def test_excel_cells_numbers_and_dates(self):
        # Excel hands over roll numbers as floats and dates as datetimes — both must come out right.
        from datetime import datetime

        User.objects.create_user("aarav", PW, role=Role.STUDENT, full_name="Aarav")
        f = xlsx_file([["Student username", "Date", "Status"], ["aarav", datetime(2026, 10, 12), "P"]])
        res = self.preview("attendance", f).json()
        self.assertEqual(res["counts"]["valid"], 1, res["rows"])
        self.assertEqual(res["rows"][0]["display"]["date"], "2026-10-12")

    def test_data_sheet_is_preferred_and_blank_rows_skipped(self):
        f = xlsx_file([["Class", "Stream", "Session"], ["Class X", "", ""], [None, None, None], ["Class IX", "", ""]])
        res = self.preview("classes", f).json()
        self.assertEqual(res["total"], 2)
        self.assertEqual([r["row"] for r in res["rows"]], [2, 4])  # row numbers match the spreadsheet

    def test_too_many_rows(self):
        body = "Class\n" + "\n".join(f"C{i}" for i in range(1001))
        res = self.preview("classes", csv_file(body)).json()
        self.assertIn("more than", res["file_errors"][0])


class StudentImport(Base):
    HEADER = "Full name,Username,Password,Class,Stream,Roll number,Guardian name,Guardian contact\n"

    def test_preview_flags_every_kind_of_mistake_and_saves_nothing(self):
        User.objects.create_user("taken", PW, role=Role.STUDENT, full_name="Old")
        before = User.objects.count()
        body = self.HEADER + "\n".join([
            "Good One,good.one,,Class XI,Science,1,Parent,9000000001",
            "Dup Name,taken,,Class XI,Science,2,,",
            "No Class,no.class,,Class IX,,3,,",
            "Short Pass,short.pass,abc,Class XI,Science,4,,",
            "Same,good.one,,Class XI,Science,5,,",
            ",nobody,,Class XI,Science,6,,",
            "Bad Name,has space,,Class XI,Science,7,,",
        ])
        res = self.preview("students", csv_file(body)).json()
        self.assertEqual(User.objects.count(), before)
        self.assertEqual(res["counts"], {"valid": 1, "invalid": 6, "create": 1, "update": 0, "skip": 0})
        errs = {r["row"]: " ".join(r["errors"]) for r in res["rows"]}
        self.assertIn("already exists", errs[3])
        self.assertIn("not found", errs[4])
        self.assertIn("Password", errs[5])
        self.assertIn("twice", errs[6])
        self.assertIn("required", errs[7])
        self.assertIn("Username must be", errs[8])
        # The preview never echoes a typed password back — it only says whether one was provided.
        self.assertEqual({r["display"]["password"] for r in res["rows"]}, {"auto-generated", "provided"})
        self.assertNotIn("abc", [r["display"]["password"] for r in res["rows"]])

    def test_commit_creates_accounts_with_generated_and_typed_passwords(self):
        body = self.HEADER + "Asha Roy,asha.roy,,Class XI,Science,1,Mr Roy,9000000001\nBimal Das,bimal.das,MyTyped-Pass-77,Class XI,Science,2,,\n"
        res = self.commit("students", csv_file(body), [2, 3])
        self.assertEqual(res.status_code, 200, res.content)
        out = res.json()
        self.assertEqual((out["imported"], out["created"]), (2, 2))
        self.assertEqual([c["username"] for c in out["credentials"]], ["asha.roy"])  # only generated ones are returned
        self.assertEqual(res["Cache-Control"], "no-store")
        asha = User.objects.get(username="asha.roy")
        self.assertTrue(asha.check_password(out["credentials"][0]["password"]))
        self.assertEqual(asha.role, Role.STUDENT)
        self.assertFalse(asha.must_change_password)
        sp = StudentProfile.objects.get(user=asha)
        self.assertEqual((sp.school_class, sp.roll_number, sp.guardian_name), (self.klass, "1", "Mr Roy"))
        self.assertTrue(User.objects.get(username="bimal.das").check_password("MyTyped-Pass-77"))

    def test_commit_skips_invalid_rows_and_never_duplicates(self):
        body = self.HEADER + "A One,a.one,,Class XI,Science,1,,\nB Two,b.two,,Class IX,,2,,\n"
        res = self.commit("students", csv_file(body), [2, 3]).json()
        self.assertEqual(res["imported"], 1)
        self.assertEqual([r["row"] for r in res["rejected"]], [3])
        again = self.commit("students", csv_file(body), [2]).json()  # re-uploading the same file is harmless
        self.assertEqual(again["imported"], 0)
        self.assertEqual(User.objects.filter(username="a.one").count(), 1)

    def test_commit_batch_limit_and_bad_rows_param(self):
        body = self.HEADER + "A,a.aaa,,,,,,\n"
        self.assertEqual(self.commit("students", csv_file(body), list(range(2, 40))).status_code, 400)
        self.assertEqual(self.commit("students", csv_file(body), []).status_code, 400)
        res = self.client.post("/api/imports/students/commit/", {"file": csv_file(body), "rows": "oops"}, format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_cannot_create_staff_or_admin_through_import(self):
        body = self.HEADER + "A One,a.one,,Class XI,Science,1,,\n"
        self.commit("students", csv_file(body), [2])
        u = User.objects.get(username="a.one")
        self.assertFalse(u.is_staff or u.is_superuser)


class TeacherImport(Base):
    def test_teachers(self):
        body = "Full name,Username,Department,Years of experience\nSunita Roy,sunita.roy,Physics,12\nBad,bad.exp,Maths,99\n"
        pv = self.preview("teachers", csv_file(body)).json()
        self.assertEqual(pv["counts"]["valid"], 1)
        res = self.commit("teachers", csv_file(body), [2]).json()
        self.assertEqual(res["created"], 1)
        tp = TeacherProfile.objects.get(user__username="sunita.roy")
        self.assertEqual((tp.department, tp.years_experience), ("Physics", 12))
        self.assertEqual(User.objects.get(username="sunita.roy").role, Role.TEACHER)


class AcademicImports(Base):
    def test_classes_and_subjects_are_idempotent(self):
        body = "Class,Stream\nClass XII,Science\nClass XI,Science\n"
        pv = self.preview("classes", csv_file(body)).json()
        self.assertEqual((pv["counts"]["create"], pv["counts"]["skip"]), (1, 1))
        self.assertEqual(self.commit("classes", csv_file(body), [2, 3]).json()["skipped"], 1)
        self.assertEqual(SchoolClass.objects.count(), 2)
        sub = "Subject,Class,Stream\nChemistry,Class XI,Science\nPhysics,Class XI,Science\nBio,Class VII,\n"
        pv = self.preview("subjects", csv_file(sub)).json()
        self.assertEqual((pv["counts"]["create"], pv["counts"]["skip"], pv["counts"]["invalid"]), (1, 1, 1))

    def test_results_validate_and_update(self):
        s = User.objects.create_user("stu", PW, role=Role.STUDENT, full_name="Stu")
        StudentProfile.objects.filter(user=s).update(school_class=self.klass)
        body = "Student username,Subject,Marks obtained,Full marks\nstu,Physics,78,100\nstu,Maths,50,100\nstu,Physics,120,100\nghost,Physics,5,100\n"
        pv = self.preview("results", csv_file(body)).json()
        self.assertEqual(pv["counts"]["valid"], 1)
        self.assertIn("more than full marks", " ".join(pv["rows"][2]["errors"]))
        self.assertTrue(self.commit("results", csv_file(body), [2]).json()["created"])
        r = Result.objects.get()
        self.assertEqual(str(r.marks_obtained), "78.00")
        again = "Student username,Subject,Marks obtained\nstu,Physics,81.5\n"
        self.assertEqual(self.preview("results", csv_file(again)).json()["rows"][0]["action"], "update")
        self.assertEqual(self.commit("results", csv_file(again), [2]).json()["updated"], 1)
        self.assertEqual(Result.objects.count(), 1)
        self.assertEqual(str(Result.objects.get().marks_obtained), "81.50")

    def test_attendance_rules(self):
        s = User.objects.create_user("stu", PW, role=Role.STUDENT, full_name="Stu")
        today, future = timezone.localdate(), timezone.localdate() + timedelta(days=2)
        body = f"Student username,Date,Status\nstu,{today},P\nstu,{future},P\nstu,{today},A\nstu,2026-01-05,maybe\n"
        pv = self.preview("attendance", csv_file(body)).json()
        self.assertEqual(pv["counts"]["valid"], 1)
        self.assertIn("future", " ".join(pv["rows"][1]["errors"]))
        self.assertIn("twice", " ".join(pv["rows"][2]["errors"]))
        self.commit("attendance", csv_file(body), [2])
        self.assertEqual(Attendance.objects.get(student__user=s).status, "PRESENT")
        change = f"Student username,Date,Status\nstu,{today.strftime('%d/%m/%Y')},Absent\n"  # DD/MM/YYYY and a word both work
        self.assertEqual(self.preview("attendance", csv_file(change)).json()["rows"][0]["action"], "update")
        self.commit("attendance", csv_file(change), [2])
        self.assertEqual(Attendance.objects.get(student__user=s).status, "ABSENT")

    def test_teacher_attendance(self):
        t = User.objects.create_user("tea", PW, role=Role.TEACHER, full_name="Tea")
        s = User.objects.create_user("stu", PW, role=Role.STUDENT, full_name="Stu")
        body = f"Teacher username,Date,Status\ntea,2026-10-01,P\nstu,2026-10-01,P\n"
        pv = self.preview("teacher_attendance", csv_file(body)).json()
        self.assertEqual(pv["counts"]["valid"], 1)  # a student username is not accepted here
        self.assertEqual(self.commit("teacher_attendance", csv_file(body), [2]).json()["created"], 1)
        self.assertTrue(s)

    def test_events_exams_timetable(self):
        ev = "Title,Date,Audience\nSports Day,2026-12-05,All\nSports Day,05/12/2026,All\n"
        pv = self.preview("events", csv_file(ev)).json()
        self.assertEqual((pv["counts"]["valid"], pv["counts"]["invalid"]), (1, 1))
        self.assertEqual(self.commit("events", csv_file(ev), [2]).json()["created"], 1)
        self.assertEqual(self.preview("events", csv_file(ev)).json()["rows"][0]["action"], "skip")

        ex = "Exam name,Class,Stream,Subject,Date,Start time\nHalf-yearly,Class XI,Science,Physics,2026-12-10,10:30 AM\nHalf-yearly,Class XI,Science,Maths,2026-12-11,10:30\n"
        pv = self.preview("exams", csv_file(ex)).json()
        self.assertEqual((pv["counts"]["valid"], pv["counts"]["invalid"]), (1, 1))
        self.assertEqual(self.commit("exams", csv_file(ex), [2]).json()["created"], 1)

        tt = "Class,Stream,Day,Period,Start time,End time,Subject,Label\nClass XI,Science,Mon,1,10:00,10:45,Physics,\nClass XI,Science,Monday,2,10:45,10:30,Physics,\nClass XI,Science,Tue,1,10:00,10:45,,\n"
        pv = self.preview("timetable", csv_file(tt)).json()
        self.assertEqual((pv["counts"]["valid"], pv["counts"]["invalid"]), (1, 2))
        self.assertIn("End time", " ".join(pv["rows"][1]["errors"]))
        self.assertIn("Label", " ".join(pv["rows"][2]["errors"]))
        self.assertEqual(self.commit("timetable", csv_file(tt), [2]).json()["created"], 1)

    def test_commit_is_atomic_per_request(self):
        # If anything blows up while saving a batch, none of that batch is kept.
        from unittest import mock

        body = "Class\nA1\nA2\n"
        real = SchoolClass.objects.create
        calls = {"n": 0}

        def flaky(**kw):
            calls["n"] += 1
            if calls["n"] == 2:
                raise RuntimeError("boom")
            return real(**kw)

        with mock.patch.object(SchoolClass.objects, "create", side_effect=flaky):
            res = self.commit("classes", csv_file(body), [2, 3])
        self.assertEqual(res.status_code, 500)  # the API's generic error handler answers; no details leak
        self.assertNotIn("boom", res.content.decode())
        self.assertEqual(SchoolClass.objects.filter(name__in=["A1", "A2"]).count(), 0)
