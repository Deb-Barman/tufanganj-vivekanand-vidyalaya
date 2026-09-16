"""
SCAFFOLD — models only, not yet wired to serializers/views/URLs.

These cover the remaining data areas listed in context.md's "Suggested Data
Areas" section: classes, subjects, academic_sessions, attendance, results,
marksheets, teacher_profiles/student_profiles, admissions, school_forms,
gallery, events, articles.

Per context.md rule #6 ("Build module-by-module instead of generating an
unnecessarily huge codebase at once"), these models exist so the schema
shape is visible and reviewable, but no app logic has been built on top of
them yet. See docs/NEXT_STEPS.md in the repo root for the intended build
order — each module should get its own serializers.py/views.py/urls.py,
RBAC permission checks, tests, and a matching Supabase RLS policy before
being considered done, the same way `notices/` was built in this slice.

Do NOT expose these via the Django admin or API until:
1. The field list has been checked against actual school requirements
   (context.md: "Design the final schema only after checking actual
   requirements. Avoid unnecessary tables.")
2. RBAC permissions are written for every endpoint touching student data.
"""
import uuid

from django.conf import settings
from django.db import models


class AcademicSession(models.Model):
    """e.g. '2025-2026'. TODO / Required Data: confirm session-naming convention with the school."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=20, unique=True)
    is_current = models.BooleanField(default=False)

    class Meta:
        db_table = "academic_sessions"

    def __str__(self):
        return self.label


class SchoolClass(models.Model):
    """e.g. 'Class 10', 'Class 11 - Science'. TODO: confirm exact section/stream naming used by the school."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    stream = models.CharField(
        max_length=20,
        blank=True,
        help_text="e.g. 'Science' or 'Arts' — only relevant for Class XI/XII.",
    )
    session = models.ForeignKey(AcademicSession, on_delete=models.CASCADE, related_name="classes")

    class Meta:
        db_table = "classes"
        unique_together = ["name", "stream", "session"]

    def __str__(self):
        return f"{self.name} {self.stream}".strip()


class Subject(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="subjects")

    class Meta:
        db_table = "subjects"

    def __str__(self):
        return self.name


class StudentProfile(models.Model):
    """
    Extends a Student-role User with school-specific fields. Kept separate
    from the User model (accounts/models.py) so auth concerns and academic
    records stay decoupled.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="student_profile")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.SET_NULL, null=True, related_name="students")
    roll_number = models.CharField(max_length=20)
    guardian_name = models.CharField(max_length=150, blank=True)
    guardian_contact = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = "student_profiles"

    def __str__(self):
        return f"{self.user.full_name} ({self.roll_number})"


class TeacherProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="teacher_profile")
    department = models.CharField(max_length=100, blank=True)
    subjects_taught = models.ManyToManyField(Subject, blank=True, related_name="teachers")
    bio = models.TextField(blank=True)
    years_experience = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "teacher_profiles"

    def __str__(self):
        return self.user.full_name


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="attendance_records")
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices)
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

    class Meta:
        db_table = "attendance"
        unique_together = ["student", "date"]


class Result(models.Model):
    """Individual subject-level marks. Aggregated into a Marksheet per session."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="results")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    session = models.ForeignKey(AcademicSession, on_delete=models.CASCADE)
    marks_obtained = models.DecimalField(max_digits=5, decimal_places=2)
    full_marks = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

    class Meta:
        db_table = "results"
        unique_together = ["student", "subject", "session"]


class Marksheet(models.Model):
    """Generated summary document for a student for a given session. TODO: confirm PDF generation requirements."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="marksheets")
    session = models.ForeignKey(AcademicSession, on_delete=models.CASCADE)
    file = models.FileField(upload_to="marksheets/", blank=True, null=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "marksheets"
        unique_together = ["student", "session"]


class Article(models.Model):
    """Public-facing news/articles section. TODO: confirm required fields (author byline, cover image, etc.)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    body = models.TextField()
    published = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "articles"


class GalleryImage(models.Model):
    """TODO: confirm storage approach — planned to use Supabase Storage per context.md, not local FileField in production."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caption = models.CharField(max_length=200, blank=True)
    image_url = models.URLField()
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gallery_images"


class Event(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date = models.DateField()
    audience = models.CharField(max_length=100, blank=True, help_text="e.g. 'All Classes', 'Class 9-10'.")

    class Meta:
        db_table = "events"
        ordering = ["date"]


class Admission(models.Model):
    """Admission enquiry submitted from the public site. TODO: confirm required fields with the school office."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONTACTED = "CONTACTED", "Contacted"
        CLOSED = "CLOSED", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    applicant_name = models.CharField(max_length=150)
    guardian_contact = models.CharField(max_length=20)
    applying_for_class = models.CharField(max_length=50)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "admissions"


class SchoolForm(models.Model):
    """Downloadable forms/documents (prospectus, admission form PDF, etc). TODO: confirm which forms exist today."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    file_url = models.URLField()
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "school_forms"
