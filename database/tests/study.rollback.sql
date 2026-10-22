begin;
insert into public.family_members(id,display_name,role) values
 ('d4111111-1111-4111-8111-111111111111','Synthetic Study Admin','ADMIN'),
 ('d4222222-2222-4222-8222-222222222222','Synthetic Study Member','MEMBER'),
 ('d4333333-3333-4333-8333-333333333333','Synthetic Study Parent','PARENT'),
 ('d4444444-4444-4444-8444-444444444444','Synthetic Study Inactive','MEMBER');
update public.family_members set is_active=false where id='d4444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare a uuid:='d4111111-1111-4111-8111-111111111111';b uuid:='d4222222-2222-4222-8222-222222222222';p uuid:='d4333333-3333-4333-8333-333333333333';inactive uuid:='d4444444-4444-4444-8444-444444444444';
 actor uuid; sid uuid;cid uuid;gid uuid;session_id uuid;data jsonb;sem jsonb;goal jsonb;studied date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 sem:=jsonb_build_object('name','Synthetic semester','startDate','2026-01-01','endDate','2027-12-31','isActive',true);
 foreach actor in array array[a,b] loop
  perform public.study_mutate(actor,'semesters',null,sem,false);
  data:=public.study_read(actor,studied);sid:=(data->'semesters'->0->>'id')::uuid;
  perform public.study_mutate(actor,'courses',null,jsonb_build_object('name','Synthetic course','semesterId',sid,'code',null),false);
  data:=public.study_read(actor,studied);cid:=(data->'courses'->0->>'id')::uuid;
  perform public.study_mutate(actor,'sessions',null,jsonb_build_object('courseId',cid,'studiedAt',studied,'durationMinutes',90,'note','Synthetic note'),false);
  perform public.study_mutate(actor,'sessions',null,jsonb_build_object('courseId',null,'studiedAt',studied,'durationMinutes',30,'note',null),false);
  goal:=jsonb_build_object('courseId',cid,'title','Synthetic weekly goal','targetMinutes',300,'targetDate',studied,'status','ACTIVE');
  perform public.study_mutate(actor,'goals',null,goal,false);
  data:=public.study_read(actor,studied);gid:=(data->'goals'->0->>'id')::uuid;
  if (data->'summary'->>'totalMinutes')::integer<>120 or (data->'summary'->>'sessionCount')::integer<>2 or (data->'summary'->'goals'->0->>'minutes')::integer<>90 then raise exception 'weekly summary or course goal wrong'; end if;
  if jsonb_array_length(data->'summary'->'courses')<>2 then raise exception 'course breakdown missing'; end if;
  perform public.study_mutate(actor,'sessions',null,jsonb_build_object('courseId',null,'studiedAt',(data->'summary'->>'weekStart')::date-1,'durationMinutes',120,'note',null),false);
  if (public.study_read(actor,studied)->'summary'->>'totalMinutes')::integer<>120 then raise exception 'previous week counted';end if;
  perform public.study_mutate(actor,'semesters',null,sem||'{"name":"Synthetic second semester"}'::jsonb,false);
  if (select count(*) from public.study_semesters where owner_member_id=actor and is_active)<>1 then raise exception 'active semester not exclusive';end if;
  perform public.study_mutate(actor,'semesters',sid,sem,false);
  perform public.study_mutate(actor,'courses',cid,jsonb_build_object('name','Synthetic updated course','semesterId',sid,'code','TEST'),false);
  if (data->'summary'->>'weekStart')::date>studied or extract(isodow from (data->'summary'->>'weekStart')::date)<>1 then raise exception 'week start wrong'; end if;
  perform public.study_mutate(actor,'goals',gid,goal||'{"status":"COMPLETED"}'::jsonb,false);
  if jsonb_array_length(public.study_read(actor,studied)->'summary'->'goals')<>0 then raise exception 'completed goal remained active'; end if;
  begin perform public.study_mutate(actor,'semesters',sid,null,true);raise exception 'semester cascaded private records';exception when foreign_key_violation then null;end;
  begin perform public.study_mutate(actor,'courses',cid,null,true);raise exception 'course cascaded history';exception when foreign_key_violation then null;end;
  begin perform public.study_mutate(actor,'sessions',null,jsonb_build_object('studiedAt',studied,'durationMinutes',0),false);raise exception 'zero session accepted';exception when check_violation then null;end;
  begin perform public.study_mutate(actor,'sessions',null,jsonb_build_object('studiedAt',studied+1,'durationMinutes',30),false);raise exception 'future session accepted';exception when invalid_parameter_value then null;end;
 end loop;
 data:=public.study_read(b,studied);sid:=(data->'semesters'->0->>'id')::uuid;cid:=(data->'courses'->0->>'id')::uuid;gid:=(data->'goals'->0->>'id')::uuid;session_id:=(data->'sessions'->0->>'id')::uuid;
 if exists(select 1 from jsonb_array_elements(public.study_read(a,studied)->'courses')x where x->>'id'=cid::text) then raise exception 'ADMIN read other owner';end if;
 begin perform public.study_mutate(a,'semesters',sid,sem,false);raise exception 'ADMIN edited member';exception when no_data_found then null;end;
 begin perform public.study_mutate(a,'courses',cid,null,true);raise exception 'ADMIN deleted member course';exception when no_data_found then null;end;
 begin perform public.study_mutate(a,'goals',gid,null,true);raise exception 'ADMIN deleted member goal';exception when no_data_found then null;end;
 begin perform public.study_mutate(a,'sessions',session_id,null,true);raise exception 'ADMIN deleted member session';exception when no_data_found then null;end;
 begin perform public.study_mutate(a,'courses',null,jsonb_build_object('semesterId',sid,'name','Foreign semester'),false);raise exception 'foreign semester accepted';exception when foreign_key_violation then null;end;
 begin perform public.study_mutate(a,'sessions',null,jsonb_build_object('courseId',cid,'studiedAt',studied,'durationMinutes',60),false);raise exception 'foreign course accepted';exception when foreign_key_violation then null;end;
 begin perform public.study_mutate(a,'goals',null,goal||jsonb_build_object('courseId',cid),false);raise exception 'foreign goal course accepted';exception when foreign_key_violation then null;end;
 data:=public.study_read(a,studied);sid:=(data->'semesters'->0->>'id')::uuid;
 if exists(select 1 from jsonb_array_elements(public.study_read(b,studied)->'semesters')x where x->>'id'=sid::text) then raise exception 'MEMBER read ADMIN data';end if;
 begin perform public.study_mutate(b,'semesters',sid,sem,false);raise exception 'MEMBER edited ADMIN data';exception when no_data_found then null;end;
 begin perform public.study_mutate(b,'semesters',sid,null,true);raise exception 'MEMBER deleted ADMIN data';exception when no_data_found then null;end;
 foreach actor in array array[p,inactive] loop
  begin perform public.study_read(actor,studied);raise exception 'forbidden Study read';exception when insufficient_privilege then null;end;
  begin perform public.study_mutate(actor,'semesters',null,sem,false);raise exception 'forbidden Study write';exception when insufficient_privilege then null;end;
 end loop;
 -- Delete in explicit dependency order: no hidden cascade loss.
 foreach actor in array array[a,b] loop
  data:=public.study_read(actor,studied);
  for session_id in select (x->>'id')::uuid from jsonb_array_elements(data->'sessions')x loop perform public.study_mutate(actor,'sessions',session_id,null,true);end loop;
  for gid in select (x->>'id')::uuid from jsonb_array_elements(data->'goals')x loop perform public.study_mutate(actor,'goals',gid,null,true);end loop;
  for cid in select (x->>'id')::uuid from jsonb_array_elements(data->'courses')x loop perform public.study_mutate(actor,'courses',cid,null,true);end loop;
  for sid in select (x->>'id')::uuid from jsonb_array_elements(data->'semesters')x loop perform public.study_mutate(actor,'semesters',sid,null,true);end loop;
  if jsonb_array_length(public.study_read(actor,studied)->'semesters')<>0 then raise exception 'delete failed';end if;
 end loop;
 for i in 1..51 loop perform public.study_mutate(a,'sessions',null,jsonb_build_object('studiedAt',studied,'durationMinutes',1),false);end loop;
 data:=public.study_read(a,studied);
 if jsonb_array_length(data->'sessions')<>50 or (data->'summary'->>'sessionCount')::integer<>51 or (data->'summary'->>'totalMinutes')::integer<>51 then raise exception 'recent limit truncated weekly aggregate';end if;
end $$;
reset role;
do $$ declare t text;f record;begin
 foreach t in array array['study_semesters','study_courses','study_goals','study_sessions'] loop
  if not(select relrowsecurity from pg_class where oid=('public.'||t)::regclass) or exists(select 1 from pg_policies where schemaname='public' and tablename=t) then raise exception 'unsafe RLS';end if;
  if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser grants';end if;
 end loop;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'study_%' loop
  if f.prosecdef or not('search_path=""'=any(f.proconfig)) or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'unsafe Study RPC';end if;
 end loop;
end $$;
set constraints all immediate;
rollback;
select count(*) as synthetic_study_members_remaining from public.family_members where id in('d4111111-1111-4111-8111-111111111111','d4222222-2222-4222-8222-222222222222','d4333333-3333-4333-8333-333333333333','d4444444-4444-4444-8444-444444444444');
