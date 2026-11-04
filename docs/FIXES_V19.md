# V19 — year-end promotion, landing/developer/achievements/notices upgrades

## Promote students (Super Admin → Academics → "Promote students")
Three steps: **new session** → **tick who goes up** → **review & confirm**.
* Only chosen students go up. A student left on **Stays** repeats the same class in the new session.
* Class 10 → 11: the stream (Science / Arts) is chosen per student (or for all at once). Class 11 → 12 keeps the stream.
* Class 12 students are **passed out** (alumni): the account, results, attendance and portfolio stay.
* New classes are created automatically; last year's subjects, their teachers and (optionally) the weekly timetable are copied.
* **Nothing is deleted.** Results, attendance, marksheets, homework and timetables stay tied to the old class/session.
  Every class year is kept (`class_enrollments`), so a student can still open an earlier year: a **Class year** drop-down
  appears on Timetable, Homework and Exams for students who have been in more than one class.
* The whole run is one database transaction and can be **undone** (latest run only, while nobody was moved afterwards).
* Backend: `academics/promotion.py`, `academics/enrollment.py`, migrations `0012`, `0013` (back-fills a history row for every
  current student), `academics/test_promotion.py` (15 tests). API: `/api/academics/promotion/{plan,apply,batches}/`, `/api/academics/my-classes/`.
* After the first run: check **Classes & Subjects** (new classes, copied subjects) and roll numbers on the **Students** page.

## Landing page
* Scroll effects (pinned story, pinned gallery, parallax, scroll-driven marquee, progress bar, floating cards) now run **only on a
  desktop with a mouse** (`html[data-fx]`). Phones/tablets — even when they show the wide layout — get normal scrolling.
* Number band and portal section text fixed (labels were hiding the numbers) and enlarged on touch screens.

## Developer page — new premium design (dark stage hero, code window, bento, marquee, link cards).
## Achievements — compact clickable cards, a page per achievement (`/achievements/:id`), compact admin cards.
## Notices — slim skeleton that matches the real notice row.
