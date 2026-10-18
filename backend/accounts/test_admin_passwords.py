"""Admin-issued passwords are immediately usable; legacy flags grant no extra access."""
from datetime import timedelta
from importlib import import_module

from django.apps import apps
from django.utils import timezone
from rest_framework.test import APIClient

from config.testing import PASSWORD, BaseAPITestCase

from .models import Role, User


class AdminIssuedPasswordTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.make_admin()
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(self.admin)

    def test_model_default_does_not_force_password_change(self):
        # Do not use make_user: it explicitly supplies the flag and would hide a bad model default.
        user = User.objects.create_user(username="fresh", password=PASSWORD, role=Role.STUDENT)
        user.refresh_from_db()
        self.assertFalse(user.must_change_password)

    def test_created_student_and_teacher_sign_in_with_the_exact_issued_password(self):
        for role in (Role.STUDENT, Role.TEACHER):
            with self.subTest(role=role):
                username = f"new-{role.lower()}"
                issued = "Chosen!ByAdmin#42"
                created = self.admin_client.post("/api/auth/admin/users/", {
                    "username": username, "full_name": "New Account", "role": role, "password": issued,
                }, format="json")
                self.assertEqual(created.status_code, 201, created.data)
                user = User.objects.get(username=username)
                self.assertFalse(user.must_change_password)
                self.assertTrue(user.check_password(issued))
                self.assertNotEqual(user.password, issued)
                login = APIClient().post("/api/auth/staff-login/", {"username": username, "password": issued}, format="json")
                self.assertEqual(login.status_code, 200, login.data)
                client = APIClient()
                client.credentials(HTTP_AUTHORIZATION="Bearer " + login.data["access"])
                self.assertEqual(client.get("/api/academics/attendance/").status_code, 200)

    def test_reset_clears_legacy_flag_and_lockout_and_revokes_old_tokens(self):
        user = self.make_user("legacy", Role.STUDENT, must_change_password=True)
        old_client = self.login(user)
        User.objects.filter(pk=user.pk).update(failed_login_attempts=5, locked_until=timezone.now() + timedelta(minutes=15))
        issued = "Reset!ByAdmin#42"
        res = self.admin_client.post(f"/api/auth/admin/users/{user.pk}/reset-password/", {"new_password": issued}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        user.refresh_from_db()
        self.assertEqual((user.must_change_password, user.failed_login_attempts, user.locked_until), (False, 0, None))
        self.assertTrue(user.check_password(issued))
        self.assertFalse(user.check_password(PASSWORD))
        self.assertEqual(old_client.get("/api/auth/me/").status_code, 401)
        self.assertEqual(APIClient().post("/api/auth/token/refresh/", {"refresh": old_client.refresh_token}, format="json").status_code, 401)
        login = APIClient().post("/api/auth/staff-login/", {"username": user.username, "password": issued}, format="json")
        self.assertEqual(login.status_code, 200, login.data)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer " + login.data["access"])
        self.assertEqual(client.get("/api/academics/attendance/").status_code, 200)

    def test_rejected_weak_reset_preserves_password_flag_and_lockout(self):
        user = self.make_user("locked", Role.TEACHER, must_change_password=True,
                              failed_login_attempts=5, locked_until=timezone.now() + timedelta(minutes=15))
        before = (user.password, user.must_change_password, user.failed_login_attempts, user.locked_until)
        res = self.admin_client.post(f"/api/auth/admin/users/{user.pk}/reset-password/", {"new_password": "12345678"}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        user.refresh_from_db()
        self.assertEqual((user.password, user.must_change_password, user.failed_login_attempts, user.locked_until), before)

    def test_legacy_flag_does_not_bypass_role_permissions(self):
        user = self.make_user("legacy-student", Role.STUDENT, must_change_password=True)
        client = self.login(user)
        self.assertEqual(client.get("/api/academics/attendance/").status_code, 200)
        self.assertEqual(client.get("/api/auth/admin/users/").status_code, 403)
        self.assertEqual(client.get("/api/auth/admin/database/").status_code, 403)

    def test_clearing_legacy_flags_is_idempotent_and_preserves_passwords_and_lockouts(self):
        legacy = self.make_user("legacy", Role.STUDENT, must_change_password=True, failed_login_attempts=3,
                                locked_until=timezone.now() + timedelta(minutes=15))
        current = self.make_user("current", Role.TEACHER)
        before = list(User.objects.order_by("pk").values_list("pk", "password", "failed_login_attempts", "locked_until"))
        clear = import_module("accounts.migrations.0002_password_set_by_admin").clear_forced_change
        for _ in range(2):
            clear(apps, None)
            self.assertFalse(User.objects.filter(must_change_password=True).exists())
            self.assertEqual(list(User.objects.order_by("pk").values_list("pk", "password", "failed_login_attempts", "locked_until")), before)
        legacy.refresh_from_db()
        current.refresh_from_db()
        self.assertFalse(legacy.must_change_password)
        self.assertFalse(current.must_change_password)
