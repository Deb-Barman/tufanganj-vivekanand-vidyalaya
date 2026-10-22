"""
Lockout lives in the authentication backend so it protects EVERY way of signing in — the portal's JWT login pages AND
Django's own /admin/ login.

Rules
- 5 wrong passwords for a username FROM THE SAME NETWORK ADDRESS block that address (for that username) for 15 minutes.
  A stranger guessing a classmate's password therefore only blocks themselves, never the real owner.
- 30 wrong passwords in total, from anywhere, lock the whole account for 15 minutes (the Super Admin can unlock it).
- A correct password resets everything for that account.
- The "too many attempts" answer is identical for real and made-up usernames, so it cannot be used to find usernames.
"""
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.utils import timezone

MAX_FAILED_ATTEMPTS = 5  # per username + address
ACCOUNT_LOCK_THRESHOLD = 30  # per username, all addresses together
LOCKOUT_DURATION = timedelta(minutes=15)
LOCK_MESSAGE = "Too many failed attempts. Try again in {m} minute(s), or contact the school office."


def attempt_ip(request) -> str:
    """The network address the attempt came from. Behind a proxy the LAST X-Forwarded-For entry is the one the proxy
    itself added (earlier ones can be typed by the visitor), so that is the one used — unless NUM_PROXIES is set, in
    which case Django REST framework's own rule is followed."""
    if request is None:
        return "unknown"
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        if settings.REST_FRAMEWORK.get("NUM_PROXIES") is not None:
            from config.clientip import client_ip

            return client_ip(request) or "unknown"
        return forwarded.split(",")[-1].strip()[:64] or "unknown"
    return (request.META.get("REMOTE_ADDR") or "unknown")[:64]


def _minutes(until, now) -> int:
    return max(1, int((until - now).total_seconds() // 60) + 1)


def lock_message(request, username):
    """None when the person may try; otherwise the (uniform) message to show."""
    from .models import LoginFailure

    if not username:
        return None
    now = timezone.now()
    pair = LoginFailure.objects.filter(username=username.lower(), ip=attempt_ip(request)).first()
    if pair and pair.count >= MAX_FAILED_ATTEMPTS and pair.updated_at + LOCKOUT_DURATION > now:
        return LOCK_MESSAGE.format(m=_minutes(pair.updated_at + LOCKOUT_DURATION, now))
    User = get_user_model()
    locked = User.objects.filter(**{User.USERNAME_FIELD: username}).values_list("locked_until", flat=True).first()
    if locked and locked > now:
        return LOCK_MESSAGE.format(m=_minutes(locked, now))
    return None


def forget_failures(username):
    from .models import LoginFailure

    LoginFailure.objects.filter(username=username.lower()).delete()


def _record_failure(request, username, candidate):
    from .models import LoginFailure

    now = timezone.now()
    key, ip = username.lower(), attempt_ip(request)
    LoginFailure.objects.filter(updated_at__lt=now - timedelta(days=1)).delete()  # tidy up old rows as we go
    row, _ = LoginFailure.objects.get_or_create(username=key, ip=ip, defaults={"count": 0, "updated_at": now})
    if row.updated_at + LOCKOUT_DURATION <= now:
        row.count = 0  # the block has run out — start counting again
    row.count += 1
    row.updated_at = now
    row.save(update_fields=["count", "updated_at"])
    if candidate is not None:
        candidate.failed_login_attempts += 1
        fields = ["failed_login_attempts"]
        if candidate.failed_login_attempts >= ACCOUNT_LOCK_THRESHOLD:
            candidate.locked_until = now + LOCKOUT_DURATION
            fields.append("locked_until")
        candidate.save(update_fields=fields)


class LockoutModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if username is None or password is None:
            return None

        if lock_message(request, username):
            return None  # blocked: refuse even a correct password

        candidate = User.objects.filter(**{User.USERNAME_FIELD: username}).first()
        user = super().authenticate(request, username=username, password=password, **kwargs)

        if user is None:
            _record_failure(request, username, candidate)
            return None

        forget_failures(username)
        if user.failed_login_attempts or user.locked_until:
            user.failed_login_attempts = 0
            user.locked_until = None
            user.save(update_fields=["failed_login_attempts", "locked_until"])
        return user
