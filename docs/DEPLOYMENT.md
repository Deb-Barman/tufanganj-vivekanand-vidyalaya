# Deployment — Django + DRF backend, React frontend, Supabase as database

Architecture: Django + Django REST Framework is the entire backend web
layer, deployed to Render. React + TypeScript is the frontend, deployed to
Vercel. Supabase provides only (1) managed Postgres, connected to via
`DATABASE_URL`, and (2) S3-compatible Storage for uploaded files. Supabase
Auth and Supabase Row Level Security are **not used** — Django owns
authentication and authorization end to end, per `context.md`'s
requirement that "the backend must enforce authentication and
authorization" and "never rely on frontend checks for security."

## 1. Create the Supabase project (database + storage only)

Create a project at supabase.com as usual. You will use it for two things,
neither of which is Supabase Auth:

**Database connection string**: Project Settings → Database → Connection
string → URI. This becomes `DATABASE_URL`.

**S3-compatible Storage credentials**: Storage → S3 Configuration → create
an access key. This gives you an Access Key ID + Secret Access Key pair —
**different from your Supabase project's API keys** — plus the S3 endpoint
URL for your project. These become `SUPABASE_S3_ACCESS_KEY_ID`,
`SUPABASE_S3_SECRET_ACCESS_KEY`, `SUPABASE_S3_ENDPOINT`. Also create a
bucket (e.g. `tvv-media`) for `SUPABASE_S3_BUCKET`.

## 2. Deploy the backend to Render

1. Push the repo to GitHub.
2. Render → **New** → **Web Service** → connect the repo, **Root
   Directory** = `backend`.
3. **Build Command**: `./build.sh` (runs `pip install`, `collectstatic`,
   `migrate` — see `backend/build.sh`)
4. **Start Command**: `gunicorn config.wsgi`
5. Environment variables — see `backend/.env.example` for the full list
   with explanations. At minimum:

| Key | Where it comes from |
|---|---|
| `DJANGO_SECRET_KEY` | Generate: `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `ENVIRONMENT` | `production` |
| `DJANGO_ALLOWED_HOSTS` | Your Render domain, e.g. `tvv-backend.onrender.com` |
| `DATABASE_URL` | Supabase connection string (step 1) |
| `FRONTEND_URL` | Your Vercel URL (set after step 3, update here after) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Supabase project API secret key (not currently used by any code path — kept for future direct API calls if ever needed) |
| `SUPABASE_DB_LIMIT_MB` / `SUPABASE_STORAGE_LIMIT_MB` | Optional. Plan sizes for the usage bars on the Super Admin *Database* page (defaults 500 / 1024 = Supabase free plan) |
| `SUPABASE_S3_ACCESS_KEY_ID` | From Storage → S3 Configuration (step 1) |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | From Storage → S3 Configuration (step 1) |
| `SUPABASE_S3_ENDPOINT` | From Storage → S3 Configuration (step 1) |
| `SUPABASE_S3_BUCKET` | The bucket name you created |

6. Deploy. Once live, open Render's **Shell** tab for the service and
   create the first Super Admin:

```bash
python manage.py createsuperuser
```

This is the only account ever created this way — every Teacher/Student
account after this goes through `POST /api/auth/admin/users/`, which
requires a Super Admin's token.

## 3. Deploy the frontend to Vercel

1. Vercel → **Add New** → **Project** → import the repo, **Root
   Directory** = `frontend`.
2. Environment variables:

| Key | Value |
|---|---|
| `VITE_API_URL` | Your Render backend URL, e.g. `https://tvv-backend.onrender.com` |
| `VITE_SUPABASE_URL` | Optional — not used by any current code path |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional — not used by any current code path |

3. Deploy.

## 4. Close the loop — update CORS on the backend

Go back to Render → your service → Environment, update:

- `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` (if set
  separately) to your real Vercel URL.

Redeploy for the change to take effect. Without this, every API call from
the deployed frontend fails with a CORS error.

## Security checklist before real student data goes in

- [ ] `DJANGO_DEBUG` is unset or `False` in production — `settings.py`
      refuses to enable it at all when `ENVIRONMENT=production`, as a hard
      safety net, but confirm anyway
- [ ] `DJANGO_SECRET_KEY` is a real generated value, not the local dev
      placeholder
- [ ] Test the account lockout: 5 wrong passwords in a row should lock the
      account for 15 minutes, even with the correct password
- [ ] Test cross-student isolation with two real (non-admin) student
      accounts: log in as Student A, confirm you cannot see Student B's
      attendance/results/marksheets via the API, including by guessing
      record IDs
- [ ] Test that a Teacher/Student token genuinely cannot call
      `POST /api/auth/admin/users/` (must be 403)
- [ ] Confirm file uploads reject wrong types/oversized files (try
      uploading a `.exe` renamed to `.jpg` — Pillow's actual image
      validation should reject it, not just the declared content-type)
- [ ] Confirm `SUPABASE_SECRET_KEY` and `SUPABASE_S3_SECRET_ACCESS_KEY`
      never appear in any frontend file or in the built JS bundle:
      `grep -r "SECRET" frontend/dist/` after a build should return nothing
- [ ] Rotate any password or credential that was ever typed into a chat,
      shared doc, or screenshot — treat it as compromised the moment it
      left a real secrets manager

## What Supabase does NOT do in this architecture

- Does not authenticate users (Django/DRF + Simple JWT does)
- Does not enforce Row Level Security as an access boundary (Django's
  queryset scoping in `academics/views.py` etc. is the boundary — see the
  comments in that file for exactly how student records are scoped)
- Is not called from the frontend at all — the frontend only ever talks to
  the Django API
