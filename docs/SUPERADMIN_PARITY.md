# Super Admin dashboard (Vercel) vs Django admin (Render)

Goal: do everything from `…vercel.app/portal/dashboard` — never open `…onrender.com/admin/`.

| Django admin model | Dashboard page (`/portal/dashboard/…`) | What you can do there |
|---|---|---|
| Users | `accounts` | Create · edit name/username/phone/email · reset password · unlock · disable/enable · delete · search + filters · see last sign-in |
| Notices | `notices` | Publish · **edit** · delete · search |
| Events | `events` | Add · **edit** · delete · Upcoming/Past/All · search |
| Articles | `blog` | Add · edit · publish/unpublish · delete |
| Gallery images | `gallery` | Upload · **edit caption / replace image** · delete · search |
| School forms | `downloads` | Upload · **rename / replace file** · delete · search |
| Admissions | `admissions` | Status · **edit all details** · delete · call / WhatsApp |
| Contact messages | `messages` | Mark read/replied · delete |
| Achievements | `achievements` | Add · edit · delete |
| Academic sessions / Classes / Subjects | `academics` | Add · edit · delete |
| Teacher profiles | `teachers` | Edit profile |
| Student profiles | `students` | Edit class, roll number, guardian |
| Timetable entries | `timetable` | Add · edit · delete |
| Homework | `homework` | Add · edit · delete · **see which students finished** (Homework completions) |
| Exams | `exams` | Schedule · edit · delete |
| Attendance | `attendance` | Mark a class · **Saved records tab: correct or delete single rows** |
| Results | `results` | Enter marks · **Saved results tab: correct or delete single rows** |
| Marksheets | `marksheets` | Upload · **edit (replace file / re-assign)** · delete |

Bold = added in this version (before, only the Django admin could do it).

## New API endpoints / methods (all Super-Admin only unless noted)
- `PATCH /api/content/gallery/<id>/`, `PATCH /api/content/forms/<id>/` (were delete-only)
- `PATCH /api/academics/marksheets/<id>/`
- `GET  /api/academics/homework/<id>/completions/` (Super Admin; a Teacher only for their own homework)
- `POST /api/auth/admin/users/<id>/unlock/`
- `PATCH /api/auth/admin/users/<id>/` now also accepts `username`; list/detail now include `locked_until`, `failed_login_attempts`, `last_login`

## Deliberately NOT in the dashboard (kept in Django / server only)
- Creating or editing another **Super Admin** account — only `manage.py createsuperuser` on the server (security rule already in the code).
- Changing a user's **role** — intentionally impossible through the API.
- Django **Groups/permissions** and **JWT token blacklist tables** — not used by this app's own permission system.
- Django's per-object "History" log — API changes are not written to it.

## Deploy order
1. Push the backend (Render redeploys, no migration needed).
2. Push the frontend (Vercel). If Vercel goes first, the new buttons show an error until Render finishes.
