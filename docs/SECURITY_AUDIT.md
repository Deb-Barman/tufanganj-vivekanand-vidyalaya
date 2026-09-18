# Security audit — what was actually tested

"100% secure" isn't a real claim any honest engineer makes — no system is
provably unbreakable. What follows is a record of what was specifically
tested against a running instance of this backend, what bugs that testing
found, and what remains untested. Treat gaps here as real gaps, not
modesty.

## Bugs found and fixed during this build

1. **Account lockout was completely non-functional.** The login
   serializer caught `rest_framework_simplejwt.exceptions.AuthenticationFailed`,
   but Simple JWT's `validate()` actually raises
   `rest_framework.exceptions.AuthenticationFailed` — a different class
   from a different module. The `except` clause never matched, so 5 failed
   login attempts never incremented the lockout counter and an account
   could be brute-forced indefinitely. Found by testing 6 consecutive
   failed logins and observing the counter stay at 0 in the database.
   Fixed by importing the correct exception class
   (`accounts/serializers.py`). Re-tested: lockout now triggers on the 5th
   failure, blocks the correct password while locked, and resets cleanly
   after expiry.

2. **A student could delete their own marksheet.** `MarksheetDetailView`
   used `RetrieveDestroyAPIView` with only `IsAuthenticatedActiveUser`,
   which doesn't distinguish "read my own record" from "delete an official
   document." Found on code review, not live testing — fixed before it
   ran, by adding an explicit `perform_destroy` check restricted to staff
   (`academics/views.py`).

3. **No public read endpoint existed for the Faculty directory**, so the
   public homepage's Faculty section had no way to fetch teacher data
   without authentication. Added `PublicTeacherListView` following the
   same `AllowAny` pattern used for notices/articles/events/gallery/forms.

## Verified with real requests against a running instance

- Login issues a working JWT with the correct role claim
- A disabled account (`is_active_account=False`) cannot log in even with
  the correct password
- Account lockout: 5 wrong passwords locks the account for 15 minutes;
  the correct password is still rejected while locked; the lock and
  counter both reset correctly after expiry
- RBAC: a Student gets 403 attempting to create a Notice; an
  unauthenticated request to a protected endpoint gets 401
- Privilege escalation: attempting to create a `SUPER_ADMIN` account
  through `POST /api/auth/admin/users/` is rejected with 400, regardless
  of the caller's role
- HTML/XSS sanitization: `<script>` tags and `onerror` event-handler
  attributes are stripped from Notice/Article title and body fields on
  save; safe tags (`<b>`, `<i>`, `<p>`, lists) are preserved
- Cross-student data isolation (the highest-stakes check in the system):
  a student's `GET /api/academics/attendance/` returns only their own
  record; passing `?student=<other-student-id>` as a query parameter is
  silently ignored for a student caller (the backend queryset overrides it
  entirely rather than trusting it); requesting another student's specific
  attendance record by ID via the detail endpoint returns 403, not the
  data
- File upload validation: a file with a spoofed `image/png` content-type
  header but non-image bytes is rejected — verified this is enforced by
  Pillow's actual image-content validation (`ImageField`), not merely the
  declared MIME type, which is a stronger check than my own
  `validate_image_upload` content-type check alone would provide
- Every public content endpoint (notices, articles, events, gallery,
  forms, teacher directory) returns 200 with no authentication
- The public admission enquiry form (frontend `Admissions.tsx` →
  `POST /api/content/admissions/submit/`) actually submits successfully
  end-to-end with matching field names, and the contact-number rate limit
  genuinely rejects a 4th submission from the same guardian contact number
  within 24 hours with a 429 — tested with 4 real sequential requests, not
  just reviewed

## Verified by code review, not live request testing

- CORS/CSRF configuration reads from environment and defaults to a
  same-origin-only posture — not exercised with an actual cross-origin
  browser request in this session (the sandbox this was built in cannot
  run two persistent networked processes and have them talk to each other
  across separate tool calls — see the note in git history/conversation
  for why)
- The S3 Storage integration (`django-storages` + `boto3` config in
  `settings.py`) has not been tested against a real Supabase Storage
  bucket, since no real Supabase project credentials exist in this
  session — only reviewed for correct configuration shape

## Not tested at all

- Load/stress testing of any kind
- Anything resembling a penetration test (SQL injection attempts, JWT
  tampering/forgery, timing attacks on the login lockout)
- Dependency vulnerability scanning WAS run this session (`pip-audit`,
  `npm audit`) — see the dedicated section above. What's still untested is
  everything else in this list.
- Browser-based testing of the frontend against a live backend (only
  independently: Django via its test client, frontend via a clean
  TypeScript build)

## Dependency audit — run, not just recommended

`pip-audit -r backend/requirements.txt` and `npm audit` (frontend) were
both run in this session: **zero known vulnerabilities found** in either.
This reflects the dependency versions pinned at the time of this build —
re-run both before every deploy, since new CVEs are published continuously
and this result has a shelf life.

## Recommended before treating this as production-ready

- Run `pip-audit` and `npm audit` and address anything they flag
- Actually deploy to a real Render + Vercel + Supabase setup and run
  through this document's deployment checklist against the live URLs,
  not just locally
- Get a second person (or a dedicated security review tool) to attempt
  the "not tested at all" list above
