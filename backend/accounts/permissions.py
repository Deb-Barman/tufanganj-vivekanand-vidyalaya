"""
Shared DRF permission classes. This is the real authorization boundary for
the whole project — every view must declare one of these explicitly.
context.md: "Never rely on frontend checks for security" and "Validate
permissions on the server for every protected operation."
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS


def _active(user):
    return bool(user and user.is_authenticated and user.is_active_account)


class IsSuperAdmin(BasePermission):
    message = "This action is restricted to the Super Admin."

    def has_permission(self, request, view):
        return _active(request.user) and request.user.is_super_admin


class IsTeacher(BasePermission):
    message = "This action is restricted to Teachers."

    def has_permission(self, request, view):
        return _active(request.user) and request.user.is_teacher


class IsStudent(BasePermission):
    message = "This action is restricted to Students."

    def has_permission(self, request, view):
        return _active(request.user) and request.user.is_student


class IsSuperAdminOrTeacher(BasePermission):
    message = "This action is restricted to Super Admin or Teacher accounts."

    def has_permission(self, request, view):
        return _active(request.user) and (request.user.is_super_admin or request.user.is_teacher)


class IsAuthenticatedActiveUser(BasePermission):
    message = "You must be signed in with an active account."

    def has_permission(self, request, view):
        return _active(request.user)


class IsSuperAdminOrReadOnly(BasePermission):
    message = "Only the Super Admin can create, edit, or remove this."

    def has_permission(self, request, view):
        if not _active(request.user):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_super_admin


class IsOwnerStudentOrStaff(BasePermission):
    """
    Object-level permission for per-student records (attendance, results,
    marksheets): the owning student may read their own row; Super Admin
    and Teacher may read/write any row. Use alongside IsAuthenticatedActiveUser
    as the view-level permission_classes entry, and rely on this for
    has_object_permission on retrieve/update/destroy.
    """

    message = "You may only access your own records."

    def has_object_permission(self, request, view, obj):
        if not _active(request.user):
            return False
        if request.user.is_super_admin or request.user.is_teacher:
            return True
        # obj is expected to have a `student` FK whose `user` is the owner,
        # or to itself be the student profile.
        student_user_id = getattr(getattr(obj, "student", obj), "user_id", None) or getattr(obj, "user_id", None)
        return student_user_id == request.user.id
