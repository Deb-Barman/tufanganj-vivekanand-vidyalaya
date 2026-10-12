import io

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client
from rest_framework.test import APIClient

from academics.models import StudentProfile, TeacherProfile
from config.testing import PASSWORD, BaseAPITestCase

from .models import Role, User


class LoginTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.make_admin()
        self.teacher = self.make_user("teach1", Role.TEACHER)
        self.student = self.make_user("stud1", Role.STUDENT)

    def post(self, path, username, password=PASSWORD):
        return APIClient().post(path, {"username": username, "password": password}, format="json")

    def test_each_role_can_sign_in_on_its_own_page(self):
        self.assertEqual(self.post("/api/auth/admin-login/", "head@school.test").status_code, 200)
        self.assertEqual(self.post("/api/auth/staff-login/", "teach1").status_code, 200)
        self.assertEqual(self.post("/api/auth/staff-login/", "stud1").status_code, 200)

    def test_wrong_portal_is_rejected_with_the_generic_message(self):
        res = self.post("/api/auth/admin-login/", "stud1")
        self.assertEqual(res.status_code, 401)
        self.assertIn("No active account", str(res.data["detail"]))
        self.assertEqual(self.post("/api/auth/staff-login/", "head@school.test").status_code, 401)

    def test_disabled_account_cannot_sign_in(self):
        self.student.is_active_account = False
        self.student.save()
        res = self.post("/api/auth/staff-login/", "stud1")
        self.assertEqual(res.status_code, 401)

    def test_five_wrong_passwords_lock_the_account_even_for_the_right_password(self):
        for _ in range(5):
            self.assertEqual(self.post("/api/auth/staff-login/", "stud1", "wrong").status_code, 401)
        res = self.post("/api/auth/staff-login/", "stud1")
        self.assertEqual(res.status_code, 401)
        self.assertIn("Too many failed attempts", str(res.data["detail"]))

    def test_successful_login_resets_the_failure_counter(self):
        for _ in range(3):
            self.post("/api/auth/staff-login/", "stud1", "wrong")
        self.assertEqual(self.post("/api/auth/staff-login/", "stud1").status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.failed_login_attempts, 0)

    def test_django_admin_login_is_also_protected_by_lockout(self):
        # Django's own /admin/ login goes through authenticate() -> our backend.
        client = Client()
        for _ in range(5):
            self.assertFalse(client.login(username="head@school.test", password="wrong"))
        self.assertFalse(Client().login(username="head@school.test", password=PASSWORD))  # right password, still locked
        self.assertEqual(self.post("/api/auth/admin-login/", "head@school.test").status_code, 401)  # same counter as the portal

    def test_admin_page_url_is_configurable(self):
        from django.conf import settings
        self.assertTrue(settings.ADMIN_URL.endswith("/"))


class PasswordPolicyTests(BaseAPITestCase):
    def test_temporary_password_blocks_the_api_until_changed(self):
        admin = self.make_admin()
        user = self.make_user("newkid", Role.STUDENT, must_change_password=True)
        client = self.login(user)

        self.assertEqual(client.get("/api/notices/").status_code, 403)
        self.assertEqual(client.get("/api/academics/attendance/").status_code, 403)
        self.assertEqual(client.get("/api/auth/me/").status_code, 200)  # the app needs this to redirect

        res = client.post("/api/auth/me/change-password/",
                          {"current_password": PASSWORD, "new_password": "Brand-New#Pass42"}, format="json")
        self.assertEqual(res.status_code, 200)

        again = APIClient()
        token = again.post("/api/auth/staff-login/", {"username": "newkid", "password": "Brand-New#Pass42"}, format="json")
        again.credentials(HTTP_AUTHORIZATION="Bearer " + token.data["access"])
        self.assertEqual(again.get("/api/notices/").status_code, 200)

    def test_changing_the_password_revokes_old_tokens(self):
        user = self.make_user("stud1", Role.STUDENT)
        old = self.login(user)
        old_refresh = old.refresh_token
        old.post("/api/auth/me/change-password/",
                 {"current_password": PASSWORD, "new_password": "Brand-New#Pass42"}, format="json")
        self.assertEqual(old.get("/api/auth/me/").status_code, 401)
        res = APIClient().post("/api/auth/token/refresh/", {"refresh": old_refresh}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_weak_new_password_is_rejected(self):
        user = self.make_user("stud1", Role.STUDENT)
        res = self.login(user).post("/api/auth/me/change-password/",
                                    {"current_password": PASSWORD, "new_password": "12345678"}, format="json")
        self.assertEqual(res.status_code, 400)


class LogoutTests(BaseAPITestCase):
    def test_logout_blacklists_the_refresh_token(self):
        client = self.login(self.make_user("stud1", Role.STUDENT))
        refresh = client.refresh_token
        self.assertEqual(client.post("/api/auth/logout/", {"refresh": refresh}, format="json").status_code, 200)
        res = APIClient().post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_logout_with_garbage_token_still_answers_200(self):
        client = self.login(self.make_user("stud1", Role.STUDENT))
        self.assertEqual(client.post("/api/auth/logout/", {"refresh": "nonsense"}, format="json").status_code, 200)


class AccountAdministrationTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.make_admin()
        self.admin_client = self.login(self.admin)

    def test_only_super_admin_can_list_or_create_accounts(self):
        for role in (Role.STUDENT, Role.TEACHER):
            client = self.login(self.make_user(f"u-{role}", role))
            self.assertEqual(client.get("/api/auth/admin/users/").status_code, 403)
            self.assertEqual(client.post("/api/auth/admin/users/", {}, format="json").status_code, 403)
        self.assertEqual(APIClient().get("/api/auth/admin/users/").status_code, 401)

    def test_super_admin_creates_a_student_and_profile_is_made_automatically(self):
        res = self.admin_client.post("/api/auth/admin/users/", {
            "username": "ravi", "password": "T3mp!Passw0rd", "full_name": "Ravi Roy", "role": "STUDENT"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        user = User.objects.get(username="ravi")
        self.assertTrue(user.must_change_password)
        self.assertTrue(StudentProfile.objects.filter(user=user).exists())

    def test_teacher_account_gets_a_teacher_profile(self):
        self.admin_client.post("/api/auth/admin/users/", {
            "username": "mrs-sen", "password": "T3mp!Passw0rd", "full_name": "Mrs Sen", "role": "TEACHER"}, format="json")
        self.assertTrue(TeacherProfile.objects.filter(user__username="mrs-sen").exists())

    def test_cannot_create_another_super_admin_through_the_api(self):
        res = self.admin_client.post("/api/auth/admin/users/", {
            "username": "evil", "password": "T3mp!Passw0rd", "full_name": "Evil", "role": "SUPER_ADMIN"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(username="evil").exists())

    def test_super_admin_cannot_be_edited_or_reset_through_the_api(self):
        other = self.make_admin("second@school.test")
        self.assertEqual(self.admin_client.patch(f"/api/auth/admin/users/{other.id}/", {"full_name": "x"}, format="json").status_code, 404)

    def test_reset_password_forces_change_and_clears_lockout(self):
        student = self.make_user("stud1", Role.STUDENT)
        student.failed_login_attempts = 5
        student.save()
        res = self.admin_client.post(f"/api/auth/admin/users/{student.id}/reset-password/",
                                     {"new_password": "Res3t!Passw0rd"}, format="json")
        self.assertEqual(res.status_code, 200)
        student.refresh_from_db()
        self.assertTrue(student.must_change_password)
        self.assertEqual(student.failed_login_attempts, 0)


class EnsureSuperuserCommandTests(BaseAPITestCase):
    ENV = {"SUPERUSER_EMAIL": "head@school.test", "SUPERUSER_PASSWORD": "Head!Passw0rd-1"}

    def run_cmd(self, **env):
        import os
        keys = ["SUPERUSER_EMAIL", "SUPERUSER_PASSWORD", "SUPERUSER_USERNAME", "SUPERUSER_FORCE_PASSWORD_RESET"]
        old = {k: os.environ.pop(k, None) for k in keys}
        os.environ.update(env)
        try:
            call_command("ensure_superuser", stdout=io.StringIO())
        finally:
            for k in keys:
                os.environ.pop(k, None)
                if old[k] is not None:
                    os.environ[k] = old[k]

    def test_creates_super_admin_then_leaves_a_changed_password_alone(self):
        self.run_cmd(**self.ENV)
        user = User.objects.get(username="head@school.test")
        self.assertTrue(user.is_super_admin and user.is_superuser and user.is_staff)
        user.set_password("Changed!By-Head-9")
        user.save()
        self.run_cmd(**self.ENV)
        user.refresh_from_db()
        self.assertTrue(user.check_password("Changed!By-Head-9"))

    def test_force_reset_overwrites_the_password(self):
        self.run_cmd(**self.ENV)
        user = User.objects.get(username="head@school.test")
        user.set_password("Changed!By-Head-9")
        user.save()
        self.run_cmd(**self.ENV, SUPERUSER_FORCE_PASSWORD_RESET="true")
        user.refresh_from_db()
        self.assertTrue(user.check_password(self.ENV["SUPERUSER_PASSWORD"]))

    def test_weak_password_is_refused(self):
        with self.assertRaises(CommandError):
            self.run_cmd(SUPERUSER_EMAIL="head@school.test", SUPERUSER_PASSWORD="short")


class AdminStatsTests(BaseAPITestCase):
    def test_stats_are_super_admin_only_and_have_expected_shape(self):
        admin = self.login(self.make_admin())
        self.make_user("s1", Role.STUDENT)
        self.make_user("t1", Role.TEACHER, must_change_password=True)
        data = admin.get("/api/auth/admin/stats/").data
        self.assertEqual(data["people"]["students"], 1)
        self.assertEqual(data["people"]["teachers"], 1)
        self.assertEqual(data["people"]["awaiting_first_login"], 1)
        self.assertEqual(data["people"]["students_without_class"], 1)
        self.assertEqual(len(data["attendance"]["last7"]), 7)
        for key in ("admissions", "content", "academics", "messages", "recent_admissions", "recent_notices"):
            self.assertIn(key, data)
        for role in (Role.TEACHER, Role.STUDENT):
            self.assertEqual(self.login(User.objects.get(role=role)).get("/api/auth/admin/stats/").status_code, 403)
        self.assertEqual(APIClient().get("/api/auth/admin/stats/").status_code, 401)


class SuperAdminAccountParityTests(BaseAPITestCase):
    """Edit username, unlock, delete — everything the Django admin offered for accounts."""

    def setUp(self):
        super().setUp()
        self.admin = self.make_admin()
        self.admin_c = self.login(self.admin)
        self.student = self.make_user("kid1", Role.STUDENT)
        self.url = f"/api/auth/admin/users/{self.student.id}/"

    def test_admin_can_rename_username_but_not_to_a_taken_one(self):
        self.make_user("kid2", Role.STUDENT)
        self.assertEqual(self.admin_c.patch(self.url, {"username": "kid2"}, format="json").status_code, 400)
        self.assertEqual(self.admin_c.patch(self.url, {"username": "kid-renamed"}, format="json").status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.username, "kid-renamed")

    def test_list_shows_lock_state_and_unlock_clears_it(self):
        from django.utils import timezone

        self.student.failed_login_attempts = 5
        self.student.locked_until = timezone.now() + timezone.timedelta(minutes=15)
        self.student.save()
        row = next(r for r in self.admin_c.get("/api/auth/admin/users/").data["results"] if r["username"] == "kid1")
        self.assertIsNotNone(row["locked_until"])
        self.assertEqual(self.admin_c.post(self.url + "unlock/").status_code, 200)
        self.student.refresh_from_db()
        self.assertIsNone(self.student.locked_until)
        self.assertEqual(self.student.failed_login_attempts, 0)

    def test_unlock_is_super_admin_only(self):
        self.assertEqual(self.login(self.student).post(self.url + "unlock/").status_code, 403)

    def test_admin_can_delete_an_account(self):
        self.assertEqual(self.admin_c.delete(self.url).status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.student.pk).exists())


class AdminStatsQueryBudgetTests(BaseAPITestCase):
    """The overview is loaded on every Super Admin visit and each query is a round-trip to a remote
    database, so keep it lean (it used to run ~30 queries) and keep the numbers right."""

    def test_overview_is_few_queries_and_numbers_are_right(self):
        import datetime

        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        from django.utils import timezone

        from academics.models import Attendance, StudentProfile

        admin_c = self.login(self.make_admin())
        a, b = self.make_user("s1", Role.STUDENT), self.make_user("s2", Role.STUDENT, must_change_password=True)
        self.make_user("t1", Role.TEACHER, is_active_account=False)
        today = timezone.localdate()
        Attendance.objects.create(student=StudentProfile.objects.get(user=a), date=today, status="PRESENT")
        Attendance.objects.create(student=StudentProfile.objects.get(user=b), date=today, status="ABSENT")
        Attendance.objects.create(student=StudentProfile.objects.get(user=a), date=today - datetime.timedelta(days=2), status="PRESENT")

        with CaptureQueriesContext(connection) as ctx:
            data = admin_c.get("/api/auth/admin/stats/").data
        self.assertLessEqual(len(ctx), 22)
        self.assertEqual((data["people"]["students"], data["people"]["teachers"], data["people"]["disabled"], data["people"]["awaiting_first_login"]), (2, 0, 1, 1))
        self.assertEqual(data["attendance"]["today"], {"present": 1, "absent": 1, "marked": 2})
        self.assertEqual(len(data["attendance"]["last7"]), 7)
        self.assertEqual(data["attendance"]["last7"][-3], {"date": str(today - datetime.timedelta(days=2)), "present": 1, "absent": 0})
        self.assertEqual(data["attendance"]["last7"][-1]["date"], str(today))
