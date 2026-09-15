# TVV Portal — Frontend

React + TypeScript (Vite). Deploys to Vercel; talks to the Django backend
over the REST API.

## Local setup

```bash
cd frontend
npm install
cp .env.example .env   # defaults to http://127.0.0.1:8000/api — matches
                        # the backend's local dev setup
npm run dev
```

Runs at `http://localhost:5173`. Make sure the backend (`../backend/`) is
running locally too, and that its `CORS_ALLOWED_ORIGINS`/
`CSRF_TRUSTED_ORIGINS` include `http://localhost:5173` (the `.env.example`
in `backend/` already sets this as the default).

## Structure

```
src/
├── components/     Public-site sections (Hero, Academics, Faculty, ...)
├── pages/          Route-level pages for the public site (HomePage)
├── portal/         Everything behind /portal — login, dashboard, RBAC guard
│   ├── pages/
│   └── components/
├── lib/            API client, auth context, token storage, env config
├── types/          Shared TypeScript types matching backend serializers
└── styles/         Design tokens (CSS variables) ported from the original demo
```

## Auth flow

- `lib/AuthContext.tsx` holds the current user and exposes `login`/`logout`
- `lib/tokenStorage.ts` persists JWTs in `localStorage` (see the TODO note
  in that file about hardening this further with httpOnly cookies later)
- `lib/api.ts` is the single fetch wrapper: attaches the `Authorization`
  header, and automatically retries once with a refreshed access token on
  a 401
- `portal/RequireAuth.tsx` redirects to `/portal` (login) if there's no
  signed-in user

## What's wired vs. not

The **Notices** section (public homepage + portal dashboard) is fully
wired to the real backend — use it as the reference pattern for adding the
next module. Everything else scaffolded in the backend
(`academics/models.py`) does not have a corresponding frontend section yet.
See `../docs/NEXT_STEPS.md`.
