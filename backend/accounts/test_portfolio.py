"""Student portfolio: skills / projects / achievements, the owner's section switches, and the two school-record
sections (results, attendance) that appear on the public page ONLY when the student switches them on."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from academics.models import AcademicSession, Attendance, Homework, HomeworkCompletion, Result, SchoolClass, StudentProfile, Subject
from accounts.models import PublicProfile, Role, User

PW = "Str0ng-Pass-123"


class PortfolioTests(APITestCase):
    def setUp(self):
        s5 = AcademicSession.objects.create(label="2025-2026")
        s6 = AcademicSession.objects.create(label="2026-2027", is_current=True)
        self.c5 = SchoolClass.objects.create(name="Class 5", session=s5)
        self.c6 = SchoolClass.objects.create(name="Class 6", session=s6)
        self.eng5 = Subject.objects.create(name="English", school_class=self.c5)
        self.ben5 = Subject.objects.create(name="Bangla", school_class=self.c5)
        self.eng6 = Subject.objects.create(name="English", school_class=self.c6)
        self.user = User.objects.create_user("riju", PW, role=Role.STUDENT, full_name="Riju Barman", phone="9111111111")
        StudentProfile.objects.filter(user=self.user).update(school_class=self.c6, roll_number="9", guardian_name="Secret Guardian")
        self.user = User.objects.get(pk=self.user.pk)
        self.sp = self.user.student_profile
        for subject, session, term, got in [(self.eng5, s5, "SEM1", 99), (self.ben5, s5, "SEM1", 66), (self.eng5, s5, "SEM2", 54), (self.eng6, s6, "SEM1", 80)]:
            Result.objects.create(student=self.sp, subject=subject, session=session, term=term, marks_obtained=got, full_marks=100)
        self.client.force_authenticate(self.user)
        self.client.patch("/api/auth/me/profile/", {"is_public": True, "headline": "Hi"}, format="json")
        self.client.force_authenticate(None)

    def me(self, body):
        self.client.force_authenticate(self.user)
        r = self.client.patch("/api/auth/me/profile/", body, format="json")
        self.client.force_authenticate(None)
        return r

    def public(self):
        self.client.force_authenticate(None)
        return self.client.get("/api/auth/profiles/student/riju/")

    # ── privacy defaults
    def test_marks_and_attendance_are_hidden_until_switched_on(self):
        Attendance.objects.create(student=self.sp, date=timezone.localdate(), status="PRESENT")
        d = self.public().json()
        self.assertNotIn("results", d)
        self.assertNotIn("attendance", d)
        self.assertFalse(self.client.force_authenticate(self.user) or self.client.get("/api/auth/me/profile/").json()["visibility"]["results"])

    def test_summary_results_show_percentages_but_no_subjects_or_marks(self):
        self.me({"visibility": {"results": True}})
        res = self.public().json()["results"]
        self.assertEqual(res["mode"], "summary")
        self.assertEqual([c["class_label"] for c in res["classes"]], ["Class 5", "Class 6"])
        sem1 = res["classes"][0]["semesters"][0]
        self.assertEqual((sem1["label"], sem1["percent"], sem1["subject_count"]), ("First Semester", 83, 2))
        raw = str(res)
        self.assertNotIn("Bangla", raw)
        self.assertNotIn("subjects", sem1)
        self.assertNotIn("got", sem1)

    def test_full_results_list_every_subject_per_class_and_semester(self):
        self.me({"visibility": {"results": True}, "results_mode": "full"})
        res = self.public().json()["results"]
        c5 = res["classes"][0]
        self.assertEqual([s["label"] for s in c5["semesters"]], ["First Semester", "Second Semester"])
        self.assertEqual([(x["name"], x["got"], x["percent"]) for x in c5["semesters"][0]["subjects"]], [("Bangla", 66.0, 66), ("English", 99.0, 99)])
        self.assertEqual(res["top_subjects"][0]["name"], "English")
        self.assertEqual(res["classes"][1]["semesters"][0]["percent"], 80)

    def test_attendance_calendar_streaks_and_homework_habit(self):
        today = timezone.localdate()
        for i, st in enumerate(["PRESENT", "PRESENT", "ABSENT", "PRESENT", "PRESENT", "PRESENT"]):
            Attendance.objects.create(student=self.sp, date=today - timedelta(days=6 - i), status=st)
        hw = [Homework.objects.create(school_class=self.c6, subject=self.eng6, title=f"HW{i}", due_date=today - timedelta(days=2 + i)) for i in range(4)]
        HomeworkCompletion.objects.create(homework=hw[0], student=self.sp)
        HomeworkCompletion.objects.create(homework=hw[1], student=self.sp)
        self.me({"visibility": {"attendance": True}})
        a = self.public().json()["attendance"]
        self.assertEqual((a["present"], a["absent"], a["total"], a["percent"]), (5, 1, 6, 83))
        self.assertEqual((a["current_streak"], a["longest_streak"]), (3, 3))
        self.assertEqual(len(a["days"]), 6)
        self.assertEqual(a["homework"], {"done": 2, "total": 4, "percent": 50})

    def test_private_data_never_appears_even_with_everything_on(self):
        self.me({"visibility": {"results": True, "attendance": True}, "results_mode": "full"})
        raw = self.public().content.decode().lower()
        for secret in ("9111111111", "secret guardian", "guardian", "roll_number", "phone", "email"):
            self.assertNotIn(secret, raw, secret)

    def test_only_the_owner_decides_and_a_private_profile_still_404s(self):
        self.me({"visibility": {"results": True}})
        PublicProfile.objects.filter(user=self.user).update(is_public=False)
        self.assertEqual(self.public().status_code, 404)

    # ── section switches hide content on the SERVER
    def test_hidden_sections_are_emptied_by_the_server(self):
        self.me({"about": "Secret story", "talents": ["Chess"], "city": "Tufanganj", "projects": "old text",
                 "visibility": {"about": False, "skills": False, "quick_facts": False, "projects": False}})
        d = self.public().json()
        self.assertEqual((d["about"], d["talents"], d["city"], d["projects"]), ("", [], "", ""))
        self.assertEqual(d["headline"], "Hi")

    # ── validation
    def test_skills_projects_achievements_are_cleaned(self):
        r = self.me({
            "skills": [{"name": " Python ", "level": 4}, {"name": "python", "level": 2}, {"name": "Drawing", "level": 5}],
            "project_list": [{"title": "Weather bot", "summary": "Tells the weather", "link": "github.com/riju/weather", "tags": ["Python", "python", "API"]}],
            "achievement_items": [{"title": "Science fair", "year": "2026", "kind": "award", "detail": "2nd prize"}],
            "learning": ["Machine learning"],
        })
        self.assertEqual(r.status_code, 200, r.content)
        d = self.public().json()
        self.assertEqual([x["name"] for x in d["skills"]], ["Python", "Drawing"])
        self.assertEqual(d["project_list"][0]["link"], "https://github.com/riju/weather")
        self.assertEqual(d["project_list"][0]["tags"], ["Python", "API"])
        self.assertEqual(d["achievement_items"][0]["kind"], "award")
        self.assertEqual(d["learning"], ["Machine learning"])

    def test_bad_input_is_refused(self):
        bad = [
            {"skills": [{"name": "Python", "level": 9}]},
            {"project_list": [{"title": "X", "link": "javascript:alert(1)"}]},
            {"project_list": [{"title": "X", "summary": "call 9876543210 now"}]},
            {"project_list": [{"title": "X", "link": "http://10.0.0.1/admin"}]},
            {"achievement_items": [{"title": "X", "year": "1850"}]},
            {"achievement_items": [{"title": "X", "kind": "hack"}]},
            {"visibility": {"password": True}},
            {"visibility": {"results": "yes"}},
            {"results_mode": "everything"},
            {"project_list": [{"title": f"P{i}"} for i in range(9)]},
        ]
        for body in bad:
            self.assertEqual(self.me(body).status_code, 400, body)
