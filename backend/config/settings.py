"""
Django settings for TVV Portal.

Architecture: Django + DRF is the entire backend. Supabase is used as (1)
the managed Postgres database via DATABASE_URL, and (2) S3-compatible
Storage for uploaded files (article covers, gallery images, school forms,
marksheets). Supabase Auth and Supabase RLS are NOT used — Django owns
authentication (accounts/) and authorization (accounts/permissions.py,
enforced in every view) end to end, per context.md: "the backend must
enforce authentication and authorization" and "never rely on frontend
checks for security."

Env var naming follows what the person specified for their Vercel/Render
deployment, with additions this file needs beyond that starting list —
see backend/.env.example for the authoritative full list with comments
on which ones are genuinely required vs. optional.
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


ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# ---------------------------------------------------------------------------
# Core / secrets
# ---------------------------------------------------------------------------

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not IS_PRODUCTION:
        SECRET_KEY = "insecure-local-dev-key-do-not-use-in-production"
    else:
        raise RuntimeError("DJANGO_SECRET_KEY is not set. Required in production.")

DEBUG = _bool_env("DJANGO_DEBUG", not IS_PRODUCTION) and not IS_PRODUCTION  # never True in production, no matter what

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
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "storages",
    "accounts",
    "notices",
    "academics",
    "content",
]

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
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
# Database — Supabase Postgres via DATABASE_URL. Falls back to SQLite only
# outside production, purely for first-run convenience.
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    import dj_database_url

    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600, ssl_require=True)}
elif not IS_PRODUCTION:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
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
# Static files (WhiteNoise serves these directly from the Django process —
# no separate static host needed on Render)
# ---------------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Media files — Supabase Storage via its S3-compatible endpoint.
# Requires an S3 access key PAIR generated in the Supabase dashboard
# (Storage -> S3 Configuration) — this is NOT the same as SUPABASE_SECRET_KEY,
# which is the Postgres/API service key. See .env.example.
# Falls back to local disk storage outside production for convenience.
# ---------------------------------------------------------------------------

SUPABASE_S3_ACCESS_KEY_ID = os.environ.get("SUPABASE_S3_ACCESS_KEY_ID")
SUPABASE_S3_SECRET_ACCESS_KEY = os.environ.get("SUPABASE_S3_SECRET_ACCESS_KEY")
SUPABASE_S3_ENDPOINT = os.environ.get("SUPABASE_S3_ENDPOINT")  # e.g. https://<ref>.storage.supabase.co/storage/v1/s3
SUPABASE_S3_REGION = os.environ.get("SUPABASE_S3_REGION", "ap-south-1")
SUPABASE_S3_BUCKET = os.environ.get("SUPABASE_S3_BUCKET", "tvv-media")

if SUPABASE_S3_ACCESS_KEY_ID and SUPABASE_S3_SECRET_ACCESS_KEY and SUPABASE_S3_ENDPOINT:
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}
    AWS_ACCESS_KEY_ID = SUPABASE_S3_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY = SUPABASE_S3_SECRET_ACCESS_KEY
    AWS_STORAGE_BUCKET_NAME = SUPABASE_S3_BUCKET
    AWS_S3_ENDPOINT_URL = SUPABASE_S3_ENDPOINT
    AWS_S3_REGION_NAME = SUPABASE_S3_REGION
    AWS_DEFAULT_ACL = None  # bucket policy controls access; don't set per-object ACLs
    AWS_S3_FILE_OVERWRITE = False
    AWS_QUERYSTRING_AUTH = True  # private files need signed URLs (marksheets)
    AWS_QUERYSTRING_EXPIRE = 3600
elif not IS_PRODUCTION:
    STORAGES["default"] = {"BACKEND": "django.core.files.storage.FileSystemStorage"}
    MEDIA_URL = "media/"
    MEDIA_ROOT = BASE_DIR / "media"
else:
    raise RuntimeError(
        "SUPABASE_S3_ACCESS_KEY_ID / SUPABASE_S3_SECRET_ACCESS_KEY / SUPABASE_S3_ENDPOINT are not set. "
        "Generate an S3 key pair in Supabase -> Storage -> S3 Configuration."
    )

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    # Deny-by-default: every view must declare its own permission_classes
    # (accounts/permissions.py) — this default only stops anonymous access,
    # it does NOT substitute for a real role check.
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/minute",
        "user": "180/minute",
        "admission_submit": "3/hour",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "config.exception_handlers.security_aware_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ---------------------------------------------------------------------------
# CORS / CSRF — explicit allow-list only, driven by FRONTEND_URL as the
# person specified, with room for additional origins if ever needed.
# ---------------------------------------------------------------------------

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

CORS_ALLOWED_ORIGINS = _list_env("CORS_ALLOWED_ORIGINS", FRONTEND_URL)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = _list_env("CSRF_TRUSTED_ORIGINS", FRONTEND_URL)

# ---------------------------------------------------------------------------
# Security hardening
# ---------------------------------------------------------------------------

SECURE_SSL_REDIRECT = IS_PRODUCTION
SESSION_COOKIE_SECURE = IS_PRODUCTION
CSRF_COOKIE_SECURE = IS_PRODUCTION
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False  # Django's CSRF cookie must be JS-readable to be sent back in the header
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30 if IS_PRODUCTION else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = IS_PRODUCTION
SECURE_HSTS_PRELOAD = IS_PRODUCTION
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https") if IS_PRODUCTION else None

# File upload hard limits, enforced at the Django level in addition to the
# per-field checks in content/serializers.py — a second layer against
# unexpectedly large request bodies before they even reach a serializer.
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# ---------------------------------------------------------------------------
# Supabase — Postgres connection string + S3 Storage keys only. No
# Supabase Auth key is used anywhere in this backend.
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")  # kept for potential future direct API calls; unused by auth

# ---------------------------------------------------------------------------
# Logging — errors to stdout (Render captures this); never log secrets or
# full request bodies (which could contain passwords).
# ---------------------------------------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.security": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}
