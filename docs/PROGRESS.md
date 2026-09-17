# Progress — what's real vs. scaffolded

Last updated: this build session.

## ✅ Fully working (built, tested end-to-end)

**Backend**
- Custom `User` model with roles (`SUPER_ADMIN`/`TEACHER`/`STUDENT`), no public
  registration endpoint anywhere in the codebase
- JWT login (`/api/auth/login/`), refresh (`/api/auth/token/refresh/`)
- `/api/auth/me/` and `/api/auth/me/change-password/`
- Super-Admin-only account management (`/api/auth/admin/users/...`) — the
  single way Teacher/Student accounts get created; blocks creating another
  `SUPER_ADMIN` through the API
- Shared RBAC permission classes in `accounts/permissions.py`
- **Notices module**, fully wired: public read (`/api/notices/public/`, no
  auth), authenticated portal read (`/api/notices/`), Super-Admin-only
  create/update/delete (`/api/notices/`, `/api/notices/<id>/`)
- Verified via Django's test client: login issues a working token, Super
  Admin can publish a notice, a Student gets a real 403 attempting to
  publish one, unauthenticated requests to protected endpoints get 401,
  and the public endpoint serves notices with no auth at all

**Frontend**
- Public website (`/`) ported to React + TypeScript: Hero, Trust bar,
  Academics (Science/Arts), Faculty (TODO panel — see below), Achievements
  (TODO panel), Campus, **live Notices section reading from the real API**,
  FAQ, Admissions, Contact
- Portal login (`/portal`) — calls the real login endpoint, stores JWTs,
  redirects to the dashboard
- Protected dashboard (`/portal/dashboard`) — Notices module fully wired:
  list, create (Super Admin only), delete (Super Admin only); Teachers and
  Students see the same list read-only
- Auth context handles token refresh automatically on 401
- Clean `tsc -b && vite build` with zero errors

## 🚧 Scaffolded, not yet wired

**Backend** (`academics/models.py`) — models exist, no serializers/views/URLs
yet, not exposed via API or Django admin:
- `AcademicSession`, `SchoolClass`, `Subject`
- `StudentProfile`, `TeacherProfile`
- `Attendance`, `Result`, `Marksheet`
- `Article`, `GalleryImage`, `Event`
- `Admission`, `SchoolForm`

**Supabase** — `docs/supabase_schema_rls.sql` has RLS policies written for
every table above, ready to apply once the tables exist via Django
migrations. Not yet run against a real Supabase project (no project
credentials were provided).

**Frontend**
- Faculty section shows an explicit "TODO / Required Data" panel — no real
  teacher data was provided, so nothing is invented
- Achievements section shows the same — the original demo's stats were
  explicitly placeholder figures
- Contact section is missing a live map embed and direct phone/email (not
  provided)
- Dashboard has a placeholder note pointing at the scaffolded modules above

## ❌ Not started

- Everything in "Scaffolded, not yet wired" needs its serializers/views/
  RBAC-checked endpoints on the backend AND its dashboard UI on the
  frontend, following the exact pattern `notices/` demonstrates
- Deployment: no Render/Vercel projects created, no live Supabase project
  wired up — `.env.example` files in both `backend/` and `frontend/`
  document every variable needed when that happens
- Automated test suite (only manual/interactive verification has been done
  so far)
- Real school data: teacher directory, current results/achievement
  figures, admission form fields, contact phone/email, campus map — all
  explicitly marked TODO rather than invented, per context.md rule #1
