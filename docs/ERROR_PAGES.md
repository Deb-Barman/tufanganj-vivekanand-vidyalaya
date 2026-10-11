# Error pages & loader

One design, three places it shows up. **None of them ever scroll** (desktop, tablet, phone, landscape phone).

| Where | What the visitor sees | Source |
|---|---|---|
| Website (React) | Any unknown URL, e.g. `/abc` or `/portal/dashboard/xyz` → full-screen **404**. A crash anywhere in the UI → full-screen **500** (instead of a blank page). | `src/components/ErrorScreen.tsx`, `ErrorBoundary.tsx` |
| Static files | `/errors/400.html … 503.html` (400, 401, 403, 404, 408, 500, 502, 503). Self-contained (~22 KB each). Use them anywhere a plain HTML error page is needed. | `public/errors/` (generated) |
| Backend (Django) | A wrong browser URL on the Render backend (e.g. `/admin/zzz`) → branded 400 / 403 / 404 / 500. Anything under `/api/` (or asking for JSON) still gets JSON. | `backend/config/error_views.py`, `backend/templates/errors/` (generated) |

## Change the words or the design
1. Words, buttons, quotes → `frontend/src/errors/catalog.json`
2. Look and feel → `frontend/src/styles/error-screen.css` (shared by React *and* the static pages)
3. Regenerate the static + Django pages: `cd frontend && npm run build:errors`
4. Commit the regenerated files. (The script writes both `frontend/public/errors/` and `backend/templates/errors/`.)

## Images (all in `frontend/public/`)
`swami-dark.webp|jpg`, `swami-light.webp|jpg` (portrait, picked by theme) · `school_logo.png` (round seal, transparent corners) ·
`loader-medallion.webp` (intro) · `favicon-64.png`, `apple-touch-icon.png`.

## Loader
Your `tvv_logo_loader` is wired into `frontend/index.html` (the 4 marked blocks). It plays once per browser session;
add `?intro=replay` to any URL to see it again. The old spinner (`BootLoader`) was removed. The medallion image is now a real
file (`/loader-medallion.webp`) instead of 180 KB of base64 inside the HTML.

## Honest limits
* **502 / 503 / 408 are normally produced by the hosting platform** (Render / Vercel / a proxy), before your code runs, so they can't
  show these pages unless the platform lets you set a custom error page (paid plans or a proxy such as Cloudflare/Nginx). The files are
  ready for that. The website itself (404 + crash 500) and the Django backend (400/403/404/500) show them today.
* The Swami Vivekananda quotes are kept exactly as you supplied them. Please double-check wording and attribution before publishing.
