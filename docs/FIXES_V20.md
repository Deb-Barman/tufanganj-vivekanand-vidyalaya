# V20 — scroll experience, login gap, skeletons

## 1. Landing-page scroll effects now work on phones AND desktops
**Cause.** V19 switched the effects on only for "wide window + mouse" (`min-width: 900px` + `hover: hover` + `pointer: fine`).
A phone — in normal mode or in Chrome's "Desktop site" mode — failed that test, so the pinned story, the sideways
gallery and the parallax never ran: the chapters just stacked as plain text.

**Now.** `html[data-fx]` is set on every device unless the visitor turned on *Reduce motion*; `html[data-touch]` marks touch
screens and shortens every distance (`--amp: .62`) so phones get gentler, battery-friendly motion.

### New scroll engine (`components/home/scroll.ts`)
- ONE shared loop for all sections (was one listener + `getBoundingClientRect()` per section, per scroll event).
- Geometry is measured only when the layout changes (ResizeObserver / resize / fonts) — never while scrolling.
- Progress is **damped** (it glides to the real value), so wheel steps and touch jitter look like one floating motion.
- Off-screen sections cost nothing; the loop stops when nothing moves.
- Adds `--v` (scroll speed) for the marquee, and a `"page"` kind for the top progress line.

### Sections
- **Story** — no more on/off chapter switching. Every chapter is scrubbed by the scroll: label, headline and paragraph drift at
  three different speeds, fade in/out (never two texts at once), and the big number follows. Chapters share one grid cell, so
  the box is always as tall as the tallest chapter. Soft colour clouds are plain radial gradients (no blur filter) — cheap on phones.
- **Gallery** — pinned on every device. The card nearest the screen centre lifts and straightens (`--k`). Height is now pure CSS
  (`100svh + --dist`), so the phone address bar showing/hiding no longer makes the page jump.
- **Marquee** — scroll-linked sliding + gentle self-drift + lean (skew) with scroll speed.
- **Progress line** — smoothed, shown on every device.
- **Portal preview** — 3D floating cards only with a mouse and a wide window; everywhere else the three cards stack and drift
  sideways (they used to overlap on narrow/touch screens).

## 2. Login page gap (blank space under "Sign in")
**Cause.** `home.css` had a global class `.st` (the landing-page numbers band, with big `padding-block`). The login's status line
also uses `.st`, so once the landing page's CSS was loaded the status line became 92–137 px tall.
**Fix.** Landing-page classes renamed `.st*` → `.hstats*` (`Stats.tsx`, `home.css`). The empty status line now takes no space.
Also: the "Forgot password?" pill no longer covers the "Tap anywhere and the koi will swim to you" hint (`has-fp`).

## 3. Skeletons that did not match the real content (Events, Downloads)
**Cause.** `.sk-card` is a column; `.sk-row` only said `display:flex`, so the picture and lines stacked and collapsed
(you saw only a centred square).
**Fix.** `.sk-row` now sets `flex-direction: row`, and a new `SkRowCards` skeleton reuses the real `.row-card`, `.date-badge`
and `.row-body` classes — same padding, badge size and text rows on desktop and phone (measured: 118/109 px vs 119/108 px).
Downloads shows the two button placeholders; Events shows date badge, title, two lines, date + pill. The tab counts show `(…)` while loading.

## Files
Changed: `frontend/src/components/home/{scroll.ts, home.css, Story.tsx, HorizontalShowcase.tsx, Marquee.tsx, ScrollProgressBar.tsx, Stats.tsx}`,
`frontend/src/components/loading/{Loading.tsx, loading.css}`, `frontend/src/pages/{EventsPage.tsx, DownloadsPage.tsx}`,
`frontend/src/portal/login/{KoiLogin.tsx, KoiLogin.css}`. New: `docs/FIXES_V20.md`. Delete: nothing.

## Checked
`tsc -b` 0 errors · `oxlint` 0 warnings · `vite build` OK · browser-tested at 480 px (phone), 980 px (phone "Desktop site"),
1280 px (desktop) and with *Reduce motion*: no horizontal overflow, no console errors, chapters stack when motion is reduced.
