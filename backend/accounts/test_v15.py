"""V15 — smarter lockout, separate refresh limit, forgot-password queue, profile finder."""
from django.core.cache import cache
from rest_framework.test import APIClient

from config.testing import PASSWORD, BaseAPITestCase

from .models import LoginFailure, PasswordResetRequest, PublicProfile, Role

GOOD = PASSWORD


def client_at(ip):
    return APIClient(REMOTE_ADDR=ip)


class V15Base(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.admin = self.make_admin()
        self.stu = self.make_user("riju", Role.STUDENT)
        self.teacher = self.make_user("ranjan", Role.TEACHER)

    def login_as(self, ip, username="riju", password=GOOD):
        return client_at(ip).post("/api/auth/staff-login/", {"username": username, "password": password}, format="json")


class SmarterLockoutTests(V15Base):
    def test_a_stranger_guessing_blocks_only_themselves_not_the_owner(self):
        for _ in range(5):
            self.assertEqual(self.login_as("10.0.0.1", password="wrong").status_code, 401)
        blocked = self.login_as("10.0.0.1")  # the stranger, even with the right password, is blocked
        self.assertIn("Too many failed attempts", str(blocked.data["detail"]))
        self.assertEqual(self.login_as("10.0.0.2").status_code, 200)  # the real owner is fine
        self.stu.refresh_from_db()
        self.assertIsNone(self.stu.locked_until)

    def test_the_block_message_is_the_same_for_made_up_usernames(self):
        for _ in range(5):
            self.login_as("10.0.0.1", username="nobody-here", password="x")
        for _ in range(5):
            self.login_as("10.0.0.1", password="wrong")
        fake = self.login_as("10.0.0.1", username="nobody-here", password="x").data["detail"]
        real = self.login_as("10.0.0.1", password="wrong").data["detail"]
        self.assertEqual(str(fake), str(real))

    def test_many_failures_from_everywhere_still_lock_the_whole_account_and_admin_can_unlock(self):
        for i in range(30):
            self.login_as(f"10.1.{i // 200}.{i % 200 + 1}", password="wrong")
        self.stu.refresh_from_db()
        self.assertIsNotNone(self.stu.locked_until)
        self.assertIn("Too many failed attempts", str(self.login_as("10.9.9.9").data["detail"]))
        admin_c = self.login(self.admin)
        self.assertEqual(admin_c.post(f"/api/auth/admin/users/{self.stu.id}/unlock/", {}, format="json").status_code, 200)
        self.assertEqual(self.login_as("10.9.9.9").status_code, 200)

    def test_a_correct_password_forgets_the_earlier_failures(self):
        for _ in range(3):
            self.login_as("10.0.0.1", password="wrong")
        self.assertEqual(self.login_as("10.0.0.1").status_code, 200)
        self.assertEqual(LoginFailure.objects.filter(username="riju").count(), 0)

    def test_a_visitor_cannot_dodge_the_block_by_faking_the_start_of_x_forwarded_for(self):
        for i in range(5):
            client_at("10.5.5.5").post("/api/auth/staff-login/", {"username": "riju", "password": "wrong"}, format="json", HTTP_X_FORWARDED_FOR=f"1.2.3.{i}, 203.0.113.9")
        res = client_at("10.5.5.5").post("/api/auth/staff-login/", {"username": "riju", "password": GOOD}, format="json", HTTP_X_FORWARDED_FOR="9.9.9.9, 203.0.113.9")
        self.assertIn("Too many failed attempts", str(res.data["detail"]))


class RefreshIsNotThrottledByLoginsTests(V15Base):
    def test_class_signing_in_together_does_not_break_token_refresh(self):
        first = self.login_as("10.7.7.7")
        self.assertEqual(first.status_code, 200)
        for i in range(20):  # a whole class on one school Wi-Fi
            self.login_as("10.7.7.7", username=f"other{i}", password="x")
        res = client_at("10.7.7.7").post("/api/auth/token/refresh/", {"refresh": first.data["refresh"]}, format="json")
        self.assertEqual(res.status_code, 200)


class ForgotPasswordTests(V15Base):
    URL = "/api/auth/forgot-password/"

    def ask(self, username, note=""):
        return client_at("10.2.2.2").post(self.URL, {"username": username, "note": note}, format="json")

    def test_answer_is_identical_for_real_and_unknown_usernames(self):
        a, b = self.ask("riju"), self.ask("does-not-exist")
        self.assertEqual((a.status_code, a.data), (b.status_code, b.data))
        self.assertEqual(a.status_code, 202)

    def test_a_real_request_is_queued_once_and_shown_to_the_super_admin(self):
        self.ask("riju", "Class 9, roll 12")
        self.ask("RIJU")  # again, different case -> still ONE open request
        self.assertEqual(PasswordResetRequest.objects.filter(user=self.stu, resolved_at__isnull=True).count(), 1)
        rows = self.login(self.admin).get("/api/auth/admin/reset-requests/").data
        self.assertEqual([r["username"] for r in rows], ["riju"])
        self.assertEqual(rows[0]["note"], "Class 9, roll 12")

    def test_the_super_admin_never_gets_a_request_but_a_mistyped_name_is_kept_for_the_office(self):
        self.ask(self.admin.username)
        self.assertEqual(PasswordResetRequest.objects.count(), 0)
        self.ask("@Riju-typo", "Class 9")
        self.ask("riju-typo")  # same typo again -> still one entry
        rows = self.login(self.admin).get("/api/auth/admin/reset-requests/").data
        self.assertEqual([(r["username"], r["known"], r["user"]) for r in rows], [("Riju-typo", False, None)])

    def test_stats_show_how_many_people_are_waiting(self):
        self.ask("riju")
        self.ask("typo-name")
        self.assertEqual(self.login(self.admin).get("/api/auth/admin/stats/").data["password_requests"], 2)

    def test_unknown_name_requests_are_capped_so_the_office_cannot_be_flooded(self):
        PasswordResetRequest.objects.bulk_create([PasswordResetRequest(user=None, username=f"nobody{i}") for i in range(50)])
        self.assertEqual(self.ask("one-more").status_code, 202)  # the answer never changes...
        self.assertEqual(PasswordResetRequest.objects.filter(user__isnull=True).count(), 50)  # ...but the queue stops growing

    def test_one_address_can_only_send_a_few_requests_per_hour(self):
        codes = [self.ask(f"spam{i}").status_code for i in range(13)]
        self.assertEqual(codes[:10], [202] * 10)
        self.assertEqual(codes[10], 429)

    def test_setting_a_new_password_closes_the_request(self):
        self.ask("riju")
        admin_c = self.login(self.admin)
        self.assertEqual(admin_c.post(f"/api/auth/admin/users/{self.stu.id}/reset-password/", {"new_password": "Another-Strong-4471"}, format="json").status_code, 200)
        self.assertEqual(admin_c.get("/api/auth/admin/reset-requests/").data, [])
        self.assertEqual(self.login_as("10.3.3.3", password="Another-Strong-4471").status_code, 200)

    def test_dismiss_and_permissions(self):
        self.ask("riju")
        rid = PasswordResetRequest.objects.get().id
        self.assertEqual(self.login(self.stu).get("/api/auth/admin/reset-requests/").status_code, 403)
        self.assertEqual(self.login(self.teacher).post(f"/api/auth/admin/reset-requests/{rid}/dismiss/", {}, format="json").status_code, 403)
        self.assertEqual(self.login(self.admin).post(f"/api/auth/admin/reset-requests/{rid}/dismiss/", {}, format="json").status_code, 200)
        self.assertEqual(PasswordResetRequest.objects.filter(resolved_at__isnull=True).count(), 0)


class ProfileFinderTests(V15Base):
    def find(self, name):
        return APIClient().get("/api/auth/profiles/find/", {"u": name})

    def test_only_published_profiles_are_found_by_exact_username(self):
        PublicProfile.objects.update_or_create(user=self.teacher, defaults={"headline": "Physics teacher", "is_public": True})
        PublicProfile.objects.update_or_create(user=self.stu, defaults={"headline": "Hidden", "is_public": False})
        hit = self.find("ranjan").data
        self.assertTrue(hit["found"])
        self.assertEqual((hit["role"], hit["path"], hit["headline"]), ("teacher", "/profile/teacher/ranjan", "Physics teacher"))
        self.assertTrue(self.find("@Ranjan").data["found"])  # case and @ do not matter
        self.assertEqual(self.find("riju").data, {"found": False})  # private
        self.assertEqual(self.find("does-not-exist").data, {"found": False})  # unknown looks the same as private

    def test_no_partial_matching_so_the_list_of_people_cannot_be_harvested(self):
        PublicProfile.objects.update_or_create(user=self.teacher, defaults={"is_public": True})
        for part in ("ranj", "r", "ran%", ""):
            self.assertEqual(self.find(part).data, {"found": False})
