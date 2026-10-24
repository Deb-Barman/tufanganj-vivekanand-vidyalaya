# V18 — student portfolio, compact results, GitHub-style attendance, landing page, simple footer

## Student profile = portfolio (`/profile/student/<username>`)
* **Skills with levels**, **project cards** (name, description, tags, GitHub/details link), **achievement cards**
  (award, competition, certificate, activity — with year), **"currently learning"**.
* **Results** (class → every semester → every subject) and **Attendance** (12-month calendar like GitHub, streaks,
  homework habit) come from the school's records and appear **only if the student switches them on**.
  Results can be shown as *percentages only* or *every subject & mark*.
* **Who can see what**: a switch for every section under My profile. A switched-off section is removed **by the
  server** (it is not in the API response), not just hidden in the browser.
* Portfolio strength meter, share button, "Save as PDF" (print layout), section tabs, count-up stats.
* Backend: `accounts/portfolio.py`, migration `0008_portfolio_fields`, `accounts/test_portfolio.py` (+ updated profile API).
* Private data (phone, e-mail, guardian, roll number) is still never in the public response — covered by tests.

## My results (student dashboard)
One compact table per class (rows = subjects, columns = semesters) with class tabs, instead of one tall card per exam.
Shared component: `components/portfolio/ResultsExplorer.tsx`.

## Landing page
Scroll progress bar · hero with word-by-word headline, light that follows the pointer, parallax and emblem tilt ·
scroll-driven marquee · pinned 4-chapter story · pinned horizontal gallery (swipe row on phones) · count-up numbers ·
floating portal preview · magnetic buttons. Reduced-motion users get a calm static page.

## Footer
"Follow us" is just a small label with the three round icons under it, left-aligned (no boxes).

## Also
My profile skeleton matches the new sections. Notification bell + desktop gravity pop-up from V17 are unchanged.
