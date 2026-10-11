# Test & Review Report — October 2026

Scope: full code review of `backend/` and `frontend/`, 56 automated backend tests (new),
production-mode boot check, frontend type-check/build/lint, dependency audits.
**Not tested:** the live Render/Vercel deployments (no network access from the review
environment), load/penetration testing, real Supabase Postgres + Storage.

## Results
| Check | Before | After |
|---|---|---|
| Backend automated tests | 0 (empty stubs) | 56 passing (`python manage.py test`) |
| `manage.py check --deploy` (production env) | clean | clean |
| `pip-audit` | clean | clean |
| `npm audit` | 1 high (`source-map-js`, build tool) | 0 |
| Frontend `tsc` + build | pass | pass |
| Frontend lint | 1 warning | 0 |

## Bugs found and fixed
1. **`&` shown as `&amp;`** on the website (e.g. "Science &amp; Arts") — sanitiser stored HTML entities. Now stores plain text; a data migration repairs existing rows.
2. **Bengali article titles got empty/ugly slugs** (`""`, `"-2"`). Unicode slugs now supported, with a fallback.
3. **Students had no profile record** → the student dropdown was empty when adding attendance/results in Django admin. Profiles are now created automatically (signal) and backfilled for existing accounts. New endpoints: `GET /api/academics/students/`, `GET|PATCH /api/academics/students/<id>/`.
4. **Temporary-password rule was frontend-only** — the API could be used without changing it. Now enforced server-side.
5. **Password change did not revoke tokens** (old access/refresh tokens worked up to 7 days). Both are now revoked.
6. **No server-side logout** — added `POST /api/auth/logout/` (blacklists refresh token); the app calls it.
7. **Django `/admin/` login had no brute-force protection.** Lockout moved into an auth backend so it covers the portal *and* Django admin.
8. **Public endpoints leaked internal user UUIDs** (`created_by`, `uploaded_by`, teacher `user`). Public serializers no longer include them.
9. **Student POST to attendance/results returned 400**, now a proper 403.
10. **Config footguns:** trailing slash in `FRONTEND_URL` broke CORS; missing `DJANGO_ALLOWED_HOSTS` → every request 400 on Render; `ssl_require` broke non-Postgres local DBs. All handled. `ADMIN_URL` is now configurable.
11. **Frontend:** friendly message when the Render server is asleep/unreachable; faculty list no longer depends on a user ID; lint warning and `npm audit` finding fixed.

## Known gaps / recommendations (not changed)
- Tokens live in `localStorage` (XSS-exfiltration risk) — acceptable now, hardening candidate: httpOnly refresh cookie.
- The "account locked" message reveals that a username exists (usability vs. enumeration trade-off).
- Teachers can delete results/attendance — confirm that is the intended school policy.
- No UI yet for marking attendance / entering results (API exists). Faculty heading says "Thirty teachers" — confirm this is a verified school fact.
- Render free tier sleeps; first request can take ~30–60 s.


---

# Update — Super Admin dashboard redesign (October 2026)

The website dashboard now covers everything the Django admin showed, with a new design
(phone-first: bottom tab bar + slide-in menu, desktop sidebar, `Ctrl+K` quick jump).

## New / rebuilt pages
| Page | Who | What it does |
|---|---|---|
| Overview | all roles | Super Admin command centre: live counts, "needs your attention", today's attendance ring, 7-day chart, admissions pipeline. Teacher and Student get their own overview. |
| Admissions | Super Admin | Website enquiries inbox: filter, search, Call / WhatsApp, mark contacted / closed, delete. |
| Classes & Subjects | Super Admin | Create / edit / delete sessions, classes, subjects (one "current" session). |
| Students | Super Admin, Teacher | Search + filter by class; Super Admin edits class, roll, guardian. |
| Attendance | Teacher / Admin / Student | Staff mark a whole class in one save; students see their own % and calendar. |
| Results | Teacher / Admin / Student | Staff type marks for a whole class + subject in one save (validated against full marks); students see their own results with percentages. |
| Marksheets | Super Admin / all | Super Admin uploads; students download their own. |
| Faculty | Super Admin / Teacher | Super Admin edits department, bio, experience, subjects taught; teachers edit their own profile. |

## Backend additions (56 → 72 automated tests)
`GET /api/auth/admin/stats/`, `POST /api/academics/attendance/bulk/`, `POST /api/academics/results/bulk/`,
edit/delete for sessions, classes and subjects, `PATCH /api/academics/teachers/<id>/`,
filters (`school_class`, `session`, `subject`, `date`, `search`), `?page_size=` (max 200).

## Extra bugs found while building
* **Marksheet uploads accepted any file type** (HTML, executables…). Now only a real PDF/PNG/JPEG/WebP up to 10 MB.
* Only one academic session can be "current" at a time.

## How it was checked
Headless-browser run (Chromium) against a seeded local database as Super Admin, Teacher and Student, on
desktop (1366 px) and phone (390 px) sizes: every page opened with no page errors, no horizontal scrolling,
role guards redirect correctly, and the attendance / marks / admissions / subjects / student-edit / Ctrl+K flows
were clicked through. Frontend lint: 0 warnings. Not tested: the live Render/Vercel sites, real Supabase storage.


---

# Update — error pages, loader, images (October 2026)

* **Error pages:** all 8 (400, 401, 403, 404, 408, 500, 502, 503) rebuilt as one premium design (gold on near-black / ivory, Swami Vivekananda portrait with a glowing halo, animated, theme-aware). ~22 KB each instead of ~300 KB. See `docs/ERROR_PAGES.md`.
* **Never scrolls:** automated check of every page × 13 screen sizes (1920×1080 down to 320×568 phones and 568×320 landscape) × light/dark = **208 combinations, 0 scroll, 0 clipped elements, 0 overlaps**.
* **In the website:** unknown URLs used to render a *blank page*; they now show the 404 screen. A UI crash shows the 500 screen. Browser-tested: theme toggle (remembered), Return home, no scroll even with the mouse wheel.
* **Backend:** branded 400/403/404/500 for browser URLs, JSON kept for `/api/` (5 new tests → 77 total).
* **Loader:** your logo intro is integrated (plays once per session, `?intro=replay` to replay). `index.html` went from 213 KB to 31 KB because the medallion image is now a file.
* **Images:** portrait split into dark/light, seal turned into a transparent round logo (`school_logo.png`) — now used automatically in the header and hero.
* Dashboard regression run (all flows) still passes. Frontend lint: 0 warnings.


---

# Update — professional multi-page website, loading system, new components (October 2026)

**Checks run:** 99 backend tests (was 77), frontend lint 0 warnings / typecheck clean / build OK, and a 64-check headless-browser run (desktop + phone) plus the earlier dashboard (all flows) and error-page (208 size/theme combinations) suites — all passing.

* **Real URLs for every section** (see `docs/SITE_STRUCTURE.md`): `/about`, `/faculty` (+`/teacher`), `/contact`, `/academics`, `/achievements`, `/campus`, `/notices/<id>`, `/blog/<slug>`, `/events`, `/downloads`, `/faq`, `/admissions`, `/privacy`, `/terms`, with per-page titles, descriptions, breadcrumbs, sitemap and robots.
* **Loading:** intro only on first website load; top progress bar between pages; skeleton screens for UI/data; simple spinner for buttons. Pages are lazy-loaded.
* **Your components:** CTA dock → footer ("REACH": Facebook, Contact, Admissions, Notices, Login); lamp-login physics duo → login page (real sign-in, light/dark); student & teacher dashboard designs → real data.
* **New backend:** contact messages (public submit, throttled; Super Admin inbox), achievements (public read; Super Admin CRUD with image validation), public notice/article detail, timetable, homework (+ tick-off), exams.
* **Found & fixed while building:** blank screen for unknown URLs (now a 404 screen); `/blog/<slug>` needed a Unicode-safe route; first-ever Contact page had no spam protection (now 5/hour per IP and per sender).
* **Please review:** legal pages are generic; `TrustBar` still says "30+ teachers" and the Campus page has statements written by the earlier author — I could not verify them; phone/email are empty in `site.ts`; the sitemap uses the Vercel address.
