-- Profile avatars are intentionally visible on the family profile selector.
-- Storage writes remain backend/service-role-only; this migration adds no
-- browser write policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-avatars',
  'family-avatars',
  true,
  5242880,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists family_avatars_public_read on storage.objects;
create policy family_avatars_public_read
on storage.objects
for select
to public
using (bucket_id = 'family-avatars');

revoke insert, update, delete on table storage.objects from anon, authenticated;

create or replace function public.update_own_family_profile(
  p_actor_member_id uuid,
  p_session_id uuid,
  p_input jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.family_members%rowtype;
  name text;
  avatar_type_value text;
  avatar_value_value text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('family-security', 0)
  );
  select * into m
  from public.family_members
  where id = p_actor_member_id and is_active
  for update;

  if not found or not exists (
    select 1
    from public.auth_sessions
    where id = p_session_id
      and member_id = p_actor_member_id
      and expires_at > clock_timestamp()
  ) then
    raise exception 'active session required' using errcode = '28000';
  end if;

  if p_input is null
    or jsonb_typeof(p_input) <> 'object'
    or not (p_input ?& array['displayName', 'avatarType', 'avatarValue'])
    or (p_input - array['displayName', 'avatarType', 'avatarValue']) <> '{}'::jsonb
    or jsonb_typeof(p_input->'displayName') <> 'string'
  then
    raise exception 'invalid profile input' using errcode = '22023';
  end if;

  name = btrim(p_input->>'displayName');
  avatar_type_value = p_input->>'avatarType';
  avatar_value_value = p_input->>'avatarValue';
  if name is null
    or char_length(name) not between 1 and 100
    or name ~ '[[:cntrl:]]'
  then
    raise exception 'invalid display name' using errcode = '22023';
  end if;

  if not (
    (p_input->'avatarType' = 'null'::jsonb and p_input->'avatarValue' = 'null'::jsonb)
    or (
      jsonb_typeof(p_input->'avatarType') = 'string'
      and jsonb_typeof(p_input->'avatarValue') = 'string'
      and (
        (avatar_type_value is not distinct from m.avatar_type
          and avatar_value_value is not distinct from m.avatar_value)
        or (
          avatar_type_value = 'EMOJI'
          and avatar_value_value = any(
            array['🌿', '🌸', '🐱', '🐼', '🦊', '🌻', '📚', '☀️']
          )
        )
        or (
          avatar_type_value = 'IMAGE'
          and avatar_value_value ~ (
            '^/api/profile/avatar/' || m.id::text || '\?v=[0-9]{1,20}$'
          )
        )
      )
    )
  ) then
    raise exception 'invalid avatar choice' using errcode = '22023';
  end if;

  update public.family_members
  set display_name = name,
      avatar_type = avatar_type_value,
      avatar_value = avatar_value_value
  where id = m.id
  returning * into m;

  return jsonb_build_object(
    'id', m.id,
    'displayName', m.display_name,
    'role', m.role,
    'avatarType', m.avatar_type,
    'avatarValue', m.avatar_value
  );
end
$$;

revoke all privileges on function public.update_own_family_profile(uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.update_own_family_profile(uuid, uuid, jsonb)
to service_role;
