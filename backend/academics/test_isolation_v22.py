"""V22 — one student can never see or change another student's records (nor a teacher's), whatever URL or filter is tried."""
from datetime import date

from accounts.models import Role
from config.testing import BaseAPITestCase

from .models import AcademicSession, Attendance, Marksheet, Result, SchoolClass, StudentProfile, Subject


class StudentIsolationTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.make_admin()
        self.teacher = self.make_user("teach1", Role.TEACHER)
        self.session = AcademicSession.objects.create(label="2026", is_current=True, working_days=200)
        self.klass = SchoolClass.objects.create(name="Class VI", session=self.session)
        self.subject = Subject.objects.create(name="Science", school_class=self.klass)
        self.a_user, self.b_user = self.make_user("alice", Role.STUDENT), self.make_user("bob", Role.STUDENT)
        self.a, self.b = StudentProfile.objects.get(user=self.a_user), StudentProfile.objects.get(user=self.b_user)
        for s in (self.a, self.b):
            s.school_class = self.klass
            s.save()
        self.att_b = Attendance.objects.create(student=self.b, date=date(2026, 7, 1), status="PRESENT", marked_by=self.teacher)
        self.res_b = Result.objects.create(student=self.b, subject=self.subject, session=self.session, marks_obtained=88)
        self.ms_b = Marksheet.objects.create(student=self.b, session=self.session, file_link="https://example.com/m.pdf")
        self.alice = self.login(self.a_user)

    def _ids(self, url):
        res = self.alice.get(url)
        self.assertEqual(res.status_code, 200, url)
        rows = res.data["results"] if isinstance(res.data, dict) and "results" in res.data else res.data
        return [str(r["id"]) for r in rows]

    def test_lists_show_only_my_own_rows_even_if_i_ask_for_someone_elses(self):
        for url, mine in (
            ("/api/academics/attendance/", str(self.att_b.id)),
            (f"/api/academics/attendance/?student={self.b.pk}", str(self.att_b.id)),
            ("/api/academics/results/", str(self.res_b.id)),
            (f"/api/academics/results/?student={self.b.pk}", str(self.res_b.id)),
            ("/api/academics/marksheets/", str(self.ms_b.id)),
            (f"/api/academics/marksheets/?student={self.b.pk}", str(self.ms_b.id)),
        ):
            self.assertNotIn(mine, self._ids(url), url)

    def test_a_classmates_records_cannot_be_opened_or_changed_by_id(self):
        for url in (f"/api/academics/attendance/{self.att_b.id}/", f"/api/academics/results/{self.res_b.id}/", f"/api/academics/marksheets/{self.ms_b.id}/"):
            self.assertIn(self.alice.get(url).status_code, (403, 404), url)
            self.assertIn(self.alice.patch(url, {"status": "ABSENT", "marks_obtained": 100}, format="json").status_code, (403, 404, 405), url)
            self.assertIn(self.alice.delete(url).status_code, (403, 404, 405), url)
        self.res_b.refresh_from_db()
        self.assertEqual(float(self.res_b.marks_obtained), 88.0)
        self.assertTrue(Attendance.objects.filter(pk=self.att_b.pk).exists())

    def test_a_student_cannot_write_records_for_anyone(self):
        body = {"student": str(self.a.pk), "subject": str(self.subject.id), "session": str(self.session.id), "marks_obtained": 100, "term": "SEM1"}
        self.assertEqual(self.alice.post("/api/academics/results/", body, format="json").status_code, 403)
        self.assertEqual(self.alice.post("/api/academics/attendance/", {"student": str(self.a.pk), "date": "2026-07-02", "status": "PRESENT"}, format="json").status_code, 403)

    def test_student_profile_of_a_classmate_is_not_readable_or_editable(self):
        res = self.alice.get(f"/api/academics/students/{self.b.pk}/")
        self.assertIn(res.status_code, (403, 404))
        self.assertIn(self.alice.patch(f"/api/academics/students/{self.b.pk}/", {"guardian_phone": "1"}, format="json").status_code, (403, 404))

    def test_teacher_attendance_is_private_to_the_teacher_and_the_head(self):
        self.assertEqual(self.alice.get("/api/academics/teacher-attendance/").status_code, 403)
        self.assertEqual(self.alice.get("/api/academics/teacher-attendance/sheet/").status_code, 403)
        self.assertEqual(self.alice.get("/api/auth/admin/users/").status_code, 403)
        self.assertEqual(self.alice.get("/api/auth/console/").status_code in (403, 404), True)
