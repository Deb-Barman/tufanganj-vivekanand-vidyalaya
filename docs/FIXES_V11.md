# V11 — neumorphic pickers, desktop header, map, Super Admin tools

## 1. Dropdowns and date pickers (whole website)
Every native `<select>`, date and time box is replaced by a neumorphic control with the same look as the rest of the site
(`portal/ui/Select.tsx`, `DateField.tsx`, `Popover.tsx`, `neo-fields.css`):
- **Dropdown** — soft inset field, floating raised menu on desktop, **bottom sheet on phones**; keyboard (arrows, Enter,
  Esc, type-ahead); long lists (students, people) get a search box.
- **Date picker** — month grid, tap the title for month/year view, Today / Clear, min/max respected, arrow-key navigation.
- **Time picker** — hour / minute / AM-PM columns.
Used in Homework, Attendance, Results, Marksheets, Exams, Timetable, Events, Students, Accounts, Academic setup, Teacher records.

## 2. Search box not on the same line
`.toolbar` now aligns to the bottom edge, so a search box (no label) sits on the same line as the labelled dropdowns in
**every** dashboard section; on phones the dropdowns share rows evenly.

## 3. Homework start + end date
New `start_date` (migration `academics/0008`; older homework opens from the day it was created). Students can tick a
homework only from the start date to the **end date**. After it: ticks are locked on the server too, unfinished work shows
**Missed**, finished work stays finished. Not-yet-started homework shows "Opens <date>".

## 4. No more "Set a new password" screen
The Super Admin types (or generates) the password when creating an account or using **Set password**; the person signs in
with exactly that password. The forced-change page, redirect and API gate are removed (migration `accounts/0002` clears the
old flag on existing accounts, so nobody is stuck).

## 5. Error pages
Same neumorphic theme as the website (light + dark). Desktop: a raised card with the message on the left and the portrait
in a pressed-in frame, fully visible; phone layout kept. One screen, never scrolls (checked from 390×844 to 1920×1080).
Regenerate with `npm run build:errors` (already done; includes `backend/templates/errors/`).

## 6. Header (desktop)
Home · About · Academics · Faculty · Notices · Admissions · Contact + a **More** menu (Achievements, Campus, Blog, Events,
Downloads, FAQ, Gallery) show from 900px up (also in a phone's "desktop site" mode); below that the burger menu is unchanged.

## 7. Contact page map
New "Find the school" card (`components/LocationMap.tsx`) using the same method as `tiec-location-map.html`: Google Maps
embed, tap-to-explore cover, light/dark aware, Get directions / Open in Maps / Copy address. Until you add exact numbers in
`config/site.ts` (`SITE.map.lat/lng`) the pin is found by the school name + town.

## 8. Super Admin: Database, Data view, Teacher attendance
- **Database** — database size and file-storage use against the plan limits, per-bucket sizes, every table's rows and size,
  connections, uploaded files per feature. Reads Supabase's own `storage.objects` table. Plan sizes: `SUPABASE_DB_LIMIT_MB`,
  `SUPABASE_STORAGE_LIMIT_MB`.
- **Data view** — browse every school table (and the stored files list) like the Supabase table editor: search, sort, pages,
  click a row for all fields, CSV export. Read-only; password hashes are masked; Django internals are not listed.
- **Teacher attendance** — *Attendance → Teachers*: the Super Admin takes the teachers' attendance exactly like a class
  (date, P / A per teacher, "Everyone present", one Save), and can review / flip / delete saved days under *Teacher records*.
  Teachers see their own days under *Attendance → My attendance* (percentage ring + day chips); they can never see another
  teacher's days and students have no access. New table `teacher_attendance` (migration `academics/0009`), API
  `academics/teacher-attendance/` (+ `bulk/`, `sheet/`, `<id>/`). Future dates are refused; only active Teacher accounts count.

## Tests
Backend 131 tests pass (111 before + homework window, console tools, teacher attendance). Database/Data view were also run against a real
PostgreSQL with a Supabase-style `storage.objects` table. Frontend: `tsc`, `oxlint` and `vite build` clean; checked in a real
browser at phone and desktop sizes.
