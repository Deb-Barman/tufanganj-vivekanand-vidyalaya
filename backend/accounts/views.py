from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .permissions import IsSuperAdmin
from .serializers import (
    AdminCreateUserSerializer,
    ChangePasswordSerializer,
    RoleAwareTokenObtainPairSerializer,
    UserSerializer,
)


class LoginView(TokenObtainPairView):
    """POST username + password -> access/refresh tokens. No signup counterpart exists."""

    serializer_class = RoleAwareTokenObtainPairSerializer


class MeView(APIView):
    """GET the current authenticated user's own profile."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """Any authenticated user can change their own password (not create one)."""

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)


class AdminUserListCreateView(generics.ListCreateAPIView):
    """
    Super-Admin-only: list all Teacher/Student accounts, or create a new one.
    This is the single entry point for onboarding — there is deliberately no
    other way to create a Teacher or Student account in this system.
    """

    permission_classes = [IsSuperAdmin]
    queryset = User.objects.exclude(role="SUPER_ADMIN").order_by("-created_at")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminCreateUserSerializer
        return UserSerializer


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Super-Admin-only: view/update/disable a specific Teacher or Student
    account. We expose disabling via PATCH {"is_active_account": false}
    rather than encouraging hard deletes, so historical records (results,
    attendance) stay intact — but DELETE is available if truly needed.
    """

    permission_classes = [IsSuperAdmin]
    queryset = User.objects.exclude(role="SUPER_ADMIN")
    serializer_class = UserSerializer
