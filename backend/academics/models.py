import uuid

from django.conf import settings
from django.db import models


class AcademicSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=20, unique=True)
    is_current = models.BooleanField(default=False)

    class Meta:
        db_table = "academic_sessions"
        ordering = ["-label"]

    def __str__(self):
        return self.label


class SchoolClass(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    stream = models.CharField(max_length=20, blank=True)
    session = models.ForeignKey(AcademicSession, on_delete=models.CASCADE, related_name="classes")

    class Meta:
        db_table = "classes"
        unique_together = ["name", "stream", "session"]
        ordering = ["name", "stream"]

    def __str__(self):
        return f"{self.name} {self.stream}".strip()


class Subject(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="subjects")

    class Meta:
        db_table = "subjects"
        ordering = ["name"]

    def __str__(self):
        return self.name


class TeacherProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True, related_name="teacher_profile")
    department = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    years_experience = models.PositiveIntegerField(null=True, blank=True)
    subjects_taught = models.ManyToManyField(Subject, blank=True, related_name="teachers")

    class Meta:
        db_table = "teacher_profiles"
        ordering = ["user__full_name"]

    def __str__(self):
        return self.user.full_name


class StudentProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True, related_name="student_profile")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.SET_NULL, null=True, related_name="students")
    roll_number = models.CharField(max_length=20, blank=True)
    guardian_name = models.CharField(max_length=150, blank=True)
    guardian_contact = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = "student_profiles"
        ordering = ["roll_number"]

    def __str__(self):
        return f"{self.user.full_name} ({self.roll_number})"


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="attendance_records")
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices)
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "attendance"
        unique_together = ["student", "date"]
        ordering = ["-date"]


class Result(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="results")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    session = models.ForeignKey(AcademicSession, on_delete=models.CASCADE)
    marks_obtained = models.DecimalField(max_digits=5, decimal_places=2)
    full_marks = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "results"
        unique_together = ["student", "subject", "session"]
        ordering = ["-created_at"]


class Marksheet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="marksheets")
    session = models.ForeignKey(AcademicSession, on_delete=models.CASCADE)
    file = models.FileField(upload_to="marksheets/%Y/", blank=True, null=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "marksheets"
        unique_together = ["student", "session"]
        ordering = ["-generated_at"]
