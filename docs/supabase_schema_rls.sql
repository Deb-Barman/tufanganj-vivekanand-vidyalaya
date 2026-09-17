-- =============================================================================
-- TVV Portal — Supabase PostgreSQL schema + Row Level Security
-- =============================================================================
-- This mirrors the Django models exactly (accounts/models.py, notices/models.py,
-- academics/models.py) so Django's ORM is the source of truth for schema
-- changes going forward — this file documents the resulting shape and adds
-- the RLS policies Django's ORM connection does not need (it connects with
-- elevated privileges and enforces authorization in application code), but
-- that matter if anything ever queries Supabase directly (e.g. client-side
-- Supabase Storage/Auth calls, or a future direct-to-Postgres reporting tool).
--
-- IMPORTANT: Django's own DB connection should use a role that BYPASSES RLS
-- (e.g. the default `postgres` / service-role connection), since Django's
-- views are already the authorization layer (see accounts/permissions.py).
-- RLS here is a defense-in-depth backstop for any other access path, and is
-- REQUIRED before any Supabase Storage buckets or Supabase Auth-issued
-- client tokens are ever used to query these tables directly.
--
-- Run Django migrations first (`manage.py migrate`) — they create these
-- tables. This file then layers RLS on top. If you regenerate tables via
-- Django, re-apply this file's `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
-- and policy statements afterwards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: current user's role and id, read from a custom JWT claim.
-- Only relevant if Supabase Auth (not Django's own JWT auth) ever issues the
-- token being used for a direct Postgres connection. Wire this up when/if
-- that integration is added — for the Django-DRF flow in this repo today,
-- these helpers are unused because Django enforces RBAC in Python.
-- ---------------------------------------------------------------------------

create or replace function auth_role() returns text as $$
  select coalesce(current_setting('request.jwt.claims', true)::json->>'role', '')
$$ language sql stable;

create or replace function auth_user_id() returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$ language sql stable;

-- ---------------------------------------------------------------------------
-- users (created by Django migrations as table "users")
-- ---------------------------------------------------------------------------
alter table users enable row level security;

-- A user can always read their own row.
create policy users_select_self on users
  for select
  using (id = auth_user_id());

-- Super Admin can read/write every row.
create policy users_all_super_admin on users
  for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

-- ---------------------------------------------------------------------------
-- notices
-- ---------------------------------------------------------------------------
alter table notices enable row level security;

-- Everyone signed in can read.
create policy notices_select_authenticated on notices
  for select
  using (auth_user_id() is not null);

-- Public/anonymous read is handled by Django's AllowAny endpoint
-- (PublicNoticeListView), which connects with the elevated Django DB role,
-- not a Supabase Auth anon token — so no anon SELECT policy is defined here.
-- If a future feature queries notices directly with a Supabase anon key,
-- add an explicit `using (true)` SELECT policy scoped to that need only.

-- Only Super Admin can write.
create policy notices_write_super_admin on notices
  for insert
  with check (auth_role() = 'SUPER_ADMIN');

create policy notices_update_super_admin on notices
  for update
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

create policy notices_delete_super_admin on notices
  for delete
  using (auth_role() = 'SUPER_ADMIN');

-- ---------------------------------------------------------------------------
-- student_profiles — a student may only ever read their own row; teachers
-- and Super Admin can read/manage everyone's.
-- ---------------------------------------------------------------------------
alter table student_profiles enable row level security;

create policy student_profiles_select_self on student_profiles
  for select
  using (user_id = auth_user_id());

create policy student_profiles_select_staff on student_profiles
  for select
  using (auth_role() in ('SUPER_ADMIN', 'TEACHER'));

create policy student_profiles_write_super_admin on student_profiles
  for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

-- ---------------------------------------------------------------------------
-- attendance — a student sees only their own records; a teacher can mark
-- attendance; Super Admin has full access.
-- ---------------------------------------------------------------------------
alter table attendance enable row level security;

create policy attendance_select_own on attendance
  for select
  using (
    student_id in (select id from student_profiles where user_id = auth_user_id())
  );

create policy attendance_select_staff on attendance
  for select
  using (auth_role() in ('SUPER_ADMIN', 'TEACHER'));

create policy attendance_write_staff on attendance
  for insert
  with check (auth_role() in ('SUPER_ADMIN', 'TEACHER'));

create policy attendance_update_staff on attendance
  for update
  using (auth_role() in ('SUPER_ADMIN', 'TEACHER'))
  with check (auth_role() in ('SUPER_ADMIN', 'TEACHER'));

-- ---------------------------------------------------------------------------
-- results / marksheets — same shape as attendance: student reads own only,
-- staff manage.
-- ---------------------------------------------------------------------------
alter table results enable row level security;

create policy results_select_own on results
  for select
  using (
    student_id in (select id from student_profiles where user_id = auth_user_id())
  );

create policy results_select_staff on results
  for select
  using (auth_role() in ('SUPER_ADMIN', 'TEACHER'));

create policy results_write_staff on results
  for insert
  with check (auth_role() in ('SUPER_ADMIN', 'TEACHER'));

create policy results_update_staff on results
  for update
  using (auth_role() in ('SUPER_ADMIN', 'TEACHER'))
  with check (auth_role() in ('SUPER_ADMIN', 'TEACHER'));

alter table marksheets enable row level security;

create policy marksheets_select_own on marksheets
  for select
  using (
    student_id in (select id from student_profiles where user_id = auth_user_id())
  );

create policy marksheets_select_staff on marksheets
  for select
  using (auth_role() in ('SUPER_ADMIN', 'TEACHER'));

create policy marksheets_write_super_admin on marksheets
  for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

-- ---------------------------------------------------------------------------
-- admissions — enquiries submitted from the public site. Insert is public
-- (no auth required to submit an enquiry); read/manage is Super Admin only.
-- ---------------------------------------------------------------------------
alter table admissions enable row level security;

create policy admissions_insert_public on admissions
  for insert
  with check (true);

create policy admissions_manage_super_admin on admissions
  for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

-- ---------------------------------------------------------------------------
-- Public-read content: articles (published only), gallery, events, school
-- forms — visible to everyone, writable by Super Admin only.
-- ---------------------------------------------------------------------------
alter table articles enable row level security;

create policy articles_select_published on articles
  for select
  using (published = true or auth_role() = 'SUPER_ADMIN');

create policy articles_write_super_admin on articles
  for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

alter table gallery_images enable row level security;

create policy gallery_select_all on gallery_images for select using (true);

create policy gallery_write_super_admin on gallery_images
  for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

alter table events enable row level security;

create policy events_select_all on events for select using (true);

create policy events_write_super_admin on events
  for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

alter table school_forms enable row level security;

create policy school_forms_select_all on school_forms for select using (true);

create policy school_forms_write_super_admin on school_forms
  for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

-- ---------------------------------------------------------------------------
-- classes / subjects / academic_sessions / teacher_profiles — readable by
-- any authenticated user (they're shared reference data), writable by
-- Super Admin only.
-- ---------------------------------------------------------------------------
alter table classes enable row level security;
create policy classes_select_authenticated on classes for select using (auth_user_id() is not null);
create policy classes_write_super_admin on classes for all
  using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

alter table subjects enable row level security;
create policy subjects_select_authenticated on subjects for select using (auth_user_id() is not null);
create policy subjects_write_super_admin on subjects for all
  using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

alter table academic_sessions enable row level security;
create policy sessions_select_authenticated on academic_sessions for select using (auth_user_id() is not null);
create policy sessions_write_super_admin on academic_sessions for all
  using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

alter table teacher_profiles enable row level security;
create policy teacher_profiles_select_authenticated on teacher_profiles for select using (auth_user_id() is not null);
create policy teacher_profiles_self_update on teacher_profiles for update
  using (user_id = auth_user_id()) with check (user_id = auth_user_id());
create policy teacher_profiles_write_super_admin on teacher_profiles for all
  using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');
