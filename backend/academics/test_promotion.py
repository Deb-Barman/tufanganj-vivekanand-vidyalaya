"""Year-end promotion: only chosen students go up, others repeat, Class 12 passes out, nothing old is lost, and it can be undone."""
from datetime import time, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from academics.enrollment import sync_current
from academics.models import AcademicSession, Attendance, ClassEnrollment, Homework, Result, SchoolClass, StudentProfile, Subject, TimetableEntry
from accounts.models import Role, User

PW = "Str0ng-Pass-123"


def mk_student(username, klass, roll=""):
    u = User.objects.create_user(username, PW, role=Role.STUDENT, full_name=username.title())
    StudentProfile.objects.filter(user=u).update(school_class=klass, roll_number=roll)
    sp = StudentProfile.objects.get(user=u)
    sync_current(sp)  # what the post_save signal does when the office sets a class
    return sp


class PromotionTests(APITestCase):
    def setUp(self):
        self.s1 = AcademicSession.objects.create(label="2026-2027", is_current=True, attendance_min_percent=80)
        self.c5 = SchoolClass.objects.create(name="Class 5", session=self.s1)
        self.c10 = SchoolClass.objects.create(name="Class 10", session=self.s1)
        self.c11s = SchoolClass.objects.create(name="Class 11", stream="Science", session=self.s1)
        self.c12 = SchoolClass.objects.create(name="Class 12", stream="Arts", session=self.s1)
        self.eng = Subject.objects.create(name="English", school_class=self.c5)
        self.mat = Subject.objects.create(name="Maths", school_class=self.c5)
        self.teacher = User.objects.create_user("t1", PW, role=Role.TEACHER, full_name="Teacher One")
        self.teacher.teacher_profile.subjects_taught.add(self.eng)
        TimetableEntry.objects.create(school_class=self.c5, weekday=0, period=1, start_time=time(10), end_time=time(11), subject=self.eng, teacher=self.teacher)
        self.a, self.b, self.c = (mk_student(n, self.c5, r) for n, r in (("asha", "1"), ("bimal", "2"), ("chaya", "3")))
        Result.objects.create(student=self.a, subject=self.eng, session=self.s1, term="SEM1", marks_obtained=80, full_marks=100)
        Attendance.objects.create(student=self.a, date=timezone.localdate(), status="PRESENT")
        Homework.objects.create(school_class=self.c5, subject=self.eng, title="Old HW", due_date=timezone.localdate() + timedelta(days=1))
        self.admin = User.objects.create_user("admin1", PW, role=Role.SUPER_ADMIN, full_name="Head", is_staff=True)
        self.client.force_authenticate(self.admin)

    def apply(self, classes, **extra):
        return self.client.post("/api/academics/promotion/apply/", {"to_session_label": "2027-2028", "classes": classes, **extra}, format="json")

    def entry(self, klass, students, **extra):
        return {"class_id": str(klass.id), "students": [{"student_id": str(s.pk), "action": a, **({"stream": st} if st else {})} for s, a, st in students], **extra}

    # ── plan
    def test_plan_suggests_next_session_and_next_class(self):
        d = self.client.get("/api/academics/promotion/plan/").json()
        assert d["suggested_label"] == "2027-2028"
        by = {c["label"]: c for c in d["classes"]}
        assert by["Class 5"]["target"]["name"] == "Class 6" and len(by["Class 5"]["students"]) == 3
        assert by["Class 10"]["target"] == {"name": "Class 11", "stream": "", "passes_out": False, "needs_stream": True, "known": True}
        assert by["Class 11 Science"]["target"]["needs_stream"] is False
        assert by["Class 12 Arts"]["target"]["passes_out"] is True

    # ── the main case: some go up, one stays
    def test_only_chosen_students_go_up_and_old_data_stays(self):
        r = self.apply([self.entry(self.c5, [(self.a, "promote", None), (self.b, "promote", None), (self.c, "repeat", None)])])
        assert r.status_code == 201, r.content
        assert (r.json()["promoted"], r.json()["repeated"]) == (2, 1)
        for sp in (self.a, self.b, self.c):
            sp.refresh_from_db()
        assert str(self.a.school_class) == "Class 6" and self.a.school_class.session.label == "2027-2028"
        assert str(self.c.school_class) == "Class 5" and self.c.school_class.session.label == "2027-2028"  # repeats the year in the NEW session
        assert self.a.school_class_id != self.c.school_class_id
        # new session is current, old one is not
        assert AcademicSession.objects.get(label="2027-2028").is_current and not AcademicSession.objects.get(label="2026-2027").is_current
        assert AcademicSession.objects.get(label="2027-2028").attendance_min_percent == 80
        # NOTHING old is gone
        assert Result.objects.filter(student=self.a, session=self.s1, marks_obtained=80).exists()
        assert Attendance.objects.filter(student=self.a).count() == 1
        assert Homework.objects.filter(school_class=self.c5).exists()
        assert TimetableEntry.objects.filter(school_class=self.c5).exists()
        # history
        hist = {e.school_class.session.label: e for e in ClassEnrollment.objects.filter(student=self.a)}
        assert hist["2026-2027"].outcome == "promoted" and hist["2026-2027"].ended_on
        assert hist["2027-2028"].outcome == "" and hist["2027-2028"].ended_on is None

    def test_new_class_starts_with_last_years_subjects_teachers_and_timetable(self):
        # Class 6 existed last year with subjects → the new Class 6 copies them
        c6_old = SchoolClass.objects.create(name="Class 6", session=AcademicSession.objects.create(label="2025-2026"))
        Subject.objects.create(name="Science", school_class=c6_old)
        self.apply([self.entry(self.c5, [(self.a, "promote", None), (self.b, "repeat", None)])])
        new6 = SchoolClass.objects.get(name="Class 6", session__label="2027-2028")
        assert [s.name for s in new6.subjects.all()] == ["Science"]
        new5 = SchoolClass.objects.get(name="Class 5", session__label="2027-2028")
        assert sorted(s.name for s in new5.subjects.all()) == ["English", "Maths"]
        eng_new = new5.subjects.get(name="English")
        assert self.teacher.teacher_profile.subjects_taught.filter(pk=eng_new.pk).exists()
        entry = TimetableEntry.objects.get(school_class=new5)
        assert entry.subject_id == eng_new.id and entry.teacher_id == self.teacher.id
        assert Subject.objects.get(pk=self.eng.pk).school_class_id == self.c5.id  # old subject untouched

    def test_stream_must_be_chosen_after_class_10_and_is_kept_after_11(self):
        t = mk_student("tara", self.c10)
        r = self.apply([self.entry(self.c10, [(t, "promote", None)])])
        assert r.status_code == 400 and "Science or Arts" in str(r.content)
        assert self.apply([self.entry(self.c10, [(t, "promote", "Arts")])]).status_code == 201
        t.refresh_from_db()
        assert (t.school_class.name, t.school_class.stream) == ("Class 11", "Arts")
        s11 = mk_student("sima", self.c11s)
        AcademicSession.objects.filter(label="2027-2028").update(is_current=True)
        r = self.apply([self.entry(self.c11s, [(s11, "promote", None)])])
        assert r.status_code == 201
        s11.refresh_from_db()
        assert (s11.school_class.name, s11.school_class.stream) == ("Class 12", "Science")

    def test_class_12_passes_out_and_keeps_everything(self):
        g = mk_student("gita", self.c12)
        Result.objects.create(student=g, subject=Subject.objects.create(name="Bangla", school_class=self.c12), session=self.s1, term="SEM1", marks_obtained=70, full_marks=100)
        assert self.apply([self.entry(self.c12, [(g, "promote", None)])]).status_code == 400
        assert self.apply([self.entry(self.c12, [(g, "passed_out", None)])]).status_code == 201
        g.refresh_from_db()
        assert g.is_alumni and g.school_class_id == self.c12.id and g.user.is_active_account
        assert Result.objects.filter(student=g).exists()
        g.user.save()  # a later save must not re-open the class year
        assert ClassEnrollment.objects.get(student=g).outcome == "passed_out"

    def test_only_the_last_class_can_pass_out_and_students_must_be_in_that_class(self):
        assert self.apply([self.entry(self.c5, [(self.a, "passed_out", None)])]).status_code == 400
        assert self.apply([self.entry(self.c10, [(self.a, "repeat", None)])]).status_code == 400

    def test_nothing_changes_when_any_part_is_refused(self):
        r = self.apply([self.entry(self.c5, [(self.a, "promote", None)]), self.entry(self.c10, [(mk_student("x", self.c10), "promote", None)])])
        assert r.status_code == 400
        self.a.refresh_from_db()
        assert self.a.school_class_id == self.c5.id
        assert not SchoolClass.objects.filter(session__label="2027-2028").exists()
        assert AcademicSession.objects.get(label="2026-2027").is_current

    def test_unparsable_class_name_needs_a_target_name(self):
        nur = SchoolClass.objects.create(name="Nursery", session=self.s1)
        n = mk_student("nina", nur)
        assert self.apply([self.entry(nur, [(n, "promote", None)])]).status_code == 400
        assert self.apply([self.entry(nur, [(n, "promote", None)], target_name="Class 1")]).status_code == 201
        n.refresh_from_db()
        assert n.school_class.name == "Class 1"

    def test_same_session_is_refused(self):
        assert self.client.post("/api/academics/promotion/apply/", {"to_session_label": "2026-2027", "classes": [self.entry(self.c5, [(self.a, "promote", None)])]}, format="json").status_code == 400

    # ── student's own view of earlier years
    def test_student_can_still_open_earlier_class_year(self):
        self.apply([self.entry(self.c5, [(self.a, "promote", None)])])
        self.client.force_authenticate(User.objects.get(username="asha"))
        years = self.client.get("/api/academics/my-classes/").json()
        assert [(y["label"], y["session"], y["current"]) for y in years] == [("Class 6", "2027-2028", True), ("Class 5", "2026-2027", False)]
        assert self.client.get("/api/academics/homework/").json()["results" if "results" in self.client.get("/api/academics/homework/").json() else "count"] in ([], 0)  # current class: nothing yet
        old = self.client.get(f"/api/academics/homework/?school_class={self.c5.id}").json()
        rows = old["results"] if isinstance(old, dict) else old
        assert [h["title"] for h in rows] == ["Old HW"]
        tt = self.client.get(f"/api/academics/timetable/?school_class={self.c5.id}").json()
        assert len(tt["results"] if isinstance(tt, dict) else tt) == 1
        # results of the old class are still listed
        res = self.client.get("/api/academics/results/").json()
        assert len(res["results"] if isinstance(res, dict) else res) == 1

    def test_student_cannot_open_a_class_they_never_were_in(self):
        self.apply([self.entry(self.c5, [(self.a, "promote", None)])])
        self.client.force_authenticate(User.objects.get(username="asha"))
        other = SchoolClass.objects.create(name="Class 9", session=self.s1)
        Homework.objects.create(school_class=other, subject=Subject.objects.create(name="X", school_class=other), title="Secret", due_date=timezone.localdate())
        rows = self.client.get(f"/api/academics/homework/?school_class={other.id}").json()
        assert "Secret" not in str(rows)

    def test_manual_class_change_is_recorded_as_history_too(self):
        self.client.patch(f"/api/academics/students/{self.a.pk}/", {"school_class": str(self.c10.id)}, format="json")
        rows = {e.school_class_id: e for e in ClassEnrollment.objects.filter(student=self.a)}
        assert rows[self.c5.id].outcome == "moved" and rows[self.c10.id].ended_on is None

    # ── undo
    def test_undo_puts_everything_back(self):
        g = mk_student("gita", self.c12)
        before = SchoolClass.objects.count()
        r = self.apply([self.entry(self.c5, [(self.a, "promote", None), (self.c, "repeat", None)]), self.entry(self.c12, [(g, "passed_out", None)])])
        batch_id = r.json()["id"]
        assert self.client.get("/api/academics/promotion/batches/").json()[0]["can_undo"] is True
        assert self.client.post(f"/api/academics/promotion/batches/{batch_id}/undo/").status_code == 200
        for sp in (self.a, self.c, g):
            sp.refresh_from_db()
        assert self.a.school_class_id == self.c5.id and self.c.school_class_id == self.c5.id and not g.is_alumni
        assert SchoolClass.objects.count() == before
        assert not AcademicSession.objects.filter(label="2027-2028").exists()
        assert AcademicSession.objects.get(label="2026-2027").is_current
        assert ClassEnrollment.objects.get(student=self.a).ended_on is None
        assert self.client.post(f"/api/academics/promotion/batches/{batch_id}/undo/").status_code == 400

    def test_undo_refused_when_a_student_changed_afterwards(self):
        batch_id = self.apply([self.entry(self.c5, [(self.a, "promote", None)])]).json()["id"]
        self.a.refresh_from_db()
        StudentProfile.objects.filter(pk=self.a.pk).update(school_class=self.c10)
        assert self.client.post(f"/api/academics/promotion/batches/{batch_id}/undo/").status_code == 400

    # ── who may
    def test_only_super_admin(self):
        for user in (self.teacher, User.objects.get(username="asha"), None):
            self.client.force_authenticate(user)
            assert self.client.get("/api/academics/promotion/plan/").status_code in (401, 403)
            assert self.apply([self.entry(self.c5, [(self.a, "promote", None)])]).status_code in (401, 403)
