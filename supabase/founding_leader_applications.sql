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

-- ============================================================
-- Founding tester verification + reward workflow (V3)
-- ============================================================

-- Vineward founding tester verification and reward qualification workflow.
-- Admin verification is performed in Supabase Dashboard (or a future authenticated admin app).
-- Public clients can submit feedback, but cannot set verification or reward fields.

alter table public.founding_leader_applications
  add column if not exists feedback_token uuid not null default gen_random_uuid(),
  add column if not exists testing_started_at timestamptz,
  add column if not exists testing_completed_at timestamptz,
  add column if not exists verified_active_days integer not null default 0,
  add column if not exists participating_disciple_count integer not null default 0,
  add column if not exists usage_verified_at timestamptz,
  add column if not exists disciples_verified_at timestamptz,
  add column if not exists feedback_submitted_at timestamptz,
  add column if not exists reward_eligible boolean not null default false,
  add column if not exists reward_eligible_at timestamptz,
  add column if not exists reward_approved_at timestamptz,
  add column if not exists premium_reward_start timestamptz,
  add column if not exists premium_reward_end timestamptz,
  add column if not exists admin_verification_notes text;

create unique index if not exists founding_leader_applications_feedback_token_uidx
  on public.founding_leader_applications(feedback_token);

create table if not exists public.founding_leader_feedback (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.founding_leader_applications(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  feedback text not null check (length(trim(feedback)) between 20 and 10000),
  self_reported_disciple_count integer not null default 0 check (self_reported_disciple_count >= 0),
  self_reported_testing_days integer not null default 0 check (self_reported_testing_days >= 0),
  applicant_email text not null,
  constraint founding_leader_feedback_one_per_application unique (application_id)
);

alter table public.founding_leader_feedback enable row level security;
-- No direct table policies: public submissions must go through the validating RPC.
revoke all on public.founding_leader_feedback from anon, authenticated;

create or replace function public.submit_founding_leader_feedback(
  p_feedback_token uuid,
  p_email text,
  p_feedback text,
  p_self_reported_disciple_count integer,
  p_self_reported_testing_days integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application_id uuid;
begin
  if length(trim(coalesce(p_feedback, ''))) < 20 or length(trim(p_feedback)) > 10000 then
    raise exception 'Please provide feedback between 20 and 10000 characters.';
  end if;

  select id into v_application_id
  from public.founding_leader_applications
  where feedback_token = p_feedback_token
    and lower(email) = lower(trim(p_email));

  if v_application_id is null then
    raise exception 'The feedback link or email address could not be verified.';
  end if;

  insert into public.founding_leader_feedback (
    application_id, feedback, self_reported_disciple_count,
    self_reported_testing_days, applicant_email
  ) values (
    v_application_id, trim(p_feedback),
    greatest(coalesce(p_self_reported_disciple_count, 0), 0),
    greatest(coalesce(p_self_reported_testing_days, 0), 0),
    lower(trim(p_email))
  );

  update public.founding_leader_applications
  set feedback_submitted_at = now()
  where id = v_application_id;

  return jsonb_build_object('submitted', true);
end;
$$;

revoke all on function public.submit_founding_leader_feedback(uuid, text, text, integer, integer) from public;
grant execute on function public.submit_founding_leader_feedback(uuid, text, text, integer, integer) to anon, authenticated;

-- Reward eligibility is calculated from admin-verified facts, not applicant checkboxes
-- or self-reported feedback values.
create or replace function public.refresh_founding_leader_reward_eligibility()
returns trigger
language plpgsql
as $$
declare
  v_eligible boolean;
begin
  v_eligible :=
    new.status in ('selected', 'invited', 'active', 'completed')
    and new.testing_started_at is not null
    and new.testing_completed_at is not null
    and new.testing_completed_at >= new.testing_started_at + interval '14 days'
    and new.verified_active_days >= 14
    and new.participating_disciple_count >= 3
    and new.usage_verified_at is not null
    and new.disciples_verified_at is not null
    and new.feedback_submitted_at is not null;

  if v_eligible and not coalesce(new.reward_eligible, false) then
    new.reward_eligible_at := now();
  elsif not v_eligible then
    new.reward_eligible_at := null;
  end if;

  new.reward_eligible := v_eligible;

  -- A premium benefit cannot be activated until eligibility has been earned and manually approved.
  if not v_eligible then
    new.reward_approved_at := null;
    new.premium_reward_start := null;
    new.premium_reward_end := null;
  elsif new.reward_approved_at is null then
    new.premium_reward_start := null;
    new.premium_reward_end := null;
  elsif new.premium_reward_start is not null then
    new.premium_reward_end := new.premium_reward_start + interval '12 months';
  else
    new.premium_reward_end := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_refresh_founding_leader_reward_eligibility on public.founding_leader_applications;
create trigger trg_refresh_founding_leader_reward_eligibility
before insert or update on public.founding_leader_applications
for each row execute function public.refresh_founding_leader_reward_eligibility();

comment on column public.founding_leader_applications.testing_completed_at is
  'Admin-verified completion timestamp. Must be at least 14 days after testing_started_at.';
comment on column public.founding_leader_applications.verified_active_days is
  'Admin-verified count of distinct active testing days; must be at least 14.';
comment on column public.founding_leader_applications.participating_disciple_count is
  'Admin-verified count of disciples who actually participated; must be at least 3.';
comment on column public.founding_leader_applications.reward_eligible is
  'Automatically calculated from admin-verified usage, disciple participation, and submitted feedback.';
comment on column public.founding_leader_applications.reward_approved_at is
  'Set manually by an admin after reviewing reward eligibility.';
comment on column public.founding_leader_applications.premium_reward_start is
  'Set by an admin when the 12-month premium benefit is activated; end date is calculated automatically.';\n\n-- Returning tester: private-token + application-email lookup.\n-- Return only the application fields needed to identify the applicant before feedback.
-- The opaque feedback token and matching application email are both required.
create or replace function public.get_founding_leader_for_feedback(
  p_feedback_token uuid,
  p_email text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.founding_leader_applications%rowtype;
begin
  select * into v_application
  from public.founding_leader_applications
  where feedback_token = p_feedback_token
    and lower(email) = lower(trim(p_email));

  if not found then
    raise exception 'The email address could not be matched to this private feedback link.';
  end if;

  return jsonb_build_object(
    'full_name', v_application.full_name,
    'email', v_application.email,
    'platform', v_application.platform,
    'discipleship_system', v_application.discipleship_system,
    'disciple_count', v_application.disciple_count,
    'church_ministry', v_application.church_ministry,
    'city_country', v_application.city_country,
    'leadership_role', v_application.leadership_role,
    'threads_username', v_application.threads_username,
    'created_at', v_application.created_at,
    'status', v_application.status,
    'feedback_submitted_at', v_application.feedback_submitted_at
  );
end;
$$;

revoke all on function public.get_founding_leader_for_feedback(uuid, text) from public;
grant execute on function public.get_founding_leader_for_feedback(uuid, text) to anon, authenticated;


-- Simple returning-tester flow: enter the application email, find that one application,
-- display the submitted details, and submit feedback against the matched application.
-- No private feedback URL, browser token, or email OTP is required for this flow.

-- Retire the token-based RPC signatures from the previous iteration.
drop function if exists public.get_founding_leader_for_feedback(uuid, text);
drop function if exists public.submit_founding_leader_feedback(uuid, text, text, integer, integer);

create or replace function public.get_founding_leader_for_feedback(
  p_email text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.founding_leader_applications%rowtype;
begin
  select * into v_application
  from public.founding_leader_applications
  where lower(email) = lower(trim(p_email))
  limit 1;

  if not found then
    raise exception 'No application was found for that email address. Check the email you used when applying.';
  end if;

  return jsonb_build_object(
    'full_name', v_application.full_name,
    'email', v_application.email,
    'platform', v_application.platform,
    'discipleship_system', v_application.discipleship_system,
    'disciple_count', v_application.disciple_count,
    'church_ministry', v_application.church_ministry,
    'city_country', v_application.city_country,
    'leadership_role', v_application.leadership_role,
    'threads_username', v_application.threads_username,
    'created_at', v_application.created_at,
    'status', v_application.status,
    'feedback_submitted_at', v_application.feedback_submitted_at
  );
end;
$$;

create or replace function public.submit_founding_leader_feedback(
  p_email text,
  p_feedback text,
  p_self_reported_disciple_count integer,
  p_self_reported_testing_days integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application_id uuid;
begin
  if length(trim(coalesce(p_feedback, ''))) < 20 or length(trim(p_feedback)) > 10000 then
    raise exception 'Please provide feedback between 20 and 10000 characters.';
  end if;

  select id into v_application_id
  from public.founding_leader_applications
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_application_id is null then
    raise exception 'No application was found for that email address.';
  end if;

  insert into public.founding_leader_feedback (
    application_id, feedback, self_reported_disciple_count,
    self_reported_testing_days, applicant_email
  ) values (
    v_application_id, trim(p_feedback),
    greatest(coalesce(p_self_reported_disciple_count, 0), 0),
    greatest(coalesce(p_self_reported_testing_days, 0), 0),
    lower(trim(p_email))
  );

  update public.founding_leader_applications
  set feedback_submitted_at = now()
  where id = v_application_id;

  return jsonb_build_object('submitted', true);
end;
$$;

revoke all on function public.get_founding_leader_for_feedback(text) from public;
grant execute on function public.get_founding_leader_for_feedback(text) to anon, authenticated;
revoke all on function public.submit_founding_leader_feedback(text, text, integer, integer) from public;
grant execute on function public.submit_founding_leader_feedback(text, text, integer, integer) to anon, authenticated;
