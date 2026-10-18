"""
JWT authentication for the portal.

Earlier versions forced anyone holding an admin-issued "temporary" password
to change it before the API would answer. That step is gone: the Super Admin
sets each Teacher/Student password and they sign in with exactly that
password. The class name is kept so settings.py does not need to change.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication


class PasswordChangeAwareJWTAuthentication(JWTAuthentication):
    """Plain JWT authentication (kept under its old name for settings compatibility)."""
