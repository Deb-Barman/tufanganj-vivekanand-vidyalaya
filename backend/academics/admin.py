from django.contrib import admin

from .models import (
    AcademicSession,
    Attendance,
    Exam,
    Homework,
    HomeworkCompletion,
    Marksheet,
    Result,
    SchoolClass,
    StudentProfile,
    Subject,
    TeacherProfile,
    TimetableEntry,
)

admin.site.register(AcademicSession)
admin.site.register(SchoolClass)
admin.site.register(Subject)
admin.site.register(TeacherProfile)
admin.site.register(StudentProfile)
admin.site.register(Attendance)
admin.site.register(Result)
admin.site.register(Marksheet)


# --- Registered so the Django admin (Render) shows the SAME modules as the
# --- Super Admin dashboard (Vercel): Timetable, Homework, Exams.

@admin.register(TimetableEntry)
class TimetableEntryAdmin(admin.ModelAdmin):
    list_display = ("school_class", "weekday", "period", "start_time", "end_time", "subject", "label", "teacher", "room")
    list_filter = ("school_class", "weekday")
    list_select_related = ("school_class", "subject", "teacher")
    ordering = ("school_class", "weekday", "period")


@admin.register(Homework)
class HomeworkAdmin(admin.ModelAdmin):
    list_display = ("title", "school_class", "subject", "due_date", "created_by", "created_at")
    list_filter = ("school_class", "subject", "due_date")
    search_fields = ("title", "details")
    list_select_related = ("school_class", "subject", "created_by")
    date_hierarchy = "due_date"


@admin.register(HomeworkCompletion)
class HomeworkCompletionAdmin(admin.ModelAdmin):
    list_display = ("homework", "student", "completed_at")
    list_filter = ("homework__school_class",)
    raw_id_fields = ("homework", "student")  # avoids loading every student into a dropdown


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ("name", "school_class", "subject", "date", "start_time", "room", "created_by")
    list_filter = ("school_class", "subject", "date")
    search_fields = ("name",)
    list_select_related = ("school_class", "subject", "created_by")
    date_hierarchy = "date"
