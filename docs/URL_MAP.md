# TVV Portal — URL map (Vercel dashboard ↔ Django API ↔ Django admin)

Two different sites, two different dashboards:

| What | Host | Base path |
|---|---|---|
| Public site + Super Admin dashboard (React) | `https://tufanganj-vivekanand-vidyalaya.vercel.app` | `/portal/dashboard/...` |
| Django API (JSON) | `https://tufanganj-vivekanand-vidyalaya.onrender.com` | `/api/...` |
| Django pre-built admin | `https://tufanganj-vivekanand-vidyalaya.onrender.com` | `/admin/...` (or the `ADMIN_URL` env var if set) |

`/admin/` does NOT exist on the Vercel domain (Vercel rewrites every unknown path to the React app, so you get the React 404 page). The Django admin only lives on Render.

## Module-by-module map

| Dashboard module | Vercel route (`/portal/dashboard/…`) | Django API (`/api/…`) | Django admin (`/admin/…`) |
|---|---|---|---|
| Overview | *(index)* | `auth/admin/stats/` | `/admin/` |
| Notices | `notices` | `notices/` | `notices/notice/` |
| Events | `events` | `content/events/` | `content/event/` |
| Admissions | `admissions` | `content/admissions/` | `content/admission/` |
| Messages | `messages` | `content/contact/` | `content/contactmessage/` **(added)** |
| Blog | `blog` | `content/articles/` | `content/article/` |
| Gallery | `gallery` | `content/gallery/` | `content/galleryimage/` |
| Downloads | `downloads` | `content/forms/` | `content/schoolform/` |
| Achievements | `achievements` | `content/achievements/` | `content/achievement/` **(added)** |
| Timetable | `timetable` | `academics/timetable/` | `academics/timetableentry/` **(added)** |
| Homework | `homework` | `academics/homework/` | `academics/homework/` and `academics/homeworkcompletion/` **(added)** |
| Exams | `exams` | `academics/exams/` | `academics/exam/` **(added)** |
| Attendance | `attendance` | `academics/attendance/`, `academics/teacher-attendance/` (+ `bulk/`, `sheet/`) | `academics/attendance/` |
| Results | `results` | `academics/results/` | `academics/result/` |
| Marksheets | `marksheets` | `academics/marksheets/` | `academics/marksheet/` |
| Classes & Subjects | `academics` | `academics/sessions/`, `classes/`, `subjects/` | `academics/academicsession/`, `schoolclass/`, `subject/` |
| Students | `students` | `academics/students/` | `academics/studentprofile/` |
| Faculty | `teachers` | `academics/teachers/` | `academics/teacherprofile/` |
| Accounts | `accounts` | `auth/admin/users/` | `accounts/user/` |

## Public (no login) endpoints used by the Vercel site
`notices/public/`, `content/articles/public/`, `content/events/public/`, `content/gallery/public/`, `content/forms/public/`, `content/achievements/public/`, `academics/teachers/public/`, `content/admissions/submit/`, `content/contact/submit/`, `health/`.

## Auth endpoints
`auth/admin-login/`, `auth/staff-login/`, `auth/token/refresh/`, `auth/logout/`, `auth/me/`, `auth/me/change-password/`, `auth/admin/users/<id>/reset-password/`,
`auth/admin/database/`, `auth/admin/data/`, `auth/admin/data/<app.model>/`, `auth/admin/data/<app.model>/export/` (Super Admin only).


## Added in V8
- `/gallery` — public photo gallery
- `/developer` — who built the website
