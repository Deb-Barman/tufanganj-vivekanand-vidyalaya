# V21 — App page, Projects, and "type it like Excel" bulk import

## 1. New: **App** section on the website (`/app`)
Anyone can open **/app** (footer → *Get the App*, desktop *More ▾* menu, phone *More* tab) and:
- **Download the school app** — each download is a card with name, device (Android / iPhone / Windows / Mac / Web / Other),
  version, file size, "what's new" and a **Download** button. The card matching the visitor's own phone is highlighted
  *For your device* and listed first.
- **Add the website to the home screen** (works with no APK at all): an **Install app** button on Chrome/Edge/Samsung Internet,
  and step-by-step help for iPhone (Safari → Share → Add to Home Screen) and other browsers. Shows "You are already using the app"
  when opened from the installed icon. This is a PWA: `manifest.webmanifest` + `icon-192.png` / `icon-512.png` (no service worker,
  so nothing can get cached/stale).
- **Super Admin → Dashboard → Website → App**: add / edit / hide / delete downloads. Each one is a **pasted public link**
  (Google Drive "Anyone with the link", GitHub Releases, a store page) — APK files are too big for the free storage, so nothing is
  uploaded. Links go through the same safety check as Downloads (https only; no `javascript:` / `data:` / `file:`; Drive links are
  cleaned and get a direct-download address). A **Test** button opens the link; **Hide/Show** removes an old version from the site
  without deleting it.
- API: `GET /api/content/apps/public/` (public, only shown apps, no internal ids, cached 60 s) · `GET/POST /api/content/apps/` and
  `GET/PATCH/DELETE /api/content/apps/<id>/` (Super Admin only).

## 2. New: **Projects** (Super Admin, Teacher, Student)
Dashboard → Academics → **Projects**.
- **Teacher or Super Admin gives a project to one class:** title, **semester** (First…Fourth / Annual, or none), optional subject,
  **start date**, **deadline**, details (up to 4,000 characters).
- **Students of that class** see it (their current class; earlier class years via the same *Class year* picker as Homework),
  with a live status — *Starts 12 Nov · 5 days left · Due tomorrow · Deadline today · Missed*. They tick it as done **only between
  the start date and the deadline**; after the deadline it is locked.
- **Staff see progress:** "12 of 40 done" per project and **See who** (done / not yet, with roll numbers). Filter by class and semester.
- Rules: a teacher edits/deletes only the projects they set; the Super Admin can change any; students can never create or change one
  and cannot read another class's projects. Dates are checked (deadline ≥ start) and a subject must belong to the chosen class.
  Text is stripped of HTML.
- API: `/api/academics/projects/`, `…/<id>/`, `…/<id>/done/`, `…/<id>/completions/`. New tables `projects`, `project_completions`
  (migration `academics/0014_projects`). Also registered in Django admin.

## 3. Bulk import: **type the data right on the page**
Old way: download sample → open Excel → type → save → upload → read warnings → edit → upload again.
New way (Dashboard → System → **Bulk import**, and the *Import* buttons on other pages): choose the type (e.g. *Student accounts*) and a
**spreadsheet opens in the page**, columns already set up:
- type like in Excel (Enter / ↑ ↓ move between rows), **paste cells copied from Excel or Google Sheets** (also a *Paste a whole table*
  box that works well on phones; a pasted header line is skipped automatically), add 5 rows, insert an example row, remove a row, clear.
- **Check rows** → the same row-by-row check as before (nothing is saved yet). Problems come back **on the exact row in the sheet, in red,
  with what to fix**; fix it and press Check again. Editing a row clears its old message.
- **Import** saves the good rows; rows that were *not* saved stay in the sheet ("Fix the N rows that were not saved"), saved rows are removed.
- Your typing is kept for this browser tab (sessionStorage), so a refresh or a dropped connection doesn't lose it.
- *Upload a file* is still there as the second tab (unchanged). **No backend change was needed:** the sheet is sent through the same
  `/imports/<type>/preview/` and `/commit/` endpoints (as an in-memory CSV), so every rule, limit and the one-time password list are identical.

## Tests
- Backend: +35 tests (`academics/test_projects.py` 21, `content/test_app_releases.py` 9, `bulkimport/test_sheet.py` 5). Whole suite passes.
- Frontend: `tsc -b`, lint (0 warnings) and production build pass; the sheet helpers were unit-checked; and every new screen was driven in a
  real browser against a real backend (type → check → fix → import; give a project as a teacher → tick it as a student on a phone-size
  screen; add an app as Super Admin → see it on `/app`).

## After deploying
1. Render runs `migrate` automatically (build.sh): two migrations — `academics/0014_projects`, `content/0007_app_releases`.
2. Super Admin → **App** → *Add app*: paste the APK link (or leave empty — the page already offers "add to home screen").
