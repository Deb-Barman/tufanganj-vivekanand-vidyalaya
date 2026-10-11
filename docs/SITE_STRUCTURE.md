# Website structure (v4)

## Public pages (each has its own URL, title, description and breadcrumb)
| URL | What it is | Data |
|---|---|---|
| `/` | Home: hero, highlights, "Explore" cards, latest 3 notices, admissions call-to-action | API |
| `/about` | Story, seal & quote, school at a glance, values | static (only facts already on the site) |
| `/academics` | Science & Arts streams | static |
| `/faculty` | Teacher directory (`/teacher`, `/teachers`, `/staff` redirect here) | API — teachers edit their own profile |
| `/achievements` | Awards by year with category filter | API — added by the Super Admin; friendly empty state until then |
| `/campus` | Facilities (`/gallery`, `/facilities` redirect here) | static |
| `/notices`, `/notices/<id>` | Notice board with search + a shareable page per notice | API |
| `/blog`, `/blog/<slug>` | Articles (Bengali titles supported) | API |
| `/events` | Upcoming / past events | API |
| `/downloads` | Forms and documents | API |
| `/faq` | Parent FAQ | static |
| `/admissions` | Enquiry form | API |
| `/contact` | Address, hours, Facebook, message form → Dashboard ▸ Messages | API |
| `/privacy`, `/terms` | Plain-language legal pages (please have the school review) | static |

Also: friendly aliases (`/contact-us`, `/admission`, `/login`, …), a full-screen 404 for anything else, `sitemap.xml`, `robots.txt`.

## Loading — four levels, each used where it fits
1. **Logo intro** — only when the website first loads in a browser session (never between pages). `?intro=replay` shows it again.
2. **Top progress bar** — thin gold bar on every page change and while a page's code downloads.
3. **Skeleton screens** (YouTube / Facebook style shimmer) — for pages, cards, lists, articles and the dashboard while UI or data loads.
4. **Simple spinner** — buttons ("Sending…") and tiny areas.
Every page is lazy-loaded, so the first visit downloads far less (main bundle 402 KB → ~300 KB).

## Dashboard
* **Student:** overview with attendance ring, today's timetable (current period highlighted), homework to tick off, exams, attendance calendar, subject performance, notices. Pages: Timetable, Homework, Exams, Attendance, Results, Marksheets.
* **Teacher:** overview with today's periods, attendance still to mark, homework progress. Pages: Timetable (own periods), Homework (set + see who finished), Exams (schedule), Attendance, Results, Students.
* **Super Admin:** everything above plus Timetable editor, Messages inbox, Achievements manager, Admissions, Classes & Subjects, Accounts.

## Where to change facts
`frontend/src/config/site.ts` — school name, address, hours, Facebook, **phone and email (empty until confirmed; they appear automatically once filled in)**, site URL for the sitemap.
