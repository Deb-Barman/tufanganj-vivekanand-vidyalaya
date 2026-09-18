from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny

from accounts.permissions import IsAuthenticatedActiveUser, IsSuperAdmin, IsSuperAdminOrReadOnly, IsSuperAdminOrTeacher

from .models import AcademicSession, Attendance, Marksheet, Result, SchoolClass, StudentProfile, Subject, TeacherProfile
from .serializers import (
    AcademicSessionSerializer,
    AttendanceSerializer,
    MarksheetSerializer,
    ResultSerializer,
    SchoolClassSerializer,
    StudentProfileSerializer,
    SubjectSerializer,
    TeacherProfileSerializer,
)


# --- Reference data: sessions/classes/subjects — read for any active user, write Super-Admin-only ---

class AcademicSessionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = AcademicSessionSerializer
    queryset = AcademicSession.objects.all()


class SchoolClassListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = SchoolClassSerializer
    queryset = SchoolClass.objects.all()


class SubjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = SubjectSerializer
    queryset = Subject.objects.all()


# --- Teacher directory: a public read for the website's Faculty section
# (teacher name/department/bio are meant to be public, like a staff page —
# distinct from student data, which is never public), plus an authenticated
# list for the portal and a self-edit endpoint for the teacher's own row. ---

class PublicTeacherListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = TeacherProfileSerializer
    queryset = TeacherProfile.objects.select_related("user").all()


class TeacherProfileListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = TeacherProfileSerializer
    queryset = TeacherProfile.objects.select_related("user").all()


class MyTeacherProfileView(generics.RetrieveUpdateAPIView):
    """A teacher can view/edit only their own profile (bio, department)."""

    permission_classes = [IsSuperAdminOrTeacher]
    serializer_class = TeacherProfileSerializer

    def get_object(self):
        if self.request.user.is_teacher:
            obj, _ = TeacherProfile.objects.get_or_create(user=self.request.user)
            return obj
        raise PermissionDenied("Only teachers have a teacher profile to edit here.")


# --- Attendance: THE key security boundary. A student's queryset is
# filtered to their own profile ONLY — never trust a query param for this. ---

class AttendanceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = AttendanceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin or user.is_teacher:
            qs = Attendance.objects.select_related("student__user").all()
            # Optional filter by student, but only staff may use it — a
            # student can never widen their own query via ?student=<other-id>
            # because the branch below overrides this entirely for students.
            student_id = self.request.query_params.get("student")
            if student_id:
                qs = qs.filter(student_id=student_id)
            return qs
        # Student: hard-scoped to their own profile, ignoring any query params.
        return Attendance.objects.filter(student__user=user)

    def perform_create(self, serializer):
        if self.request.user.is_student:
            raise PermissionDenied("Students cannot record attendance.")
        serializer.save(marked_by=self.request.user)


class AttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrTeacher]
    serializer_class = AttendanceSerializer
    queryset = Attendance.objects.all()


# --- Results: identical scoping pattern to Attendance. ---

class ResultListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = ResultSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin or user.is_teacher:
            qs = Result.objects.select_related("student__user", "subject").all()
            student_id = self.request.query_params.get("student")
            if student_id:
                qs = qs.filter(student_id=student_id)
            return qs
        return Result.objects.filter(student__user=user)

    def perform_create(self, serializer):
        if self.request.user.is_student:
            raise PermissionDenied("Students cannot record results.")
        serializer.save(recorded_by=self.request.user)


class ResultDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrTeacher]
    serializer_class = ResultSerializer
    queryset = Result.objects.all()


# --- Marksheets: same scoping; write is Super-Admin-only (a generated/uploaded document). ---

class MarksheetListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = MarksheetSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin or user.is_teacher:
            return Marksheet.objects.select_related("student__user").all()
        return Marksheet.objects.filter(student__user=user)


class MarksheetCreateView(generics.CreateAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = MarksheetSerializer
    queryset = Marksheet.objects.all()


class MarksheetDetailView(generics.RetrieveDestroyAPIView):
    """
    Retrieve is scoped the same as list; a student fetching another
    student's marksheet by ID must 404, not 200. DELETE is blocked for
    students explicitly — IsAuthenticatedActiveUser alone would let a
    student DELETE their own row, which is wrong for an official record.
    """

    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = MarksheetSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin or user.is_teacher:
            return Marksheet.objects.all()
        return Marksheet.objects.filter(student__user=user)

    def perform_destroy(self, instance):
        if not (self.request.user.is_super_admin or self.request.user.is_teacher):
            raise PermissionDenied("You cannot delete a marksheet.")
        instance.delete()
