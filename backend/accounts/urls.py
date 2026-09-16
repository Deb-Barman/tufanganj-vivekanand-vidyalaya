from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

app_name = "accounts"

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", views.MeView.as_view(), name="me"),
    path("me/change-password/", views.ChangePasswordView.as_view(), name="change_password"),
    # Super Admin only — the sole way Teacher/Student accounts are created.
    path("admin/users/", views.AdminUserListCreateView.as_view(), name="admin_user_list_create"),
    path("admin/users/<uuid:pk>/", views.AdminUserDetailView.as_view(), name="admin_user_detail"),
]
