"""
Lockout lives in the authentication backend so it protects EVERY way of
signing in — the portal's JWT login pages AND Django's own /admin/ login
(which previously had no brute-force protection at all).

Rules: 5 wrong passwords lock the account for 15 minutes; a correct password
(while not locked) resets the counter.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.utils import timezone

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)


class LockoutModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if username is None or password is None:
            return None

        candidate = User.objects.filter(**{User.USERNAME_FIELD: username}).first()

        if candidate and candidate.locked_until and candidate.locked_until > timezone.now():
            return None  # locked: refuse even a correct password

        user = super().authenticate(request, username=username, password=password, **kwargs)

        if user is None:
            if candidate is not None:
                candidate.failed_login_attempts += 1
                fields = ["failed_login_attempts"]
                if candidate.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                    candidate.locked_until = timezone.now() + LOCKOUT_DURATION
                    fields.append("locked_until")
                candidate.save(update_fields=fields)
            return None

        if user.failed_login_attempts or user.locked_until:
            user.failed_login_attempts = 0
            user.locked_until = None
            user.save(update_fields=["failed_login_attempts", "locked_until"])
        return user
