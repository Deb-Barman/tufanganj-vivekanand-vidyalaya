# TVV Portal — Backend

Django + Django REST Framework. Deploys to Render. Database is Supabase
Postgres (via `DATABASE_URL`); file uploads go to Supabase Storage via its
S3-compatible interface. No Supabase Auth, no Supabase RLS — this backend
is the entire authentication/authorization layer.

## Local setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# For quick local testing: leave DATABASE_URL unset and ENVIRONMENT unset
# (defaults away from production) — falls back to local SQLite and local
# disk storage automatically.
python manage.py migrate
python manage.py createsuperuser   # first Super Admin (Head Sir)
python manage.py runserver
```

API is now at `http://127.0.0.1:8000/api/`.

## Creating Teacher / Student accounts

No public sign-up exists. After creating the first Super Admin, log in and use:

```
POST /api/auth/admin/users/
Authorization: Bearer <super admin access token>
{
  "username": "priya.das",
  "password": "a-temporary-password-10-chars-min",
  "full_name": "Priya Das",
  "role": "STUDENT"
}
```

The account is created with `must_change_password=True` — the frontend
prompts for a change on first login via `POST /api/auth/me/change-password/`.

## Apps

- `accounts/` — custom user model (role, active flag, failed-login
  lockout fields), JWT login/refresh with account lockout after 5 failed
  attempts (15-min cooldown), Super-Admin-only account management, shared
  RBAC permission classes used by every other app
- `notices/` — public read + Super-Admin-only write, with `bleach`-based
  HTML sanitization on save
- `content/` — Blog/Articles (draft→publish), Events, Gallery, School
  Forms/Downloads, Admissions (public enquiry submission, rate-limited).
  All file uploads validate both declared content-type and actual file
  size; images additionally go through Pillow's real image validation
- `academics/` — classes, subjects, sessions, teacher/student profiles,
  attendance, results, marksheets. The queryset scoping in
  `academics/views.py` is the actual security boundary for student
  records — read the comments there before touching it

## Security notes

- Every DRF view declares its own `permission_classes` explicitly
- `AdminCreateUserSerializer` refuses to create a second `SUPER_ADMIN`
  through the API
- Account lockout: 5 failed logins locks the account for 15 minutes,
  tracked per-user in the database (`failed_login_attempts`,
  `locked_until`)
- All rich-text input (notice/article bodies, titles) is sanitized with
  `bleach` before storage — never trust that only the frontend will ever
  call these endpoints
- File uploads are validated for both declared MIME type and actual file
  size at the serializer level, and for images, actual pixel content via
  Pillow (`ImageField`)
- `config/exception_handlers.py` prevents unhandled exceptions from
  leaking internal details to API responses — logs the real error
  server-side, returns a generic message to the client
- See `../docs/SECURITY_AUDIT.md` for what was actually tested versus
  assumed
