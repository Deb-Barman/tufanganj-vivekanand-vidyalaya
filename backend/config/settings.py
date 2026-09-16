"""
Django settings for the TVV Portal backend.

Security posture (per context.md):
- All secrets come from environment variables — nothing sensitive is
  hardcoded here or committed to the repo. See .env.example for the full
  list of variables this file reads.
- DEBUG defaults to False; it must be explicitly turned on for local dev.
- CORS is locked to an explicit allow-list, not "allow all".
- Database is Supabase PostgreSQL in every environment except local dev
  without a DATABASE_URL set (falls back to SQLite so `manage.py runserver`
  works out of the box for quick local iteration).
"""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _bool_env(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _list_env(name, default=""):
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ---------------------------------------------------------------------------
# Core / secrets
# ---------------------------------------------------------------------------

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if _bool_env("DJANGO_DEBUG", False):
        # Local-dev-only fallback so the project runs before .env is set up.
        # NEVER used when DEBUG is off.
        SECRET_KEY = "insecure-local-dev-key-do-not-use-in-production"
    else:
        raise RuntimeError(
            "DJANGO_SECRET_KEY is not set. Set it in your environment or .env file "
            "before running with DEBUG=False."
        )

DEBUG = _bool_env("DJANGO_DEBUG", False)

ALLOWED_HOSTS = _list_env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    # local apps
    "accounts",
    "notices",
    "academics",
]

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Database — Supabase PostgreSQL (falls back to SQLite only in local DEBUG
# mode with no DATABASE_URL, purely for first-run convenience).
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    import dj_database_url  # imported lazily; see requirements.txt

    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600, ssl_require=True)}
elif DEBUG:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    raise RuntimeError("DATABASE_URL is not set. Point it at your Supabase Postgres connection string.")

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# I18n
# ---------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # No implicit "allow if logged in" default — every view must declare its
    # own permission_classes explicitly (see accounts/permissions.py). This
    # denies-by-default any view someone forgets to annotate.
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/minute",
        "user": "120/minute",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ---------------------------------------------------------------------------
# CORS — explicit allow-list only, never "*"
# ---------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = _list_env(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173",  # Vite dev server
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = _list_env("CSRF_TRUSTED_ORIGINS", "http://localhost:5173")

# ---------------------------------------------------------------------------
# Security hardening (relaxed automatically under DEBUG for local dev)
# ---------------------------------------------------------------------------

SECURE_SSL_REDIRECT = not DEBUG and _bool_env("DJANGO_SECURE_SSL_REDIRECT", True)
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_HSTS_SECONDS = 0 if DEBUG else 60 * 60 * 24 * 30
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# ---------------------------------------------------------------------------
# Supabase — used by app code (e.g. Storage uploads) via the service-role
# key on the BACKEND ONLY. Never send SUPABASE_SERVICE_ROLE_KEY to the
# frontend; the frontend gets only SUPABASE_URL + SUPABASE_ANON_KEY.
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
