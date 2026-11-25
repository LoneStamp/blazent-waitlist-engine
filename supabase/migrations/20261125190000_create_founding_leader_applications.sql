-- Vineward Founding Leaders Program
-- Run this in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.founding_leader_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  platform text not null check (platform in ('Android','iOS')),
  discipleship_system text not null check (discipleship_system in ('G12 Vision','Adapting G12')),
  disciple_count text not null check (disciple_count in ('3–5','6–11','12–15','16–20','More than 20')),
  church_ministry text,
  city_country text,
  leadership_role text,
  threads_username text,
  has_three_disciples boolean not null default false check (has_three_disciples = true),
  commits_14_days boolean not null default false check (commits_14_days = true),
  agrees_feedback boolean not null default false check (agrees_feedback = true),
  privacy_consent boolean not null default false check (privacy_consent = true),
  acquisition_source text,
  acquisition_medium text,
  acquisition_campaign text,
  referrer text,
  status text not null default 'applicant' check (status in ('applicant','selected','invited','active','completed','declined')),
  offer_terms_version text not null default 'founding-2026-v1'
);

-- Safe for projects where the applications table was created before the offer was added.
alter table public.founding_leader_applications
  add column if not exists offer_terms_version text not null default 'founding-2026-v1';

-- Avoid duplicate applications using the same email address.
create unique index if not exists founding_leader_applications_email_lower_uidx
  on public.founding_leader_applications (lower(email));

alter table public.founding_leader_applications enable row level security;

-- Public visitors can submit an application, but cannot read, update, or delete applicant data.
drop policy if exists "Public can submit founding leader applications" on public.founding_leader_applications;
create policy "Public can submit founding leader applications"
  on public.founding_leader_applications
  for insert
  to anon, authenticated
  with check (
    length(trim(full_name)) between 2 and 120
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and platform in ('Android','iOS')
    and has_three_disciples = true
    and commits_14_days = true
    and agrees_feedback = true
    and privacy_consent = true
    and status = 'applicant'
  );

-- No SELECT policy is intentionally created. Review applications from the Supabase dashboard
-- using an authorized project account. Never expose the service_role key in the browser.
