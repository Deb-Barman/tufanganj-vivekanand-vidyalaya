"""V21 — the public App page: downloads added by the Super Admin as pasted links."""
from rest_framework.test import APIClient

from accounts.models import Role
from config.testing import BaseAPITestCase

from .models import AppRelease

APK = "https://github.com/deb-barman166/tvv-app/releases/download/v1.0/tvv.apk"


class AppReleaseTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin_c = self.login(self.make_admin())
        self.teacher_c = self.login(self.make_user("teach1", Role.TEACHER))
        self.student_c = self.login(self.make_user("alice", Role.STUDENT))

    def add(self, **extra):
        body = {"name": "TVV School App", "platform": "ANDROID", "version": "1.0", "size_text": "24 MB", "notes": "First release", "download_link": APK}
        body.update(extra)
        return self.admin_c.post("/api/content/apps/", body, format="json")

    def test_super_admin_adds_an_app_and_it_shows_publicly(self):
        res = self.add()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["platform_label"], "Android")
        public = APIClient().get("/api/content/apps/public/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual([a["name"] for a in public.data], ["TVV School App"])
        self.assertNotIn("created_by", public.data[0])
        self.assertNotIn("is_published", public.data[0])

    def test_hidden_apps_are_not_public_but_the_admin_still_sees_them(self):
        self.add()
        self.add(name="Old version", is_published=False)
        self.assertEqual([a["name"] for a in APIClient().get("/api/content/apps/public/").data], ["TVV School App"])
        self.assertEqual(self.admin_c.get("/api/content/apps/").data["count"], 2)

    def test_only_the_super_admin_can_manage(self):
        for client in (self.teacher_c, self.student_c, APIClient()):
            self.assertIn(client.get("/api/content/apps/").status_code, (401, 403))
            self.assertIn(client.post("/api/content/apps/", {"name": "x", "download_link": APK}, format="json").status_code, (401, 403))
        self.assertEqual(AppRelease.objects.count(), 0)

    def test_edit_and_delete(self):
        pk = self.add().data["id"]
        res = self.admin_c.patch(f"/api/content/apps/{pk}/", {"version": "1.1", "is_published": False}, format="json")
        self.assertEqual((res.status_code, res.data["version"], res.data["is_published"]), (200, "1.1", False))
        self.assertEqual(self.admin_c.delete(f"/api/content/apps/{pk}/").status_code, 204)

    def test_unsafe_or_plain_http_links_are_refused(self):
        for bad in ("javascript:alert(1)", "http://example.com/app.apk", "data:text/html,hi", "ftp://x.com/a", "file:///etc/passwd", "not a link"):
            self.assertEqual(self.add(download_link=bad).status_code, 400, bad)
        self.assertEqual(AppRelease.objects.count(), 0)

    def test_link_is_required_and_name_is_required(self):
        self.assertEqual(self.add(download_link="").status_code, 400)
        self.assertEqual(self.add(name="   ").status_code, 400)

    def test_unknown_platform_is_refused(self):
        self.assertEqual(self.add(platform="TOASTER").status_code, 400)

    def test_html_is_stripped_from_text_fields(self):
        res = self.add(name="<b>App</b>", notes="<script>alert(1)</script>Fixes")
        self.assertEqual(res.status_code, 201)
        self.assertNotIn("<", res.data["name"])
        self.assertNotIn("<script", res.data["notes"])

    def test_google_drive_link_gets_a_direct_download_address(self):
        res = self.add(download_link="https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["download_link"], "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view")
        self.assertIn("export=download", res.data["download_url"])
        self.assertIsNone(self.add().data["download_url"])
