from django.urls import path
from . import console_views, profiles, views

app_name = "accounts"

urlpatterns = [
    path("admin-login/", views.AdminPortalLoginView.as_view(), name="admin_login"),
    path("staff-login/", views.StaffStudentPortalLoginView.as_view(), name="staff_login"),
    path("token/refresh/", views.SafeTokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("admin/stats/", views.AdminStatsView.as_view(), name="admin_stats"),
    path("me/", views.MeView.as_view(), name="me"),
    path("me/profile/", profiles.MyProfileView.as_view(), name="my_profile"),
    path("me/profile/photo/", profiles.MyProfilePhotoView.as_view(), name="my_profile_photo"),
    path("profiles/<str:role>/<str:username>/", profiles.PublicProfileView.as_view(), name="public_profile"),
    path("me/change-password/", views.ChangePasswordView.as_view(), name="change_password"),
    path("admin/users/", views.AdminUserListCreateView.as_view(), name="admin_user_list_create"),
    path("admin/users/<uuid:pk>/", views.AdminUserDetailView.as_view(), name="admin_user_detail"),
    path("admin/users/<uuid:pk>/reset-password/", views.AdminResetPasswordView.as_view(), name="admin_reset_password"),
    path("admin/users/<uuid:pk>/unlock/", views.AdminUnlockView.as_view(), name="admin_unlock"),
    # Super Admin: Supabase usage + read-only data browser
    path("admin/database/", console_views.AdminDatabaseView.as_view(), name="admin_database"),
    path("admin/data/", console_views.AdminDataTablesView.as_view(), name="admin_data_tables"),
    path("admin/data/<str:key>/export/", console_views.AdminDataExportView.as_view(), name="admin_data_export"),
    path("admin/data/<str:key>/delete-preview/", console_views.AdminDataDeletePreviewView.as_view(), name="admin_data_delete_preview"),
    path("admin/data/<str:key>/delete/", console_views.AdminDataDeleteView.as_view(), name="admin_data_delete"),
    path("admin/data/<str:key>/", console_views.AdminDataRowsView.as_view(), name="admin_data_rows"),
]
