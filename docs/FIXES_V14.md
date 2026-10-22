# V14 — Faculty cards, semester results, link-only profile photos, picture position & full-screen viewer

## What changed (matches your screenshots)
1. **Marksheets** (Super Admin): new **Paste a link** tab next to Upload (Google Drive etc.). Saved in `Marksheet.file_link`; students open it from `file` as before.
2. **Profile photo** (student + teacher *My profile*): **upload removed — paste a link only**. A "Move & zoom" tool positions it in the round frame.
3. **Results by semester**: every mark now belongs to a **semester** (First/Second/Third/Fourth/Annual); the class comes from the subject. Super Admin / teachers pick the semester when entering marks; the Result records page can filter by it; the student page shows one block per exam, titled e.g. **First Semester · Class VI**. Bulk import has an optional **Semester** column (blank = First Semester). Existing marks become *First Semester*.
4. **Student dashboard attendance**: shows **5 of 200 days · 6 held so far** (the session's working days), not "5 of 6".
5. **Faculty cards** (public website + portal): one professional card built from the teacher's own *My profile* — photo, headline, qualification, experience, subjects, languages. **Tap a card → `/profile/teacher/<username>`**. A teacher whose profile is private shows only the school-office details and never leaks profile data.
6. **Full-screen picture viewer**: tap any profile picture (public profile pages, portal My profile), gallery photo (portal), achievement or blog cover (website) to see the whole picture. Swipe / arrows between pictures, tap to zoom, "open original".
7. **Picture position (Instagram-style)**: drag + zoom slider for profile photos, gallery, blog covers and achievements — works for uploads and pasted links. The original is never cut; only how it is shown is saved (`x,y,zoom`). Big uploads are shrunk to 1600 px before sending to save storage.
8. **Blog & Articles (portal)**: card grid with cover, excerpt, date; tap to read; Super Admin gets New / Edit / Publish / Delete.
9. **Database page**: loading skeleton now has the same layout as the real page (two rings, four tiles, panels, table list); small-screen overflow guards added.

## Database changes (run `python manage.py migrate`)
- `academics.0011` — `Result.term` (default First Semester; unique per student + subject + session + **term**), `Marksheet.file_link`
- `content.00xx` — `cover_adjust`, `image_adjust` on Article / GalleryImage / Achievement
- `accounts.00xx` — `PublicProfile.photo_adjust`

## Tests
230 backend tests pass (16 new in `academics/test_v14.py`); `tsc`, `oxlint` and `vite build` are clean.
