from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User
from .permissions import IsSuperAdmin
from .serializers import (
    AdminCreateUserSerializer,
    AdminPortalTokenObtainPairSerializer,
    StaffStudentPortalTokenObtainPairSerializer,
    AdminResetPasswordSerializer,
    PasswordAwareTokenRefreshSerializer,
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


class SafeTokenRefreshView(TokenRefreshView):
    """POST /api/auth/token/refresh/ — refuses tokens issued under an old password."""

    serializer_class = PasswordAwareTokenRefreshSerializer
    throttle_classes = [LoginRateThrottle]


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    """POST /api/auth/logout/ {refresh} — blacklists the refresh token so a
    copied/stolen token stops working after sign-out. Always answers 200 so the
    app can sign out locally even if the token was already expired."""

    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                pass
        return Response({"detail": "Signed out."}, status=status.HTTP_200_OK)


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


class AdminStatsView(APIView):
    """GET /api/auth/admin/stats/ — numbers for the Super Admin command centre."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from datetime import timedelta

        from django.db.models import Count, Q
        from django.utils import timezone

        from academics.models import AcademicSession, Attendance, SchoolClass, StudentProfile, Subject
        from content.models import Achievement, Admission, Article, ContactMessage, Event, GalleryImage, SchoolForm
        from notices.models import Notice

        today = timezone.localdate()

        users = User.objects.exclude(role="SUPER_ADMIN")
        adm = Admission.objects.aggregate(
            total=Count("id"),
            pending=Count("id", filter=Q(status="PENDING")),
            contacted=Count("id", filter=Q(status="CONTACTED")),
            closed=Count("id", filter=Q(status="CLOSED")),
        )
        arts = Article.objects.aggregate(n_pub=Count("id", filter=Q(published=True)), n_draft=Count("id", filter=Q(published=False)))

        att_today = Attendance.objects.filter(date=today).aggregate(
            present=Count("id", filter=Q(status="PRESENT")), absent=Count("id", filter=Q(status="ABSENT")))
        series = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            row = Attendance.objects.filter(date=d).aggregate(
                present=Count("id", filter=Q(status="PRESENT")), absent=Count("id", filter=Q(status="ABSENT")))
            series.append({"date": str(d), **row})

        current = AcademicSession.objects.filter(is_current=True).first()
        return Response({
            "people": {
                "students": users.filter(role="STUDENT", is_active_account=True).count(),
                "teachers": users.filter(role="TEACHER", is_active_account=True).count(),
                "disabled": users.filter(is_active_account=False).count(),
                "awaiting_first_login": users.filter(must_change_password=True, is_active_account=True).count(),
                "students_without_class": StudentProfile.objects.filter(school_class__isnull=True, user__is_active_account=True).count(),
            },
            "admissions": adm,
            "content": {
                "notices": Notice.objects.count(),
                "articles_published": arts["n_pub"],
                "articles_drafts": arts["n_draft"],
                "events_upcoming": Event.objects.filter(event_date__gte=today).count(),
                "gallery": GalleryImage.objects.count(),
                "forms": SchoolForm.objects.count(),
                "achievements": Achievement.objects.count(),
            },
            "messages": {"new": ContactMessage.objects.filter(status="NEW").count(), "total": ContactMessage.objects.count()},
            "academics": {
                "sessions": AcademicSession.objects.count(),
                "classes": SchoolClass.objects.count(),
                "subjects": Subject.objects.count(),
                "current_session": current.label if current else None,
            },
            "attendance": {"today": {**att_today, "marked": att_today["present"] + att_today["absent"]}, "last7": series},
            "recent_admissions": list(Admission.objects.values("id", "applicant_name", "applying_for_class", "status", "submitted_at")[:5]),
            "recent_notices": list(Notice.objects.values("id", "title", "created_at")[:5]),
        })
