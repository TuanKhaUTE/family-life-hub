-- Credential-bound operations serialize before row locks: a verified old PIN cannot
-- create a session after rotation has revoked the target's sessions.
create function public.record_failed_pin_login(p_member_id uuid,p_expected_pin_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('family-security',0));
 perform 1 from public.auth_credentials where member_id=p_member_id and pin_hash=p_expected_pin_hash for update;
 if not found then return false;end if;
 return public.record_failed_pin_login(p_member_id);
end $$;

create function public.complete_successful_pin_login(p_member_id uuid,p_expected_pin_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('family-security',0));
 perform 1 from public.auth_credentials where member_id=p_member_id and pin_hash=p_expected_pin_hash for update;
 if not found then return false;end if;
 return public.complete_successful_pin_login(p_member_id);
end $$;

create function public.create_verified_auth_session(p_member_id uuid,p_expected_pin_hash text,p_token_hash text,p_expires_at timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('family-security',0));
 perform 1 from public.family_members m join public.auth_credentials c on c.member_id=m.id
 where m.id=p_member_id and m.is_active and c.pin_hash=p_expected_pin_hash
 and (c.locked_until is null or c.locked_until<=clock_timestamp()) for update of m,c;
 if not found then raise exception 'credential verification required' using errcode='28000';end if;
 if p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '7 days 1 minute' then
  raise exception 'invalid session expiry' using errcode='22023';end if;
 insert into public.auth_sessions(member_id,token_hash,expires_at) values(p_member_id,p_token_hash,p_expires_at);
end $$;

create function public.update_own_family_profile(p_actor_member_id uuid,p_session_id uuid,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.family_members%rowtype; name text; avatar_type_value text; avatar_value_value text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('family-security',0));
 select * into m from public.family_members where id=p_actor_member_id and is_active for update;
 if not found or not exists(select 1 from public.auth_sessions where id=p_session_id and member_id=p_actor_member_id and expires_at>clock_timestamp()) then
  raise exception 'active session required' using errcode='28000';end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or not(p_input ?& array['displayName','avatarType','avatarValue'])
 or (p_input-array['displayName','avatarType','avatarValue'])<>'{}'::jsonb or jsonb_typeof(p_input->'displayName')<>'string'
 then raise exception 'invalid profile input' using errcode='22023';end if;
 name=btrim(p_input->>'displayName');avatar_type_value=p_input->>'avatarType';avatar_value_value=p_input->>'avatarValue';
 if name is null or char_length(name) not between 1 and 100 or name ~ '[[:cntrl:]]' then raise exception 'invalid display name' using errcode='22023';end if;
 if not ((p_input->'avatarType'='null'::jsonb and p_input->'avatarValue'='null'::jsonb)
 or (jsonb_typeof(p_input->'avatarType')='string' and jsonb_typeof(p_input->'avatarValue')='string' and
 ((avatar_type_value is not distinct from m.avatar_type and avatar_value_value is not distinct from m.avatar_value)
 or (avatar_type_value='EMOJI' and avatar_value_value=any(array['🌿','🌸','🐱','🐼','🦊','🌻','📚','☀️'])))))
 then raise exception 'invalid avatar choice' using errcode='22023';end if;
 update public.family_members set display_name=name,avatar_type=avatar_type_value,avatar_value=avatar_value_value where id=m.id returning * into m;
 return jsonb_build_object('id',m.id,'displayName',m.display_name,'role',m.role,'avatarType',m.avatar_type,'avatarValue',m.avatar_value);
end $$;

create function public.rotate_family_pin(p_actor_member_id uuid,p_session_id uuid,p_target_member_id uuid,p_expected_pin_hash text,p_new_pin_hash text,p_reset boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare actor_role public.family_members.role%type;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('family-security',0));
 select m.role into actor_role from public.family_members m join public.auth_credentials c on c.member_id=m.id
 where m.id=p_actor_member_id and m.is_active and c.pin_hash=p_expected_pin_hash
 and (c.locked_until is null or c.locked_until<=clock_timestamp()) for update of m,c;
 if not found or not exists(select 1 from public.auth_sessions where id=p_session_id and member_id=p_actor_member_id and expires_at>clock_timestamp()) then
  raise exception 'credential verification required' using errcode='28000';end if;
 if p_reset is null or p_target_member_id is null or (p_reset and (actor_role<>'ADMIN' or p_actor_member_id=p_target_member_id))
 or (not p_reset and p_actor_member_id<>p_target_member_id) then raise exception 'PIN recovery not permitted' using errcode='42501';end if;
 -- Match the existing Argon2id cost settings; parameter ordering is not significant.
 if p_new_pin_hash is null or p_new_pin_hash !~ '^\$argon2id\$v=19\$(m=19456,t=2,p=1|m=19456,p=1,t=2)\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$' then
  raise exception 'invalid encoded credential' using errcode='22023';end if;
 perform 1 from public.family_members m join public.auth_credentials c on c.member_id=m.id where m.id=p_target_member_id and m.is_active for update of m,c;
 if not found then raise exception 'active member not found' using errcode='P0002';end if;
 update public.auth_credentials set pin_hash=p_new_pin_hash,pin_changed_at=clock_timestamp(),failed_attempt_count=0,locked_until=null where member_id=p_target_member_id;
 if p_reset then update public.auth_credentials set failed_attempt_count=0,locked_until=null where member_id=p_actor_member_id;end if;
 delete from public.auth_sessions where member_id=p_target_member_id;
end $$;

revoke all privileges on function public.record_failed_pin_login(uuid,text),public.complete_successful_pin_login(uuid,text),public.create_verified_auth_session(uuid,text,text,timestamptz),public.update_own_family_profile(uuid,uuid,jsonb),public.rotate_family_pin(uuid,uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.record_failed_pin_login(uuid,text),public.complete_successful_pin_login(uuid,text),public.create_verified_auth_session(uuid,text,text,timestamptz),public.update_own_family_profile(uuid,uuid,jsonb),public.rotate_family_pin(uuid,uuid,uuid,text,text,boolean) to service_role;
