# TVV Portal — Backend

Django + Django REST Framework API. Deploys to Render; database is Supabase PostgreSQL.

## Local setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: for quick local testing you can leave DATABASE_URL unset and
# set DJANGO_DEBUG=True — it will fall back to a local SQLite file.
python manage.py migrate
python manage.py createsuperuser   # creates the first Super Admin (Head Sir) account
python manage.py runserver
```

The API is now at `http://127.0.0.1:8000/api/`.

## Creating Teacher / Student accounts

There is no public sign-up. After creating the first Super Admin with
`createsuperuser`, log in as that user and use:

```
POST /api/auth/admin/users/
Authorization: Bearer <super admin access token>
{
  "username": "priya.das",
  "password": "a-temporary-password",
  "full_name": "Priya Das",
  "role": "STUDENT"   // or "TEACHER"
}
```

The account is created with `must_change_password=True`; the frontend
should prompt for a password change on first login (see
`POST /api/auth/me/change-password/`).

## Apps

- `accounts/` — custom user model (role: SUPER_ADMIN/TEACHER/STUDENT), JWT
  login, Super-Admin-only account management, shared RBAC permission
  classes used by every other app.
- `notices/` — **fully wired** end-to-end module: public read endpoint for
  the website, authenticated read for the portal, Super-Admin-only
  create/update/delete. Use this as the reference pattern for building out
  the remaining modules.
- `academics/` — **scaffold only**. Models exist for classes, subjects,
  academic sessions, student/teacher profiles, attendance, results,
  marksheets, articles, gallery, events, admissions, and school forms — but
  no serializers/views/URLs/permissions yet. See `academics/models.py`'s
  module docstring and `../docs/NEXT_STEPS.md` for the build order.

## Security notes

- Every DRF view declares its own `permission_classes` explicitly — the
  project default (`DEFAULT_PERMISSION_CLASSES`) is `IsAuthenticated`, so a
  view that forgets to add stricter permissions still denies anonymous
  access, but it will NOT automatically enforce role checks. Always check
  which permission class from `accounts/permissions.py` a new view needs.
- `AdminCreateUserSerializer` explicitly refuses to create another
  `SUPER_ADMIN` account through the API — additional Super Admins must be
  created via `manage.py createsuperuser` on the server, never over HTTP.
- Passwords are hashed by Django's default PBKDF2 hasher; nothing in this
  codebase stores or logs plaintext passwords.
- CORS/CSRF are locked to the explicit origins in `.env` — never widen this
  to `*` in production.
