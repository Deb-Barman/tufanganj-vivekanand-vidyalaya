# V16 — Phone "app mode", social icons, forgot-password requests now visible on the dashboard

## 1. Phone app mode (phones only — desktop and laptop are unchanged)
On every public page **except the landing page (`/`)**, on phone-size screens:
- the website **header and footer are hidden**;
- a round **Back** button appears top-left (goes to the previous page, or Home if the page was opened from a shared link);
- a floating **bottom tab bar** appears: Home · Notices · Admission · Contact · **More**;
- **More** opens a bottom sheet with every page (including Profile Finder), the Student & Staff Login / dashboard button, the light/dark switch and the social icons — so nothing that lived in the header or footer is lost.

"Phone" = the same definition the site already uses (`styles/mobile.css`): up to 768 px wide, or a touch device up to 1024 px.
Nothing outside that media query changes. Login screens and dashboards were already full-screen and are untouched.
Files: `components/site/SiteLayout.tsx`, `MobileTabBar.tsx`, `MobileApp.css`.
To switch the whole feature off, remove `{shell === "shell-app" && <MobileAppChrome />}` and the `shell-app` rules in `MobileApp.css`.

## 2. Footer
- The Profile Finder strip was **removed** from the footer (the "Profile Finder" link in the Help column and the `/find-profile` page stay).
- New **Follow us** row with round social buttons (colour rises on hover, glow, label pops up, mouse pulls the button). **Facebook** and **Instagram** (`instagram.com/tufanganjvivekanandavidyalay`) are live; **YouTube** shows greyed out with "coming soon" until you paste the link into `youtube` in `frontend/src/config/site.ts` — it then becomes a normal link automatically.
- The old text "Facebook" link in the Help column was replaced by the Facebook icon.

## 3. "Forgot password" requests now reach the Super Admin
Why you did not see it: requests were only listed deep inside **Accounts**, and a request for a username that does not exist (a typo, or a full name typed by mistake) was thrown away silently. Now:
- **Dashboard → "Needs your attention"** shows "N forgot-password requests" (tap → Accounts).
- A red **badge with the count** sits on **Accounts** in the menu.
- Requests with a **mistyped username** are kept too, shown as “name” — *no account has this username*, with **Search accounts** and **Dismiss** (the person still sees the same neutral message, so usernames cannot be probed). Limited to 50 open ones and 10 sends per hour per address.

## Database changes (run `python manage.py migrate`)
- `accounts.0007` — `PasswordResetRequest.username`, and `user` may be empty (mistyped usernames)

## Tests
Backend tests: 246 (3 new in `accounts/test_v15.py`); `tsc`, `oxlint`, `vite build` clean.
