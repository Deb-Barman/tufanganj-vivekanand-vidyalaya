from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .permissions import IsSuperAdmin
from .serializers import (
    AdminCreateUserSerializer,
    AdminPortalTokenObtainPairSerializer,
    StaffStudentPortalTokenObtainPairSerializer,
    AdminResetPasswordSerializer,
    AdminUpdateUserSerializer,
    ChangePasswordSerializer,
    UserSerializer,
)


class LoginRateThrottle(SimpleRateThrottle):
    """Per-IP cap on sign-in attempts (on top of the per-account lockout)."""

    scope = "login"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class AdminPortalLoginView(TokenObtainPairView):
    """POST /api/auth/admin-login/ — Super User page. Rejects every non-Super-Admin."""

    serializer_class = AdminPortalTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]


class StaffStudentPortalLoginView(TokenObtainPairView):
    """POST /api/auth/staff-login/ — Student/Teacher page. Rejects Super Admins."""

    serializer_class = StaffStudentPortalTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """Any authenticated user changes their own password (never creates one)."""

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)


class AdminUserListCreateView(generics.ListCreateAPIView):
    """Super-Admin-only: list Teacher/Student accounts, or create a new one."""

    permission_classes = [IsSuperAdmin]
    queryset = User.objects.exclude(role="SUPER_ADMIN").order_by("-created_at")

    def get_serializer_class(self):
        return AdminCreateUserSerializer if self.request.method == "POST" else UserSerializer


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Super-Admin-only: view/edit/disable/delete a Teacher or Student account."""

    permission_classes = [IsSuperAdmin]
    queryset = User.objects.exclude(role="SUPER_ADMIN")

    def get_serializer_class(self):
        return AdminUpdateUserSerializer if self.request.method in ("PATCH", "PUT") else UserSerializer


class AdminResetPasswordView(APIView):
    """Super-Admin-only: force-reset a Teacher/Student's password (e.g. they forgot it)."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.exclude(role="SUPER_ADMIN").get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = True
        user.failed_login_attempts = 0
        user.locked_until = None
        user.save(update_fields=["password", "must_change_password", "failed_login_attempts", "locked_until"])
        return Response({"detail": "Password reset. User must change it on next login."})
