# SEO guide — Tufanganj Vivekananda Vidyalaya (H.S.)  ·  V22 "search upgrade"

Live site: https://tufanganj-vivekanand-vidyalaya.vercel.app  
Sitemap: `/sitemap.xml` · Robots: `/robots.txt` · AI summary: `/llms.txt`

> **Honest note.** Nobody can promise position #1. Code can remove every technical reason Google could have for not finding, trusting or
> understanding the site, and give every page the exact words people type. For the exact name *"Tufanganj Vivekanand Vidyalaya"* the school's own
> site is the best possible match — but only **after Google has indexed it**, and Google only learns about a new site if you add it in Search
> Console (section 4, about 10 minutes on a phone). Broad searches such as "best school in Tufanganj" take weeks and need real-world signals
> (Google Business Profile, reviews, links).

---

## 1. What the audit found (and fixed in V22)

| # | Finding | Impact | Fix |
|---|---|---|---|
| 1 | `public/sitemap.xml` (an old fixed file) was back in the repo. Vercel serves real files **before** rewrites, so it hid the live `/sitemap.xml` that lists notices and blog posts — and it listed a `noindex` page | Google got a stale, partly wrong sitemap | File deleted; the build also removes any `sitemap.xml` that sneaks in; `seo:check` fails if it returns |
| 2 | Every page carried `hreflang="en-IN"` pointing at **the home page** (copied from `index.html`) | Contradicts each page's own canonical; Google may ignore or mis-cluster pages | Removed (a single-language site needs none), also on in-app navigation |
| 3 | The school seal says **"VIVEKANAND"** and people type *Vivekanand*, but titles/H1/text only said *Vivekananda* | Weaker match for the exact search | Both spellings in home title, descriptions, About, FAQ, footer, structured data, plus the Bengali name |
| 4 | The first-visit intro (loader text "Loading … Press Escape to skip") was in the HTML of every page and shown to crawlers | Junk text for snippets; black screenshot if a crawler snapshots mid-animation | Crawlers (Googlebot, Bingbot, social previews…) skip the intro and the loader markup is removed; `data-nosnippet` added |
| 5 | Article/BlogPosting `author`/`publisher` were bare `@id` references to a block in another script | Google can't read publisher name/logo | Inline publisher with name + logo |
| 6 | No `favicon.ico`; favicon was 64 px (Google wants multiples of 48) | `/favicon.ico` 404; icon may not show beside the result | `favicon.ico`, 48, 96 and 192 px added and linked |
| 7 | No-JavaScript text was one sentence | Thin first-pass HTML | 1–3 real paragraphs per page + links to every main page |
| 8 | Light-theme small text contrast 2.3:1; skeleton `aria-label` on plain `div`s; footer heading order | Accessibility audit failures | Contrast raised, `role="status"` added, footer headings level 2 |
| 9 | `README_LOGO.txt` was published at `/README_LOGO.txt` | Pointless public file | Deleted |

Already correct and kept: one prerendered HTML file per page with its own title/description/canonical/Open Graph, live sitemap with notices/blog/achievements,
real 404s and 301s, `noindex` for portal/profile/API, HSTS and cache headers, lazy-loaded pages.

## 2. What V22 added

**Names and keywords**
- 54 search phrases in `src/seo/keywords.json` in 8 groups (section 3). Each page uses its own subset in `<meta name="keywords">` (Google ignores it, other engines read it); the visible wording does the real work.
- Home title: *Tufanganj Vivekananda Vidyalaya (H.S.) – Tufanganj Vivekanand Vidyalaya Official Website*. All 20 titles/descriptions rewritten around what people search.
- Visible text: hero top line carries the full school name; the home intro, footer, About and FAQ say "also spelt Tufanganj Vivekanand Vidyalaya", the Bengali name and "TVV"; About and Academics explain Class V–X (WBBSE, Madhyamik) and Class XI–XII (WBCHSE).
- New page **`/school-in-tufanganj`** — "Best School in Tufanganj? A Parent's Checklist": an honest six-point guide to comparing schools, then what this school offers. It does **not** claim to be "the best" (section 6).
- FAQ grew from 6 to 17 questions (answers use only facts already published on the site); the page and the structured data share one file.

**Structured data (JSON-LD)**
- `EducationalOrganization` + `School`: name, 11 alternate names (spellings, TVV, Bengali), description, logo, founding year, locality/region/country, area served (Tufanganj, Cooch Behar), keywords, Facebook + Instagram. `WebSite` with alternate names (helps Google's site name).
- Per page: `WebPage` / `AboutPage` / `ContactPage` / `CollectionPage` + `BreadcrumbList`; `FAQPage` on /faq; `MobileApplication` on /app; `Article` / `BlogPosting` for notices and posts.
- **Generated from one place** — `src/seo/routes.json` → `site`. Phone, e-mail, street address, postcode and map pin are added **automatically** the day you fill `site.contact` (section 5). Nothing is invented; `seo:check` fails if contact data appears without being configured.

**Crawling and indexing**
- Typed aliases now 301 to the right page (`/results`, `/notice-board`, `/apply`, `/news`, `/help`, `/best-school-in-tufanganj` …) — 33 permanent redirects in all.
- `llms.txt` — a short, accurate summary for AI assistants and AI search.
- Manifest: language, categories, shortcuts (login, notices, admissions, contact).

## 3. Keyword report (54 phrases)

| Group | Phrases | Used in |
|---|---|---|
| Brand & spellings (12) | Tufanganj Vivekananda Vidyalaya · Tufanganj Vivekanand Vidyalaya · …HS · Vivekananda/Vivekanand Vidyalaya Tufanganj · official website · TVV Tufanganj · TVV School Tufanganj | Titles, H1/top line, intro, About, FAQ, footer, JSON-LD names |
| Bengali (5) | তুফানগঞ্জ বিবেকানন্দ বিদ্যালয় · (উচ্চ মাধ্যমিক) · তুফানগঞ্জ স্কুল · ভর্তি · নোটিশ | Visible on home, About, footer, FAQ; JSON-LD |
| Location (9) | Tufanganj School · School in Tufanganj · Schools in Tufanganj Cooch Behar · Schools near Tufanganj · Tufanganj Education · Cooch Behar school · West Bengal School … | Titles, descriptions, intro, checklist page, area served |
| Level (8) | Higher Secondary School in Tufanganj · **Tufanganj High School** (true: Class IX–X are taught) · Class V to XII school · Science and Arts school · WBCHSE / WBBSE · Class 11 / 12 | Academics, About, FAQ, checklist |
| Admission (5) | School Admission Tufanganj · admission enquiry · Class 11 admission · admission form | Admissions, FAQ, Downloads |
| Updates (8) | Tufanganj School Notice(s) · Results · notice board · events · gallery · teachers · downloads | Notices, Achievements, Events, Gallery, Faculty; every notice page |
| Digital (3) | TVV School App · student portal · contact | App, Contact |
| Guide (4) | Best school in Tufanganj · How to choose a school in Tufanganj · checklist for parents · Schools in Tufanganj list | `/school-in-tufanganj` only |

To add more phrases: append to a group in `keywords.json` — but only phrases that are true about the school. Do not repeat them in hidden text.

## 4. Google Search Console — on your phone (≈10 min)

1. In Chrome open https://search.google.com/search-console → menu ⋮ → tick **Desktop site** → sign in with the school's Google account.
2. **Add property → URL prefix** → `https://tufanganj-vivekanand-vidyalaya.vercel.app` (no slash at the end).
3. Choose **HTML tag**; copy only the text inside `content="…"`.
4. Vercel → your project → **Settings → Environment Variables** → add `GOOGLE_SITE_VERIFICATION` = that text (Production) → **Redeploy**. Back in Search Console tap **Verify**.
5. **Sitemaps** → type `sitemap.xml` → **Submit** (status should become *Success*: ~20 pages plus every notice and post).
6. **URL inspection** → paste each address → **Test live URL** → **Request indexing**: `/`, `/about`, `/admissions`, `/notices`, `/contact`, `/faq`, `/school-in-tufanganj`, `/academics`, `/achievements`, `/faculty`.
7. After 3–7 days open **Pages**. "Discovered / Crawled – currently not indexed" is normal for a brand-new site at first.
8. Optional: Bing Webmaster Tools → *Import from Google Search Console* (Bing also feeds DuckDuckGo, Yahoo, Ecosia).
9. After every deploy, open `/sitemap.xml` and `/robots.txt`, and **View source** of `/about` (title and canonical must say About).

## 5. Remaining manual actions (cannot be done in code)

1. **Search Console + sitemap** (section 4) — the single most important step.
2. **Google Business Profile** (business.google.com): category *School*, exact name, address and phone as on official records, website URL, hours, photos; verify by postcard/phone. This puts the school on Google Maps and in "school near Tufanganj". Honest reviews from parents and alumni are how "best" is legitimately earned.
3. **Confirm with the school office**: phone, e-mail, full postal address, PIN code and the gate's map pin. Then fill `src/seo/routes.json` → `site.contact` (`telephone`, `email`, `streetAddress`, `postalCode`, `latitude`, `longitude`, `mapsUrl`) and the matching fields in `src/config/site.ts`. Redeploy — structured data, footer and Contact page update together. Left empty on purpose: they must not be guessed.
4. **Custom domain** (strongly recommended): `*.vercel.app` is shared with thousands of sites. Buy a domain close to the school's name → Vercel → Domains. Then set `SITE_URL` and `VITE_SITE_URL` to it (same value, no trailing slash) and redeploy; canonicals, sitemap, robots, JSON-LD and share tags switch automatically. Redirect the old address to the new one.
5. **Official listings**: if the school has a Banglarshiksha / UDISE page or district education-office page, ask for a link to the website and add the exact URL to `site.sameAs` in routes.json. No paid or fake links.
6. **Keep Render awake** (free tier sleeps): ping `https://tufanganj-vivekanand-vidyalaya.onrender.com/api/health/` every 10 minutes with a free uptime monitor. While Render sleeps, notice pages fall back to generic tags and the sitemap lists only the fixed pages.
7. **Content**: real original pages beat any technique — year-wise results, admission dates, a real history of the school, captioned photos, regular notices. Every published notice, post and achievement becomes its own indexable page.
8. Re-run https://pagespeed.web.dev on `/` once Google shows field data.

## 6. Why "Best School in Tufanganj" is a question, not a claim

"Best" is an unprovable superlative; Google and parents distrust it and false claims can be penalised. The checklist page targets that search honestly. A school earns "best" through reviews and results, not through its own headline.

## 7. Verification done for this release

`npm run build` (type-check, lint, Vite build, prerender) and `npm run seo:check` — **all checks pass**: 20 pages with unique titles/descriptions, correct canonicals, `og:url` = canonical, valid JSON-LD, no hreflang, keywords present, noindex pages without canonical; `404.html` / `shell.html` noindex; robots.txt allows the site and lists the sitemap; vercel.json valid; no static sitemap; manifest, favicons and `llms.txt` present; no invented contact facts in the School JSON-LD.

Also tested in real Chromium (normal and Googlebot user-agents): canonical, robots and JSON-LD intact after JavaScript runs, one H1 per page, no script errors, intro shown to visitors and not to crawlers; the dynamic notice page returns Article JSON-LD with publisher logo; a missing notice returns a real HTTP 404; `/sitemap.xml` lists the notice; `/results` → 301 `/achievements`.

Lighthouse (mobile emulation, local build, throttled CPU, sandbox without GPU): **SEO 100** on all pages tested, CLS 0, LCP ≈ 1.4 s, Best Practices 96. Performance 85–96 on inner pages; the home page and first visits score lower in the lab because the animated first-visit intro and hero effects run heavy script. Field data (PageSpeed Insights after launch) is what counts. To lighten first visits, lower `revealMs` in `TVVIntro` inside `index.html`.

## 8. Deployment readiness

- Vercel Root Directory = `frontend`, Node ≥ 20.10, build command unchanged (`npm run build`). Optional env vars: `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `SITE_URL` + `VITE_SITE_URL`; `VITE_API_URL` already set.
- Render backend: **no change, no migration** (the noindex header stays).
- Delete in GitHub: `frontend/public/sitemap.xml`, `frontend/public/README_LOGO.txt`.
- Rollback: restore the previous `frontend/vercel.json`, `frontend/index.html`, `frontend/api/_seo.js` and `frontend/scripts/seo-prerender.mjs`.

## 9. Files

New: `src/seo/keywords.json`, `src/seo/faqs.json`, `src/pages/GuidePage.tsx`, `public/favicon.ico`, `public/favicon-48.png`, `public/favicon-96.png`, `public/llms.txt`.  
Changed: `index.html`, `vercel.json`, `api/_seo.js`, `scripts/seo-prerender.mjs`, `scripts/seo-check.mjs`, `public/robots.txt`, `public/manifest.webmanifest`, `src/seo/routes.json`, `src/seo/summaries.json`, `src/seo/schema.ts`, `src/lib/usePageMeta.ts`, `src/lib/routePreload.ts`, `src/routeLoaders.ts`, `src/App.tsx`, `src/config/site.ts`, `src/components/Faq.tsx`, `src/components/Hero.tsx`, `src/components/home/SchoolIntro.tsx`, `src/components/SiteFooter.tsx`, `src/components/loading/Loading.tsx`, `src/pages/AboutPage.tsx`, `src/pages/AcademicsPage.tsx`, `src/pages/AdmissionsPage.tsx`, `src/styles/tokens.css`, `docs/SEO_GUIDE.md`.  
Deleted: `public/sitemap.xml`, `public/README_LOGO.txt`.
