from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Role, User

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)


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
        try:
            candidate = User.objects.get(username=username)
        except User.DoesNotExist:
            candidate = None

        if candidate and candidate.locked_until and candidate.locked_until > timezone.now():
            minutes_left = max(1, int((candidate.locked_until - timezone.now()).total_seconds() // 60))
            raise AuthenticationFailed(
                f"Too many failed attempts. Try again in {minutes_left} minute(s), "
                "or contact the school office."
            )

        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            if candidate:
                candidate.failed_login_attempts += 1
                if candidate.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                    candidate.locked_until = timezone.now() + LOCKOUT_DURATION
                candidate.save(update_fields=["failed_login_attempts", "locked_until"])
            raise

        if not self.user.is_active_account:
            raise AuthenticationFailed("This account has been disabled. Contact the school office.")

        # Successful login: reset the lockout counter.
        if self.user.failed_login_attempts or self.user.locked_until:
            self.user.failed_login_attempts = 0
            self.user.locked_until = None
            self.user.save(update_fields=["failed_login_attempts", "locked_until"])

        data["user"] = UserSerializer(self.user).data
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "username", "full_name", "role", "phone", "email",
            "is_active_account", "must_change_password", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


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
        user = User(**validated_data, must_change_password=True)
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
    """Super-Admin-only edits: disable/enable, edit contact fields. Never touches role or password here."""

    class Meta:
        model = User
        fields = ["full_name", "phone", "email", "is_active_account"]

    def validate(self, attrs):
        if self.instance and self.instance.is_super_admin:
            raise serializers.ValidationError("Super Admin accounts cannot be modified through this endpoint.")
        return attrs


class AdminResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
