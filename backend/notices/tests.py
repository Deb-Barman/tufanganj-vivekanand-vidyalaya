from rest_framework.test import APIClient

from accounts.models import Role
from config.testing import BaseAPITestCase

from .models import Notice


class NoticeTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin_client = self.login(self.make_admin())

    def test_ampersand_and_symbols_are_stored_as_real_characters(self):
        res = self.admin_client.post("/api/notices/", {"title": "Science & Arts Fair", "body": "5 < 6 & 7 > 3"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["title"], "Science & Arts Fair")
        self.assertEqual(res.data["body"], "5 < 6 & 7 > 3")

    def test_html_is_stripped(self):
        res = self.admin_client.post("/api/notices/", {
            "title": "<b>Holiday</b>", "body": "Closed<script>alert(1)</script> <img src=x onerror=alert(1)>tomorrow"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertNotIn("<", res.data["title"])
        self.assertNotIn("<", res.data["body"])
        self.assertNotIn("onerror", res.data["body"])

    def test_empty_after_sanitising_is_rejected(self):
        res = self.admin_client.post("/api/notices/", {"title": "<script></script>", "body": "x"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_only_super_admin_can_write(self):
        for role in (Role.TEACHER, Role.STUDENT):
            client = self.login(self.make_user(f"u-{role}", role))
            self.assertEqual(client.post("/api/notices/", {"title": "t", "body": "b"}, format="json").status_code, 403)
        self.assertEqual(APIClient().post("/api/notices/", {"title": "t", "body": "b"}, format="json").status_code, 401)

    def test_public_list_is_open_but_hides_internal_user_ids(self):
        self.admin_client.post("/api/notices/", {"title": "Hello", "body": "World"}, format="json")
        res = APIClient().get("/api/notices/public/")
        self.assertEqual(res.status_code, 200)
        item = res.data["results"][0]
        self.assertNotIn("created_by", item)
        self.assertEqual(item["title"], "Hello")
        self.assertEqual(Notice.objects.count(), 1)
