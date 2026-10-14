# Tufanganj Vivekananda Vidyalaya — website & school portal

Official website and secure student/teacher/admin portal.

- **frontend/** — React 19 + TypeScript + Vite (deploy: Vercel)
- **backend/** — Django 5 + DRF + JWT (deploy: Render), Supabase Postgres/Storage
- **docs/** — architecture, security audit, test report, per-version fix logs (latest: `FIXES_V8.md`)

```bash
# frontend
cd frontend && npm ci && npm run dev      # lint: npm run lint · build: npm run build
# backend
cd backend && pip install -r requirements.txt && python manage.py test
```
Accounts are created only by the school; there is no public sign-up.
