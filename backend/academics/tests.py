import datetime

from rest_framework.test import APIClient

from accounts.models import Role
from config.testing import BaseAPITestCase

from .models import AcademicSession, Attendance, Marksheet, Result, SchoolClass, StudentProfile, Subject


class AcademicsBase(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.make_admin()
        self.teacher = self.make_user("teach1", Role.TEACHER)
        self.alice_user = self.make_user("alice", Role.STUDENT)
        self.bob_user = self.make_user("bob", Role.STUDENT)
        self.alice = StudentProfile.objects.get(user=self.alice_user)  # created by the signal
        self.bob = StudentProfile.objects.get(user=self.bob_user)
        self.session = AcademicSession.objects.create(label="2026", is_current=True)
        self.klass = SchoolClass.objects.create(name="Class XI", stream="Science", session=self.session)
        self.subject = Subject.objects.create(name="Physics", school_class=self.klass)
        self.alice_c, self.bob_c = self.login(self.alice_user), self.login(self.bob_user)
        self.teacher_c, self.admin_c = self.login(self.teacher), self.login(self.admin)
        Attendance.objects.create(student=self.alice, date=datetime.date(2026, 10, 1), status="PRESENT")
        Attendance.objects.create(student=self.bob, date=datetime.date(2026, 10, 1), status="ABSENT")


class StudentProfileTests(AcademicsBase):
    def test_signal_made_profiles_for_new_students(self):
        self.assertEqual(StudentProfile.objects.count(), 2)

    def test_staff_see_all_students_a_student_sees_only_themselves(self):
        self.assertEqual(self.teacher_c.get("/api/academics/students/").data["count"], 2)
        res = self.alice_c.get("/api/academics/students/")
        self.assertEqual([str(r["user"]) for r in res.data["results"]], [str(self.alice_user.id)])

    def test_student_cannot_open_another_students_profile(self):
        self.assertEqual(self.alice_c.get(f"/api/academics/students/{self.bob_user.id}/").status_code, 404)

    def test_only_super_admin_can_edit_a_profile(self):
        url = f"/api/academics/students/{self.alice_user.id}/"
        body = {"roll_number": "12", "school_class": str(self.klass.id)}
        self.assertEqual(self.alice_c.patch(url, body, format="json").status_code, 403)
        self.assertEqual(self.teacher_c.patch(url, body, format="json").status_code, 403)
        self.assertEqual(self.admin_c.patch(url, body, format="json").status_code, 200)


class AttendanceIsolationTests(AcademicsBase):
    def test_student_sees_only_own_attendance(self):
        res = self.alice_c.get("/api/academics/attendance/")
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["status"], "PRESENT")

    def test_student_cannot_widen_query_with_student_param(self):
        res = self.alice_c.get(f"/api/academics/attendance/?student={self.bob_user.id}")
        self.assertEqual([r["status"] for r in res.data["results"]], ["PRESENT"])

    def test_student_cannot_read_edit_or_delete_by_guessing_ids(self):
        bobs = Attendance.objects.get(student=self.bob)
        url = f"/api/academics/attendance/{bobs.id}/"
        self.assertEqual(self.alice_c.get(url).status_code, 403)
        self.assertEqual(self.alice_c.patch(url, {"status": "PRESENT"}, format="json").status_code, 403)
        self.assertEqual(self.alice_c.delete(url).status_code, 403)

    def test_student_cannot_mark_attendance(self):
        res = self.alice_c.post("/api/academics/attendance/", {"student": str(self.alice_user.id), "date": "2026-10-02", "status": "PRESENT"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_teacher_can_mark_attendance_and_is_recorded_as_marker(self):
        res = self.teacher_c.post("/api/academics/attendance/", {"student": str(self.alice_user.id), "date": "2026-10-02", "status": "ABSENT"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(str(res.data["marked_by"]), str(self.teacher.id))

    def test_duplicate_day_is_rejected(self):
        res = self.teacher_c.post("/api/academics/attendance/", {"student": str(self.alice_user.id), "date": "2026-10-01", "status": "ABSENT"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_anonymous_gets_401(self):
        self.assertEqual(APIClient().get("/api/academics/attendance/").status_code, 401)


class ResultsAndMarksheetTests(AcademicsBase):
    def result_body(self, **kw):
        return {"student": str(self.alice_user.id), "subject": str(self.subject.id), "session": str(self.session.id),
                "marks_obtained": "80", "full_marks": "100", **kw}

    def test_marks_cannot_exceed_full_marks_or_be_negative(self):
        self.assertEqual(self.teacher_c.post("/api/academics/results/", self.result_body(marks_obtained="101"), format="json").status_code, 400)
        self.assertEqual(self.teacher_c.post("/api/academics/results/", self.result_body(marks_obtained="-1"), format="json").status_code, 400)
        self.assertEqual(self.teacher_c.post("/api/academics/results/", self.result_body(), format="json").status_code, 201)

    def test_student_sees_only_own_results_and_cannot_write(self):
        Result.objects.create(student=self.alice, subject=self.subject, session=self.session, marks_obtained=70)
        Result.objects.create(student=self.bob, subject=self.subject, session=self.session, marks_obtained=60)
        self.assertEqual(self.alice_c.get("/api/academics/results/").data["count"], 1)
        self.assertEqual(self.alice_c.post("/api/academics/results/", self.result_body(), format="json").status_code, 403)

    def test_student_cannot_view_other_marksheet_or_delete_own(self):
        mine = Marksheet.objects.create(student=self.alice, session=self.session)
        theirs = Marksheet.objects.create(student=self.bob, session=AcademicSession.objects.create(label="2027"))
        self.assertEqual(self.alice_c.get(f"/api/academics/marksheets/{theirs.id}/").status_code, 404)
        self.assertEqual(self.alice_c.get(f"/api/academics/marksheets/{mine.id}/").status_code, 200)
        self.assertEqual(self.alice_c.delete(f"/api/academics/marksheets/{mine.id}/").status_code, 403)
        self.assertTrue(Marksheet.objects.filter(pk=mine.pk).exists())

    def test_only_super_admin_creates_marksheets(self):
        self.assertEqual(self.teacher_c.post("/api/academics/marksheets/create/", {"student": str(self.alice_user.id), "session": str(self.session.id)}, format="json").status_code, 403)
        self.assertEqual(self.admin_c.post("/api/academics/marksheets/create/", {"student": str(self.alice_user.id), "session": str(self.session.id)}, format="json").status_code, 201)


class FacultyTests(AcademicsBase):
    def test_public_faculty_list_hides_user_ids(self):
        res = APIClient().get("/api/academics/teachers/public/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        self.assertNotIn("user", res.data["results"][0])
        self.assertEqual(res.data["results"][0]["full_name"], "Teach1")


class ReferenceDataTests(AcademicsBase):
    def test_super_admin_can_edit_and_delete_class_subject_session(self):
        r = self.admin_c.patch(f"/api/academics/classes/{self.klass.id}/", {"stream": "Arts"}, format="json")
        self.assertEqual(r.status_code, 200)
        r = self.admin_c.patch(f"/api/academics/subjects/{self.subject.id}/", {"name": "Chemistry"}, format="json")
        self.assertEqual(r.data["name"], "Chemistry")
        self.assertEqual(self.admin_c.delete(f"/api/academics/subjects/{self.subject.id}/").status_code, 204)
        self.assertEqual(self.admin_c.patch(f"/api/academics/sessions/{self.session.id}/", {"label": "2026-27"}, format="json").status_code, 200)

    def test_teachers_and_students_can_read_but_not_change_reference_data(self):
        for c in (self.teacher_c, self.alice_c):
            self.assertEqual(c.get("/api/academics/classes/").status_code, 200)
            self.assertEqual(c.patch(f"/api/academics/classes/{self.klass.id}/", {"stream": "x"}, format="json").status_code, 403)
            self.assertEqual(c.delete(f"/api/academics/subjects/{self.subject.id}/").status_code, 403)

    def test_filters(self):
        other = SchoolClass.objects.create(name="Class XII", stream="Science", session=self.session)
        Subject.objects.create(name="Maths", school_class=other)
        self.assertEqual(self.admin_c.get(f"/api/academics/subjects/?school_class={other.id}").data["count"], 1)
        self.assertEqual(self.admin_c.get(f"/api/academics/classes/?session={self.session.id}").data["count"], 2)

    def test_student_filters_by_class_and_search_for_staff_only(self):
        StudentProfile.objects.filter(pk=self.alice_user.pk).update(school_class=self.klass, roll_number="7")
        self.assertEqual(self.teacher_c.get(f"/api/academics/students/?school_class={self.klass.id}").data["count"], 1)
        self.assertEqual(self.teacher_c.get("/api/academics/students/?school_class=none").data["count"], 1)
        self.assertEqual(self.teacher_c.get("/api/academics/students/?search=bob").data["count"], 1)
        self.assertEqual(self.alice_c.get("/api/academics/students/?search=bob").data["count"], 1)  # still only herself

    def test_page_size_can_be_raised_but_is_capped(self):
        res = self.admin_c.get("/api/academics/students/?page_size=500")
        self.assertEqual(res.status_code, 200)


class BulkEntryTests(AcademicsBase):
    def test_bulk_attendance_creates_then_updates(self):
        body = {"date": "2026-10-05", "records": [
            {"student": str(self.alice_user.id), "status": "PRESENT"},
            {"student": str(self.bob_user.id), "status": "ABSENT"}]}
        self.assertEqual(self.teacher_c.post("/api/academics/attendance/bulk/", body, format="json").data["saved"], 2)
        body["records"][1]["status"] = "PRESENT"
        self.teacher_c.post("/api/academics/attendance/bulk/", body, format="json")
        self.assertEqual(Attendance.objects.filter(date="2026-10-05").count(), 2)
        self.assertEqual(Attendance.objects.get(student=self.bob, date="2026-10-05").status, "PRESENT")

    def test_bulk_attendance_rejects_students_and_bad_status(self):
        body = {"date": "2026-10-05", "records": [{"student": str(self.alice_user.id), "status": "PRESENT"}]}
        self.assertEqual(self.alice_c.post("/api/academics/attendance/bulk/", body, format="json").status_code, 403)
        body["records"][0]["status"] = "LATE"
        self.assertEqual(self.teacher_c.post("/api/academics/attendance/bulk/", body, format="json").status_code, 400)
        self.assertEqual(self.teacher_c.post("/api/academics/attendance/bulk/", {"date": "2026-10-05", "records": []}, format="json").status_code, 400)

    def test_attendance_date_and_class_filters(self):
        StudentProfile.objects.filter(pk=self.alice_user.pk).update(school_class=self.klass)
        self.assertEqual(self.teacher_c.get("/api/academics/attendance/?date=2026-10-01").data["count"], 2)
        self.assertEqual(self.teacher_c.get(f"/api/academics/attendance/?school_class={self.klass.id}").data["count"], 1)

    def test_bulk_results_validate_and_upsert(self):
        body = {"subject": str(self.subject.id), "session": str(self.session.id), "full_marks": "50",
                "records": [{"student": str(self.alice_user.id), "marks_obtained": "45"}, {"student": str(self.bob_user.id), "marks_obtained": "30.5"}]}
        self.assertEqual(self.teacher_c.post("/api/academics/results/bulk/", body, format="json").data["saved"], 2)
        body["records"][0]["marks_obtained"] = "48"
        self.teacher_c.post("/api/academics/results/bulk/", body, format="json")
        self.assertEqual(Result.objects.count(), 2)
        self.assertEqual(str(Result.objects.get(student=self.alice).marks_obtained), "48.00")

    def test_bulk_results_reject_marks_above_full_and_all_or_nothing(self):
        body = {"subject": str(self.subject.id), "session": str(self.session.id), "full_marks": "50",
                "records": [{"student": str(self.alice_user.id), "marks_obtained": "40"}, {"student": str(self.bob_user.id), "marks_obtained": "51"}]}
        self.assertEqual(self.teacher_c.post("/api/academics/results/bulk/", body, format="json").status_code, 400)
        self.assertEqual(Result.objects.count(), 0)
        self.assertEqual(self.alice_c.post("/api/academics/results/bulk/", body, format="json").status_code, 403)

    def test_super_admin_can_edit_teacher_profile(self):
        res = self.admin_c.patch(f"/api/academics/teachers/{self.teacher.id}/", {"department": "Physics", "years_experience": 8}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.teacher_c.patch(f"/api/academics/teachers/{self.teacher.id}/", {"department": "x"}, format="json").status_code, 403)


class CurrentSessionTests(AcademicsBase):
    def test_only_one_session_is_current(self):
        other = self.admin_c.post("/api/academics/sessions/", {"label": "2027", "is_current": True}, format="json")
        self.assertEqual(other.status_code, 201)
        self.session.refresh_from_db()
        self.assertFalse(self.session.is_current)
        self.admin_c.patch(f"/api/academics/sessions/{self.session.id}/", {"is_current": True}, format="json")
        self.assertEqual(AcademicSession.objects.filter(is_current=True).count(), 1)
        self.assertTrue(AcademicSession.objects.get(label="2026").is_current)


class MarksheetUploadTests(AcademicsBase):
    def post(self, name, data, ctype):
        from django.core.files.uploadedfile import SimpleUploadedFile
        f = SimpleUploadedFile(name, data, content_type=ctype)
        return self.admin_c.post("/api/academics/marksheets/create/", {"student": str(self.alice_user.id), "session": str(self.session.id), "file": f}, format="multipart")

    def test_pdf_is_accepted(self):
        self.assertEqual(self.post("m.pdf", b"%PDF-1.4 hello", "application/pdf").status_code, 201)

    def test_html_or_exe_disguised_as_pdf_is_rejected(self):
        self.assertEqual(self.post("m.pdf", b"<html><script>alert(1)</script>", "application/pdf").status_code, 400)
        self.assertEqual(self.post("m.pdf", b"MZ\x90\x00 exe", "application/pdf").status_code, 400)

    def test_marksheet_without_file_is_still_allowed(self):
        res = self.admin_c.post("/api/academics/marksheets/create/", {"student": str(self.alice_user.id), "session": str(self.session.id)}, format="json")
        self.assertEqual(res.status_code, 201)


class ClassroomBase(AcademicsBase):
    def setUp(self):
        super().setUp()
        StudentProfile.objects.filter(pk=self.alice_user.pk).update(school_class=self.klass)
        self.other_class = SchoolClass.objects.create(name="Class XII", stream="Arts", session=self.session)
        self.other_subject = Subject.objects.create(name="History", school_class=self.other_class)
        self.hw_body = {"school_class": str(self.klass.id), "subject": str(self.subject.id), "title": "Chapter 3 questions", "details": "Do Q1-Q5", "due_date": "2030-01-10"}


class TimetableTests(ClassroomBase):
    def entry(self, **kw):
        body = {"school_class": str(self.klass.id), "weekday": 0, "period": 1, "start_time": "09:00", "end_time": "09:45", "subject": str(self.subject.id), "teacher": str(self.teacher.id), "room": "Lab 1"}
        body.update(kw)
        return body

    def test_only_super_admin_edits_and_everyone_reads_their_own(self):
        self.assertEqual(self.admin_c.post("/api/academics/timetable/", self.entry(), format="json").status_code, 201)
        self.assertEqual(self.teacher_c.post("/api/academics/timetable/", self.entry(period=2), format="json").status_code, 403)
        self.assertEqual(self.alice_c.post("/api/academics/timetable/", self.entry(period=2), format="json").status_code, 403)
        self.assertEqual(self.alice_c.get("/api/academics/timetable/").data["count"], 1)

    def test_student_only_sees_their_own_class_timetable(self):
        self.admin_c.post("/api/academics/timetable/", self.entry(), format="json")
        self.admin_c.post("/api/academics/timetable/", self.entry(school_class=str(self.other_class.id), subject=str(self.other_subject.id)), format="json")
        self.assertEqual(self.admin_c.get("/api/academics/timetable/").data["count"], 2)
        self.assertEqual(self.alice_c.get("/api/academics/timetable/").data["count"], 1)
        self.assertEqual(self.bob_c.get("/api/academics/timetable/").data["count"], 0)  # no class -> nothing

    def test_validation(self):
        self.assertEqual(self.admin_c.post("/api/academics/timetable/", self.entry(end_time="08:00"), format="json").status_code, 400)
        self.assertEqual(self.admin_c.post("/api/academics/timetable/", self.entry(subject=None, label=""), format="json").status_code, 400)
        self.assertEqual(self.admin_c.post("/api/academics/timetable/", self.entry(subject=str(self.other_subject.id)), format="json").status_code, 400)
        self.assertEqual(self.admin_c.post("/api/academics/timetable/", self.entry(teacher=str(self.alice_user.id)), format="json").status_code, 400)
        self.assertEqual(self.admin_c.post("/api/academics/timetable/", self.entry(subject=None, label="Break", teacher=None), format="json").status_code, 201)
        self.assertEqual(self.admin_c.post("/api/academics/timetable/", self.entry(), format="json").status_code, 400)  # same slot again

    def test_teacher_can_filter_to_their_own_periods(self):
        self.admin_c.post("/api/academics/timetable/", self.entry(), format="json")
        self.admin_c.post("/api/academics/timetable/", self.entry(period=2, teacher=None), format="json")
        self.assertEqual(self.teacher_c.get("/api/academics/timetable/?mine=1").data["count"], 1)


class HomeworkTests(ClassroomBase):
    def test_teacher_sets_homework_student_cannot(self):
        res = self.teacher_c.post("/api/academics/homework/", self.hw_body, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(self.alice_c.post("/api/academics/homework/", self.hw_body, format="json").status_code, 403)

    def test_subject_must_belong_to_the_class(self):
        bad = {**self.hw_body, "subject": str(self.other_subject.id)}
        self.assertEqual(self.teacher_c.post("/api/academics/homework/", bad, format="json").status_code, 400)

    def test_student_sees_only_own_class_and_can_tick_done(self):
        hw = self.teacher_c.post("/api/academics/homework/", self.hw_body, format="json").data
        self.teacher_c.post("/api/academics/homework/", {**self.hw_body, "school_class": str(self.other_class.id), "subject": str(self.other_subject.id)}, format="json")
        items = self.alice_c.get("/api/academics/homework/").data["results"]
        self.assertEqual(len(items), 1)
        self.assertIs(items[0]["done"], False)
        self.assertIsNone(items[0]["submitted"])  # students never see class-wide counts
        self.assertEqual(self.alice_c.post(f"/api/academics/homework/{hw['id']}/done/", {"done": True}, format="json").status_code, 200)
        self.assertIs(self.alice_c.get("/api/academics/homework/").data["results"][0]["done"], True)
        staff = self.teacher_c.get(f"/api/academics/homework/?school_class={self.klass.id}").data["results"][0]
        self.assertEqual((staff["submitted"], staff["class_size"], staff["done"]), (1, 1, None))
        self.alice_c.post(f"/api/academics/homework/{hw['id']}/done/", {"done": False}, format="json")
        self.assertIs(self.alice_c.get("/api/academics/homework/").data["results"][0]["done"], False)

    def test_student_cannot_tick_another_class_homework_or_edit(self):
        other = self.teacher_c.post("/api/academics/homework/", {**self.hw_body, "school_class": str(self.other_class.id), "subject": str(self.other_subject.id)}, format="json").data
        self.assertEqual(self.alice_c.post(f"/api/academics/homework/{other['id']}/done/", {"done": True}, format="json").status_code, 404)
        mine = self.teacher_c.post("/api/academics/homework/", self.hw_body, format="json").data
        self.assertEqual(self.alice_c.patch(f"/api/academics/homework/{mine['id']}/", {"title": "x"}, format="json").status_code, 403)
        self.assertEqual(self.alice_c.delete(f"/api/academics/homework/{mine['id']}/").status_code, 403)
        self.assertEqual(self.teacher_c.post(f"/api/academics/homework/{mine['id']}/done/", {"done": True}, format="json").status_code, 403)

    def test_teacher_edits_only_own_homework_admin_edits_any(self):
        mine = self.teacher_c.post("/api/academics/homework/", self.hw_body, format="json").data
        second = self.make_user("teach2", "TEACHER")
        t2 = self.login(second)
        self.assertEqual(t2.patch(f"/api/academics/homework/{mine['id']}/", {"title": "hijack"}, format="json").status_code, 404)
        self.assertEqual(self.teacher_c.patch(f"/api/academics/homework/{mine['id']}/", {"title": "Updated"}, format="json").status_code, 200)
        self.assertEqual(self.admin_c.delete(f"/api/academics/homework/{mine['id']}/").status_code, 204)

    def test_html_in_title_is_stripped(self):
        res = self.teacher_c.post("/api/academics/homework/", {**self.hw_body, "title": "<b>Read</b> & write"}, format="json")
        self.assertEqual(res.data["title"], "Read & write")


class ExamTests(ClassroomBase):
    body = {"name": "Unit Test II", "date": "2030-02-02", "start_time": "10:00", "room": "Hall"}

    def make(self, **kw):
        return {**self.body, "school_class": str(self.klass.id), "subject": str(self.subject.id), **kw}

    def test_staff_schedule_students_read_own_class_only(self):
        self.assertEqual(self.teacher_c.post("/api/academics/exams/", self.make(), format="json").status_code, 201)
        self.admin_c.post("/api/academics/exams/", self.make(school_class=str(self.other_class.id), subject=str(self.other_subject.id)), format="json")
        self.assertEqual(self.alice_c.get("/api/academics/exams/").data["count"], 1)
        self.assertEqual(self.alice_c.post("/api/academics/exams/", self.make(), format="json").status_code, 403)
        self.assertEqual(self.admin_c.get("/api/academics/exams/").data["count"], 2)

    def test_upcoming_filter_and_subject_class_check(self):
        self.teacher_c.post("/api/academics/exams/", self.make(date="2001-01-01"), format="json")
        self.teacher_c.post("/api/academics/exams/", self.make(), format="json")
        self.assertEqual(self.alice_c.get("/api/academics/exams/?upcoming=1").data["count"], 1)
        self.assertEqual(self.teacher_c.post("/api/academics/exams/", self.make(subject=str(self.other_subject.id)), format="json").status_code, 400)

    def test_student_cannot_change_or_delete(self):
        ex = self.teacher_c.post("/api/academics/exams/", self.make(), format="json").data
        self.assertEqual(self.alice_c.patch(f"/api/academics/exams/{ex['id']}/", {"name": "x"}, format="json").status_code, 403)
        self.assertEqual(self.alice_c.delete(f"/api/academics/exams/{ex['id']}/").status_code, 403)
        self.assertEqual(self.teacher_c.delete(f"/api/academics/exams/{ex['id']}/").status_code, 204)
