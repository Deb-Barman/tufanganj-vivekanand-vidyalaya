from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import get_md5_hash_password

from .models import Role, User


class RoleAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    JWT login with account-lockout brute-force protection layered on top of
    Simple JWT's normal username/password check. The token payload carries
    role for UI purposes only — every actual authorization decision
    re-checks request.user against the database (accounts/permissions.py),
    never trusting this claim.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs):
        username = attrs.get(self.username_field)
        candidate = User.objects.filter(username=username).first()

        if candidate and candidate.locked_until and candidate.locked_until > timezone.now():
            minutes_left = max(1, int((candidate.locked_until - timezone.now()).total_seconds() // 60) + 1)
            raise AuthenticationFailed(
                f"Too many failed attempts. Try again in {minutes_left} minute(s), "
                "or contact the school office."
            )

        # Failed-attempt counting and lockout happen in
        # accounts.backends.LockoutModelBackend (shared with Django admin).
        data = super().validate(attrs)

        if not self.user.is_active_account:
            raise AuthenticationFailed("This account has been disabled. Contact the school office.")

        data["user"] = UserSerializer(self.user).data
        return data


class AdminPortalTokenObtainPairSerializer(RoleAwareTokenObtainPairSerializer):
    """
    Login for the *Super User* page only. Reuses every protection of the
    base serializer (lockout, disabled-account check) and then additionally
    refuses any account that is not a SUPER_ADMIN. This is enforced here on
    the server — hiding the tab in the UI would not be a security boundary.

    The rejection message is deliberately the same generic text a wrong
    password produces, so this endpoint cannot be used to discover which
    usernames belong to staff/students.
    """

    portal_roles = (Role.SUPER_ADMIN,)

    def validate(self, attrs):
        # The Super User page asks for an EMAIL. Map it to the account's
        # Django username (looked up among Super Admins only) before the
        # normal checks run. If nothing matches we leave it untouched, so
        # the failure is indistinguishable from a wrong password.
        typed = (attrs.get(self.username_field) or "").strip()
        if "@" in typed:
            match = (
                User.objects.filter(role=Role.SUPER_ADMIN, email__iexact=typed)
                .order_by("created_at")
                .first()
            )
            if match:
                attrs[self.username_field] = match.get_username()
        data = super().validate(attrs)
        if self.user.role not in self.portal_roles:
            raise AuthenticationFailed("No active account found with the given credentials")
        return data


class StaffStudentPortalTokenObtainPairSerializer(AdminPortalTokenObtainPairSerializer):
    """Login for the Student / Teacher page only — Super Admins must use their own page."""

    portal_roles = (Role.TEACHER, Role.STUDENT)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "username", "full_name", "role", "phone", "email",
            "is_active_account", "must_change_password", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AdminUserSerializer(UserSerializer):
    """What the Super Admin sees for a Teacher/Student: the normal fields plus sign-in state."""

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ["locked_until", "failed_login_attempts", "last_login"]
        read_only_fields = UserSerializer.Meta.read_only_fields + ["locked_until", "failed_login_attempts", "last_login"]


class AdminCreateUserSerializer(serializers.ModelSerializer):
    """The only path that creates a Teacher/Student account."""

    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["id", "username", "password", "full_name", "role", "phone", "email"]
        read_only_fields = ["id"]

    def validate_role(self, value):
        if value == Role.SUPER_ADMIN:
            raise serializers.ValidationError(
                "Additional Super Admin accounts must be created via `manage.py createsuperuser` "
                "on the server, not this API, to prevent privilege escalation through a "
                "compromised admin session."
            )
        return value

    def validate_username(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data, must_change_password=False)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        user = self.context["request"].user
        if user.check_password(value):
            raise serializers.ValidationError("New password must differ from the current password.")
        return value


class AdminUpdateUserSerializer(serializers.ModelSerializer):
    """Super-Admin-only edits: username, name, contact fields, disable/enable. Never touches role or password here."""

    class Meta:
        model = User
        fields = ["username", "full_name", "phone", "email", "is_active_account"]

    def validate_username(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters.")
        return value

    def validate(self, attrs):
        if self.instance and self.instance.is_super_admin:
            raise serializers.ValidationError("Super Admin accounts cannot be modified through this endpoint.")
        return attrs


class AdminResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, validators=[validate_password])


class PasswordAwareTokenRefreshSerializer(TokenRefreshSerializer):
    """
    simplejwt's CHECK_REVOKE_TOKEN only protects ACCESS tokens. A stolen
    REFRESH token kept working for 7 days even after the password was changed.
    Here the password fingerprint stored in the refresh token is compared with
    the user's current password before a new access token is issued.
    """

    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs["refresh"])
        except Exception as exc:  # expired / malformed / blacklisted -> same answer as before
            raise InvalidToken(str(exc))
        user = User.objects.filter(pk=refresh.payload.get("user_id")).first()
        if user is None or not user.is_active or not user.is_active_account:
            raise InvalidToken("Token is no longer valid.")
        if refresh.payload.get("hash_password") != get_md5_hash_password(user.password):
            raise InvalidToken("Password changed — please sign in again.")
        return super().validate(attrs)
