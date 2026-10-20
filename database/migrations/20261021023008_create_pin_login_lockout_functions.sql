create function public.record_failed_pin_login(p_member_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_failed_attempt_count integer;
  v_locked_until timestamptz;
  v_is_active boolean;
  v_now timestamptz := clock_timestamp();
begin
  select
    credential.failed_attempt_count,
    credential.locked_until,
    member.is_active
  into
    v_failed_attempt_count,
    v_locked_until,
    v_is_active
  from public.auth_credentials as credential
  join public.family_members as member
    on member.id = credential.member_id
  where credential.member_id = p_member_id
  for update of credential, member;

  if not found or not v_is_active then
    return false;
  end if;

  if v_locked_until is not null and v_locked_until > v_now then
    return true;
  end if;

  if v_locked_until is not null then
    v_failed_attempt_count := 0;
  end if;

  v_failed_attempt_count := v_failed_attempt_count + 1;

  if v_failed_attempt_count >= 5 then
    v_locked_until := v_now + interval '15 minutes';
  else
    v_locked_until := null;
  end if;

  update public.auth_credentials as credential
  set
    failed_attempt_count = v_failed_attempt_count,
    locked_until = v_locked_until
  where credential.member_id = p_member_id;

  return v_locked_until is not null;
end;
$$;

create function public.complete_successful_pin_login(p_member_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_locked_until timestamptz;
  v_is_active boolean;
  v_now timestamptz := clock_timestamp();
begin
  select
    credential.locked_until,
    member.is_active
  into
    v_locked_until,
    v_is_active
  from public.auth_credentials as credential
  join public.family_members as member
    on member.id = credential.member_id
  where credential.member_id = p_member_id
  for update of credential, member;

  if not found or not v_is_active then
    return false;
  end if;

  if v_locked_until is not null and v_locked_until > v_now then
    return false;
  end if;

  update public.auth_credentials as credential
  set
    failed_attempt_count = 0,
    locked_until = null
  where credential.member_id = p_member_id;

  return true;
end;
$$;

revoke all privileges on function public.record_failed_pin_login(uuid)
from public, anon, authenticated;
grant execute on function public.record_failed_pin_login(uuid)
to service_role;

revoke all privileges on function public.complete_successful_pin_login(uuid)
from public, anon, authenticated;
grant execute on function public.complete_successful_pin_login(uuid)
to service_role;
