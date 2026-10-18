from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Role, User
from academics.models import AcademicSession, Attendance, SchoolClass, StudentProfile, TeacherAttendance
from academics.reports import attendance_figures

PW = "Str0ng-Pass-123"


class FiguresTests(APITestCase):
    def test_percentages_against_total_working_days(self):
        f = attendance_figures(present=8, absent=2, held_days=10, working_days=200, min_percent=75)
        self.assertEqual((f["percent"], f["percent_of_total"], f["days_left"], f["best_possible_percent"], f["status"]), (80.0, 4.0, 190, 99.0, "ok"))

    def test_low_and_critical(self):
        self.assertEqual(attendance_figures(6, 4, 10, 200, 75)["status"], "low")  # 60% so far but can still recover
        f = attendance_figures(2, 8, 10, 20, 75)  # only 10 days left: best case 12/20 = 60% < 75%
        self.assertEqual((f["best_possible_percent"], f["status"]), (60.0, "critical"))

    def test_no_data_and_no_working_days_set(self):
        self.assertEqual(attendance_figures(0, 0, 0, 200, 75)["status"], "no_data")
        f = attendance_figures(9, 1, 10, None, 75)
        self.assertEqual((f["percent"], f["percent_of_total"], f["days_left"], f["status"]), (90.0, None, None, "ok"))


class ReportEndpointTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("head", PW, role=Role.SUPER_ADMIN, full_name="Head", is_staff=True)
        self.session = AcademicSession.objects.create(label="2026-2027", is_current=True, working_days=200, attendance_min_percent=75)
        self.klass = SchoolClass.objects.create(name="Class XI", stream="Science", session=self.session)
        self.s1 = User.objects.create_user("good", PW, role=Role.STUDENT, full_name="Good Student")
        self.s2 = User.objects.create_user("poor", PW, role=Role.STUDENT, full_name="Poor Student")
        self.s3 = User.objects.create_user("new", PW, role=Role.STUDENT, full_name="No Records")
        StudentProfile.objects.filter(user__in=[self.s1, self.s2, self.s3]).update(school_class=self.klass)
        today = timezone.localdate()
        for i in range(10):
            day = today - timedelta(days=i)
            Attendance.objects.create(student_id=self.s1.pk, date=day, status="PRESENT")
            Attendance.objects.create(student_id=self.s2.pk, date=day, status="PRESENT" if i < 5 else "ABSENT")
        self.client.force_authenticate(self.admin)

    def test_students_report_sorted_worst_first(self):
        d = self.client.get("/api/academics/attendance-report/?kind=students").json()
        self.assertEqual(d["session"]["working_days"], 200)
        s = d["summary"]
        self.assertEqual((s["people"], s["days_held"], s["days_left"], s["percent_of_session_done"]), (3, 10, 190, 5.0))
        by = {r["username"]: r for r in d["rows"]}
        self.assertEqual((by["good"]["percent"], by["good"]["percent_of_total"], by["good"]["status"]), (100.0, 5.0, "ok"))
        self.assertEqual((by["poor"]["percent"], by["poor"]["status"]), (50.0, "low"))
        self.assertEqual(by["new"]["status"], "no_data")
        self.assertEqual(d["rows"][0]["username"], "poor")  # needs attention goes first
        self.assertEqual((s["low"], s["no_data"], s["ok"]), (1, 1, 1))

    def test_class_filter_and_start_date(self):
        other = SchoolClass.objects.create(name="Class XII", stream="Arts", session=self.session)
        StudentProfile.objects.filter(user=self.s3).update(school_class=other)
        d = self.client.get(f"/api/academics/attendance-report/?kind=students&school_class={other.id}").json()
        self.assertEqual([r["username"] for r in d["rows"]], ["new"])
        self.session.start_date = timezone.localdate() - timedelta(days=2)  # only the last 3 days count
        self.session.save()
        d = self.client.get("/api/academics/attendance-report/?kind=students").json()
        self.assertEqual(d["summary"]["days_held"], 3)

    def test_teachers_report(self):
        t = User.objects.create_user("tea", PW, role=Role.TEACHER, full_name="Tea")
        TeacherAttendance.objects.create(teacher=t, date=timezone.localdate(), status="PRESENT")
        d = self.client.get("/api/academics/attendance-report/?kind=teachers").json()
        self.assertEqual((d["rows"][0]["username"], d["rows"][0]["percent"]), ("tea", 100.0))

    def test_disabled_people_are_left_out(self):
        self.s2.is_active_account = False
        self.s2.save()
        names = [r["username"] for r in self.client.get("/api/academics/attendance-report/?kind=students").json()["rows"]]
        self.assertNotIn("poor", names)

    def test_only_super_admin_and_bad_input(self):
        self.client.force_authenticate(self.s1)
        self.assertEqual(self.client.get("/api/academics/attendance-report/").status_code, 403)
        self.client.force_authenticate(User.objects.create_user("t", PW, role=Role.TEACHER, full_name="T"))
        self.assertEqual(self.client.get("/api/academics/attendance-report/").status_code, 403)
        self.client.force_authenticate(self.admin)
        for q in ("kind=parents", "session=abc", "school_class=abc"):
            self.assertEqual(self.client.get(f"/api/academics/attendance-report/?{q}").status_code, 400, q)

    def test_session_settings_are_validated(self):
        r = self.client.patch(f"/api/academics/sessions/{self.session.id}/", {"working_days": 200, "attendance_min_percent": 80, "start_date": "2026-06-01"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["working_days"], 200)
        for bad in ({"working_days": 0}, {"working_days": 400}, {"attendance_min_percent": 101}):
            self.assertEqual(self.client.patch(f"/api/academics/sessions/{self.session.id}/", bad, format="json").status_code, 400, bad)
