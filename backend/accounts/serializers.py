from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Role, User


class RoleAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Standard JWT login, extended so the token payload carries the user's
    role. The frontend uses this only to decide which dashboard UI to show;
    the backend never trusts the token's role claim for authorization
    decisions — every protected view re-checks request.user.role against
    the database on every request (see accounts/permissions.py).
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_active_account:
            raise serializers.ValidationError(
                "This account has been disabled. Contact the school office."
            )
        data["user"] = UserSerializer(self.user).data
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "full_name",
            "role",
            "phone",
            "email",
            "is_active_account",
            "must_change_password",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AdminCreateUserSerializer(serializers.ModelSerializer):
    """
    Used exclusively by the Super-Admin-only account creation endpoint.
    This is the ONLY way a Teacher or Student account can be created —
    there is no public-facing equivalent of this serializer/view.
    """

    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["id", "username", "password", "full_name", "role", "phone", "email"]
        read_only_fields = ["id"]

    def validate_role(self, value):
        if value == Role.SUPER_ADMIN:
            raise serializers.ValidationError(
                "Additional Super Admin accounts must be created via the Django "
                "management command (manage.py createsuperuser), not this API, "
                "to avoid privilege escalation through a compromised admin session."
            )
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
