"""V22 security regressions: unspoofable client address, 400 (not 500) for bad filters, username rules, upload names."""
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from config.clientip import client_ip
from config.testing import PASSWORD, BaseAPITestCase

from .models import LoginFailure, Role, User


class _Req:
    def __init__(self, **meta):
        self.META = meta


class ClientAddressTests(BaseAPITestCase):
    def test_cloudflare_header_wins_over_anything_the_visitor_typed(self):
        r = _Req(HTTP_CF_CONNECTING_IP="203.0.113.7", HTTP_X_FORWARDED_FOR="6.6.6.6, 7.7.7.7", REMOTE_ADDR="10.0.0.1")
        self.assertEqual(client_ip(r), "203.0.113.7")

    def test_without_cloudflare_the_proxy_added_last_entry_is_used_not_the_typed_first_one(self):
        r = _Req(HTTP_X_FORWARDED_FOR="6.6.6.6, 198.51.100.4", REMOTE_ADDR="10.0.0.1")
        self.assertEqual(client_ip(r), "198.51.100.4")

    def test_garbage_falls_back_to_the_connection_address(self):
        self.assertEqual(client_ip(_Req(HTTP_CF_CONNECTING_IP="nope", HTTP_X_FORWARDED_FOR="???", REMOTE_ADDR="127.0.0.1")), "127.0.0.1")
        self.assertIsNone(client_ip(_Req()))

    def test_faking_x_forwarded_for_does_not_escape_the_admission_limit(self):
        cache.clear()
        for i in range(3):
            body = {"applicant_name": "A", "guardian_contact": f"09000000{i:02d}", "applying_for_class": "8"}
            res = APIClient().post("/api/content/admissions/submit/", body, format="json", HTTP_CF_CONNECTING_IP="198.51.100.9", HTTP_X_FORWARDED_FOR=f"1.1.1.{i}")
            self.assertEqual(res.status_code, 201)
        body = {"applicant_name": "A", "guardian_contact": "0900000099", "applying_for_class": "8"}
        res = APIClient().post("/api/content/admissions/submit/", body, format="json", HTTP_CF_CONNECTING_IP="198.51.100.9", HTTP_X_FORWARDED_FOR="2.2.2.2")
        self.assertEqual(res.status_code, 429)

    def test_faking_x_forwarded_for_does_not_reset_the_login_lockout(self):
        cache.clear()
        self.make_user("riju", Role.STUDENT)
        for i in range(5):
            APIClient().post("/api/auth/staff-login/", {"username": "riju", "password": "wrong"}, format="json", HTTP_CF_CONNECTING_IP="198.51.100.9", HTTP_X_FORWARDED_FOR=f"9.9.9.{i}")
        res = APIClient().post("/api/auth/staff-login/", {"username": "riju", "password": PASSWORD}, format="json", HTTP_CF_CONNECTING_IP="198.51.100.9", HTTP_X_FORWARDED_FOR="8.8.8.8")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(LoginFailure.objects.filter(username="riju").count(), 1)  # one address, not five made-up ones


class BadInputTests(BaseAPITestCase):
    def test_a_bad_filter_value_is_a_400_not_a_server_error(self):
        t = self.make_user("teach1", Role.TEACHER)
        c = APIClient()
        c.force_authenticate(t)
        for url in ("/api/academics/attendance/?student=abc", "/api/academics/attendance/?date=2026-13-45", "/api/academics/students/?school_class=abc", "/api/academics/results/?session=abc"):
            self.assertEqual(c.get(url).status_code, 400, url)

    def test_forgot_password_and_logout_survive_a_non_object_body(self):
        self.assertEqual(APIClient().post("/api/auth/forgot-password/", [1, 2], format="json").status_code, 202)
        u = self.make_user("stud1", Role.STUDENT)
        c = APIClient()
        c.force_authenticate(u)
        self.assertEqual(c.post("/api/auth/logout/", [1], format="json").status_code, 200)


class AccountRuleTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.make_admin()
        self.c = APIClient()
        self.c.force_authenticate(self.admin)

    def _create(self, username):
        return self.c.post("/api/auth/admin/users/", {"username": username, "password": "Str0ng-Pass-9x!", "full_name": "X Y", "role": "STUDENT"}, format="json")

    def test_usernames_are_unique_ignoring_case(self):
        self.assertEqual(self._create("Riya.Das").status_code, 201)
        self.assertEqual(self._create("riya.das").status_code, 400)

    def test_usernames_cannot_contain_spaces_or_url_characters(self):
        for bad in ("two words", "a/b/c", "who?me", "x#y", "ab"):
            self.assertEqual(self._create(bad).status_code, 400, bad)

    def test_renaming_onto_an_existing_name_is_refused(self):
        self.assertEqual(self._create("first.one").status_code, 201)
        second = self._create("second.one").json()
        res = self.c.patch(f"/api/auth/admin/users/{second['id']}/", {"username": "FIRST.ONE"}, format="json")
        self.assertEqual(res.status_code, 400)


class UploadNameTests(BaseAPITestCase):
    def test_marksheet_and_document_uploads_need_a_matching_file_name(self):
        from academics.serializers import MarksheetSerializer
        from rest_framework import serializers as drf

        fake = SimpleUploadedFile("evil.html", b"%PDF-1.4 <script>alert(1)</script>", content_type="application/pdf")
        with self.assertRaises(drf.ValidationError):
            MarksheetSerializer().validate_file(fake)
        ok = SimpleUploadedFile("marks.pdf", b"%PDF-1.4 fine", content_type="application/pdf")
        self.assertIs(MarksheetSerializer().validate_file(ok), ok)


class ApiHeaderTests(BaseAPITestCase):
    def test_api_answers_carry_a_locked_down_policy_and_private_ones_are_not_cached(self):
        res = APIClient().get("/api/health/")
        self.assertEqual(res["Content-Security-Policy"], "default-src 'none'; frame-ancestors 'none'")
        u = self.make_user("stud2", Role.STUDENT)
        c = APIClient()
        c.force_authenticate(u)
        res = c.get("/api/auth/me/", HTTP_AUTHORIZATION="Bearer x")
        self.assertEqual(res["Cache-Control"], "private, no-store")
