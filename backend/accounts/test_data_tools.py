import json
import os
import shutil
import tempfile
from datetime import timedelta

from django.core.files.base import ContentFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from academics.models import AcademicSession, Attendance, SchoolClass, StudentProfile
from accounts.models import Role, User
from content.models import Admission, GalleryImage

PW = "Str0ng-Pass-123"
TMP = tempfile.mkdtemp()


def F(field, op, value=""):
    return {"field": field, "op": op, "value": value}


@override_settings(MEDIA_ROOT=TMP)
class DataToolsTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.create_user("head", PW, role=Role.SUPER_ADMIN, full_name="Head", is_staff=True)
        self.client.force_authenticate(self.admin)
        for i, (name, status) in enumerate([("Asha", "PENDING"), ("Bimal", "PENDING"), ("Chitra", "CLOSED"), ("Dev", "CONTACTED")]):
            Admission.objects.create(applicant_name=name, guardian_contact=f"900000000{i}", applying_for_class="Class V", status=status, message="hello" if i % 2 == 0 else "")

    def rows(self, key, **params):
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        r = self.client.get(f"/api/auth/admin/data/{key}/?{qs}")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def names(self, filters, key="content.admission"):
        d = self.rows(key, filters=json.dumps(filters))
        return sorted(r["applicant_name"] for r in d["results"])

    # ── filters
    def test_columns_describe_their_filters(self):
        cols = {c["name"]: c for c in self.rows("content.admission")["columns"]}
        self.assertEqual(cols["status"]["filter"], "choice")
        self.assertIn({"value": "PENDING", "label": "Pending"}, cols["status"]["choices"])
        self.assertEqual(cols["applicant_name"]["filter"], "text")
        self.assertEqual(cols["submitted_at"]["filter"], "datetime")
        self.assertEqual(cols["id"]["filter"], "id")

    def test_text_filters(self):
        self.assertEqual(self.names([F("applicant_name", "contains", "it")]), ["Chitra"])
        self.assertEqual(self.names([F("applicant_name", "equals", "bimal")]), ["Bimal"])
        self.assertEqual(self.names([F("applicant_name", "startswith", "d")]), ["Dev"])
        self.assertEqual(self.names([F("message", "empty")]), ["Bimal", "Dev"])
        self.assertEqual(self.names([F("message", "not_empty")]), ["Asha", "Chitra"])

    def test_choice_filters_and_combining(self):
        self.assertEqual(self.names([F("status", "eq", "PENDING")]), ["Asha", "Bimal"])
        self.assertEqual(self.names([F("status", "eq", "PENDING"), F("applicant_name", "contains", "as")]), ["Asha"])  # AND
        r = self.client.get("/api/auth/admin/data/content.admission/?filters=" + json.dumps([F("status", "eq", "NOPE")]))
        self.assertEqual(r.status_code, 400)

    def test_date_filters(self):
        old = Admission.objects.get(applicant_name="Dev")
        Admission.objects.filter(pk=old.pk).update(submitted_at=timezone.now() - timedelta(days=40))
        cutoff = (timezone.localdate() - timedelta(days=10)).isoformat()
        self.assertEqual(self.names([F("submitted_at", "until", cutoff)]), ["Dev"])
        self.assertEqual(self.names([F("submitted_at", "from", cutoff)]), ["Asha", "Bimal", "Chitra"])
        self.assertEqual(self.client.get("/api/auth/admin/data/content.admission/?filters=" + json.dumps([F("submitted_at", "from", "yesterday")])).status_code, 400)

    def test_number_bool_and_id_filters(self):
        s = AcademicSession.objects.create(label="2026-2027", is_current=True, working_days=200)
        AcademicSession.objects.create(label="2025-2026", working_days=150)
        d = self.rows("academics.academicsession", filters=json.dumps([F("working_days", "gt", "160")]))
        self.assertEqual([r["label"] for r in d["results"]], ["2026-2027"])
        d = self.rows("academics.academicsession", filters=json.dumps([F("is_current", "is_false")]))
        self.assertEqual([r["label"] for r in d["results"]], ["2025-2026"])
        d = self.rows("academics.academicsession", filters=json.dumps([F("id", "eq", str(s.pk))]))
        self.assertEqual(d["count"], 1)
        self.assertEqual(self.client.get("/api/auth/admin/data/academics.academicsession/?filters=" + json.dumps([F("working_days", "gt", "abc")])).status_code, 400)
        self.assertEqual(self.client.get("/api/auth/admin/data/academics.academicsession/?filters=" + json.dumps([F("id", "eq", "not-a-uuid")])).status_code, 400)

    def test_filter_validation(self):
        bad = [
            [F("password", "contains", "x")],  # hidden column
            [F("nope", "contains", "x")],
            [F("applicant_name", "gt", "1")],  # operator does not fit the column
            [F("status", "contains", "P")],
            [F("applicant_name", "contains", "a")] * 9,  # too many
        ]
        for f in bad:
            r = self.client.get("/api/auth/admin/data/content.admission/?filters=" + json.dumps(f))
            self.assertEqual(r.status_code, 400, f)
        self.assertEqual(self.client.get("/api/auth/admin/data/content.admission/?filters=%7Bnot-json").status_code, 400)
        self.assertEqual(self.client.get("/api/auth/admin/data/accounts.user/?filters=" + json.dumps([F("password", "contains", "x")])).status_code, 400)

    def test_export_honours_filters(self):
        r = self.client.get("/api/auth/admin/data/content.admission/export/?filters=" + json.dumps([F("status", "eq", "CLOSED")]))
        text = r.content.decode()
        self.assertIn("Chitra", text)
        self.assertNotIn("Asha", text)

    # ── delete: safety
    def post(self, action, key, body):
        return self.client.post(f"/api/auth/admin/data/{key}/{action}/", body, format="json")

    def ids(self, *names):
        return [str(a.pk) for a in Admission.objects.filter(applicant_name__in=names)]

    def test_only_super_admin(self):
        t = User.objects.create_user("t1", PW, role=Role.TEACHER, full_name="T")
        self.client.force_authenticate(t)
        self.assertEqual(self.post("delete", "content.admission", {"ids": self.ids("Asha"), "confirm": "DELETE"}).status_code, 403)
        self.assertEqual(self.post("delete-preview", "content.admission", {"ids": self.ids("Asha")}).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.post("delete", "content.admission", {"ids": []}).status_code, 401)

    def test_confirmation_is_required(self):
        for body in ({"ids": self.ids("Asha")}, {"ids": self.ids("Asha"), "confirm": "yes"}, {"ids": self.ids("Asha"), "confirm": "delete"}):
            self.assertEqual(self.post("delete", "content.admission", body).status_code, 400)
        self.assertEqual(Admission.objects.count(), 4)

    def test_bad_input(self):
        for body in ({}, {"ids": []}, {"ids": "x"}, {"ids": ["not-a-uuid"], "confirm": "DELETE"}, {"ids": [str(i) for i in range(501)], "confirm": "DELETE"}):
            self.assertEqual(self.post("delete", "content.admission", {**body, "confirm": "DELETE"}).status_code, 400, body)
        self.assertEqual(self.post("delete", "auth.user", {"ids": ["1"], "confirm": "DELETE"}).status_code, 404)  # only the school's own apps
        self.assertEqual(self.post("delete", "sessions.session", {"ids": ["1"], "confirm": "DELETE"}).status_code, 404)

    def test_preview_changes_nothing_then_delete_by_ids(self):
        ids = self.ids("Asha", "Bimal")
        pv = self.post("delete-preview", "content.admission", {"ids": ids}).json()
        self.assertEqual((pv["count"], pv["blocked_count"], pv["error"]), (2, 0, None))
        self.assertEqual(sorted(pv["samples"]), ["Asha", "Bimal"])  # readable names, not "Admission object (…)"
        self.assertEqual(Admission.objects.count(), 4)
        r = self.post("delete", "content.admission", {"ids": ids, "confirm": "DELETE"}).json()
        self.assertEqual(r["deleted"], 2)
        self.assertEqual(sorted(Admission.objects.values_list("applicant_name", flat=True)), ["Chitra", "Dev"])

    def test_delete_all_matching_filter(self):
        body = {"scope": "filtered", "filters": [F("status", "eq", "PENDING")]}
        self.assertEqual(self.post("delete-preview", "content.admission", body).json()["count"], 2)
        self.assertEqual(self.post("delete", "content.admission", {**body, "confirm": "DELETE"}).json()["deleted"], 2)
        self.assertEqual(Admission.objects.count(), 2)
        # no filter at all = everything that matches the (empty) search
        self.assertEqual(self.post("delete-preview", "content.admission", {"scope": "filtered", "q": "Chitra"}).json()["count"], 1)

    def test_filtered_delete_is_capped(self):
        from unittest import mock

        from accounts import console_views

        with mock.patch.object(console_views, "MAX_DELETE_FILTERED", 3):
            r = self.post("delete-preview", "content.admission", {"scope": "filtered"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("Narrow", r.json()["detail"])
        self.assertEqual(Admission.objects.count(), 4)

    def test_protected_accounts_and_session(self):
        other_admin = User.objects.create_user("deputy", PW, role=Role.SUPER_ADMIN, full_name="Deputy")
        staff_teacher = User.objects.create_user("stf", PW, role=Role.TEACHER, full_name="Staff T", is_staff=True)
        normal = User.objects.create_user("norm", PW, role=Role.STUDENT, full_name="Norm")
        ids = [str(u.pk) for u in (self.admin, other_admin, staff_teacher, normal)]
        pv = self.post("delete-preview", "accounts.user", {"ids": ids}).json()
        self.assertEqual((pv["count"], pv["blocked_count"]), (1, 3))
        self.assertTrue(any("own account" in b["reason"] for b in pv["blocked"]))
        self.post("delete", "accounts.user", {"ids": ids, "confirm": "DELETE"})
        self.assertEqual(sorted(User.objects.values_list("username", flat=True)), ["deputy", "head", "stf"])
        cur = AcademicSession.objects.create(label="2026-2027", is_current=True)
        r = self.post("delete", "academics.academicsession", {"ids": [str(cur.pk)], "confirm": "DELETE"}).json()
        self.assertEqual(r["deleted"], 0)
        self.assertTrue(AcademicSession.objects.filter(pk=cur.pk).exists())

    def test_cascade_is_shown_before_and_applied(self):
        session = AcademicSession.objects.create(label="2026-2027", is_current=True)
        klass = SchoolClass.objects.create(name="Class XI", stream="Science", session=session)
        stu = User.objects.create_user("stu", PW, role=Role.STUDENT, full_name="Stu")
        StudentProfile.objects.filter(user=stu).update(school_class=klass)
        for i in range(3):
            Attendance.objects.create(student_id=stu.pk, date=timezone.localdate() - timedelta(days=i), status="PRESENT")
        pv = self.post("delete-preview", "accounts.user", {"ids": [str(stu.pk)]}).json()
        also = {a["name"]: a["count"] for a in pv["also"]}
        self.assertEqual(also.get("Attendance Records") or also.get("Attendances"), 3)
        self.assertEqual(Attendance.objects.count(), 3)
        r = self.post("delete", "accounts.user", {"ids": [str(stu.pk)], "confirm": "DELETE"}).json()
        self.assertEqual(r["deleted"], 1)
        self.assertEqual(Attendance.objects.count(), 0)
        self.assertFalse(StudentProfile.objects.filter(pk=stu.pk).exists())

    # ── files are removed with their record
    def test_deleting_a_record_removes_its_file(self):
        g = GalleryImage.objects.create(caption="x", image=ContentFile(b"abc", name="p.jpg"))
        path = g.image.path
        self.assertTrue(os.path.exists(path))
        with self.captureOnCommitCallbacks(execute=True):
            self.post("delete", "content.galleryimage", {"ids": [str(g.pk)], "confirm": "DELETE"})
        self.assertFalse(GalleryImage.objects.exists())
        self.assertFalse(os.path.exists(path))

    def test_normal_delete_from_a_page_also_removes_the_file(self):
        g = GalleryImage.objects.create(caption="y", image=ContentFile(b"abc", name="q.jpg"))
        path = g.image.path
        with self.captureOnCommitCallbacks(execute=True):
            g.delete()
        self.assertFalse(os.path.exists(path))

    def test_storage_view_is_absent_without_supabase(self):
        self.assertEqual(self.client.get("/api/auth/admin/data/storage.objects/").status_code, 404)
        self.assertEqual(self.post("delete-preview", "storage.objects", {"ids": ["a.png"]}).status_code, 404)
