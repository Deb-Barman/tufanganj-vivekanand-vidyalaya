# V6 fixes

## 1. "An unexpected error occurred" on the Admission enquiry and Contact message forms
**Cause (reproduced on a real PostgreSQL):** behind Render the `X-Forwarded-For` header holds several
addresses ("client, proxy"). The forms saved that whole string into an `inet` column; PostgreSQL rejects it,
so every submission returned a 500. SQLite (used in tests) accepts anything, which is why it was never caught.
**Fix:** `backend/config/clientip.py` keeps ONE valid IP (or none). Regression tests added.

## 2. Public header / footer around dashboards
Dashboards (Super Admin, Teacher, Student) are now a separate route group with no site header, footer or
"REACH" dock. The sidebar/drawer got the school logo, a Light/System/Dark switch and "View website".

## 3. Bottom tab bar (Home / Admissions / Messages / Attendance / More)
Phones only (screen width up to 768 px). Hidden on tablets and desktops. It is now opaque (page content no
longer shows through it) and the page keeps room underneath it.

## 4. Dashboard loading
- Overview used 29 database queries per visit; now 18.
- After 6 s of loading, a skeleton says the server is waking up.
- Data requests (GET) retry automatically while the free Render server wakes (network error / 502 / 503 / 504).
- Overview has a "Try again" button; unknown dashboard addresses show a message instead of a blank page.
- The top bar shows the page name ("Attendance") instead of the group name ("Academics").
- The page-in animation can no longer leave a page invisible.

## Keep the free Render server awake (recommended, no code)
Render's free plan sleeps after ~15 minutes without visits. Add a free monitor (UptimeRobot or cron-job.org)
that opens `https://tufanganj-vivekanand-vidyalaya.onrender.com/api/health/` every 5-10 minutes.
