create function public.bootstrap_family_member(
  p_display_name text,
  p_role public.family_member_role,
  p_avatar_type text,
  p_avatar_value text,
  p_pin_hash text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_member_id uuid;
begin
  insert into public.family_members as member (
    display_name,
    role,
    avatar_type,
    avatar_value
  ) values (
    p_display_name,
    p_role,
    p_avatar_type,
    p_avatar_value
  )
  returning member.id into v_member_id;

  insert into public.auth_credentials (
    member_id,
    pin_hash
  ) values (
    v_member_id,
    p_pin_hash
  );

  return v_member_id;
end;
$$;

revoke all privileges on function public.bootstrap_family_member(
  text,
  public.family_member_role,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.bootstrap_family_member(
  text,
  public.family_member_role,
  text,
  text,
  text
) to service_role;
