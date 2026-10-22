begin;
set local role service_role;
do $$
declare
 a uuid='f7000000-0000-4000-8000-000000000001';
 b uuid='f7000000-0000-4000-8000-000000000002';
 p uuid='f7000000-0000-4000-8000-000000000003';
 s uuid='f7000000-0000-4000-8000-000000000011';
 t uuid='f7000000-0000-4000-8000-000000000012';
 ps uuid='f7000000-0000-4000-8000-000000000013';
 h text='$argon2id$v=19$m=19456,p=1,t=2$'||repeat('A',22)||'$'||repeat('B',43);
 nh text='$argon2id$v=19$m=19456,p=1,t=2$'||repeat('C',22)||'$'||repeat('D',43);
 v jsonb; i integer;
begin
 insert into public.family_members(id,display_name,role) values(a,'Synthetic Admin','ADMIN'),(b,'Synthetic Member','MEMBER'),(p,'Synthetic Parent','PARENT');
 insert into public.auth_credentials(member_id,pin_hash) values(a,h),(b,h),(p,h);
 insert into public.auth_sessions(id,member_id,token_hash,expires_at) values(s,a,repeat('a',64),clock_timestamp()+interval '1 day'),(t,b,repeat('b',64),clock_timestamp()+interval '1 day'),(ps,p,repeat('c',64),clock_timestamp()+interval '1 day');
 v=public.update_own_family_profile(a,s,'{"displayName":"Synthetic Updated","avatarType":"EMOJI","avatarValue":"🌿"}');
 if v->>'id'<>a::text or v->>'role'<>'ADMIN' or v ? 'pin_hash' or (select count(*) from jsonb_object_keys(v))<>5 then raise exception 'unsafe profile projection';end if;
 begin perform public.update_own_family_profile(b,s,'{"displayName":"Unauthorized","avatarType":null,"avatarValue":null}');raise exception 'foreign session accepted';exception when invalid_authorization_specification then null;end;
 begin perform public.update_own_family_profile(a,s,'{"displayName":"Bad","role":"MEMBER","avatarType":null,"avatarValue":null}');raise exception 'role input accepted';exception when invalid_parameter_value then null;end;
 begin perform public.update_own_family_profile(a,s,'{"displayName":"Bad","avatarType":"IMAGE","avatarValue":"https://invalid.example/avatar"}');raise exception 'arbitrary avatar accepted';exception when invalid_parameter_value then null;end;
 begin perform public.rotate_family_pin(p,ps,b,h,nh,true);raise exception 'parent recovery accepted';exception when insufficient_privilege then null;end;
 begin perform public.rotate_family_pin(b,t,a,h,nh,true);raise exception 'member recovery accepted';exception when insufficient_privilege then null;end;
 begin perform public.rotate_family_pin(a,s,b,h,nh,false);raise exception 'foreign own change accepted';exception when insufficient_privilege then null;end;
 begin perform public.rotate_family_pin(a,s,b,h,'123456',true);raise exception 'plaintext accepted';exception when invalid_parameter_value then null;end;
 if not exists(select 1 from public.auth_sessions where id=t) then raise exception 'failed mutation revoked sessions';end if;
 for i in 1..5 loop perform public.record_failed_pin_login(b,h);end loop;
 if not exists(select 1 from public.auth_credentials where member_id=b and failed_attempt_count=5 and locked_until>clock_timestamp()+interval '14 minutes') then raise exception 'lockout not enforced';end if;
 if public.complete_successful_pin_login(b,h) then raise exception 'locked success accepted';end if;
 begin perform public.create_verified_auth_session(b,h,repeat('d',64),clock_timestamp()+interval '1 day');raise exception 'locked session accepted';exception when invalid_authorization_specification then null;end;
 perform public.rotate_family_pin(a,s,b,h,nh,true);
 if exists(select 1 from public.auth_sessions where member_id=b) or not exists(select 1 from public.auth_sessions where id=s) then raise exception 'incorrect recovery revocation scope';end if;
 if not exists(select 1 from public.auth_credentials where member_id=b and pin_hash=nh and failed_attempt_count=0 and locked_until is null) then raise exception 'recovery lockout not cleared';end if;
 if public.complete_successful_pin_login(b,h) then raise exception 'old credential completed login';end if;
 perform public.record_failed_pin_login(b,h);
 if exists(select 1 from public.auth_credentials where member_id=b and failed_attempt_count<>0) then raise exception 'stale credential mutated lockout';end if;
 begin perform public.create_verified_auth_session(b,h,repeat('d',64),clock_timestamp()+interval '1 day');raise exception 'old credential created session';exception when invalid_authorization_specification then null;end;
 perform public.create_verified_auth_session(b,nh,repeat('d',64),clock_timestamp()+interval '1 day');
 select id into t from public.auth_sessions where member_id=b;
 perform public.rotate_family_pin(b,t,b,nh,h,false);
 if exists(select 1 from public.auth_sessions where member_id=b) then raise exception 'own change did not revoke current session';end if;
 begin perform public.rotate_family_pin(b,t,b,h,nh,false);raise exception 'revoked session reused';exception when invalid_authorization_specification then null;end;
 update public.auth_sessions set expires_at=clock_timestamp()-interval '1 second',created_at=clock_timestamp()-interval '2 days' where id=ps;
 begin perform public.update_own_family_profile(p,ps,'{"displayName":"Bad","avatarType":null,"avatarValue":null}');raise exception 'expired session accepted';exception when invalid_authorization_specification then null;end;
 update public.family_members set is_active=false where id=b;
 begin perform public.rotate_family_pin(a,s,b,h,nh,true);raise exception 'inactive target accepted';exception when no_data_found then null;end;
 if not exists(select 1 from public.auth_credentials where member_id=b and pin_hash=h) then raise exception 'failed operation not atomic';end if;
end $$;
reset role;
do $$ declare f regprocedure;begin
 foreach f in array array['public.record_failed_pin_login(uuid,text)'::regprocedure,'public.complete_successful_pin_login(uuid,text)'::regprocedure,'public.create_verified_auth_session(uuid,text,text,timestamptz)'::regprocedure,'public.update_own_family_profile(uuid,uuid,jsonb)'::regprocedure,'public.rotate_family_pin(uuid,uuid,uuid,text,text,boolean)'::regprocedure] loop
 if has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('authenticated',f,'EXECUTE') or not has_function_privilege('service_role',f,'EXECUTE') then raise exception 'unsafe RPC grant';end if;
 if exists(select 1 from pg_proc where oid=f and (prosecdef or not('search_path=""'=any(proconfig)))) then raise exception 'unsafe RPC execution context';end if;
 end loop;
 if exists(select 1 from pg_class where oid in('public.auth_credentials'::regclass,'public.auth_sessions'::regclass,'public.family_members'::regclass) and not relrowsecurity) then raise exception 'RLS missing';end if;
end $$;
rollback;
select count(*) as synthetic_members_remaining from public.family_members where id in('f7000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000002','f7000000-0000-4000-8000-000000000003');
