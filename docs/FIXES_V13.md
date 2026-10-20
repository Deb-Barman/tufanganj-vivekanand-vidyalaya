# V13 — Data view delete & filters, paste-a-link, richer profiles, new sidebar

## 1. Data view (Super Admin)
* **Delete without Supabase:** tick rows (or "Select all N matching") → Delete. Before anything is removed you see
  what will go (names, linked records such as a student's attendance, number of files) and must type `DELETE`.
  Protected: your own account, Super Admin/staff accounts, the current session.
* **Filters:** column + condition + value (text contains/exactly/starts with/empty; number >, ≥, <, ≤; yes/no; dates on/from/until;
  dropdown choices; IDs). Up to 8 at once, shown as chips. Quick buttons: last 7 days, last 30 days, older than 1 year.
  Filters also apply to CSV export. Rows per page: 25/50/100.
* **Storage Files:** same filters + "Unused files only" (files no record points to) → delete them to free space.
  A file still used by a record can't be deleted there ("delete the record instead").
* **Files are now deleted with their record** everywhere (gallery, downloads, profile photos, …): `accounts/filecleanup.py`.

## 2. Paste a link instead of uploading
Gallery, Downloads, Blog cover, Achievements and profile photos: **Upload** or **Paste a link**
(Google Drive "Anyone with the link", Dropbox, Imgur, direct picture addresses). Instant check + preview.
Pictures from Facebook/Instagram/X **posts** are web pages, not pictures, so those links are refused with
instructions (save to Drive first). Nothing is downloaded by the server. Switching to a link deletes the old upload.
New fields: `cover_link`, `image_link`, `file_link`, `photo_link` (migrations `content/0005`, `accounts/0004`).

## 3. Profiles
Added: age and gender (private unless "show" is ticked), town, languages, favourite subject, what I want to become
(students), qualification (teachers), quote, projects, and **social links with real logos**
(Instagram, Facebook, X, YouTube, LinkedIn, GitHub, Telegram, Threads, Pinterest, Snapchat, Behance, Medium, website).
Type `@username` or paste a link; the server cleans it and rejects the wrong site, phone numbers and e-mails.
Logos: Simple Icons (CC0), inlined — no network request.

## 4. New sidebar (all three dashboards)
Account card, page search (Enter jumps to the first match), collapsible sections (remembered), icon tiles with an
active indicator, number bubble on Admissions for the Super Admin, footer with Quick jump / View website / Log out.
Desktop: collapse to an icon rail. Tablet: slide-in drawer. Phone: full-screen menu.

## Deploy
Push the files. Render's `build.sh` runs the 2 new migrations. Nothing to delete, no new packages.
Tests: backend 214 pass (83 new in V12+V13); `tsc`, `oxlint`, `vite build` clean.
