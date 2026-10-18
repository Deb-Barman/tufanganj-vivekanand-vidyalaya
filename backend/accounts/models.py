"""
Custom user model for TVV Portal.

Architecture note: Django owns authentication and authorization end to
end. Supabase is used only as the managed Postgres instance (via
DATABASE_URL) and for Storage (media files) — NOT for Supabase Auth and
NOT for Row Level Security as an access-control layer. Every permission
check in this project happens in Django/DRF (accounts/permissions.py),
because context.md requires "the backend must enforce authentication and
authorization" and "never rely on frontend checks for security" — Django
is that backend.

Security invariants for this model:
- No public registration endpoint exists anywhere in this project.
- Passwords are always hashed via Django's default PBKDF2 hasher.
- A disabled account (is_active_account=False) fails authentication even
  with a valid password — checked in both the login serializer and the
  DRF permission classes, not just one place.
"""
import uuid

from django.conf import settings
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    TEACHER = "TEACHER", "Teacher"
    STUDENT = "STUDENT", "Student"


class UserManager(BaseUserManager):
    """
    All user creation goes through create_user/create_superuser. There is
    no self-serve registration path — Teacher/Student accounts are created
    exclusively via accounts.views.AdminUserListCreateView (Super-Admin-only,
    see accounts/permissions.py), and the first Super Admin is created via
    `manage.py createsuperuser` on the server.
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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, choices=Role.choices, db_index=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True)
    is_active_account = models.BooleanField(
        default=True,
        help_text="Super Admin can disable an account without deleting it.",
    )
    must_change_password = models.BooleanField(
        default=False,
        help_text="Legacy flag, no longer used: the password the Super Admin sets is the user's real password.",
    )
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
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


def profile_photo_path(instance, filename):
    # A random name per upload: the old photo URL stops working the moment a new one is saved.
    return f"profiles/{instance.user_id}/{uuid.uuid4().hex}.jpg"


class PublicProfile(models.Model):
    """
    The "About me" page a student or teacher writes for themselves (shown at /profile/<role>/<username>).

    Kept in its own table ON PURPOSE: everything in here is allowed to be public, and nothing private
    (phone, e-mail, guardian, roll number, marks, attendance) is ever stored here. The public API
    serialises only this table plus the class / department name, so private data cannot leak by accident.
    It is hidden until the owner switches `is_public` on (opt-in), and the Super Admin can switch it off.
    """

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True, related_name="public_profile")
    headline = models.CharField(max_length=120, blank=True)
    about = models.TextField(max_length=1200, blank=True)
    background = models.TextField(max_length=1500, blank=True)
    talents = models.JSONField(default=list, blank=True)
    interests = models.JSONField(default=list, blank=True)
    achievements = models.TextField(max_length=1500, blank=True)
    website = models.URLField(max_length=200, blank=True)
    photo = models.ImageField(upload_to=profile_photo_path, blank=True, null=True)
    is_public = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "public_profiles"

    def __str__(self):
        return f"Profile of {self.user.username}"
