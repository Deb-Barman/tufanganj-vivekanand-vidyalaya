from django.urls import path

from . import views

app_name = "academics"

urlpatterns = [
    path("sessions/", views.AcademicSessionListCreateView.as_view(), name="sessions"),
    path("sessions/<uuid:pk>/", views.AcademicSessionDetailView.as_view(), name="session_detail"),
    path("classes/", views.SchoolClassListCreateView.as_view(), name="classes"),
    path("classes/<uuid:pk>/", views.SchoolClassDetailView.as_view(), name="class_detail"),
    path("subjects/", views.SubjectListCreateView.as_view(), name="subjects"),
    path("subjects/<uuid:pk>/", views.SubjectDetailView.as_view(), name="subject_detail"),

    path("teachers/", views.TeacherProfileListView.as_view(), name="teachers"),
    path("teachers/public/", views.PublicTeacherListView.as_view(), name="public_teachers"),
    path("teachers/<uuid:pk>/", views.TeacherProfileDetailView.as_view(), name="teacher_detail"),
    path("teachers/me/", views.MyTeacherProfileView.as_view(), name="my_teacher_profile"),

    path("students/", views.StudentProfileListView.as_view(), name="students"),
    path("students/<uuid:pk>/", views.StudentProfileDetailView.as_view(), name="student_detail"),

    path("attendance/bulk/", views.BulkAttendanceView.as_view(), name="attendance_bulk"),
    path("attendance/", views.AttendanceListCreateView.as_view(), name="attendance"),
    path("attendance/<uuid:pk>/", views.AttendanceDetailView.as_view(), name="attendance_detail"),

    path("results/bulk/", views.BulkResultView.as_view(), name="results_bulk"),
    path("results/", views.ResultListCreateView.as_view(), name="results"),
    path("results/<uuid:pk>/", views.ResultDetailView.as_view(), name="result_detail"),

    path("marksheets/", views.MarksheetListView.as_view(), name="marksheets"),
    path("marksheets/create/", views.MarksheetCreateView.as_view(), name="marksheet_create"),
    path("marksheets/<uuid:pk>/", views.MarksheetDetailView.as_view(), name="marksheet_detail"),

    path("timetable/", views.TimetableListCreateView.as_view(), name="timetable"),
    path("timetable/<uuid:pk>/", views.TimetableDetailView.as_view(), name="timetable_detail"),
    path("homework/", views.HomeworkListCreateView.as_view(), name="homework"),
    path("homework/<uuid:pk>/", views.HomeworkDetailView.as_view(), name="homework_detail"),
    path("homework/<uuid:pk>/done/", views.HomeworkDoneView.as_view(), name="homework_done"),
    path("homework/<uuid:pk>/completions/", views.HomeworkCompletionsView.as_view(), name="homework_completions"),
    path("exams/", views.ExamListCreateView.as_view(), name="exams"),
    path("exams/<uuid:pk>/", views.ExamDetailView.as_view(), name="exam_detail"),
]
