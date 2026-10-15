# V10 — skeletons fixed everywhere, menu scroll verified for every role

## Skeletons: "first a different skeleton, then the real one"
Cause: every navigation first showed a *placeholder* skeleton while the page's code downloaded (one fixed shape for
all pages), then the page rendered and showed *its own, different* skeleton while its data loaded. It happened on every
page, not only Gallery.

Fix (at the root, not a per-page patch):
- **Pages are downloaded before they are needed** (`lib/routePreload.ts`): the page for the current URL loads in
  parallel with React and the first render waits for it (max 2.5 s, hidden behind the intro); every other public/dashboard
  page is fetched quietly when idle; and the page behind a link starts loading the moment a finger/cursor touches it.
- **Preloaded pages render immediately** (`App.tsx`, `routeLoaders.ts`): no Suspense flash at all, so the only skeleton
  a visitor sees is the page's own.
- **Pages with two loading phases** (Attendance, Results, Homework, Timetable, Attendance/Result records) now show their
  title + toolbar + list skeleton from the very first moment (`ui/PageLoading.tsx`) instead of a bare list.
- **When code is still downloading** (very slow network) the fallback now has the exact shape of that page and role
  (`ui/skeletonVariant.ts`), and the "checking login" dashboard skeleton follows the page you opened
  (`ShellSkeleton`) instead of always looking like the overview.

Verified in a real browser against the real backend, clicking every page as Super Admin (18), Teacher (13) and
Student (12), and every public page: **0 extra placeholder skeletons**. Deep links and the slow-download worst case show a
skeleton of the same shape as the page's own.

## Dashboard menu scroll (phones) — Teacher, Student and Super Admin
It is one shared menu, fixed in V9 (`DashboardShell.css`). Re-tested with real touch swipes for all three roles at
360×640, 412×860, 600×900 and 768×1000: the menu scrolls to the end and "Log out" is reachable; the page behind does
not move.
