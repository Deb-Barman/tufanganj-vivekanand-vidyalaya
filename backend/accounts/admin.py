from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "full_name", "role", "is_active_account", "locked_until", "created_at")
    list_filter = ("role", "is_active_account")
    search_fields = ("username", "full_name", "email")
    ordering = ("-created_at",)
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal info", {"fields": ("full_name", "email", "phone")}),
        ("Role & status", {"fields": ("role", "is_active_account", "must_change_password", "failed_login_attempts", "locked_until")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("username", "full_name", "role", "password1", "password2")}),
    )


from .models import PublicProfile  # noqa: E402


@admin.register(PublicProfile)
class PublicProfileAdmin(admin.ModelAdmin):
    """The Super Admin can see every profile and hide any of them from the public with one click."""

    list_display = ("user", "headline", "is_public", "updated_at")
    list_filter = ("is_public", "user__role")
    search_fields = ("user__username", "user__full_name", "headline")
    list_select_related = ("user",)
    raw_id_fields = ("user",)
    actions = ["hide_from_public"]

    @admin.action(description="Hide selected profiles from the public website")
    def hide_from_public(self, request, queryset):
        n = queryset.update(is_public=False)
        self.message_user(request, f"{n} profile(s) are now private.")
