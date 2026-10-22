begin;
insert into public.family_members(id,display_name,role) values
 ('f4111111-1111-4111-8111-111111111111','Synthetic Fitness Admin','ADMIN'),
 ('f4222222-2222-4222-8222-222222222222','Synthetic Fitness Member','MEMBER'),
 ('f4333333-3333-4333-8333-333333333333','Synthetic Fitness Parent','PARENT'),
 ('f4444444-4444-4444-8444-444444444444','Synthetic Fitness Inactive','MEMBER');
update public.family_members set is_active=false where id='f4444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare a uuid:='f4111111-1111-4111-8111-111111111111';b uuid:='f4222222-2222-4222-8222-222222222222';p uuid:='f4333333-3333-4333-8333-333333333333';inactive uuid:='f4444444-4444-4444-8444-444444444444';actor uuid;pid uuid;did uuid;gid uuid;sid uuid;data jsonb;summary jsonb;config jsonb;foreign_plan uuid;foreign_day uuid;foreign_goal uuid;foreign_session uuid;kind text;foreign_id uuid;
begin
 foreach actor in array array[a,b] loop
  perform public.fitness_mutate(actor,'plans',null,'{"name":"Synthetic plan","note":null,"isActive":true}'::jsonb,false);
  pid:=(public.fitness_read(actor,'2026-10-19')->'plans'->0->>'id')::uuid;
  perform public.fitness_mutate(actor,'days',null,jsonb_build_object('planId',pid,'weekday',1,'title','Synthetic Monday','note',null),false);
  perform public.fitness_mutate(actor,'days',null,jsonb_build_object('planId',pid,'weekday',3,'title','Synthetic Wednesday','note',null),false);
  perform public.fitness_mutate(actor,'days',null,jsonb_build_object('planId',pid,'weekday',5,'title','Synthetic Friday','note',null),false);
  data:=public.fitness_read(actor,'2026-10-19');did:=(data->'days'->0->>'id')::uuid;
  if data->'summary'->'nextWorkout'->>'title'<>'Synthetic Monday' then raise exception 'initial next workout wrong';end if;
  begin perform public.fitness_mutate(actor,'days',null,jsonb_build_object('planId',pid,'weekday',1,'title','Duplicate Monday','note',null),false);raise exception 'duplicate weekday allowed';exception when unique_violation then null;end;
  perform public.fitness_mutate(actor,'goals',null,'{"weeklySessionTarget":3,"isActive":true}'::jsonb,false);
  config:=jsonb_build_object('planDayId',did,'performedAt','2026-10-19','durationMinutes',60,'title','Synthetic completed','note',null);
  perform public.fitness_mutate(actor,'sessions',null,config,false);
  data:=public.fitness_read(actor,'2026-10-19');summary:=data->'summary';sid:=(data->'sessions'->0->>'id')::uuid;
  if summary->>'weekStart'<>'2026-10-19' or summary->>'weekEnd'<>'2026-10-25' or (summary->>'sessionsThisWeek')::integer<>1 or (summary->>'totalMinutes')::integer<>60 or (summary->>'completionPercent')::integer<>33 then raise exception 'weekly summary wrong';end if;
  if summary->'nextWorkout'->>'date'<>'2026-10-21' then raise exception 'completed Monday not skipped';end if;
  perform public.fitness_mutate(actor,'sessions',null,config||'{"planDayId":null,"performedAt":"2026-10-21","durationMinutes":55}'::jsonb,false);
  if (public.fitness_read(actor,'2026-10-21')->'summary'->>'completionPercent')::integer<>67 then raise exception '2/3 rounding wrong';end if;
  perform public.fitness_mutate(actor,'sessions',null,config||'{"planDayId":null,"performedAt":"2026-10-21","durationMinutes":null}'::jsonb,false);
  summary:=public.fitness_read(actor,'2026-10-21')->'summary';
  if (summary->>'totalMinutes')::integer<>115 or (summary->>'completionPercent')::integer<>100 or (summary->>'unrecordedDurationCount')::integer<>1 then raise exception 'unknown duration/progress wrong';end if;
  perform public.fitness_mutate(actor,'sessions',null,config||'{"planDayId":null,"performedAt":"2026-10-18"}'::jsonb,false);
  if (public.fitness_read(actor,'2026-10-21')->'summary'->>'sessionsThisWeek')::integer<>3 then raise exception 'previous Sunday counted';end if;
  if public.fitness_read(actor,'2026-10-25')->'summary'->'nextWorkout'->>'date'<>'2026-10-26' then raise exception 'next week workout missing';end if;
  begin perform public.fitness_mutate(actor,'days',did,null,true);raise exception 'day cascaded workout history';exception when foreign_key_violation then null;end;
  begin perform public.fitness_mutate(actor,'plans',pid,null,true);raise exception 'plan cascaded schedule';exception when foreign_key_violation then null;end;
  begin perform public.fitness_mutate(actor,'goals',null,'{"weeklySessionTarget":0,"isActive":true}'::jsonb,false);raise exception 'zero target accepted';exception when check_violation then null;end;
  begin perform public.fitness_mutate(actor,'goals',null,'{"weeklySessionTarget":22,"isActive":true}'::jsonb,false);raise exception 'unbounded target accepted';exception when check_violation then null;end;
  begin perform public.fitness_mutate(actor,'sessions',null,config||'{"durationMinutes":0}'::jsonb,false);raise exception 'zero duration accepted';exception when check_violation then null;end;
  begin perform public.fitness_mutate(actor,'sessions',null,config||jsonb_build_object('performedAt',(now() at time zone 'Asia/Ho_Chi_Minh')::date+1),false);raise exception 'future completion accepted';exception when invalid_parameter_value then null;end;
  begin update public.fitness_sessions set owner_member_id=case when actor=a then b else a end where id=sid;raise exception 'owner changed';exception when insufficient_privilege then null;end;
  perform public.fitness_mutate(actor,'sessions',sid,config||'{"title":"Synthetic edited","durationMinutes":45}'::jsonb,false);
  if (public.fitness_read(actor,'2026-10-21')->'summary'->>'totalMinutes')::integer<>100 then raise exception 'session edit not reflected';end if;
  perform public.fitness_mutate(actor,'plans',null,'{"name":"Synthetic replacement","note":null,"isActive":true}'::jsonb,false);
  if (select count(*) from public.fitness_plans where owner_member_id=actor and is_active)<>1 then raise exception 'two active plans';end if;
  perform public.fitness_mutate(actor,'plans',pid,'{"name":"Synthetic plan updated","note":null,"isActive":true}'::jsonb,false);
  perform public.fitness_mutate(actor,'goals',null,'{"weeklySessionTarget":4,"isActive":true}'::jsonb,false);
  if (select count(*) from public.fitness_goals where owner_member_id=actor and is_active)<>1 then raise exception 'two active goals';end if;
 end loop;
 data:=public.fitness_read(b,'2026-10-21');foreign_plan:=(data->'plans'->0->>'id')::uuid;foreign_day:=(data->'days'->0->>'id')::uuid;foreign_goal:=(data->'goals'->0->>'id')::uuid;foreign_session:=(data->'sessions'->0->>'id')::uuid;
 if exists(select 1 from jsonb_array_elements(public.fitness_read(a,'2026-10-21')->'plans')x where x->>'id'=foreign_plan::text) then raise exception 'ADMIN read member plan';end if;
 foreach kind in array array['plans','days','goals','sessions'] loop
  foreign_id:=case kind when 'plans' then foreign_plan when 'days' then foreign_day when 'goals' then foreign_goal else foreign_session end;
  begin perform public.fitness_mutate(a,kind,foreign_id,'{}'::jsonb,false);raise exception 'ADMIN edited member';exception when no_data_found then null;end;
  begin perform public.fitness_mutate(a,kind,foreign_id,null,true);raise exception 'ADMIN deleted member';exception when no_data_found then null;end;
 end loop;
 begin perform public.fitness_mutate(a,'days',null,jsonb_build_object('planId',foreign_plan,'weekday',2,'title','Foreign plan','note',null),false);raise exception 'foreign plan FK accepted';exception when foreign_key_violation then null;end;
 begin perform public.fitness_mutate(a,'sessions',null,config||jsonb_build_object('planDayId',foreign_day),false);raise exception 'foreign plan day FK accepted';exception when foreign_key_violation then null;end;
 data:=public.fitness_read(a,'2026-10-21');foreign_plan:=(data->'plans'->0->>'id')::uuid;
 if exists(select 1 from jsonb_array_elements(public.fitness_read(b,'2026-10-21')->'plans')x where x->>'id'=foreign_plan::text) then raise exception 'MEMBER read ADMIN';end if;
 begin perform public.fitness_mutate(b,'plans',foreign_plan,'{}'::jsonb,false);raise exception 'MEMBER edited ADMIN';exception when no_data_found then null;end;
 begin perform public.fitness_mutate(b,'plans',foreign_plan,null,true);raise exception 'MEMBER deleted ADMIN';exception when no_data_found then null;end;
 foreach actor in array array[p,inactive] loop
  begin perform public.fitness_read(actor,'2026-10-21');raise exception 'forbidden read';exception when insufficient_privilege then null;end;
  begin perform public.fitness_mutate(actor,'plans',null,'{}'::jsonb,false);raise exception 'forbidden write';exception when insufficient_privilege then null;end;
 end loop;
 -- Recent-list capping must never truncate the aggregate.
 for i in 1..21 loop perform public.fitness_mutate(a,'sessions',null,config||'{"planDayId":null,"performedAt":"2026-10-21","durationMinutes":1}'::jsonb,false);end loop;
 data:=public.fitness_read(a,'2026-10-21');
 if jsonb_array_length(data->'sessions')<>20 or (data->'summary'->>'sessionsThisWeek')::integer<>24 or (data->'summary'->>'completionPercent')::integer<>100 then raise exception 'bounded list truncated summary';end if;
 -- Explicit dependency-ordered deletion; historical rows never disappear via cascade.
 foreach actor in array array[a,b] loop
  for sid in select id from public.fitness_sessions where owner_member_id=actor loop perform public.fitness_mutate(actor,'sessions',sid,null,true);end loop;
  for did in select id from public.fitness_plan_days where owner_member_id=actor loop perform public.fitness_mutate(actor,'days',did,null,true);end loop;
  for pid in select id from public.fitness_plans where owner_member_id=actor loop perform public.fitness_mutate(actor,'plans',pid,null,true);end loop;
  for gid in select id from public.fitness_goals where owner_member_id=actor loop perform public.fitness_mutate(actor,'goals',gid,null,true);end loop;
  summary:=public.fitness_read(actor,'2026-10-21')->'summary';
  if summary->'weeklyTarget'<>'null'::jsonb or summary->'completionPercent'<>'null'::jsonb or summary->'nextWorkout'<>'null'::jsonb then raise exception 'empty state invented data';end if;
 end loop;
end $$;
reset role;
do $$ declare t text;f record;begin
 foreach t in array array['fitness_plans','fitness_plan_days','fitness_goals','fitness_sessions'] loop
  if not(select relrowsecurity from pg_class where oid=('public.'||t)::regclass) or exists(select 1 from pg_policies where schemaname='public' and tablename=t) then raise exception 'unsafe RLS';end if;
  if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser grants';end if;
 end loop;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'fitness_%' loop
  if f.prosecdef or not('search_path=""'=any(f.proconfig)) or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'unsafe Fitness RPC';end if;
 end loop;
end $$;
set constraints all immediate;
rollback;
select count(*) as synthetic_fitness_members_remaining from public.family_members where id in('f4111111-1111-4111-8111-111111111111','f4222222-2222-4222-8222-222222222222','f4333333-3333-4333-8333-333333333333','f4444444-4444-4444-8444-444444444444');
