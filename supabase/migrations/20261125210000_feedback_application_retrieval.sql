-- Return only the application fields needed to identify the applicant before feedback.
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
