"""
JWT authentication that also enforces "you must change your temporary
password first" ON THE SERVER. Before this, only the React app redirected to
the change-password page, so anyone holding a temporary password could call
the API directly and skip it.
"""
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

# Paths a user with a temporary password may still call.
ALLOWED_WHILE_MUST_CHANGE = (
    "/api/auth/me/",
    "/api/auth/me/change-password/",
    "/api/auth/logout/",
)


class PasswordChangeAwareJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        if getattr(user, "must_change_password", False) and request.path not in ALLOWED_WHILE_MUST_CHANGE:
            raise PermissionDenied("You must change your temporary password before using the portal.")
        return user, token
