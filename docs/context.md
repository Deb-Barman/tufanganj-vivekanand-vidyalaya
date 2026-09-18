# Tufanganj Vivekananda Vidyalaya — Project Context

## Purpose
Build a production-ready **Official School Website + Secure School Management Portal** for **Tufanganj Vivekananda Vidyalaya (H.S.)**.

The system has two parts:
1. Public school website
2. Private portal for Super Admin, Teachers, and Students

## Core Stack

### Frontend
- React + TypeScript
- HTML + CSS + JavaScript
- Three.js / React Three Fiber only when useful
- Deploy: **Vercel**

### Backend
- **Python + Django + Django REST Framework**
- Deploy: **Render**
- Do NOT add FastAPI or Flask unless a real requirement is identified.

### Data & Auth
- **Supabase PostgreSQL**
- Supabase Auth where appropriate
- Supabase Storage for files/images when appropriate
- Supabase Row Level Security (RLS)

## Architecture

User
→ React/TypeScript (Vercel)
→ HTTPS REST API
→ Django/DRF (Render)
→ Supabase PostgreSQL/Auth/Storage

The backend must enforce authentication and authorization. Never rely on frontend checks for security.

## Roles

### Super Admin (Head Sir)
Highest authority. Can:
- Create, edit, disable, and manage Student/Teacher accounts
- Assign login credentials
- Manage classes, subjects, sessions, attendance, results, and marksheets
- Manage notices, articles, teacher cards, gallery, events, admissions, forms, documents, and school information
- Manage relevant system settings

### Teacher
Can access only teacher-authorized features, such as:
- Profile
- Assigned classes/subjects
- Authorized student information
- Attendance
- Results/marks
- Notices and documents

### Student
Can access only their own authorized information:
- Profile
- Class/subjects
- Results/marksheet
- Attendance
- Notices/documents

## Account Rules
- **No public Sign Up / Registration.**
- Only Super Admin creates Student and Teacher accounts.
- Students and Teachers log in using credentials supplied by the school.
- Never store plaintext passwords.
- Use secure authentication and password handling.

## Suggested Data Areas
students, teachers, profiles, classes, subjects, academic_sessions, attendance, results, marksheets, notices, articles, teacher_profiles, school_information, admissions, school_forms, documents, gallery, events.

Design the final schema only after checking actual requirements. Avoid unnecessary tables.

## Security Requirements
- Backend authorization + role-based access control (RBAC)
- Supabase RLS for protected data
- Least-privilege access
- Secure environment variables
- HTTPS
- Input validation
- Secure CORS configuration
- CSRF protection where applicable
- Protection against SQL injection and XSS
- Rate limiting where appropriate
- Never expose Django secret keys, database passwords, Supabase service-role keys, or other secrets in frontend code
- Student/teacher private data must never be publicly accessible

## Public Website
Likely sections:
Home, About, Head/Principal, Faculty, Academics, Notices, Articles/News, Admissions, School Forms, Gallery, Events, Achievements, Results, Portal/Login, FAQ, Contact.

Use the existing school demo website as a **reference**, not as an assumption for missing requirements. Preserve verified school-specific information and improve the design.

## UI/UX
- Professional school identity
- Mobile-first and responsive
- Fast and accessible
- Clean navigation and dashboards
- Use 3D/animation only when it improves UX
- Performance and usability are more important than visual effects

## Development Rules
1. Do not invent school facts, credentials, users, statistics, or policies.
2. If information is missing, clearly mark it as **TODO / Required Data** instead of guessing.
3. Do not invent APIs, database fields, environment variables, or deployment settings.
4. Keep code modular, maintainable, and production-oriented.
5. Explain important architectural changes before making them.
6. Build module-by-module instead of generating an unnecessarily huge codebase at once.
7. Give exact file paths for code changes.
8. Keep public and private data clearly separated.
9. Validate permissions on the server for every protected operation.
10. Prefer simple, reliable solutions over unnecessary complexity.

## Source of Truth
This file defines the project's current technical direction. If a future request conflicts with it, identify the conflict and explain the safest change before proceeding.

**Project:** Tufanganj Vivekananda Vidyalaya  
**Frontend:** React + TypeScript → Vercel  
**Backend:** Python + Django + DRF → Render  
**Database/Auth:** Supabase  
**Public Registration:** Disabled  
**Primary Admin:** Head Sir / Super Admin
