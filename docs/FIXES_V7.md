# V7 — premium mobile experience, shaped loading screens, developer credit

## Footer
- The "REACH" dock is gone. In its place: a professional credit card — "Designed & developed by Deb Barman"
  (Python Developer · AI & ML Builder) with links to X, LinkedIn, GitHub (deb-barman166), GitHub (Deb-Barman)
  and Reddit (u/Deb-Barman). The school's Facebook link moved into the Help column.

## Loading screens (all screen sizes)
- Every loading state now copies the layout of the real page (list rows, cards, photo grid, KPI tiles,
  overview panels, whole-dashboard shell) — like YouTube / Facebook — so nothing jumps when data arrives.
- Visible in both themes (the old placeholders were almost invisible).
- KPI tiles show placeholders instead of misleading zeros while Student/Teacher numbers load.

## Phones only (<=768 px wide, or touch devices <=1024 px — covers phones in "Desktop site" mode)
Desktop and laptop layouts are unchanged. Everything lives in `src/styles/mobile.css` (+ small blocks in
`DashboardShell.css` and `DeveloperCredit.css`), all inside one media query.
- Public site: compact app bar, bottom tab bar (Home · Notices · Admission · Contact · Login/Dashboard),
  content-first home hero, "Everything in one place" becomes a 3×3 launcher grid, compact notices, swipeable
  filter chips, 16 px form fields with big tap targets, tidy footer, no breadcrumb bar.
- Dashboards: menu opens as a full-screen sheet of big tiles (grouped), with a close button; bottom tab bar;
  toolbars/search fit the screen; the search icon no longer overlaps the placeholder text.
- Intro logo on first load is about half the previous size on phones.
- Admissions page no longer repeats its intro paragraph twice.
