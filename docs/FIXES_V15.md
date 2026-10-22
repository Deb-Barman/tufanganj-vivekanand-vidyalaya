# V15 — Profile Finder, forgot-password queue, event/notice pop-ups, attendance math, nicer picture editor

## A note on passwords
Nobody can **view** a password — not the Super Admin, not the developer. Passwords are stored only as one-way "fingerprints"
(hashes). Making them viewable would mean keeping readable passwords, which would expose every student and teacher if the
database or the Super Admin account were ever compromised. So the school office **sets a new password** instead:
Accounts → *Set password* (type one or press Generate), then **Send on WhatsApp**, **Copy** or **Print slip**.

## What changed
1. **Profile Finder** (footer + `/find-profile`): type a username → the public profile of that teacher/student. Exact username only; only *published* profiles are found; no partial matching (so the people list cannot be harvested).
2. **Forgot password?** on the Student/Teacher sign-in page: sends a request to the school office (same answer for real and made-up usernames). The Super Admin sees them in **Accounts → Forgot-password requests**, with *Set new password* / *Dismiss*. Setting a password closes the request.
3. **Accounts**: after creating an account or setting a password you can **Send on WhatsApp**, **Copy** or **Print slip** (a clean one-card page with username, password and sign-in address).
4. **Events** and **Notices** (student + teacher + admin): tap a card → full pop-up (date and "in 3 days", audience, full text with clickable links). Events have **Add to calendar** (.ics for Google/Apple/Outlook calendar) and **Copy details**; notices have **Copy text**.
5. **Attendance %** on the student dashboard: now **days present ÷ the session's working days** (6 of 200 → **3%**), with the old figure kept as a note: "6 of 200 days · 86% of the 7 held so far". The ring/colour still judge "held so far" so early in the year nobody looks red.
6. **Picture editor** redesigned: stage with a ring around the frame, "Drag to move" hint, rule-of-thirds guide while moving, − / + zoom buttons with a styled slider and zoom level, live **Preview** at the sizes people will really see, reset button, keyboard support.
7. **Sign-in reliability**
   - Token refresh now has its **own** rate bucket (it shared the sign-in bucket, so a class signing in together could break everyone's session); everyday limits are higher because a whole school shares one public address.
   - A failed refresh caused by a server hiccup / weak mobile signal **no longer signs the person out**; only a real "session over" answer does.
   - **Lockout is smarter**: 5 wrong passwords block *that username from that address* for 15 minutes — a stranger guessing a classmate's username can no longer lock the real owner out. 30 wrong passwords from anywhere still lock the whole account (the Super Admin can unlock). The "too many attempts" message is the same for real and made-up usernames.

## Database changes (run `python manage.py migrate`)
- `accounts.0006` — `LoginFailure` (wrong-password counters per username + address), `PasswordResetRequest`

## Tests
243 backend tests (13 new in `accounts/test_v15.py`); `tsc`, `oxlint` and `vite build` are clean. One older test that expected a
stranger to be able to lock the Super Admin out was updated to the new behaviour.
