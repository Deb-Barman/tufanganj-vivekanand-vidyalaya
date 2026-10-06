from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

app_name = "accounts"

urlpatterns = [
    path("admin-login/", views.AdminPortalLoginView.as_view(), name="admin_login"),
    path("staff-login/", views.StaffStudentPortalLoginView.as_view(), name="staff_login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", views.MeView.as_view(), name="me"),
    path("me/change-password/", views.ChangePasswordView.as_view(), name="change_password"),
    path("admin/users/", views.AdminUserListCreateView.as_view(), name="admin_user_list_create"),
    path("admin/users/<uuid:pk>/", views.AdminUserDetailView.as_view(), name="admin_user_detail"),
    path("admin/users/<uuid:pk>/reset-password/", views.AdminResetPasswordView.as_view(), name="admin_reset_password"),
]
