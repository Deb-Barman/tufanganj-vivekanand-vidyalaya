from django.urls import path

from . import views

app_name = "academics"

urlpatterns = [
    path("sessions/", views.AcademicSessionListCreateView.as_view(), name="sessions"),
    path("classes/", views.SchoolClassListCreateView.as_view(), name="classes"),
    path("subjects/", views.SubjectListCreateView.as_view(), name="subjects"),

    path("teachers/", views.TeacherProfileListView.as_view(), name="teachers"),
    path("teachers/public/", views.PublicTeacherListView.as_view(), name="public_teachers"),
    path("teachers/me/", views.MyTeacherProfileView.as_view(), name="my_teacher_profile"),

    path("attendance/", views.AttendanceListCreateView.as_view(), name="attendance"),
    path("attendance/<uuid:pk>/", views.AttendanceDetailView.as_view(), name="attendance_detail"),

    path("results/", views.ResultListCreateView.as_view(), name="results"),
    path("results/<uuid:pk>/", views.ResultDetailView.as_view(), name="result_detail"),

    path("marksheets/", views.MarksheetListView.as_view(), name="marksheets"),
    path("marksheets/create/", views.MarksheetCreateView.as_view(), name="marksheet_create"),
    path("marksheets/<uuid:pk>/", views.MarksheetDetailView.as_view(), name="marksheet_detail"),
]
