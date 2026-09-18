# TVV Portal — Frontend

React + TypeScript (Vite). Deploys to Vercel. Talks only to the Django
backend — no direct Supabase calls anywhere in this codebase.

## Local setup

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL to your backend's URL
npm run dev
```

Runs at `http://localhost:5173`. Make sure the backend is running and its
`FRONTEND_URL`/`CORS_ALLOWED_ORIGINS` include `http://localhost:5173`.

## Structure

```
src/
├── components/     Public-site sections (Hero, Academics, Faculty, ...)
├── pages/          Route-level pages for the public site (HomePage, BlogPage)
├── portal/
│   ├── pages/      LoginPage, ChangePasswordPage, DashboardShell, OverviewPage
│   ├── modules/    One file per dashboard module
│   └── components/ RoleBadge
├── lib/            API client (JWT + auto-refresh + multipart upload), auth context
├── types/          TypeScript types matching Django's DRF serializers exactly
└── styles/         Design tokens (CSS variables)
```

## Auth flow

- `lib/api.ts` — the one fetch wrapper: attaches `Authorization: Bearer`,
  retries once with a refreshed access token on a 401, supports both JSON
  and multipart (file upload) bodies
- `lib/AuthContext.tsx` — wraps login/logout/change-password, holds the
  current user
- `portal/RequireAuth.tsx` — redirects to `/portal` if not signed in, to
  `/portal/change-password` if the backend says `must_change_password`,
  treats a disabled account as logged out

## Where authorization actually happens

**Not in this frontend.** Every module calls the Django API; Django's
queryset scoping and permission classes decide what comes back or
whether a write succeeds. Hiding a button for a non-admin role is UI
convenience only — the same request from a modified client still hits the
real backend check. See `backend/README.md` and
`../docs/SECURITY_AUDIT.md`.

## What's wired vs. not

See the root `README.md`.
