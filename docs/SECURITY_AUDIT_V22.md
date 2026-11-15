# Security & bug audit — V22

Scope: Django backend (Render), React frontend + Vercel functions, dependencies, configuration. Method: line-by-line review of the
backend and the risky parts of the frontend, an automatic sweep that sent **1,530 requests** to every API route as a visitor / student /
teacher with every HTTP method, a **73,440-request fuzz** of every query parameter, data-based "student A vs student B" tests, dependency
audits, a Django production deploy check, and a real-browser test of every page against the new security policy.

## 1. Fixed in this release

| # | Severity | Problem | Fix |
|---|---|---|---|
| S1 | **High** | **Rate limits and the sign-in lockout could be bypassed.** They counted per address, but read the visitor-typed `X-Forwarded-For` header, which Render does not clear. Anyone could send a new fake value each time → unlimited sign-in guesses against the per-address limit, and unlimited contact/admission spam (3 and 5 per hour were not real limits). | New `config/clientip.py`: trusts Cloudflare's own `CF-Connecting-IP` (cannot be typed by a visitor), else the proxy-added last entry, else the connection address. Every throttle and the lockout use it. 5 new tests prove a faked header no longer escapes a limit. |
| S2 | Medium | The lockout also keyed on the *last* forwarded address, which on Render is a Cloudflare server shared by many people → a stranger's wrong guesses could lock out a classmate. | Fixed by S1 (real visitor address). |
| S3 | Medium | **No Content-Security-Policy.** Sign-in tokens live in the browser, so any future script-injection bug would have been able to steal them. | Build-time CSP on every page: scripts only from the site or by exact SHA-256 fingerprint of the 5 built-in scripts; requests only to the site and the school server; no plug-ins, no foreign forms, no `<base>`; framing blocked (`frame-ancestors`, `X-Frame-Options`). Tested in Chromium on all pages (first visit and repeat): **0 violations**. `npm run seo:check` fails if an inline script or handler would be blocked. |
| S4 | Medium | `npm audit`: **vite 8.3.0–8.3.2** (high, dev-server file read). Not in the live site, but on a developer's machine. | Lockfile updated to vite 8.3.8 → 0 vulnerabilities. |
| S5 | Low | `forgot-password` and `logout` returned **500** if the body was a JSON list instead of an object. | Body type checked. |
| S6 | Low | **500 errors** on 14+ list endpoints for a bad filter such as `?student=abc` or `?date=2026-13-45` (Django's own ValidationError was not handled). | Global handler answers **400** with a clear message. |
| S7 | Low | Creating/renaming one account allowed `Riya` and `riya` as two different people (impersonation) and spaces / `/ ? #` in usernames (breaks the profile link). Bulk import already refused these; the single form did not. | One shared rule for every route: 3–150 letters, digits, `. _ @ + -`; unique ignoring case. |
| S8 | Low | Marksheet and document uploads checked the file's first bytes but not its name, so a "PDF" could be stored as `x.html`. | File name must end `.pdf/.doc/.docx` (documents) or `.pdf/.png/.jpg/.jpeg/.webp` (marksheets). |
| S9 | Low | Dropbox share links were rebuilt without re-encoding the query. | Re-encoded. |
| S10 | Low | `/api/page` (Vercel) built its fetch address from the `Host` header, and a broken `%` in a URL (e.g. `/blog/%E0%A4%A`) crashed the function. | Host accepted only if it is the site or a `*.vercel.app` preview; bad `%` → clean 404. |
| S11 | Low | API answers had no restrictive browser policy, and private answers (marks, user lists) could be cached. | `ApiSecurityHeadersMiddleware`: `default-src 'none'`, COOP, and `Cache-Control: private, no-store` on any request that carries a token. |
| S12 | Low | `DJANGO_SECRET_KEY` (which also signs sign-in tokens) could silently stay as the example placeholder. | Production start-up refuses a placeholder value and warns when under 32 characters. |
| S13 | Info | Headers on Vercel | Added `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy`, `X-Permitted-Cross-Domain-Policies`. |

### Bugs fixed (not security)
- **B1 — "Print slip" never worked.** `window.open(..., "noopener")` returns nothing, so the new-account slip always showed "Allow pop-ups". Now opens, cuts the link back to the site by hand, and prints from the page itself (needed for the CSP too).
- B2 — every page pointed `hreflang` at the home page (removed). B3 — a stale static `sitemap.xml` hid the live sitemap (deleted). B4 — `/favicon.ico` was a 404 (added). Details: `docs/SEO_GUIDE.md`.
- B5 — the portal sidebar and skeleton loaders had invalid ARIA (fixed with the contrast work in V22 SEO).

## 2. Checked and found sound (no change needed)
- Sign-in: per-account lockout, uniform error messages, access tokens 15 min, refresh rotation + blacklist, tokens revoked on password change, password rules enforced.
- Permissions: every route denies visitors; students cannot write anything; **student A cannot read or change student B's attendance, results, marksheets or profile** (new test file `academics/test_isolation_v22.py`); teacher attendance is Super-Admin/teacher-only.
- Injection: no raw SQL, no `eval/exec/pickle/subprocess`, no `mark_safe`; the database-viewer tool whitelists tables, hides passwords and tokens, and neutralises spreadsheet-formula cells in CSV exports.
- Cross-site scripting: React escapes all text; no `innerHTML` or `dangerouslySetInnerHTML` for user content; HTML typed into notices is stripped by an allow-list sanitiser; links are accepted only as `https://` from known hosts or image URLs; Google Drive/Dropbox links are normalised.
- Uploads: size caps, real image decoding, file signature checks, no SVG; spreadsheet imports reject oversized and zip-bomb files.
- Privacy: public profiles are opt-in; phone numbers and e-mail addresses are removed from public text; private fields never reach public serializers.
- Secrets: none committed (`.env.example` holds placeholders only); `pip-audit` and `npm audit` clean; `manage.py check --deploy` reports no issues with production settings; HTTPS-only, HSTS, secure cookies.

## 3. Residual risks (by design — know them)
1. **Sign-in tokens are kept in the browser's storage** (the website and the server are on different domains, which rules out the safer HttpOnly-cookie design without a rebuild). The new CSP is the main protection; do not add third-party scripts to the site.
2. **Super Admin lock-out.** 30 wrong passwords lock any account for 15 minutes — including the Head's. Recovery: wait 15 minutes, or redeploy on Render (the start-up step clears the lock). Keep the Super Admin username private.
3. **Pasted image links** (profile photos, gallery) can point to any image address, so the host sees the visitor's address. Only signed-in users and the Super Admin can set them.
4. `CF-Connecting-IP` is trusted because Render sits behind Cloudflare. If you ever move the backend to a host without Cloudflare, the code falls back to the proxy-added address automatically.

## 4. What you should do (all from a phone)
1. Render → Environment: make sure `DJANGO_SECRET_KEY` is a long random value (the site will now refuse to start with the example text). Set `ADMIN_URL` to a secret path (e.g. `office-x7k2/`) so the Django admin is not at `/admin/`.
2. GitHub → Settings → Code security: turn on **Dependabot alerts** and **Secret scanning** (free).
3. Supabase → Storage: keep the media bucket's marksheet folder **private** (served by signed links).
4. Vercel → keep `VITE_API_URL` set — the Content-Security-Policy is built from it.
5. After deploying, open any page → ⋮ → **View source** and confirm a `Content-Security-Policy` line is near the top.

## 5. Files
Backend — new: `config/clientip.py`, `accounts/test_security_v22.py`, `academics/test_isolation_v22.py`. Changed: `config/settings.py`, `config/seo.py`, `config/exception_handlers.py`, `accounts/views.py`, `accounts/backends.py`, `accounts/profiles.py`, `accounts/serializers.py`, `content/views.py`, `content/serializers.py`, `content/links.py`, `content/tests.py`, `academics/serializers.py`.
Frontend: `index.html`, `vercel.json`, `package-lock.json`, `api/page.js`, `scripts/seo-prerender.mjs`, `scripts/seo-check.mjs`, `src/lib/credentialSlip.ts`.
