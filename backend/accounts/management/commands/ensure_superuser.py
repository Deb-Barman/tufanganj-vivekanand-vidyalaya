"""
Create or update the Super Admin from environment variables.

Why this exists: Render's free tier has no Shell tab, so the documented
`python manage.py createsuperuser` step is not reachable. This command is
run from build.sh on every deploy and is IDEMPOTENT:

  * No SUPERUSER_* variables set  -> does nothing (safe default).
  * User does not exist           -> creates it as SUPER_ADMIN.
  * User already exists           -> makes sure it is an active SUPER_ADMIN.
                                     The password is only rewritten when
                                     SUPERUSER_FORCE_PASSWORD_RESET=true,
                                     so a password the Head Sir has already
                                     changed is never silently overwritten
                                     by a redeploy.

Environment variables (set in Render -> Environment):
  SUPERUSER_EMAIL                 required  (this is what you type on the Super User login page)
  SUPERUSER_PASSWORD              required  (min 10 chars, validated)
  SUPERUSER_USERNAME              optional  (internal Django username; defaults to the email)
  SUPERUSER_FULL_NAME             optional  (default: "Head Sir")
  SUPERUSER_FORCE_PASSWORD_RESET  optional  (true = overwrite password)

The password is never printed or logged.
"""
import os

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.core.management.base import BaseCommand, CommandError

from accounts.models import Role, User


def _truthy(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


class Command(BaseCommand):
    help = "Create/refresh the Super Admin account from SUPERUSER_* environment variables."

    def handle(self, *args, **options):
        email = (os.environ.get("SUPERUSER_EMAIL") or "").strip().lower()
        password = os.environ.get("SUPERUSER_PASSWORD") or ""
        # The email doubles as the Django username unless overridden.
        username = (os.environ.get("SUPERUSER_USERNAME") or email).strip()
        full_name = (os.environ.get("SUPERUSER_FULL_NAME") or "Head Sir").strip()
        force_reset = _truthy(os.environ.get("SUPERUSER_FORCE_PASSWORD_RESET"))

        if not email and not password:
            self.stdout.write("ensure_superuser: SUPERUSER_EMAIL/PASSWORD not set — skipping.")
            return

        if not email or not password:
            raise CommandError("Set BOTH SUPERUSER_EMAIL and SUPERUSER_PASSWORD (or neither).")
        try:
            validate_email(email)
        except ValidationError:
            raise CommandError("SUPERUSER_EMAIL is not a valid email address.")

        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError("SUPERUSER_PASSWORD rejected: " + " ".join(exc.messages))

        user = User.objects.filter(username=username).first()

        if user is None:
            User.objects.create_superuser(
                username=username,
                password=password,
                email=email,
                full_name=full_name,
                # The person who set this password in Render's dashboard
                # chose it deliberately; forcing an immediate change would
                # just lock the Head Sir out of the admin login page.
                must_change_password=False,
                is_active_account=True,
            )
            self.stdout.write(self.style.SUCCESS(f"ensure_superuser: created Super Admin '{username}'."))
            return

        changed = []
        if user.role != Role.SUPER_ADMIN:
            user.role = Role.SUPER_ADMIN
            changed.append("role")
        if not user.is_staff:
            user.is_staff = True
            changed.append("is_staff")
        if not user.is_superuser:
            user.is_superuser = True
            changed.append("is_superuser")
        if not user.is_active_account:
            user.is_active_account = True
            changed.append("is_active_account")
        if not user.is_active:
            user.is_active = True
            changed.append("is_active")
        if user.email != email:
            user.email = email
            changed.append("email")
        if user.failed_login_attempts or user.locked_until:
            user.failed_login_attempts = 0
            user.locked_until = None
            changed.append("lockout cleared")
        if force_reset:
            user.set_password(password)
            user.must_change_password = False
            changed.append("password (forced)")

        if changed:
            user.save()
            self.stdout.write(self.style.SUCCESS(
                f"ensure_superuser: updated '{username}' ({', '.join(changed)})."
            ))
        else:
            self.stdout.write(f"ensure_superuser: '{username}' already up to date.")
