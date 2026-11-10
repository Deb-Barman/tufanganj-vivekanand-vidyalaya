import uuid

from django.conf import settings
from django.db import models


class AcademicSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=20, unique=True)
    is_current = models.BooleanField(default=False)
    #: First school day of the session. Attendance before this date is ignored in the attendance report.
    start_date = models.DateField(null=True, blank=True)
    #: Total working days in the whole session (e.g. 200). Attendance % is worked out against this number.
    working_days = models.PositiveSmallIntegerField(null=True, blank=True)
    #: Minimum attendance % a student/teacher should keep. Anyone below it is flagged "needs attention".
    attendance_min_percent = models.PositiveSmallIntegerField(default=75)

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
    #: Finished the last class (Class 12) and left the school. The account, results, attendance and portfolio all stay.
    is_alumni = models.BooleanField(default=False)

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


class TeacherAttendance(models.Model):
    """A teacher's attendance for one day. Only the Super Admin records it (like a class register for staff);
    a teacher can read their own days and nobody else's."""

    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="teacher_attendance_records")
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices)
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "teacher_attendance"
        unique_together = ["teacher", "date"]
        ordering = ["-date"]


class Result(models.Model):
    class Term(models.TextChoices):
        SEM1 = "SEM1", "First Semester"
        SEM2 = "SEM2", "Second Semester"
        SEM3 = "SEM3", "Third Semester"
        SEM4 = "SEM4", "Fourth Semester"
        ANNUAL = "ANNUAL", "Annual / Final"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="results")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    session = models.ForeignKey(AcademicSession, on_delete=models.CASCADE)
    #: Which exam the marks belong to. The class comes from the subject (a subject belongs to one class).
    term = models.CharField(max_length=6, choices=Term.choices, default=Term.SEM1)
    marks_obtained = models.DecimalField(max_digits=5, decimal_places=2)
    full_marks = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "results"
        unique_together = ["student", "subject", "session", "term"]
        ordering = ["-created_at"]


class Marksheet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="marksheets")
    session = models.ForeignKey(AcademicSession, on_delete=models.CASCADE)
    file = models.FileField(upload_to="marksheets/%Y/", blank=True, null=True)
    #: Instead of uploading: a share link to the marksheet (Google Drive "Anyone with the link", Dropbox, ...). Saves storage.
    file_link = models.URLField(max_length=1000, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "marksheets"
        unique_together = ["student", "session"]
        ordering = ["-generated_at"]


class TimetableEntry(models.Model):
    """One period in a class's weekly timetable. A row with no subject is a break/assembly (use `label`)."""

    WEEKDAYS = [(0, "Monday"), (1, "Tuesday"), (2, "Wednesday"), (3, "Thursday"), (4, "Friday"), (5, "Saturday")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="timetable")
    weekday = models.PositiveSmallIntegerField(choices=WEEKDAYS)
    period = models.PositiveSmallIntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, null=True, blank=True, related_name="timetable")
    label = models.CharField(max_length=60, blank=True)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="timetable_periods")
    room = models.CharField(max_length=30, blank=True)

    class Meta:
        db_table = "timetable_entries"
        ordering = ["weekday", "period"]
        unique_together = [("school_class", "weekday", "period")]


class Homework(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="homework")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="homework")
    title = models.CharField(max_length=200)
    details = models.TextField(blank=True, max_length=2000)
    #: First day students can tick it off. Blank = open from the day it was set.
    start_date = models.DateField(null=True, blank=True)
    #: End date: the last day students can finish (and tick) it. After this the tick is locked.
    due_date = models.DateField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="homework_set")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "homework"
        ordering = ["due_date", "-created_at"]

    @property
    def opens_on(self):
        """Effective first day: start_date, or the day the homework was created."""
        if self.start_date:
            return self.start_date
        from django.utils import timezone

        return timezone.localtime(self.created_at).date() if self.created_at else timezone.localdate()

    def phase(self, today=None):
        """'upcoming' (not started), 'open' (students can tick) or 'closed' (end date passed)."""
        from django.utils import timezone

        today = today or timezone.localdate()
        if today > self.due_date:
            return "closed"
        if today < self.opens_on:
            return "upcoming"
        return "open"


class HomeworkCompletion(models.Model):
    """A student ticking a homework item as done."""

    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name="completions")
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="homework_done")
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "homework_completions"
        unique_together = [("homework", "student")]


class Exam(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="exams")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="exams")
    name = models.CharField(max_length=100)
    date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    room = models.CharField(max_length=30, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="exams_set")

    class Meta:
        db_table = "exams"
        ordering = ["date", "start_time"]


class Project(models.Model):
    """
    A longer piece of work (a project / assignment) given to ONE class, optionally for one semester and subject.
    Unlike homework it has a clear start and a deadline, and usually a longer description. Teachers and the Super Admin
    set it; students of that class see it and tick it as done between its start date and its deadline.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="projects")
    #: Optional: a project can be for the whole class without belonging to one subject.
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name="projects")
    #: Which semester it belongs to (SEM1…ANNUAL). Blank = not tied to a semester.
    term = models.CharField(max_length=6, choices=Result.Term.choices, blank=True, default="")
    title = models.CharField(max_length=200)
    details = models.TextField(blank=True, max_length=4000)
    #: First day students can tick it as done.
    start_date = models.DateField()
    #: Deadline: the last day students can finish (and tick) it. After this the tick is locked.
    due_date = models.DateField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="projects_set")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "projects"
        ordering = ["due_date", "-created_at"]

    def phase(self, today=None):
        """'upcoming' (not started), 'open' (students can tick) or 'closed' (deadline passed)."""
        from django.utils import timezone

        today = today or timezone.localdate()
        if today > self.due_date:
            return "closed"
        if today < self.start_date:
            return "upcoming"
        return "open"


class ProjectCompletion(models.Model):
    """A student ticking a project as done."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="completions")
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="projects_done")
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "project_completions"
        unique_together = [("project", "student")]


class PromotionBatch(models.Model):
    """One "move students up to the next class" run by the Super Admin. Kept so it can be undone and so there is a record."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_session = models.ForeignKey(AcademicSession, on_delete=models.SET_NULL, null=True, blank=True, related_name="promotions_from")
    to_session = models.ForeignKey(AcademicSession, on_delete=models.SET_NULL, null=True, blank=True, related_name="promotions_to")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    promoted = models.PositiveIntegerField(default=0)
    repeated = models.PositiveIntegerField(default=0)
    passed_out = models.PositiveIntegerField(default=0)
    #: What is needed to undo it: moves [{student, from_class, to_class, outcome}], created class ids, previous current session…
    detail = models.JSONField(default=dict, blank=True)
    undone_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "promotion_batches"
        ordering = ["-created_at"]


class ClassEnrollment(models.Model):
    """
    Which class a student was in, year by year. The student's CURRENT class stays on StudentProfile.school_class; this
    keeps every earlier one, so old timetables, homework, exams, results and attendance can still be opened.
    """

    OUTCOMES = [("", "Current"), ("promoted", "Promoted"), ("repeated", "Stayed in the same class"), ("passed_out", "Passed out"), ("moved", "Moved by the office")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="enrollments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="enrollments")
    roll_number = models.CharField(max_length=20, blank=True)
    #: How that class year ended ("" while it is the current class).
    outcome = models.CharField(max_length=12, choices=OUTCOMES, blank=True, default="")
    started_on = models.DateField(auto_now_add=True)
    ended_on = models.DateField(null=True, blank=True)
    batch = models.ForeignKey(PromotionBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name="enrollments")

    class Meta:
        db_table = "class_enrollments"
        unique_together = [("student", "school_class")]
        ordering = ["-school_class__session__label", "-started_on"]
