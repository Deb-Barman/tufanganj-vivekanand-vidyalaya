"""
Shared DRF permission classes enforcing role-based access control.

context.md is explicit: "Never rely on frontend checks for security" and
"Validate permissions on the server for every protected operation." Every
view in every app must attach one of these (or a documented equivalent) —
never leave a protected view with only IsAuthenticated.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsSuperAdmin(BasePermission):
    """Full access, restricted to Super Admin only."""

    message = "This action is restricted to the Super Admin."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_super_admin
            and request.user.is_active_account
        )


class IsTeacher(BasePermission):
    message = "This action is restricted to Teachers."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_teacher
            and request.user.is_active_account
        )


class IsStudent(BasePermission):
    message = "This action is restricted to Students."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_student
            and request.user.is_active_account
        )


class IsSuperAdminOrTeacher(BasePermission):
    message = "This action is restricted to Super Admin or Teacher accounts."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active_account
            and (request.user.is_super_admin or request.user.is_teacher)
        )


class IsAuthenticatedActiveUser(BasePermission):
    """Any logged-in, non-disabled account — read-level access to shared data."""

    message = "You must be signed in with an active account."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active_account
        )


class IsSuperAdminOrReadOnly(BasePermission):
    """
    Anyone authenticated and active can read (GET/HEAD/OPTIONS); only Super
    Admin can create/update/delete. Useful for content the whole school
    reads but only the office publishes (e.g. notices, events, gallery).
    """

    message = "Only the Super Admin can create, edit, or remove this."

    def has_permission(self, request, view):
        if not (
            request.user
            and request.user.is_authenticated
            and request.user.is_active_account
        ):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_super_admin
