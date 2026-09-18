from decimal import Decimal

from rest_framework import serializers

from .models import AcademicSession, Attendance, Marksheet, Result, SchoolClass, StudentProfile, Subject, TeacherProfile


class AcademicSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicSession
        fields = ["id", "label", "is_current"]


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


class StudentProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = StudentProfile
        fields = ["user", "full_name", "school_class", "roll_number", "guardian_name", "guardian_contact"]
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


class MarksheetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Marksheet
        fields = ["id", "student", "session", "file", "generated_at"]
        read_only_fields = ["id", "generated_at"]
