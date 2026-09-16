"""
Custom user model for TVV Portal.

Per context.md:
- No public sign up / registration.
- Only Super Admin creates Student and Teacher accounts.
- Never store plaintext passwords (Django's AbstractUser hashes passwords by
  default via PBKDF2 — we keep that; do NOT replace with anything weaker).
"""
import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    TEACHER = "TEACHER", "Teacher"
    STUDENT = "STUDENT", "Student"


class UserManager(BaseUserManager):
    """
    Custom manager: user creation always goes through create_user /
    create_superuser (the latter used by `manage.py createsuperuser` for the
    very first Super Admin only). There is no self-serve registration
    endpoint anywhere in this project — see accounts/views.py and
    accounts/permissions.py.
    """

    use_in_migrations = True

    def _create_user(self, username, password, **extra_fields):
        if not username:
            raise ValueError("Users must have a username")
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, password, **extra_fields)

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", Role.SUPER_ADMIN)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        return self._create_user(username, password, **extra_fields)


class User(AbstractUser):
    """
    Extends Django's built-in user. `username` is the school-issued login
    (e.g. an admin-assigned handle or roll-number style ID) rather than an
    email, since students/teachers are onboarded by the school, not by
    signing up with their own email address.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, choices=Role.choices, db_index=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True)
    is_active_account = models.BooleanField(
        default=True,
        help_text="Super Admin can disable an account without deleting it.",
    )
    must_change_password = models.BooleanField(
        default=True,
        help_text="True until the user changes the password Super Admin assigned them.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def is_super_admin(self):
        return self.role == Role.SUPER_ADMIN

    @property
    def is_teacher(self):
        return self.role == Role.TEACHER

    @property
    def is_student(self):
        return self.role == Role.STUDENT
