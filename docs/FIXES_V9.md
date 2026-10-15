# V9 — lamp login bug, one theme toggle, scrolling menu, calmer loading

| Problem (your screenshot) | Cause | Fix |
|---|---|---|
| New lamp login shows a blank page | The effects canvas lost its position rule (its id was renamed in the port), so it sat in normal flow and grew the page to ~36,000px, pushing the lamp far off screen. | `LampLogin3.css`: canvas is absolutely positioned again (`.scene > canvas`). Reproduced and verified in a real headless Chrome. |
| Dashboard menu can't scroll on phones | The desktop rule `align-self: start` made the fixed full-screen sheet only as tall as its content (1142px on an 860px screen). | `DashboardShell.css`: sheet is `100dvh`, `align-self: stretch`, scrolls. |
| Panels appear one by one | Each panel loaded on its own. | Teacher/Student overview shows one full skeleton until every request has finished (or failed), then everything fades in together. Verified: requests ended at 1.0s / 2.7s / 3.3s, content appeared at 3.3s. |
| Gallery: list skeleton, then grid skeleton | The route fallback was always a list. | The fallback now uses the same shape as the page (`ui/skeletonVariant.ts`: grid for Gallery, cards for Notices/Accounts/…); overview has its own hero + tiles skeleton. |
| Admin "Jump to" grid | — | Removed (and from the skeleton). |
| Theme toggles everywhere | — | **One** toggle only: the website header (desktop; inside the menu on phones). Removed from the dashboard sidebar, all three login designs (Koi, Lamp, Neumorphic Lamp), the React 404/500 screen and the static error pages. Pages follow the theme chosen in the header. |

Notes
- `LampLogin.tsx` (the very first lamp) is not used by the app and still has a toggle; delete it if you don't need it.
- Static error pages were regenerated (`public/errors`, `backend/templates/errors`) — redeploy Render to publish the backend copies.
