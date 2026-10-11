"""Shared helpers for the test suites (not a test module itself)."""
import shutil
import tempfile

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from accounts.models import Role, User

PASSWORD = "Str0ng!Pass#99"
_MEDIA = tempfile.mkdtemp(prefix="tvv-test-media-")


@override_settings(MEDIA_ROOT=_MEDIA, PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class BaseAPITestCase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()  # DRF throttle counters live in the cache

    # -- builders ----------------------------------------------------------
    def make_user(self, username, role, **extra):
        extra.setdefault("must_change_password", False)
        extra.setdefault("full_name", username.title())
        return User.objects.create_user(username=username, password=PASSWORD, role=role, **extra)

    def make_admin(self, username="head@school.test"):
        return self.make_user(username, Role.SUPER_ADMIN, is_staff=True, is_superuser=True, email=username)

    # -- clients -----------------------------------------------------------
    def login(self, user, portal=None):
        portal = portal or ("admin" if user.role == Role.SUPER_ADMIN else "staff")
        client = APIClient()
        res = client.post(f"/api/auth/{portal}-login/", {"username": user.username, "password": PASSWORD}, format="json")
        assert res.status_code == 200, res.data
        client.credentials(HTTP_AUTHORIZATION="Bearer " + res.data["access"])
        client.refresh_token = res.data["refresh"]
        return client
