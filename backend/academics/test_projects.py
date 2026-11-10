"""V21 — projects: a title, details, class, semester, start date and deadline, set by teachers or the Super Admin."""
from datetime import timedelta

from django.utils import timezone

from accounts.models import Role
from config.testing import BaseAPITestCase

from .models import AcademicSession, Project, ProjectCompletion, SchoolClass, StudentProfile, Subject


class ProjectBase(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.make_admin()
        self.teacher = self.make_user("teach1", Role.TEACHER)
        self.other_teacher = self.make_user("teach2", Role.TEACHER)
        self.session = AcademicSession.objects.create(label="2026", is_current=True, working_days=200)
        self.klass = SchoolClass.objects.create(name="Class VI", session=self.session)
        self.other_class = SchoolClass.objects.create(name="Class VII", session=self.session)
        self.subject = Subject.objects.create(name="Science", school_class=self.klass)
        self.foreign_subject = Subject.objects.create(name="Maths", school_class=self.other_class)
        self.stu_user = self.make_user("alice", Role.STUDENT)
        self.stu = StudentProfile.objects.get(user=self.stu_user)
        self.stu.school_class = self.klass
        self.stu.save()
        self.outsider_user = self.make_user("bob", Role.STUDENT)
        outsider = StudentProfile.objects.get(user=self.outsider_user)
        outsider.school_class = self.other_class
        outsider.save()
        self.admin_c, self.teacher_c, self.other_teacher_c = self.login(self.admin), self.login(self.teacher), self.login(self.other_teacher)
        self.stu_c, self.outsider_c = self.login(self.stu_user), self.login(self.outsider_user)
        self.today = timezone.localdate()

    def body(self, **extra):
        body = {
            "school_class": str(self.klass.id),
            "subject": str(self.subject.id),
            "term": "SEM1",
            "title": "Solar system model",
            "details": "Make a working model and write one page about it.",
            "start_date": str(self.today),
            "due_date": str(self.today + timedelta(days=14)),
        }
        body.update(extra)
        return body

    def make(self, **extra):
        res = self.teacher_c.post("/api/academics/projects/", self.body(**extra), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        return res.data


class SettingProjects(ProjectBase):
    def test_teacher_sets_a_project_for_a_class_and_semester(self):
        data = self.make()
        pr = Project.objects.get()
        self.assertEqual((pr.term, pr.school_class_id, pr.created_by_id), ("SEM1", self.klass.id, self.teacher.id))
        self.assertEqual(data["term_label"], "First Semester")
        self.assertEqual(data["phase"], "open")

    def test_super_admin_can_set_one_too_and_subject_is_optional(self):
        res = self.admin_c.post("/api/academics/projects/", self.body(subject=None, term=""), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(Project.objects.get().subject)

    def test_student_cannot_set_a_project(self):
        self.assertEqual(self.stu_c.post("/api/academics/projects/", self.body(), format="json").status_code, 403)

    def test_deadline_cannot_be_before_the_start(self):
        res = self.teacher_c.post("/api/academics/projects/", self.body(due_date=str(self.today - timedelta(days=1))), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("due_date", res.data)

    def test_subject_must_belong_to_the_class(self):
        res = self.teacher_c.post("/api/academics/projects/", self.body(subject=str(self.foreign_subject.id)), format="json")
        self.assertEqual(res.status_code, 400)

    def test_title_is_required_and_html_is_stripped(self):
        self.assertEqual(self.teacher_c.post("/api/academics/projects/", self.body(title="  "), format="json").status_code, 400)
        data = self.make(title="<b>Bold</b> idea", details="<script>alert(1)</script>Plan")
        self.assertNotIn("<", data["title"])
        self.assertNotIn("<script", data["details"])

    def test_unknown_semester_is_refused(self):
        self.assertEqual(self.teacher_c.post("/api/academics/projects/", self.body(term="SEM9"), format="json").status_code, 400)

    def test_phase_follows_the_dates(self):
        self.assertEqual(self.make(start_date=str(self.today + timedelta(days=3)), due_date=str(self.today + timedelta(days=9)))["phase"], "upcoming")
        self.assertEqual(self.make(start_date=str(self.today - timedelta(days=9)), due_date=str(self.today - timedelta(days=2)))["phase"], "closed")


class EditingAndVisibility(ProjectBase):
    def test_teacher_edits_own_project_but_not_a_colleagues(self):
        pid = self.make()["id"]
        self.assertEqual(self.teacher_c.patch(f"/api/academics/projects/{pid}/", {"title": "Renamed"}, format="json").status_code, 200)
        self.assertEqual(self.other_teacher_c.patch(f"/api/academics/projects/{pid}/", {"title": "Hijack"}, format="json").status_code, 404)
        self.assertEqual(self.other_teacher_c.delete(f"/api/academics/projects/{pid}/").status_code, 404)
        self.assertEqual(Project.objects.get().title, "Renamed")

    def test_super_admin_can_change_and_delete_any(self):
        pid = self.make()["id"]
        self.assertEqual(self.admin_c.patch(f"/api/academics/projects/{pid}/", {"details": "New details"}, format="json").status_code, 200)
        self.assertEqual(self.admin_c.delete(f"/api/academics/projects/{pid}/").status_code, 204)
        self.assertEqual(Project.objects.count(), 0)

    def test_student_only_sees_projects_of_their_own_class(self):
        self.make()
        self.make(school_class=str(self.other_class.id), subject=str(self.foreign_subject.id), title="Other class project")
        mine = self.stu_c.get("/api/academics/projects/").data["results"]
        self.assertEqual([p["title"] for p in mine], ["Solar system model"])
        theirs = self.outsider_c.get("/api/academics/projects/").data["results"]
        self.assertEqual([p["title"] for p in theirs], ["Other class project"])

    def test_student_cannot_read_or_change_another_class_project_directly(self):
        pid = self.make(school_class=str(self.other_class.id), subject=str(self.foreign_subject.id))["id"]
        self.assertEqual(self.stu_c.get(f"/api/academics/projects/{pid}/").status_code, 404)
        self.assertEqual(self.stu_c.patch(f"/api/academics/projects/{pid}/", {"title": "x"}, format="json").status_code, 403)
        self.assertEqual(self.stu_c.delete(f"/api/academics/projects/{pid}/").status_code, 403)
        self.assertEqual(Project.objects.get().title, "Solar system model")

    def test_student_cannot_change_their_own_class_project(self):
        pid = self.make()["id"]
        self.assertEqual(self.stu_c.patch(f"/api/academics/projects/{pid}/", {"title": "x"}, format="json").status_code, 403)
        self.assertEqual(self.stu_c.delete(f"/api/academics/projects/{pid}/").status_code, 403)

    def test_staff_can_filter_by_class_and_semester(self):
        self.make(term="SEM1")
        self.make(term="SEM2", title="Second semester project")
        res = self.teacher_c.get(f"/api/academics/projects/?school_class={self.klass.id}&term=SEM2").data["results"]
        self.assertEqual([p["title"] for p in res], ["Second semester project"])

    def test_anonymous_cannot_read(self):
        from rest_framework.test import APIClient

        self.assertEqual(APIClient().get("/api/academics/projects/").status_code, 401)


class TickingAndProgress(ProjectBase):
    def test_student_ticks_and_unticks_while_open(self):
        pid = self.make()["id"]
        self.assertEqual(self.stu_c.post(f"/api/academics/projects/{pid}/done/", {"done": True}, format="json").status_code, 200)
        self.assertTrue(self.stu_c.get("/api/academics/projects/").data["results"][0]["done"])
        self.stu_c.post(f"/api/academics/projects/{pid}/done/", {"done": False}, format="json")
        self.assertEqual(ProjectCompletion.objects.count(), 0)

    def test_tick_is_locked_before_start_and_after_deadline(self):
        future = self.make(start_date=str(self.today + timedelta(days=2)), due_date=str(self.today + timedelta(days=5)))["id"]
        past = self.make(start_date=str(self.today - timedelta(days=9)), due_date=str(self.today - timedelta(days=1)))["id"]
        self.assertEqual(self.stu_c.post(f"/api/academics/projects/{future}/done/", {"done": True}, format="json").status_code, 400)
        self.assertEqual(self.stu_c.post(f"/api/academics/projects/{past}/done/", {"done": True}, format="json").status_code, 400)

    def test_student_cannot_tick_another_class_project_and_staff_cannot_tick(self):
        pid = self.make(school_class=str(self.other_class.id), subject=str(self.foreign_subject.id))["id"]
        self.assertEqual(self.stu_c.post(f"/api/academics/projects/{pid}/done/", {"done": True}, format="json").status_code, 404)
        self.assertEqual(self.teacher_c.post(f"/api/academics/projects/{pid}/done/", {"done": True}, format="json").status_code, 403)

    def test_staff_see_how_many_finished_and_who(self):
        pid = self.make()["id"]
        self.stu_c.post(f"/api/academics/projects/{pid}/done/", {"done": True}, format="json")
        row = self.teacher_c.get("/api/academics/projects/").data["results"][0]
        self.assertEqual((row["submitted"], row["class_size"]), (1, 1))
        who = self.teacher_c.get(f"/api/academics/projects/{pid}/completions/").data
        self.assertEqual([(s["full_name"], s["done"]) for s in who["students"]], [("Alice", True)])

    def test_completions_hidden_from_students_and_other_teachers(self):
        pid = self.make()["id"]
        self.assertEqual(self.stu_c.get(f"/api/academics/projects/{pid}/completions/").status_code, 403)
        self.assertEqual(self.other_teacher_c.get(f"/api/academics/projects/{pid}/completions/").status_code, 404)
        self.assertEqual(self.admin_c.get(f"/api/academics/projects/{pid}/completions/").status_code, 200)

    def test_student_view_hides_class_counts(self):
        self.make()
        row = self.stu_c.get("/api/academics/projects/").data["results"][0]
        self.assertIsNone(row["submitted"])
        self.assertIsNone(row["class_size"])
