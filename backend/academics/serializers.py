from decimal import Decimal

from rest_framework import serializers

from accounts.models import Role, User

from .models import (
    AcademicSession,
    Attendance,
    TeacherAttendance,
    Exam,
    Homework,
    Marksheet,
    Result,
    SchoolClass,
    StudentProfile,
    Subject,
    TeacherProfile,
    TimetableEntry,
)


class AcademicSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicSession
        fields = ["id", "label", "is_current"]

    # Only one session can be "current" — marking one unmarks the rest.
    def create(self, validated_data):
        obj = super().create(validated_data)
        if obj.is_current:
            AcademicSession.objects.exclude(pk=obj.pk).update(is_current=False)
        return obj

    def update(self, instance, validated_data):
        obj = super().update(instance, validated_data)
        if obj.is_current:
            AcademicSession.objects.exclude(pk=obj.pk).update(is_current=False)
        return obj


class SchoolClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolClass
        fields = ["id", "name", "stream", "session"]


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "school_class"]


class TeacherProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = TeacherProfile
        fields = ["user", "full_name", "department", "bio", "years_experience", "subjects_taught"]
        read_only_fields = ["user"]


class PublicTeacherSerializer(serializers.ModelSerializer):
    """Faculty page on the open website: no internal user ID."""

    full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = TeacherProfile
        fields = ["full_name", "department", "bio", "years_experience"]
        read_only_fields = fields


class StudentProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = StudentProfile
        fields = ["user", "full_name", "username", "school_class", "roll_number", "guardian_name", "guardian_contact"]
        read_only_fields = ["user"]


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ["id", "student", "date", "status", "marked_by", "created_at"]
        read_only_fields = ["id", "marked_by", "created_at"]

    def validate(self, attrs):
        # Belt-and-suspenders: even though the view queryset already scopes
        # a student to their own rows for read, this blocks a write attempt
        # at the serializer level too, in case a future view reuses this
        # serializer without re-checking.
        request = self.context.get("request")
        if request and request.user.is_student:
            raise serializers.ValidationError("Students cannot record attendance.")
        return attrs


class ResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = ["id", "student", "subject", "session", "marks_obtained", "full_marks", "recorded_by", "created_at"]
        read_only_fields = ["id", "recorded_by", "created_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        if request and request.user.is_student:
            raise serializers.ValidationError("Students cannot record results.")
        marks = attrs.get("marks_obtained", getattr(self.instance, "marks_obtained", None))
        full = attrs.get("full_marks", getattr(self.instance, "full_marks", Decimal("100")))
        if marks is not None and full is not None and marks > full:
            raise serializers.ValidationError("Marks obtained cannot exceed full marks.")
        if marks is not None and marks < 0:
            raise serializers.ValidationError("Marks obtained cannot be negative.")
        return attrs


MAX_MARKSHEET_SIZE = 10 * 1024 * 1024  # 10 MB
# Real first bytes of the formats accepted for a marksheet: PDF, PNG, JPEG, WebP.
_MARKSHEET_SIGNATURES = (b"%PDF-", b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff")


class MarksheetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Marksheet
        fields = ["id", "student", "session", "file", "generated_at"]
        read_only_fields = ["id", "generated_at"]

    def validate_file(self, file):
        """Marksheets are shown to students, so accept only a real PDF or photo (never HTML/SVG/executables)."""
        if file is None:
            return file
        if file.size > MAX_MARKSHEET_SIZE:
            raise serializers.ValidationError("File must be under 10 MB.")
        head = file.read(12)
        file.seek(0)
        is_webp = head[:4] == b"RIFF" and head[8:12] == b"WEBP"
        if not (head.startswith(_MARKSHEET_SIGNATURES) or is_webp):
            raise serializers.ValidationError("Upload a PDF, PNG, JPEG or WebP file.")
        return file


class _AttendanceRecord(serializers.Serializer):
    student = serializers.PrimaryKeyRelatedField(queryset=StudentProfile.objects.all())
    status = serializers.ChoiceField(choices=Attendance.Status.choices)


class BulkAttendanceSerializer(serializers.Serializer):
    date = serializers.DateField()
    records = _AttendanceRecord(many=True, allow_empty=False, max_length=300)


def _check_teacher(user):
    if not user.is_teacher:
        raise serializers.ValidationError("Teacher attendance can only be recorded for a Teacher account.")
    if not user.is_active_account:
        raise serializers.ValidationError("That teacher account is disabled.")
    return user


def _check_not_future(value):
    from django.utils import timezone

    if value > timezone.localdate():
        raise serializers.ValidationError("Attendance cannot be recorded for a future date.")
    return value


class TeacherAttendanceSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True)

    class Meta:
        model = TeacherAttendance
        fields = ["id", "teacher", "teacher_name", "date", "status", "marked_by", "created_at"]
        read_only_fields = ["id", "marked_by", "created_at"]

    def validate_teacher(self, user):
        return _check_teacher(user)

    def validate_date(self, value):
        return _check_not_future(value)


class _TeacherAttendanceRecord(serializers.Serializer):
    teacher = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role=Role.TEACHER))
    status = serializers.ChoiceField(choices=TeacherAttendance.Status.choices)

    def validate_teacher(self, user):
        return _check_teacher(user)


class BulkTeacherAttendanceSerializer(serializers.Serializer):
    date = serializers.DateField()
    records = _TeacherAttendanceRecord(many=True, allow_empty=False, max_length=300)

    def validate_date(self, value):
        return _check_not_future(value)


class _ResultRecord(serializers.Serializer):
    student = serializers.PrimaryKeyRelatedField(queryset=StudentProfile.objects.all())
    marks_obtained = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal("0"))


class BulkResultSerializer(serializers.Serializer):
    subject = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
    session = serializers.PrimaryKeyRelatedField(queryset=AcademicSession.objects.all())
    full_marks = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal("1"), default=Decimal("100"))
    records = _ResultRecord(many=True, allow_empty=False, max_length=300)

    def validate(self, attrs):
        for rec in attrs["records"]:
            if rec["marks_obtained"] > attrs["full_marks"]:
                raise serializers.ValidationError("Marks obtained cannot exceed full marks.")
        return attrs



def _plain(value: str) -> str:
    from notices.serializers import sanitize

    return sanitize((value or "").strip())


class TimetableEntrySerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True, default="")
    teacher_name = serializers.CharField(source="teacher.full_name", read_only=True, default="")

    class Meta:
        model = TimetableEntry
        fields = ["id", "school_class", "weekday", "period", "start_time", "end_time", "subject", "subject_name", "label", "teacher", "teacher_name", "room"]
        read_only_fields = ["id"]
        validators = []  # unique (class, weekday, period) is checked below for a friendlier message

    def validate_label(self, v):
        return _plain(v)

    def validate_room(self, v):
        return _plain(v)

    def validate(self, attrs):
        inst = self.instance
        get = lambda k: attrs.get(k, getattr(inst, k, None))  # noqa: E731
        if get("end_time") <= get("start_time"):
            raise serializers.ValidationError("End time must be after the start time.")
        if not get("subject") and not get("label"):
            raise serializers.ValidationError("Choose a subject, or type a label such as “Break”.")
        if get("subject") and get("subject").school_class_id != get("school_class").id:
            raise serializers.ValidationError("That subject belongs to a different class.")
        if get("teacher") and get("teacher").role != "TEACHER":
            raise serializers.ValidationError("The chosen person is not a teacher.")
        clash = TimetableEntry.objects.filter(school_class=get("school_class"), weekday=get("weekday"), period=get("period"))
        if inst:
            clash = clash.exclude(pk=inst.pk)
        if clash.exists():
            raise serializers.ValidationError("That period already exists for this class on this day.")
        return attrs


class HomeworkSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, default="")
    done = serializers.SerializerMethodField()
    submitted = serializers.SerializerMethodField()
    class_size = serializers.SerializerMethodField()
    phase = serializers.SerializerMethodField()
    can_tick = serializers.SerializerMethodField()
    start_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Homework
        fields = ["id", "school_class", "class_name", "subject", "subject_name", "title", "details", "start_date", "due_date", "phase", "can_tick", "created_by", "created_by_name", "created_at", "done", "submitted", "class_size"]
        read_only_fields = ["id", "created_by", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Homework set before start dates existed opens from the day it was created.
        data["start_date"] = data.get("start_date") or str(instance.opens_on)
        return data

    def get_phase(self, obj):
        return obj.phase()

    def get_can_tick(self, obj):
        """True only for a student while the homework is inside its start–end window."""
        user = self.context["request"].user
        return bool(getattr(user, "is_student", False)) and obj.phase() == "open"

    def get_done(self, obj):
        user = self.context["request"].user
        if not getattr(user, "is_student", False):
            return None
        done_ids = self.context.get("done_ids")
        if done_ids is None:
            return obj.completions.filter(student__user=user).exists()
        return obj.id in done_ids

    def get_submitted(self, obj):
        return None if self.context["request"].user.is_student else obj.completions.count()

    def get_class_size(self, obj):
        return None if self.context["request"].user.is_student else obj.school_class.students.count()

    def validate_title(self, v):
        v = _plain(v)
        if not v:
            raise serializers.ValidationError("Title cannot be empty.")
        return v

    def validate_details(self, v):
        return _plain(v)

    def validate(self, attrs):
        inst = self.instance
        subject = attrs.get("subject", getattr(inst, "subject", None))
        klass = attrs.get("school_class", getattr(inst, "school_class", None))
        if subject and klass and subject.school_class_id != klass.id:
            raise serializers.ValidationError("That subject belongs to a different class.")
        due = attrs.get("due_date", getattr(inst, "due_date", None))
        start = attrs["start_date"] if "start_date" in attrs else getattr(inst, "start_date", None)
        if start and due and start > due:
            raise serializers.ValidationError({"due_date": "The end date cannot be before the start date."})
        return attrs

    def create(self, validated_data):
        from django.utils import timezone

        if not validated_data.get("start_date"):
            validated_data["start_date"] = timezone.localdate()
        return super().create(validated_data)


class ExamSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    class_name = serializers.CharField(source="school_class.name", read_only=True)

    class Meta:
        model = Exam
        fields = ["id", "school_class", "class_name", "subject", "subject_name", "name", "date", "start_time", "room", "created_by"]
        read_only_fields = ["id", "created_by"]

    def validate_name(self, v):
        v = _plain(v)
        if not v:
            raise serializers.ValidationError("Exam name cannot be empty.")
        return v

    def validate_room(self, v):
        return _plain(v)

    def validate(self, attrs):
        inst = self.instance
        subject = attrs.get("subject", getattr(inst, "subject", None))
        klass = attrs.get("school_class", getattr(inst, "school_class", None))
        if subject and klass and subject.school_class_id != klass.id:
            raise serializers.ValidationError("That subject belongs to a different class.")
        return attrs
