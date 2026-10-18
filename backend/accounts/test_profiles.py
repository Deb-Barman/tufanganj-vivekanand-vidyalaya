import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from academics.models import AcademicSession, SchoolClass, StudentProfile, TeacherProfile
from accounts.models import PublicProfile, Role, User

PW = "Str0ng-Pass-123"
TMP = tempfile.mkdtemp()


def jpeg_with_gps(size=(1600, 1200)):
    img = Image.new("RGB", size, (200, 30, 30))
    exif = Image.Exif()
    exif[0x010F] = "TestPhone"  # camera make: must not survive
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return SimpleUploadedFile("me.jpg", buf.getvalue(), content_type="image/jpeg")


@override_settings(MEDIA_ROOT=TMP)
class ProfileTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP, ignore_errors=True)

    def setUp(self):
        session = AcademicSession.objects.create(label="2026-2027", is_current=True)
        klass = SchoolClass.objects.create(name="Class XI", stream="Science", session=session)
        self.student = User.objects.create_user("asha", PW, role=Role.STUDENT, full_name="Asha Roy", phone="9111111111", email="asha@example.com")
        StudentProfile.objects.filter(user=self.student).update(school_class=klass, roll_number="7", guardian_name="Secret Guardian", guardian_contact="9222222222")
        self.teacher = User.objects.create_user("mr.sen", PW, role=Role.TEACHER, full_name="Mr Sen", phone="9333333333")
        TeacherProfile.objects.filter(user=self.teacher).update(department="Physics", years_experience=9)
        self.admin = User.objects.create_user("head", PW, role=Role.SUPER_ADMIN, full_name="Head", is_staff=True)
        # reload so cached related rows reflect the updates above, like a real request would
        self.student, self.teacher = User.objects.get(pk=self.student.pk), User.objects.get(pk=self.teacher.pk)

    def as_user(self, u):
        self.client.force_authenticate(u)

    def public(self, role, username):
        self.client.force_authenticate(None)
        return self.client.get(f"/api/auth/profiles/{role}/{username}/")

    # ── editing your own profile
    def test_my_profile_starts_private_with_public_path(self):
        self.as_user(self.student)
        r = self.client.get("/api/auth/me/profile/").json()
        self.assertFalse(r["is_public"])
        self.assertEqual(r["public_path"], "/profile/student/asha")
        self.assertEqual(r["class_label"], "Class XI Science")
        self.as_user(self.admin)
        self.assertIsNone(self.client.get("/api/auth/me/profile/").json()["public_path"])

    def test_requires_login_to_edit(self):
        self.assertEqual(self.client.get("/api/auth/me/profile/").status_code, 401)
        self.assertEqual(self.client.patch("/api/auth/me/profile/", {"about": "x"}, format="json").status_code, 401)

    def test_patch_cleans_and_validates(self):
        self.as_user(self.student)
        body = {"headline": "<b>Future</b> engineer", "about": "I love <script>alert(1)</script>robots", "talents": ["Chess", "chess", " Drawing ", ""], "interests": ["AI"], "website": "https://example.org/asha"}
        r = self.client.patch("/api/auth/me/profile/", body, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        d = r.json()
        self.assertEqual(d["headline"], "Future engineer")
        self.assertNotIn("<script>", d["about"])
        self.assertEqual(d["talents"], ["Chess", "Drawing"])

    def test_private_contact_details_are_refused(self):
        self.as_user(self.student)
        for field, value in [("about", "call me on 98765 43210"), ("background", "mail me at asha@example.com"), ("headline", "+91 98765-43210"), ("talents", ["9876543210"])]:
            r = self.client.patch("/api/auth/me/profile/", {field: value}, format="json")
            self.assertEqual(r.status_code, 400, field)
        # a year or marks are fine
        self.assertEqual(self.client.patch("/api/auth/me/profile/", {"achievements": "State quiz 2025, scored 94 of 100"}, format="json").status_code, 200)

    def test_limits_and_website(self):
        self.as_user(self.student)
        self.assertEqual(self.client.patch("/api/auth/me/profile/", {"talents": [f"t{i}" for i in range(13)]}, format="json").status_code, 400)
        self.assertEqual(self.client.patch("/api/auth/me/profile/", {"talents": ["x" * 41]}, format="json").status_code, 400)
        self.assertEqual(self.client.patch("/api/auth/me/profile/", {"website": "http://insecure.example"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch("/api/auth/me/profile/", {"website": "javascript:alert(1)"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch("/api/auth/me/profile/", {"about": "a" * 1201}, format="json").status_code, 400)

    def test_admin_cannot_publish(self):
        self.as_user(self.admin)
        self.assertEqual(self.client.patch("/api/auth/me/profile/", {"is_public": True}, format="json").status_code, 400)

    # ── the public page
    def test_hidden_until_owner_opts_in(self):
        self.as_user(self.student)
        self.client.patch("/api/auth/me/profile/", {"headline": "Hi"}, format="json")
        self.assertEqual(self.public("student", "asha").status_code, 404)
        self.as_user(self.student)
        self.client.patch("/api/auth/me/profile/", {"is_public": True}, format="json")
        self.assertEqual(self.public("student", "asha").status_code, 200)

    def test_public_page_never_leaks_private_data(self):
        self.as_user(self.student)
        self.client.patch("/api/auth/me/profile/", {"is_public": True, "about": "Hello", "talents": ["Chess"]}, format="json")
        resp = self.public("student", "asha")
        raw = resp.content.decode()
        for secret in ("9111111111", "asha@example.com", "Secret Guardian", "9222222222", "roll", "phone", "email", "guardian", "password", "marks", "attendance"):
            self.assertNotIn(secret.lower(), raw.lower(), secret)
        d = resp.json()
        self.assertEqual((d["full_name"], d["class_label"], d["talents"]), ("Asha Roy", "Class XI Science", ["Chess"]))
        self.assertIn("max-age", resp["Cache-Control"])

    def test_teacher_page_shows_department_only(self):
        self.as_user(self.teacher)
        self.client.patch("/api/auth/me/profile/", {"is_public": True, "headline": "Physics teacher"}, format="json")
        d = self.public("teacher", "mr.sen").json()
        self.assertEqual((d["department"], d["years_experience"]), ("Physics", 9))
        self.assertNotIn("9333333333", str(d))

    def test_all_the_ways_it_must_404(self):
        for u in (self.student, self.teacher, self.admin):
            PublicProfile.objects.update_or_create(user=u, defaults={"is_public": True})
        self.assertEqual(self.public("student", "mr.sen").status_code, 404)  # right username, wrong role in the URL
        self.assertEqual(self.public("teacher", "asha").status_code, 404)
        self.assertEqual(self.public("student", "nobody").status_code, 404)
        self.assertEqual(self.public("admin", "head").status_code, 404)  # no public page for the Super Admin
        self.assertEqual(self.public("student", "head").status_code, 404)
        self.student.is_active_account = False
        self.student.save()
        self.assertEqual(self.public("student", "asha").status_code, 404)  # disabled account disappears
        # …and a private profile / a missing user give the SAME answer, so usernames can't be probed
        a, b = self.public("student", "nobody").json(), self.public("teacher", "asha").json()
        self.assertEqual(a, b)

    def test_public_endpoint_ignores_bad_tokens(self):
        PublicProfile.objects.update_or_create(user=self.student, defaults={"is_public": True})
        r = self.client.get("/api/auth/profiles/student/asha/", HTTP_AUTHORIZATION="Bearer garbage")
        self.assertEqual(r.status_code, 200)

    def test_admin_can_hide_from_django_admin_action(self):
        from django.contrib import admin as dj_admin
        from django.test import RequestFactory

        PublicProfile.objects.update_or_create(user=self.student, defaults={"is_public": True})
        ma = dj_admin.site._registry[PublicProfile]
        ma.message_user = lambda *a, **k: None
        ma.hide_from_public(RequestFactory().post("/"), PublicProfile.objects.all())
        self.assertEqual(self.public("student", "asha").status_code, 404)

    # ── photo
    def test_photo_upload_is_cleaned_and_replaceable(self):
        self.as_user(self.student)
        r = self.client.post("/api/auth/me/profile/photo/", {"photo": jpeg_with_gps()}, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        profile = PublicProfile.objects.get(user=self.student)
        first = profile.photo.name
        with Image.open(profile.photo.path) as img:
            self.assertLessEqual(max(img.size), 800)
            self.assertFalse(dict(img.getexif()))  # camera/GPS metadata is gone
        self.client.post("/api/auth/me/profile/photo/", {"photo": jpeg_with_gps((300, 300))}, format="multipart")
        profile.refresh_from_db()
        self.assertNotEqual(profile.photo.name, first)
        self.assertFalse(profile.photo.storage.exists(first))  # old file deleted
        self.assertEqual(self.client.delete("/api/auth/me/profile/photo/").json(), {"photo": None})
        profile.refresh_from_db()
        self.assertFalse(profile.photo)

    def test_photo_rejects_non_images_and_wrong_types(self):
        self.as_user(self.student)
        for name, data, ctype in [("a.jpg", b"not an image", "image/jpeg"), ("a.gif", b"GIF89a", "image/gif"), ("a.svg", b"<svg onload=alert(1)/>", "image/svg+xml")]:
            r = self.client.post("/api/auth/me/profile/photo/", {"photo": SimpleUploadedFile(name, data, content_type=ctype)}, format="multipart")
            self.assertEqual(r.status_code, 400, name)
        self.assertEqual(self.client.post("/api/auth/me/profile/photo/", {}, format="multipart").status_code, 400)

    def test_photo_shown_on_public_page(self):
        self.as_user(self.student)
        self.client.post("/api/auth/me/profile/photo/", {"photo": jpeg_with_gps((200, 200))}, format="multipart")
        self.client.patch("/api/auth/me/profile/", {"is_public": True}, format="json")
        self.assertTrue(self.public("student", "asha").json()["photo"])
