from django.db import transaction
from rest_framework import generics, serializers as drf_serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny

from accounts.models import Role, User
from accounts.permissions import IsAuthenticatedActiveUser, IsSuperAdmin, IsSuperAdminOrReadOnly, IsSuperAdminOrTeacher

from .models import (
    AcademicSession,
    Attendance,
    ClassEnrollment,
    Exam,
    Homework,
    HomeworkCompletion,
    Marksheet,
    PromotionBatch,
    Result,
    SchoolClass,
    StudentProfile,
    Subject,
    TeacherAttendance,
    TeacherProfile,
    TimetableEntry,
)
from .serializers import (
    AcademicSessionSerializer,
    ExamSerializer,
    HomeworkSerializer,
    TimetableEntrySerializer,
    AttendanceSerializer,
    BulkAttendanceSerializer,
    BulkResultSerializer,
    BulkTeacherAttendanceSerializer,
    MarksheetSerializer,
    PublicTeacherSerializer,
    ResultSerializer,
    SchoolClassSerializer,
    StudentProfileSerializer,
    SubjectSerializer,
    TeacherAttendanceSerializer,
    TeacherProfileSerializer,
)


# --- Reference data: sessions/classes/subjects — read for any active user, write Super-Admin-only ---

class AcademicSessionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = AcademicSessionSerializer
    queryset = AcademicSession.objects.all()


class AcademicSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = AcademicSessionSerializer
    queryset = AcademicSession.objects.all()


class SchoolClassListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = SchoolClassSerializer

    def get_queryset(self):
        qs = SchoolClass.objects.select_related("session")
        session = self.request.query_params.get("session")
        return qs.filter(session_id=session) if session else qs


class SchoolClassDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = SchoolClassSerializer
    queryset = SchoolClass.objects.all()


class SubjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = SubjectSerializer

    def get_queryset(self):
        qs = Subject.objects.select_related("school_class")
        school_class = self.request.query_params.get("school_class")
        return qs.filter(school_class_id=school_class) if school_class else qs


class SubjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = SubjectSerializer
    queryset = Subject.objects.all()


# --- Teacher directory: a public read for the website's Faculty section
# (teacher name/department/bio are meant to be public, like a staff page —
# distinct from student data, which is never public), plus an authenticated
# list for the portal and a self-edit endpoint for the teacher's own row. ---

class PublicTeacherListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicTeacherSerializer
    queryset = TeacherProfile.objects.select_related("user", "user__public_profile").prefetch_related("subjects_taught").all()


class TeacherProfileListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = TeacherProfileSerializer
    queryset = TeacherProfile.objects.select_related("user", "user__public_profile").all()


class TeacherProfileDetailView(generics.RetrieveUpdateAPIView):
    """Super Admin edits any teacher's department / bio / subjects (teachers edit their own via /teachers/me/)."""

    permission_classes = [IsSuperAdmin]
    serializer_class = TeacherProfileSerializer
    queryset = TeacherProfile.objects.select_related("user")


class MyTeacherProfileView(generics.RetrieveUpdateAPIView):
    """A teacher can view/edit only their own profile (bio, department)."""

    permission_classes = [IsSuperAdminOrTeacher]
    serializer_class = TeacherProfileSerializer

    def get_object(self):
        if self.request.user.is_teacher:
            obj, _ = TeacherProfile.objects.get_or_create(user=self.request.user)
            return obj
        raise PermissionDenied("Only teachers have a teacher profile to edit here.")


# --- Student profiles: staff can list (needed to pick a student when marking
# attendance/results); only the Super Admin can edit class/roll/guardian. A
# student sees only their own. Profiles are created automatically when a
# Student account is created (academics/signals.py). ---

class StudentProfileListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = StudentProfileSerializer

    def get_queryset(self):
        user = self.request.user
        qs = StudentProfile.objects.select_related("user", "school_class")
        if user.is_super_admin or user.is_teacher:
            qs = qs.filter(user__is_active_account=True)
            school_class = self.request.query_params.get("school_class")
            if school_class == "none":
                qs = qs.filter(school_class__isnull=True)
            elif school_class:
                qs = qs.filter(school_class_id=school_class)
            alumni = self.request.query_params.get("alumni")
            if alumni == "only":
                qs = qs.filter(is_alumni=True)
            elif alumni == "hide":
                qs = qs.filter(is_alumni=False)
            search = (self.request.query_params.get("search") or "").strip()
            if search:
                from django.db.models import Q
                qs = qs.filter(Q(user__full_name__icontains=search) | Q(roll_number__icontains=search) | Q(user__username__icontains=search))
            return qs
        return qs.filter(user=user)


class StudentProfileDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = StudentProfileSerializer

    def get_permissions(self):
        # Reads: any active user (queryset below scopes students to themselves).
        # Writes: Super Admin only.
        if self.request.method in ("PUT", "PATCH"):
            return [IsSuperAdmin()]
        return [IsAuthenticatedActiveUser()]

    def get_queryset(self):
        user = self.request.user
        qs = StudentProfile.objects.select_related("user", "school_class")
        if user.is_super_admin or user.is_teacher:
            return qs
        return qs.filter(user=user)


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
            date = self.request.query_params.get("date")
            if date:
                qs = qs.filter(date=date)
            school_class = self.request.query_params.get("school_class")
            if school_class:
                qs = qs.filter(student__school_class_id=school_class)
            return qs
        # Student: hard-scoped to their own profile, ignoring any query params.
        return Attendance.objects.filter(student__user=user)

    def create(self, request, *args, **kwargs):
        if request.user.is_student:
            raise PermissionDenied("Students cannot record attendance.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        if self.request.user.is_student:
            raise PermissionDenied("Students cannot record attendance.")
        serializer.save(marked_by=self.request.user)


class AttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrTeacher]
    serializer_class = AttendanceSerializer
    queryset = Attendance.objects.all()


# --- Teacher attendance: the Super Admin takes it (like a class register for staff). A teacher may read
# their OWN days only; students have no access at all. ---

class TeacherAttendanceListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = TeacherAttendanceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin:
            qs = TeacherAttendance.objects.select_related("teacher").all()
            p = self.request.query_params
            if p.get("teacher"):
                qs = qs.filter(teacher_id=p["teacher"])
            if p.get("date"):
                qs = qs.filter(date=p["date"])
            month = p.get("month", "")  # YYYY-MM
            if len(month) == 7 and month[:4].isdigit() and month[5:].isdigit():
                qs = qs.filter(date__year=int(month[:4]), date__month=int(month[5:]))
            return qs
        if user.is_teacher:
            # Hard-scoped to the caller: a query param can never widen this.
            return TeacherAttendance.objects.filter(teacher=user)
        raise PermissionDenied("Students cannot view teacher attendance.")


class TeacherAttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = TeacherAttendanceSerializer
    queryset = TeacherAttendance.objects.select_related("teacher")


class TeacherAttendanceSheetView(APIView):
    """GET ?date=YYYY-MM-DD — every active teacher with that day's mark (null = not marked yet)."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        import datetime

        from django.utils import timezone

        raw = request.query_params.get("date")
        try:
            day = datetime.datetime.strptime(raw, "%Y-%m-%d").date() if raw else timezone.localdate()
        except ValueError:
            raise ValidationError({"date": "Use the format YYYY-MM-DD."})
        marks = dict(TeacherAttendance.objects.filter(date=day).values_list("teacher_id", "status"))
        teachers = User.objects.filter(role=Role.TEACHER, is_active_account=True).select_related("teacher_profile").order_by("full_name")
        rows = []
        for t in teachers:
            profile = getattr(t, "teacher_profile", None)
            rows.append({"teacher": str(t.id), "full_name": t.full_name, "department": getattr(profile, "department", "") or "", "status": marks.get(t.id)})
        return Response({"date": str(day), "teachers": rows})


class BulkTeacherAttendanceView(APIView):
    permission_classes = [IsSuperAdmin]

    @transaction.atomic
    def post(self, request):
        ser = BulkTeacherAttendanceSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        date = ser.validated_data["date"]
        saved = 0
        for rec in ser.validated_data["records"]:
            TeacherAttendance.objects.update_or_create(
                teacher=rec["teacher"], date=date,
                defaults={"status": rec["status"], "marked_by": request.user},
            )
            saved += 1
        return Response({"saved": saved, "date": str(date)}, status=status.HTTP_200_OK)


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
            for param in ("subject", "session"):
                value = self.request.query_params.get(param)
                if value:
                    qs = qs.filter(**{f"{param}_id": value})
            if self.request.query_params.get("term"):
                qs = qs.filter(term=self.request.query_params["term"])
            return qs
        return Result.objects.filter(student__user=user).select_related("subject")

    def create(self, request, *args, **kwargs):
        if request.user.is_student:
            raise PermissionDenied("Students cannot record results.")
        return super().create(request, *args, **kwargs)

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


class MarksheetDetailView(generics.RetrieveUpdateDestroyAPIView):
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

    def perform_update(self, serializer):
        # Marksheets are official documents: only the Super Admin may replace/re-assign one.
        if not self.request.user.is_super_admin:
            raise PermissionDenied("Only the Super Admin can edit a marksheet.")
        serializer.save()


# --- Bulk entry (class-wide attendance / marks in one request) -----------------
# Staff-only. The students in a payload are checked to exist; marks are checked
# against full marks. All-or-nothing inside one transaction.

class BulkAttendanceView(APIView):
    permission_classes = [IsSuperAdminOrTeacher]

    @transaction.atomic
    def post(self, request):
        ser = BulkAttendanceSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        date = ser.validated_data["date"]
        saved = 0
        for rec in ser.validated_data["records"]:
            Attendance.objects.update_or_create(
                student=rec["student"], date=date,
                defaults={"status": rec["status"], "marked_by": request.user},
            )
            saved += 1
        return Response({"saved": saved, "date": str(date)}, status=status.HTTP_200_OK)


class BulkResultView(APIView):
    permission_classes = [IsSuperAdminOrTeacher]

    @transaction.atomic
    def post(self, request):
        ser = BulkResultSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        saved = 0
        for rec in d["records"]:
            Result.objects.update_or_create(
                student=rec["student"], subject=d["subject"], session=d["session"], term=d["term"],
                defaults={"marks_obtained": rec["marks_obtained"], "full_marks": d["full_marks"], "recorded_by": request.user},
            )
            saved += 1
        return Response({"saved": saved}, status=status.HTTP_200_OK)


# --- Timetable -------------------------------------------------------------
# Everyone signed in can READ what concerns them; only the Super Admin edits.

def _own_class_id(user):
    profile = StudentProfile.objects.filter(user=user).only("school_class_id").first()
    return profile.school_class_id if profile else None


def _own_class_ids(user) -> set:
    """Every class this student has been in (current and earlier years) — all of them stay readable."""
    from .enrollment import class_ids_for

    profile = StudentProfile.objects.filter(user=user).only("school_class_id").first()
    return {str(i) for i in class_ids_for(profile)} if profile else set()


def _student_class_scope(request):
    """The class a student is looking at: ?school_class=<id> if it is one of THEIR classes, otherwise the current one."""
    wanted = request.query_params.get("school_class")
    if wanted and str(wanted) in _own_class_ids(request.user):
        return wanted
    return _own_class_id(request.user)


class TimetableListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = TimetableEntrySerializer

    def get_queryset(self):
        user = self.request.user
        qs = TimetableEntry.objects.select_related("subject", "teacher", "school_class")
        if user.is_student:  # hard-scoped to the student's own classes (current by default; earlier years on request)
            return qs.filter(school_class_id=_student_class_scope(self.request))
        q = self.request.query_params
        if q.get("school_class"):
            qs = qs.filter(school_class_id=q["school_class"])
        if q.get("mine") == "1" and user.is_teacher:
            qs = qs.filter(teacher=user)
        if q.get("weekday") not in (None, ""):
            qs = qs.filter(weekday=q["weekday"])
        return qs


class TimetableDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = TimetableEntrySerializer

    def get_queryset(self):
        user = self.request.user
        qs = TimetableEntry.objects.select_related("subject", "teacher")
        return qs.filter(school_class_id__in=_own_class_ids(user)) if user.is_student else qs


# --- Homework --------------------------------------------------------------

class HomeworkListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = HomeworkSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Homework.objects.select_related("subject", "school_class", "created_by")
        if user.is_student:
            qs = qs.filter(school_class_id=_student_class_scope(self.request))
        elif self.request.query_params.get("school_class"):
            qs = qs.filter(school_class_id=self.request.query_params["school_class"])
        if self.request.query_params.get("upcoming") == "1":
            from django.utils import timezone

            qs = qs.filter(due_date__gte=timezone.localdate())
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if user.is_authenticated and user.is_student:
            ctx["done_ids"] = set(HomeworkCompletion.objects.filter(student__user=user).values_list("homework_id", flat=True))
        return ctx

    def create(self, request, *args, **kwargs):
        if request.user.is_student:
            raise PermissionDenied("Students cannot set homework.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class HomeworkDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Staff can change/delete homework they set (Super Admin: any). Students can only read their class's."""

    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = HomeworkSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Homework.objects.select_related("subject", "school_class", "created_by")
        if user.is_student:
            return qs.filter(school_class_id__in=_own_class_ids(user))
        if user.is_teacher and self.request.method not in ("GET", "HEAD", "OPTIONS"):
            return qs.filter(created_by=user)
        return qs

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.user.is_student and request.method not in ("GET", "HEAD", "OPTIONS"):
            raise PermissionDenied("Students cannot change homework.")


class HomeworkDoneView(APIView):
    """POST /academics/homework/<id>/done/ {done: true|false} — a student ticks or unticks their own item."""

    permission_classes = [IsAuthenticatedActiveUser]

    def post(self, request, pk):
        if not request.user.is_student:
            raise PermissionDenied("Only students tick homework as done.")
        profile = StudentProfile.objects.filter(user=request.user).first()
        hw = Homework.objects.filter(pk=pk, school_class_id=profile.school_class_id if profile else None).first()
        if hw is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        done = bool(request.data.get("done", True))
        phase = hw.phase()
        if phase == "closed":
            raise ValidationError({"detail": f"The end date for this homework was {hw.due_date:%d %b %Y}. It can no longer be changed."})
        if phase == "upcoming":
            raise ValidationError({"detail": f"This homework opens on {hw.opens_on:%d %b %Y}."})
        if done:
            HomeworkCompletion.objects.get_or_create(homework=hw, student=profile)
        else:
            HomeworkCompletion.objects.filter(homework=hw, student=profile).delete()
        return Response({"id": str(hw.id), "done": done})


class HomeworkCompletionsView(APIView):
    """GET /academics/homework/<id>/completions/ — staff see, per student in the class, who ticked it done.

    Super Admin: any homework. Teacher: only homework they set (same rule as editing it).
    """

    permission_classes = [IsSuperAdminOrTeacher]

    def get(self, request, pk):
        qs = Homework.objects.select_related("school_class")
        if request.user.is_teacher:
            qs = qs.filter(created_by=request.user)
        hw = qs.filter(pk=pk).first()
        if hw is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        done = {c.student_id: c.completed_at for c in hw.completions.all()}
        students = StudentProfile.objects.filter(school_class=hw.school_class).select_related("user")
        rows = [
            {
                "student": str(sp.user_id),
                "full_name": sp.user.full_name,
                "roll_number": sp.roll_number,
                "done": sp.user_id in done,
                "completed_at": done.get(sp.user_id),
            }
            for sp in students
        ]
        return Response({"homework": str(hw.id), "title": hw.title, "class_name": hw.school_class.name, "students": rows})


# --- Exams -----------------------------------------------------------------

class ExamListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = ExamSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Exam.objects.select_related("subject", "school_class")
        if user.is_student:
            qs = qs.filter(school_class_id=_student_class_scope(self.request))
        elif self.request.query_params.get("school_class"):
            qs = qs.filter(school_class_id=self.request.query_params["school_class"])
        if self.request.query_params.get("upcoming") == "1":
            from django.utils import timezone

            qs = qs.filter(date__gte=timezone.localdate())
        return qs

    def create(self, request, *args, **kwargs):
        if request.user.is_student:
            raise PermissionDenied("Students cannot schedule exams.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ExamDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticatedActiveUser]
    serializer_class = ExamSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Exam.objects.select_related("subject", "school_class")
        return qs.filter(school_class_id__in=_own_class_ids(user)) if user.is_student else qs

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.user.is_student and request.method not in ("GET", "HEAD", "OPTIONS"):
            raise PermissionDenied("Students cannot change exams.")


# --- Class years + year-end promotion ---------------------------------------

class MyClassYearsView(APIView):
    """A student's class years, newest first — lets timetable / homework / exams open an earlier year."""

    permission_classes = [IsAuthenticatedActiveUser]

    def get(self, request):
        profile = StudentProfile.objects.filter(user=request.user).first()
        if profile is None:
            return Response([])
        rows = list(ClassEnrollment.objects.filter(student=profile).select_related("school_class__session"))
        have = {r.school_class_id for r in rows}
        out = [
            {"id": str(r.school_class_id), "label": str(r.school_class), "session": r.school_class.session.label, "current": r.ended_on is None and not profile.is_alumni, "outcome": r.outcome}
            for r in rows
        ]
        if profile.school_class_id and profile.school_class_id not in have:
            c = profile.school_class
            out.insert(0, {"id": str(c.id), "label": str(c), "session": c.session.label, "current": True, "outcome": ""})
        out.sort(key=lambda x: x["session"], reverse=True)
        return Response(out)


class PromotionPlanView(APIView):
    """Step 1+2 of the wizard: every class of the session being closed, its students, and where the class goes next."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from . import promotion

        sid = request.query_params.get("from_session")
        session = AcademicSession.objects.filter(pk=sid).first() if sid else AcademicSession.objects.filter(is_current=True).first()
        if session is None:
            raise ValidationError("There is no current academic session yet. Add one under Classes & Subjects first.")
        return Response(promotion.build_plan(session))


class PromotionApplyView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        from . import promotion

        batch = promotion.apply_promotion(request.user, request.data)
        return Response(_batch_json(batch), status=status.HTTP_201_CREATED)


def _batch_json(b):
    return {
        "id": str(b.id),
        "created_at": b.created_at,
        "from_session": b.from_session.label if b.from_session else "",
        "to_session": b.to_session.label if b.to_session else b.detail.get("to_session_label", ""),
        "promoted": b.promoted,
        "repeated": b.repeated,
        "passed_out": b.passed_out,
        "created_classes": len(b.detail.get("created_class_ids", [])),
        "undone": b.undone_at is not None,
        "by": b.created_by.full_name if b.created_by else "",
    }


class PromotionBatchListView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        newest_live = PromotionBatch.objects.filter(undone_at__isnull=True).order_by("-created_at").first()
        rows = []
        for b in PromotionBatch.objects.select_related("from_session", "to_session", "created_by")[:20]:
            d = _batch_json(b)
            d["can_undo"] = bool(newest_live and b.pk == newest_live.pk)
            rows.append(d)
        return Response(rows)


class PromotionUndoView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        from . import promotion

        batch = PromotionBatch.objects.filter(pk=pk).first()
        if batch is None:
            raise ValidationError("That promotion was not found.")
        promotion.undo_promotion(batch)
        return Response({"undone": True})
