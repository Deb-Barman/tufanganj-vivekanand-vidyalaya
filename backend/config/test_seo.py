"""The API / admin server must never be indexed by search engines (the public website on Vercel is what should rank)."""
from rest_framework.test import APIClient

from .testing import BaseAPITestCase


class NoIndexHeaderTests(BaseAPITestCase):
    def test_public_api_responses_are_noindex(self):
        res = APIClient().get("/api/notices/public/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["X-Robots-Tag"], "noindex, nofollow")

    def test_errors_and_unknown_urls_are_noindex_too(self):
        self.assertEqual(APIClient().get("/api/definitely/not/here/")["X-Robots-Tag"], "noindex, nofollow")
        self.assertEqual(APIClient().get("/no/such/page/")["X-Robots-Tag"], "noindex, nofollow")

    def test_authenticated_api_responses_are_noindex(self):
        client = self.login(self.make_admin())
        self.assertEqual(client.get("/api/auth/me/")["X-Robots-Tag"], "noindex, nofollow")
