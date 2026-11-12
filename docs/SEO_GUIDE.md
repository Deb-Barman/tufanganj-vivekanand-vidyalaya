# SEO guide — Tufanganj Vivekananda Vidyalaya (H.S.)

Live site: https://tufanganj-vivekanand-vidyalaya.vercel.app  
Sitemap: https://tufanganj-vivekanand-vidyalaya.vercel.app/sitemap.xml · Robots: https://tufanganj-vivekanand-vidyalaya.vercel.app/robots.txt

> Honest note: nobody can promise a #1 ranking. What this upgrade does is remove every technical reason Google could have for **not finding or
> not understanding** the site, and give it the right wording for the searches parents make. Being listed at all needs **Search Console
> (section 3, about 10 minutes)**; ranking high for broad searches like "school in Tufanganj" then takes weeks of Google crawling plus
> real-world signals (Google Business Profile, reviews, links from other sites).

## 1. Why the site did not show in Google before
1. **Never submitted.** A new site is invisible until it is added to Google Search Console and its sitemap is submitted.
2. **Every URL looked identical to a crawler.** The server answered every address with the same page, titled the same, with the home page's canonical
   link — so /about, /admissions, /notices… all said "I am the home page". Google's first pass reads that raw HTML before it runs JavaScript.
3. **Unknown URLs returned "200 OK"** (soft 404s) and the old sitemap was a fixed list (no notices, no blog posts).
4. Nothing for Google to read without JavaScript, and the web font blocked first paint.

## 2. What was implemented
**Crawlability and indexing**
- Every public page is now its own pre-built HTML file with its **own title, description, canonical URL, Open Graph + Twitter tags, JSON-LD and a plain-text summary** (`scripts/seo-prerender.mjs`, source: `src/seo/routes.json`).
- **Live sitemap** `/sitemap.xml` (`api/sitemap.js`): all pages **plus every published notice, blog post and achievement** (read from the school's API, 1-hour cache). Drafts are never listed. If the API is asleep the fixed pages are still served.
- **`/notices/<id>`, `/blog/<slug>`, `/achievements/<id>`** (`api/page.js`): the server looks the item up and returns the right title, description, canonical, `Article` / `BlogPosting` JSON-LD and the text itself. A deleted or unknown item returns a **real HTTP 404** (noindex).
- **Real 404s** for unknown URLs (`404.html`, noindex) instead of "200 OK".
- **Real 301 redirects** for the old aliases (/teachers → /faculty, /admission → /admissions, /login → /portal …), `/index.html` → `/`, and `/about/` → `/about` (one URL per page: `trailingSlash: false`).
- `robots.txt`: everything public allowed (including /assets so Google can render the site), `/portal`, `/api/`, `/errors/` blocked, **Sitemap line added**.
- **Private pages kept out:** login, dashboards, 404/500 screens, profile pages (they belong to people, many of them children), the profile finder, and the Django API (`X-Robots-Tag: noindex` header from both Vercel and Render).

**Structured data (Schema.org JSON-LD, validated as JSON and against required fields)**
- `EducationalOrganization` + `School` (name, alternate names, description, logo, founding year 1964, locality/region/country, area served, motto, Facebook + Instagram), `WebSite`, and per page `WebPage` / `AboutPage` / `ContactPage` / `CollectionPage` + `BreadcrumbList`; `Article` for notices and `BlogPosting` for blog posts.
- **Only facts already published on the site.** No street address, phone, e-mail, ratings or reviews are invented — see section 5.

**Snippets and sharing**
- Unique keyword-rich titles (≈55–78 characters) and descriptions (≈110–160) for all 19 pages; `en-IN` language, `og:locale`, a 1200×630 share image (`og-image.jpg`) with `summary_large_image` Twitter cards, descriptive alt text on content images, web manifest and icons (already present, kept).

**Speed (Core Web Vitals)**
- Google Fonts no longer block the first paint (preload + swap), early connection to the API (`preconnect`, needs `VITE_API_URL` which you already set), long-lived caching for `/assets/*` (1 year, immutable) and images (7 days), HSTS and a Permissions-Policy header, all pages already lazy-loaded. Lab check on a phone-size browser: **LCP ≈ 0.26 s, CLS = 0** on the home page (indicative, local, un-throttled — run PageSpeed Insights on the live URL for the real field numbers).

**Content** (visible, nothing hidden)
- New home-page section *"A higher secondary school in Tufanganj, Cooch Behar"* with links to notices, admission enquiry, teachers, results/achievements and campus; keyword-bearing eyebrows on About, Academics, Admissions, Notices, Achievements, Faculty and Contact; the home H1 now names the school for assistive technology.

**Safety net**
- `npm run seo:check` (after `npm run build`) fails the build if a title or description is missing/duplicated, a canonical is wrong, JSON-LD is invalid, a private page is indexable, `vercel.json`/`robots.txt` are wrong, or an internal link is broken.
- Backend: +3 tests (noindex header). Frontend: type-check, lint and build pass.

## 3. Google Search Console — do this once (10 minutes)
1. Open https://search.google.com/search-console and sign in with the school's Google account.
2. **Add property → "URL prefix"** → enter `https://tufanganj-vivekanand-vidyalaya.vercel.app` (no slash after .app).
3. **Verify.** Choose *HTML tag*; copy only the text inside `content="…"`. In **Vercel → your project → Settings → Environment Variables** add
   `GOOGLE_SITE_VERIFICATION` = that text (Production), then **Redeploy**. Back in Search Console press **Verify**.
   (Other option: download the HTML verification file and put it in `frontend/public/`.)
4. **Sitemaps** (left menu) → type `sitemap.xml` → **Submit**. Status should say *Success* with ~20+ pages discovered.
5. **URL inspection** (top bar): paste each address below → **Test live URL** → **Request indexing**:
   `/`, `/about`, `/admissions`, `/academics`, `/notices`, `/contact`, `/faculty`, `/achievements`.
6. Check **Pages** (indexing report) after 3–7 days. For a brand-new site, "Discovered / Crawled – currently not indexed" at first is normal; it clears as Google gains trust. Never use "Request indexing" more than a few times a day.
7. Optional: Bing Webmaster Tools → *Import from Google Search Console*, or add `BING_SITE_VERIFICATION` the same way as step 3.
8. Deploy check: after each deploy open `/sitemap.xml`, `/robots.txt`, view-source of `/about` (title + canonical must say About), and a notice URL.

## 4. Keyword report
| Target keyword | Where it is used (naturally) |
|---|---|
| Tufanganj Vivekananda Vidyalaya | Every page title, description, JSON-LD name, home intro, H1 (accessible name), alt text |
| Tufanganj Vivekananda Vidyalaya HS / (H.S.) | "(H.S.)" in every title; "Tufanganj Vivekananda Vidyalaya HS" and "Tufanganj Vivekanand Vidyalaya" (spelling in the web address) as `alternateName` |
| Tufanganj School / School in Tufanganj | Home title, About title, Admissions title, home intro heading and text, JSON-LD description |
| Vivekananda Vidyalaya | All of the above |
| Higher Secondary School in Tufanganj | Home intro H2 + text, Academics eyebrow, JSON-LD description |
| Schools in Tufanganj Cooch Behar | Home title, descriptions, Contact eyebrow, noscript text |
| School Admission Tufanganj | Admissions title, eyebrow, description |
| Tufanganj School Notice | Notices eyebrow, notices title and description; each notice's own title |
| Tufanganj School Results | "Results & Achievements" page (only results the school itself posts there) |
| West Bengal School / Tufanganj Education | Descriptions, JSON-LD area served, Academics text (WBCHSE) |
| **Not used on purpose:** "Best School in Tufanganj", "Tufanganj High School" | "Best" is an unprovable claim (Google and parents penalise it); the school is a *higher secondary* school, so "High School" would be misleading. Reviews on Google (section 5) earn "best" legitimately. |

## 5. Remaining manual actions (cannot be done in code)
1. **Search Console + sitemap** (section 3) — the single most important step.
2. **Google Business Profile** (https://business.google.com): create/claim the school, category *School* (or *High school*), exact name and address as on official records, the website URL, opening hours, photos. Verify by postcard/phone. This puts the school on Google Maps and the local results for "school near Tufanganj". Ask parents/alumni for honest reviews. Afterwards add the profile's Maps link to `sameAs` in `index.html`.
3. **Confirm with the school office** the phone number, e-mail and full postal address, then fill `phone`, `email` (and the map pin) in `src/config/site.ts`; add `telephone`/`email`/`streetAddress`/`postalCode` to the School JSON-LD in `index.html`. They were left out because they must not be guessed.
4. **Custom domain (strongly recommended).** `*.vercel.app` is shared with thousands of sites and cannot show a brand. Buy a domain (e.g. a `.in` name close to the school's name) → Vercel → Domains → add. Then set `SITE_URL` and `VITE_SITE_URL` (both, e.g. `https://yourdomain.in`) in Vercel and redeploy: canonicals, sitemap, robots, JSON-LD and share tags switch automatically. Add a redirect from the old vercel.app address to the new one, and register the new address in Search Console ("Change of address" is not needed for a brand-new site).
5. **Keep the Render API awake** (free tier sleeps): use the health-check ping already described in `docs/FIXES_V6.md`. A sleeping API makes notice pages fall back to generic tags for the first crawl.
6. **Content**: write real, original pages — a history of the school, results by year, admission dates and procedure, a "Why choose us" in the school's own words, photos with captions. Google ranks useful, specific content; generic text will not rank. Post notices regularly (each one is now an indexable page).
7. **Links**: ask the District/Block education office pages, local news, alumni groups, the school's Facebook/Instagram bios and YouTube channel to link to the website. No paid or fake links.
8. Re-run PageSpeed Insights (https://pagespeed.web.dev) on `/` and `/notices` for real mobile numbers; the intro animation counts toward LCP on a first visit.

## 6. Deployment readiness
- Vercel project **Root Directory = `frontend`**, Node **20.10 or newer** (set automatically by `engines`). Build command unchanged: `npm run build` (now also runs the prerender step).
- Environment variables: `VITE_API_URL` (already set); optional `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `SITE_URL` + `VITE_SITE_URL`.
- The two serverless functions in `frontend/api/` need no configuration; they read `VITE_API_URL` (or `API_URL`) at run time.
- Render backend: redeploy to pick up `config/seo.py` (noindex header). No database change, no migration.
- Rollback: restoring the previous `vercel.json` returns the old single-page behaviour.

## 7. Files
See the list in the chat reply / zip. New: `api/_seo.js`, `api/page.js`, `api/sitemap.js`, `scripts/seo-prerender.mjs`, `scripts/seo-check.mjs`, `src/seo/*`, `public/og-image.jpg`, `src/components/home/SchoolIntro.tsx`, `backend/config/seo.py`, `backend/config/test_seo.py`. Deleted: `public/sitemap.xml`.
