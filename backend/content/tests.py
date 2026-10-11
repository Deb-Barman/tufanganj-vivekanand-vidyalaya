import io

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import Role
from config.testing import BaseAPITestCase

from .models import Article


def png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buf, "PNG")
    return buf.getvalue()


class ArticleTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin_client = self.login(self.make_admin())

    def make(self, title, published=True):
        return self.admin_client.post("/api/content/articles/", {"title": title, "body": "text", "published": published}, format="json")

    def test_bengali_titles_get_real_unique_slugs(self):
        a = self.make("বিজ্ঞান মেলা")
        b = self.make("বিজ্ঞান মেলা")
        self.assertEqual(a.status_code, 201)
        self.assertTrue(a.data["slug"])
        self.assertNotEqual(a.data["slug"], b.data["slug"])

    def test_symbol_only_title_still_gets_a_slug(self):
        self.assertTrue(self.make("!!!").data["slug"])

    def test_same_english_title_gets_numbered_slugs(self):
        self.assertEqual(self.make("Annual Sports").data["slug"], "annual-sports")
        self.assertEqual(self.make("Annual Sports").data["slug"], "annual-sports-2")

    def test_drafts_are_hidden_from_public_and_from_non_admins(self):
        draft = self.make("Secret draft", published=False)
        self.assertEqual(APIClient().get("/api/content/articles/public/").data["count"], 0)
        student = self.login(self.make_user("stud1", Role.STUDENT))
        self.assertEqual(student.get(f"/api/content/articles/{draft.data['id']}/").status_code, 404)
        self.assertEqual(self.admin_client.get(f"/api/content/articles/{draft.data['id']}/").status_code, 200)

    def test_public_endpoints_do_not_expose_user_ids(self):
        self.make("Open article")
        item = APIClient().get("/api/content/articles/public/").data["results"][0]
        self.assertNotIn("created_by", item)
        self.assertNotIn("published", item)

    def test_students_cannot_write_content(self):
        student = self.login(self.make_user("stud1", Role.STUDENT))
        self.assertEqual(student.post("/api/content/articles/", {"title": "x", "body": "y"}, format="json").status_code, 403)
        self.assertEqual(student.post("/api/content/events/", {"title": "x", "event_date": "2026-12-01"}, format="json").status_code, 403)


class UploadTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin_client = self.login(self.make_admin())

    def test_real_image_is_accepted(self):
        f = SimpleUploadedFile("a.png", png_bytes(), content_type="image/png")
        res = self.admin_client.post("/api/content/gallery/", {"caption": "Sports Day", "image": f}, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)

    def test_non_image_pretending_to_be_png_is_rejected(self):
        f = SimpleUploadedFile("evil.png", b"<script>alert(1)</script>", content_type="image/png")
        res = self.admin_client.post("/api/content/gallery/", {"caption": "x", "image": f}, format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_svg_is_rejected(self):
        f = SimpleUploadedFile("a.svg", b"<svg onload=alert(1)/>", content_type="image/svg+xml")
        self.assertEqual(self.admin_client.post("/api/content/gallery/", {"image": f}, format="multipart").status_code, 400)

    def test_pdf_ok_but_fake_pdf_rejected(self):
        ok = SimpleUploadedFile("f.pdf", b"%PDF-1.4 minimal", content_type="application/pdf")
        self.assertEqual(self.admin_client.post("/api/content/forms/", {"title": "Form", "file": ok}, format="multipart").status_code, 201)
        fake = SimpleUploadedFile("f.pdf", b"MZ this is an exe", content_type="application/pdf")
        self.assertEqual(self.admin_client.post("/api/content/forms/", {"title": "Bad", "file": fake}, format="multipart").status_code, 400)


class AdmissionTests(BaseAPITestCase):
    payload = {"applicant_name": "Riya Das", "guardian_contact": "9876543210", "applying_for_class": "Class V", "message": "Hi & hello"}

    def test_public_can_submit_but_not_read_or_set_status(self):
        anon = APIClient()
        res = anon.post("/api/content/admissions/submit/", {**self.payload, "status": "CLOSED"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["status"], "PENDING")
        self.assertEqual(res.data["message"], "Hi & hello")
        self.assertEqual(anon.get("/api/content/admissions/").status_code, 401)
        student = self.login(self.make_user("stud1", Role.STUDENT))
        self.assertEqual(student.get("/api/content/admissions/").status_code, 403)

    def test_invalid_phone_number_rejected(self):
        res = APIClient().post("/api/content/admissions/submit/", {**self.payload, "guardian_contact": "123"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_ip_throttle_blocks_the_fourth_submission(self):
        anon = APIClient()
        codes = [anon.post("/api/content/admissions/submit/", {**self.payload, "guardian_contact": f"98765432{i:02d}"}, format="json").status_code
                 for i in range(4)]
        self.assertEqual(codes, [201, 201, 201, 429])

    def test_super_admin_can_update_status(self):
        APIClient().post("/api/content/admissions/submit/", self.payload, format="json")
        admin = self.login(self.make_admin())
        item = admin.get("/api/content/admissions/").data["results"][0]
        res = admin.patch(f"/api/content/admissions/{item['id']}/", {"status": "CONTACTED"}, format="json")
        self.assertEqual(res.data["status"], "CONTACTED")


class ContactMessageTests(BaseAPITestCase):
    payload = {"name": "Rina Das", "email": "rina@example.com", "subject": "Fees & dates", "message": "Could you please share the fee structure?"}

    def test_public_can_send_but_not_read_or_set_status(self):
        anon = APIClient()
        res = anon.post("/api/content/contact/submit/", {**self.payload, "status": "REPLIED"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["status"], "NEW")
        self.assertEqual(res.data["subject"], "Fees & dates")
        self.assertEqual(anon.get("/api/content/contact/").status_code, 401)
        student = self.login(self.make_user("stud1", Role.STUDENT))
        self.assertEqual(student.get("/api/content/contact/").status_code, 403)

    def test_validation(self):
        anon = APIClient()
        self.assertEqual(anon.post("/api/content/contact/submit/", {**self.payload, "email": "", "phone": ""}, format="json").status_code, 400)
        self.assertEqual(anon.post("/api/content/contact/submit/", {**self.payload, "message": "hi"}, format="json").status_code, 400)
        self.assertEqual(anon.post("/api/content/contact/submit/", {**self.payload, "email": "not-an-email"}, format="json").status_code, 400)
        self.assertEqual(anon.post("/api/content/contact/submit/", {**self.payload, "email": "", "phone": "12345"}, format="json").status_code, 400)
        self.assertEqual(anon.post("/api/content/contact/submit/", {**self.payload, "email": "", "phone": "9876543210"}, format="json").status_code, 201)

    def test_html_is_stripped(self):
        res = APIClient().post("/api/content/contact/submit/", {**self.payload, "message": "Hello <script>alert(1)</script> there, friends"}, format="json")
        self.assertNotIn("<", res.data["subject"] + str(self.payload))
        self.assertEqual(res.status_code, 201)

    def test_ip_throttle_after_five(self):
        anon = APIClient()
        codes = [anon.post("/api/content/contact/submit/", {**self.payload, "email": f"p{i}@example.com"}, format="json").status_code for i in range(6)]
        self.assertEqual(codes, [201] * 5 + [429])

    def test_super_admin_triage(self):
        APIClient().post("/api/content/contact/submit/", self.payload, format="json")
        admin = self.login(self.make_admin())
        item = admin.get("/api/content/contact/").data["results"][0]
        self.assertEqual(admin.patch(f"/api/content/contact/{item['id']}/", {"status": "READ"}, format="json").data["status"], "READ")
        self.assertEqual(admin.delete(f"/api/content/contact/{item['id']}/").status_code, 204)


class AchievementTests(BaseAPITestCase):
    def test_public_read_admin_write(self):
        admin = self.login(self.make_admin())
        res = admin.post("/api/content/achievements/", {"title": "District Science Fair — 1st", "year": 2025, "category": "ACADEMIC", "description": "Won & proud"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        item = APIClient().get("/api/content/achievements/public/").data["results"][0]
        self.assertEqual(item["description"], "Won & proud")
        self.assertNotIn("created_by", item)
        student = self.login(self.make_user("stud1", Role.STUDENT))
        self.assertEqual(student.post("/api/content/achievements/", {"title": "x", "year": 2025}, format="json").status_code, 403)
        self.assertEqual(APIClient().post("/api/content/achievements/", {"title": "x", "year": 2025}, format="json").status_code, 401)

    def test_unrealistic_year_rejected(self):
        admin = self.login(self.make_admin())
        self.assertEqual(admin.post("/api/content/achievements/", {"title": "x", "year": 1800}, format="json").status_code, 400)
        self.assertEqual(admin.post("/api/content/achievements/", {"title": "x", "year": 2999}, format="json").status_code, 400)


class PublicDetailTests(BaseAPITestCase):
    def test_article_by_unicode_slug_and_drafts_hidden(self):
        admin = self.login(self.make_admin())
        a = admin.post("/api/content/articles/", {"title": "বিজ্ঞান মেলা", "body": "text", "published": True}, format="json").data
        d = admin.post("/api/content/articles/", {"title": "Hidden draft", "body": "x", "published": False}, format="json").data
        res = APIClient().get(f"/api/content/articles/public/{a['slug']}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["title"], "বিজ্ঞান মেলা")
        self.assertNotIn("created_by", res.data)
        self.assertEqual(APIClient().get(f"/api/content/articles/public/{d['slug']}/").status_code, 404)

    def test_public_notice_detail(self):
        from notices.models import Notice

        admin = self.make_admin()
        n = Notice.objects.create(title="Holiday", body="Closed", created_by=admin)
        res = APIClient().get(f"/api/notices/public/{n.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("created_by", res.data)
        self.assertEqual(APIClient().get("/api/notices/public/00000000-0000-0000-0000-000000000000/").status_code, 404)
