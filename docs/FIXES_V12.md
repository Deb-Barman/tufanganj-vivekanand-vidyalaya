# V12 — phone scale, profiles, bulk import, attendance report

## 1. Phone scale (looks like Chrome at 75% by default)
`frontend/index.html` — on phones (short side ≤ 600 px, touch) the page opens at 75% size, the same look you
liked at Chrome's 67–80% zoom. Tablets and computers are unchanged; pinch-zoom still works.
Change `PHONE_SCALE` (0.80 = 80%, 0.67 = 67%) in that one script to make it bigger or smaller.

## 2. Profiles
* Every dashboard (Super Admin, Teacher, Student) has **My profile**: photo, headline, about, background,
  talents, interests, achievements, website.
* Students and teachers can publish it at `/profile/student/<username>` and `/profile/teacher/<username>`.
* Privacy (enforced on the server): **off by default** (opt-in), only the profile table + name + class/department
  are public, never phone/e-mail/guardian/roll/marks/attendance; phone numbers and e-mails typed in the text are
  rejected; photos are re-encoded (GPS/camera data removed); disabled accounts and the Super Admin have no public
  page; search engines are told not to index these pages; the Super Admin can hide any profile in Django admin
  (Public profiles → action "Hide selected profiles").
* New table `public_profiles` (migration `accounts/0003_public_profile`).

## 3. Bulk import from Excel / CSV (Super Admin)
* **Bulk import** page + an "Import Excel / CSV" button on Accounts (students, teachers), Classes & Subjects,
  Attendance (students, teachers), Results, Timetable, Exams and Events.
* Flow: download the sample → fill it → upload → every row is checked (nothing saved) → confirm.
* Passwords left empty are generated; the list can be downloaded once after the import (never stored).
* Samples for all 10 kinds are in `docs/import-samples/` (`.xlsx` and `.csv`), and on every import screen.
* New Python packages: `openpyxl`, `defusedxml` (already added to `backend/requirements.txt`).

## 4. Attendance report (Super Admin)
* Classes & Subjects → Sessions: set **Total working days** (e.g. 200), **minimum attendance %** and optionally the
  first school day. Migration `academics/0010_session_working_days`.
* **Attendance report** page: for each student/teacher — days present, % of days held so far, % of the whole
  session, best % still possible, and a flag (On track / Needs attention / Cannot reach minimum). Filter by
  session/class, search, download CSV.

## Deploy
Push the files, Render runs `build.sh` (installs the 2 new packages and runs the 2 new migrations). Nothing to
delete.

## Tests
Backend: 178 tests pass (47 new). Frontend: `tsc`, `oxlint` and `vite build` clean.
