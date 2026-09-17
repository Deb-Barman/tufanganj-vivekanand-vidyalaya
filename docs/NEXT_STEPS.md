# Next steps — build order for remaining modules

Each module below should be built the same way `notices/` was: a Django app
(or addition to `academics/`) with `serializers.py`, `views.py`, `urls.py`
using the RBAC classes in `accounts/permissions.py`, wired into
`config/urls.py`, a matching frontend dashboard section, and the Supabase
RLS policy already drafted in `docs/supabase_schema_rls.sql` applied and
verified.

Suggested order (roughly matching dependency order — later modules build on
earlier ones):

1. **Classes & Subjects** — needed before students/teachers can be assigned
   to anything. Super-Admin CRUD only; everyone else read-only.
2. **Student & Teacher accounts + profiles** — extend the existing
   `AdminUserListCreateView` flow so creating a Teacher/Student also creates
   their `TeacherProfile`/`StudentProfile` in the same request (currently
   the profile models exist but nothing populates them). Add a
   Super-Admin-only "Manage Accounts" dashboard page listing/editing/
   disabling accounts.
3. **Attendance** — Teacher marks attendance for their assigned class;
   Student reads only their own; Super Admin sees everything. This is the
   first module where the "a student may only read their own row" RLS
   pattern actually matters — test it explicitly with two different student
   logins.
4. **Results & Marksheets** — same read pattern as attendance. Marksheet
   generation (PDF) is a separate concern from the `Result` records — TODO:
   confirm with the school whether marksheets need to be an uploaded PDF
   (Super Admin uploads a scanned/generated file) or system-generated from
   `Result` rows.
5. **Articles, Events, Gallery** — public-facing content, Super-Admin-only
   write, public read. Straightforward extensions of the Notices pattern.
   Gallery should use Supabase Storage for images (not local Django
   `FileField`) — the backend settings already read `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` for this; the actual upload code isn't
   written yet.
6. **Admissions enquiry form** — public POST endpoint (no auth) on the
   website's Admissions section, landing in the `Admission` table for
   Super Admin to review from the dashboard.
7. **School Forms** — downloadable documents (prospectus, forms). Depends
   on the same Supabase Storage upload path as Gallery.

## Before considering any module "done"

- [ ] Serializer validates every field a client can set
- [ ] View declares explicit `permission_classes` (never rely on the
      `DEFAULT_PERMISSION_CLASSES` fallback alone for anything touching
      student data)
- [ ] Manually verified with at least two roles: one that should succeed,
      one that should get 403/401
- [ ] Supabase RLS policy for the table is applied and re-verified against
      the same two-role check
- [ ] Frontend dashboard section shows the right thing per role (read-only
      vs. editable) and handles loading/error states, matching the
      `DashboardPage.tsx` Notices section as the reference pattern
- [ ] No invented data — TODO panel instead, same pattern as
      `Faculty.tsx`/`Achievements.tsx`/`Contact.tsx`

## Deployment checklist (once modules above are further along)

- [ ] Create the Supabase project, run `python manage.py migrate` against
      it via `DATABASE_URL`, then apply `docs/supabase_schema_rls.sql`
- [ ] Deploy backend to Render: set all vars from `backend/.env.example`,
      `gunicorn config.wsgi` as the start command, add `whitenoise` to
      `MIDDLEWARE` if serving static files directly from Django
- [ ] Deploy frontend to Vercel: set `VITE_API_BASE_URL` to the Render URL
      in Vercel project settings
- [ ] Update `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` on the backend to
      the real Vercel domain
- [ ] Create the real first Super Admin via `manage.py createsuperuser` on
      Render (one-off shell command), not by seeding it in code
