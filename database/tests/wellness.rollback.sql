begin;
insert into public.family_members(id,display_name,role) values
 ('d4111111-1111-4111-8111-111111111111','Synthetic Wellness Admin','ADMIN'),
 ('d4222222-2222-4222-8222-222222222222','Synthetic Wellness Member','MEMBER'),
 ('d4333333-3333-4333-8333-333333333333','Synthetic Wellness Parent','PARENT'),
 ('d4444444-4444-4444-8444-444444444444','Synthetic Wellness Inactive','MEMBER');
update public.family_members set is_active=false where id='d4444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare
 a uuid:='d4111111-1111-4111-8111-111111111111';
 b uuid:='d4222222-2222-4222-8222-222222222222';
 p uuid:='d4333333-3333-4333-8333-333333333333';
 inactive uuid:='d4444444-4444-4444-8444-444444444444';
 actor uuid; other_actor uuid; entry_id uuid; other_id uuid; workspace jsonb;
 input jsonb:='{"loggedDate":"2026-10-22","weightKg":62.5,"note":"Synthetic note"}';
begin
 foreach actor in array array[a,b] loop
  workspace:=public.wellness_read(actor,'2026-10-22');
  if workspace->'profile'<>'null'::jsonb or workspace->'logs'<>'[]'::jsonb then raise exception 'invented empty data'; end if;
  perform public.wellness_mutate(actor,'profile',null,'{"heightCm":174,"targetWeightKg":64,"activityLevel":"LIGHT"}',false);
  perform public.wellness_mutate(actor,'logs',null,input,false);
  perform public.wellness_mutate(actor,'logs',null,input||'{"loggedDate":"2026-10-20","weightKg":62}',false);
  workspace:=public.wellness_read(actor,'2026-10-22');
  entry_id:=(workspace->'logs'->0->>'id')::uuid;
  if (workspace->'profile'->>'heightCm')::numeric<>174 or (workspace->'logs'->0->>'weightKg')::numeric<>62.5 then raise exception 'read projection wrong'; end if;
  if round((workspace->'logs'->0->>'weightKg')::numeric/power((workspace->'profile'->>'heightCm')::numeric/100,2),1)<>20.6 then raise exception 'BMI inputs wrong'; end if;
  if (workspace->'logs'->0->>'weightKg')::numeric-(workspace->'logs'->1->>'weightKg')::numeric<>0.5 then raise exception 'ordered change inputs wrong'; end if;
  begin perform public.wellness_mutate(actor,'logs',null,input,false); raise exception 'duplicate date accepted'; exception when unique_violation then null; end;
  begin perform public.wellness_mutate(actor,'logs',entry_id,input||'{"loggedDate":"2026-10-20"}',false); raise exception 'edit duplicate date accepted'; exception when unique_violation then null; end;
  begin perform public.wellness_mutate(actor,'profile',null,'{"heightCm":99}',false); raise exception 'height range accepted'; exception when check_violation then null; end;
  begin perform public.wellness_mutate(actor,'profile',null,'{"targetWeightKg":351}',false); raise exception 'target range accepted'; exception when check_violation then null; end;
  begin perform public.wellness_mutate(actor,'profile',null,'{"activityLevel":"GUESSED"}',false); raise exception 'unknown activity accepted'; exception when check_violation then null; end;
  begin perform public.wellness_mutate(actor,'logs',null,input||'{"weightKg":0}',false); raise exception 'weight range accepted'; exception when check_violation then null; end;
  begin perform public.wellness_mutate(actor,'logs',null,input||'{"weightKg":62.555}',false); raise exception 'precision silently rounded'; exception when check_violation then null; end;
  begin perform public.wellness_mutate(actor,'logs',null,input||jsonb_build_object('loggedDate',(now() at time zone 'Asia/Ho_Chi_Minh')::date+1),false); raise exception 'future date accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.wellness_mutate(actor,'logs',null,input||jsonb_build_object('note',repeat('x',1001)),false); raise exception 'long note accepted'; exception when check_violation then null; end;
  perform public.wellness_mutate(actor,'logs',entry_id,input||'{"weightKg":63,"note":null}',false);
  if (public.wellness_read(actor,'2026-10-22')->'logs'->0->>'weightKg')::numeric<>63 then raise exception 'edit failed'; end if;
  other_actor:=case when actor=a then b else a end;
  begin update public.wellness_weight_logs set owner_member_id=other_actor where id=entry_id; raise exception 'owner changed'; exception when insufficient_privilege then null; end;
  begin update public.wellness_profiles set owner_member_id=other_actor where owner_member_id=actor; raise exception 'profile owner changed'; exception when insufficient_privilege then null; end;
 end loop;
 perform public.wellness_mutate(b,'profile',null,'{"heightCm":180,"targetWeightKg":65,"activityLevel":null}',false);
 if (public.wellness_read(a,'2026-10-22')->'profile'->>'heightCm')::numeric<>174
   or (public.wellness_read(b,'2026-10-22')->'profile'->>'heightCm')::numeric<>180 then raise exception 'cross-member profile read'; end if;
 foreach actor in array array[a,b] loop
  other_actor:=case when actor=a then b else a end;
  other_id:=(public.wellness_read(other_actor,'2026-10-22')->'logs'->0->>'id')::uuid;
  if exists(select 1 from jsonb_array_elements(public.wellness_read(actor,'2026-10-22')->'logs') x where x->>'id'=other_id::text) then raise exception 'cross-member read'; end if;
  begin perform public.wellness_mutate(actor,'logs',other_id,input,false); raise exception 'cross-member update'; exception when no_data_found then null; end;
  begin perform public.wellness_mutate(actor,'logs',other_id,null,true); raise exception 'cross-member delete'; exception when no_data_found then null; end;
 end loop;
 foreach actor in array array[p,inactive] loop
  begin perform public.wellness_read(actor,'2026-10-22'); raise exception 'forbidden read'; exception when insufficient_privilege then null; end;
  begin perform public.wellness_mutate(actor,'profile',null,'{}',false); raise exception 'forbidden profile write'; exception when insufficient_privilege then null; end;
  begin perform public.wellness_mutate(actor,'logs',null,input,false); raise exception 'forbidden log write'; exception when insufficient_privilege then null; end;
 end loop;
 begin insert into public.wellness_profiles(owner_member_id) values('d4999999-9999-4999-8999-999999999999'); raise exception 'orphan profile accepted'; exception when insufficient_privilege or foreign_key_violation then null; end;
 -- Profile reset never cascades to historical measurements.
 perform public.wellness_mutate(a,'profile',null,null,true);
 if public.wellness_read(a,'2026-10-22')->'profile'<>'null'::jsonb or jsonb_array_length(public.wellness_read(a,'2026-10-22')->'logs')<>2 then raise exception 'profile reset destroyed history'; end if;
 for entry_id in select id from public.wellness_weight_logs where owner_member_id=a loop perform public.wellness_mutate(a,'logs',entry_id,null,true); end loop;
 if public.wellness_read(a,'2026-10-22')->'logs'<>'[]'::jsonb then raise exception 'delete failed'; end if;
 -- At most one daily entry: 31 rows safely contain every 30-day observation.
 for i in 0..34 loop perform public.wellness_mutate(a,'logs',null,input||jsonb_build_object('loggedDate',date '2026-10-22'-i),false); end loop;
 if jsonb_array_length(public.wellness_read(a,'2026-10-22')->'logs')<>31 then raise exception 'recent bound wrong'; end if;
 if (select count(*) from public.wellness_weight_logs where owner_member_id=a and logged_date between date '2026-09-23' and date '2026-10-22')<>30 then raise exception '30-day inputs incomplete'; end if;
end $$;
reset role;
do $$ declare t text; f record; begin
 foreach t in array array['wellness_profiles','wellness_weight_logs'] loop
  if not(select relrowsecurity from pg_class where oid=('public.'||t)::regclass) or exists(select 1 from pg_policies where schemaname='public' and tablename=t) then raise exception 'unsafe RLS'; end if;
  if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser grants'; end if;
  if not exists(select 1 from pg_constraint where conrelid=('public.'||t)::regclass and contype='f' and confrelid='public.family_members'::regclass and confdeltype='r') then raise exception 'missing restrictive owner FK'; end if;
 end loop;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'wellness_%' loop
  if f.prosecdef or not('search_path=""'=any(f.proconfig)) or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'unsafe RPC'; end if;
 end loop;
end $$;
set constraints all immediate;
rollback;
select count(*) as synthetic_wellness_members_remaining from public.family_members where id in('d4111111-1111-4111-8111-111111111111','d4222222-2222-4222-8222-222222222222','d4333333-3333-4333-8333-333333333333','d4444444-4444-4444-8444-444444444444');
