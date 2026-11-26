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
