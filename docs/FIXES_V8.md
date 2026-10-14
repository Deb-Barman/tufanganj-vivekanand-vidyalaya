# V8 — screenshot fixes, new login, developer page, gallery

## Fixed (from your screenshots)
| Problem | Cause | Fix |
|---|---|---|
| FAQ answer opens but everything disappears | The scroll-reveal added a CSS class `in`; React rewrote `className` when the item opened and dropped it, so the item went back to `opacity: 0`. | Reveal state now lives in a `data-in` attribute React never touches (`lib/useReveal.ts`, `styles/tokens.css`). Fixes every `data-reveal` element whose classes change. Also added `aria-controls`/region roles and stronger answer text colour. |
| Faculty skeleton is rows, content is cards | `SkList` was reused. | New `SkTeachers` matches the card grid. Long teacher bios fold behind "Read more". |
| Student dashboard tiles/panels stuck on skeletons; failed loads looked like "No homework" | Errors were swallowed into empty lists; requests had no timeout. | `portal/ui/useLoad.ts`: failed panels show "Could not load — Try again"; tiles show "—". GET requests time out after 25 s (still retried 3×). |
| Theme circle collided with the gold rail (lamp login) / sat on the very top edge (error pages) | Fixed `top: 14px` overlapped a 16 px rail; no top padding. | Moved clear of the rail and the status bar. Static error pages regenerated. |
| Mobile bottom tab bar | — | Removed from the public site (the header has Login/Portal + menu). Dashboard bar is unchanged. |
| Developer credit card in footer | — | Removed. Footer now has a **Developer** link and "Designed & developed by Deb Barman →" which open `/developer`. |
| "See the real contact" | Footer had no address block. | Footer shows address, hours, phone/email (when filled in `config/site.ts`) and a "Contact the school office" button. |

## New
- **Neumorphic lamp login** (`portal/login/LampLogin3.*`), ported from `lamp-login-neumorphic.html`. The "Create account" tab was removed on purpose: accounts are created only by the school. Existing Koi and Lamp logins are untouched.
- **Random login**: `LoginExperience` picks one of the 3 designs and never repeats the previous one (remembered in `localStorage`, falls back to plain random if storage is blocked).
- **/developer** page (`config/developer.ts` holds the links).
- **/gallery** public page with keyboard/swipe lightbox, fed by Dashboard ▸ Gallery (the old `/gallery → /campus` redirect is gone).
- **SEO / sharing**: Open Graph + Twitter tags and `School` structured data in `index.html`; preview image is the school emblem; sitemap lists the new pages.
- **Security headers** (`vercel.json`): HSTS, Permissions-Policy, COOP. A Content-Security-Policy is still a follow-up (inline theme script + Google Fonts need a careful policy).

## Needs YOUR input (not invented)
- `SITE.phone` / `SITE.email` in `config/site.ts` are empty, so the footer/Contact page cannot show them yet.
- The teacher bio text shown on the Faculty page is data typed in the portal (one profile contains pasted prompt text) — edit it in Dashboard ▸ Faculty/Accounts.
- "30+ teachers" (TrustBar) / "Thirty teachers" (Faculty section) are still unverified school facts.
