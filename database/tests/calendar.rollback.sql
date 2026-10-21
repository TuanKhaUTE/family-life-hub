begin;
insert into public.family_members(id,display_name,role) values
 ('c3111111-1111-4111-8111-111111111111','Synthetic Calendar Parent','PARENT'),
 ('c3222222-2222-4222-8222-222222222222','Synthetic Calendar Admin','ADMIN'),
 ('c3333333-3333-4333-8333-333333333333','Synthetic Calendar Member','MEMBER'),
 ('c3444444-4444-4444-8444-444444444444','Synthetic Calendar Inactive','MEMBER');
update public.family_members set is_active=false where id='c3444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare
 p constant uuid := 'c3111111-1111-4111-8111-111111111111';
 a constant uuid := 'c3222222-2222-4222-8222-222222222222';
 m constant uuid := 'c3333333-3333-4333-8333-333333333333';
 inactive constant uuid := 'c3444444-4444-4444-8444-444444444444';
 series uuid; once uuid; actor uuid; result jsonb; before_event jsonb; after_event jsonb;
begin
 series:=public.calendar_save_event(m,null,'Synthetic weekly','SCHOOL','2099-05-04 02:30Z','2099-05-04 07:00Z',null,array[1,2,3,4,5],'2099-05-31');
 once:=public.calendar_save_event(p,null,'Synthetic family','FAMILY','2099-05-04 07:30Z','2099-05-04 08:30Z',null,null,null);
 result:=public.calendar_read(p,'2099-04-27','2099-05-03',m);
 if jsonb_array_length(result->'occurrences')<>0 then raise exception 'series generated before anchor'; end if;
 result:=public.calendar_read(p,'2099-06-01','2099-06-07',m);
 if jsonb_array_length(result->'occurrences')<>0 then raise exception 'series generated beyond end date'; end if;
 begin
   update public.calendar_events set owner_member_id=p where id=series;
   raise exception 'owner reassignment accepted';
 exception when insufficient_privilege then null; end;
 foreach actor in array array[p,a,m] loop
   result:=public.calendar_read(actor,'2099-05-04','2099-05-10',m);
   if jsonb_array_length(result->'occurrences')<>5 then raise exception 'weekly expansion/visibility wrong'; end if;
   begin
     perform public.calendar_save_event(actor,case when actor=m then once else series end,'Forged','SCHOOL','2099-05-04 02:30Z','2099-05-04 07:00Z',null,array[1,2,3,4,5],'2099-05-31');
     raise exception 'foreign series edit accepted';
   exception when insufficient_privilege then null; end;
   begin
     perform public.calendar_delete_event(actor,case when actor=m then once else series end);
     raise exception 'foreign delete accepted';
   exception when insufficient_privilege then null; end;
   begin
     perform public.calendar_save_exception(actor,case when actor=m then once else series end,'2099-05-04',true,null,null,null,null);
     raise exception 'foreign exception accepted';
   exception when insufficient_privilege then null; end;
 end loop;
 begin
   perform public.calendar_save_event(inactive,null,'Inactive','OTHER','2099-05-04 02:00Z','2099-05-04 03:00Z',null,null,null);
   raise exception 'inactive actor accepted';
 exception when insufficient_privilege then null; end;
 begin perform public.calendar_read(inactive,'2099-05-04','2099-05-04',null); raise exception 'inactive read accepted'; exception when insufficient_privilege then null; end;
 begin
   perform public.calendar_save_event(m,null,' ','SCHOOL','2099-05-04 02:00Z','2099-05-04 03:00Z',null,null,null);
   raise exception 'blank title accepted';
 exception when check_violation or invalid_parameter_value then null; end;
 begin
   perform public.calendar_save_event(m,null,'Invalid time','SCHOOL','2099-05-04 03:00Z','2099-05-04 02:00Z',null,null,null);
   raise exception 'reversed time accepted';
 exception when check_violation or invalid_parameter_value then null; end;
 begin
   perform public.calendar_save_event(m,null,'Invalid recurrence','SCHOOL','2099-05-04 02:00Z','2099-05-04 03:00Z',null,array[1,1],null);
   raise exception 'duplicate weekdays accepted';
 exception when check_violation or invalid_parameter_value then null; end;
 begin
   perform public.calendar_save_exception(m,series,'2099-05-03',true,null,null,null,null);
   raise exception 'non-occurrence accepted';
 exception when check_violation or invalid_parameter_value then null; end;
 select public.calendar_event_json(e) into before_event from public.calendar_events e where id=series;
 begin
   perform public.calendar_save_exception(m,series,'2099-05-04',true,'Invalid mixed state',null,null,null);
   raise exception 'invalid cancellation accepted';
 exception when check_violation then null; end;
 perform public.calendar_save_exception(m,series,'2099-05-05',true,null,null,null,null);
 perform public.calendar_save_exception(m,series,'2099-05-04',false,'Synthetic moved','2099-05-11 03:00Z','2099-05-11 04:00Z','Synthetic note');
 perform public.calendar_save_exception(m,series,'2099-05-04',false,'Synthetic moved','2099-05-11 03:00Z','2099-05-11 04:00Z','Synthetic note');
 if (select count(*) from public.calendar_occurrence_exceptions where event_id=series)<>2 then raise exception 'exception retry not idempotent'; end if;
 select public.calendar_event_json(e) into after_event from public.calendar_events e where id=series;
 if before_event<>after_event then raise exception 'exception changed series'; end if;
 result:=public.calendar_read(p,'2099-05-04','2099-05-10',m);
 if jsonb_array_length(result->'occurrences')<>4 or not exists(select 1 from jsonb_array_elements(result->'occurrences') x where x->>'date'='2099-05-05' and (x->>'cancelled')::boolean) then raise exception 'cancel/move range wrong'; end if;
 result:=public.calendar_read(a,'2099-05-11','2099-05-11',m);
 if jsonb_array_length(result->'occurrences')<>2 or not exists(select 1 from jsonb_array_elements(result->'occurrences') x where x->>'date'='2099-05-04' and x->>'title'='Synthetic moved' and x->>'note'='Synthetic note') then raise exception 'moved exception missing from destination range'; end if;
 begin
   perform public.calendar_save_event(m,series,'Changed','SCHOOL','2099-05-04 03:30Z','2099-05-04 07:00Z',null,array[1,2,3,4,5],'2099-05-31');
   raise exception 'schedule edit silently invalidated exceptions';
 exception when sqlstate 'P3001' then null; end;
 perform public.calendar_save_event(p,once,'Synthetic edited','FAMILY','2099-05-04 07:30Z','2099-05-04 08:30Z','Synthetic note',null,null);
 if not exists(select 1 from public.calendar_events where id=once and title='Synthetic edited' and updated_at is not null) then raise exception 'own edit failed'; end if;
 update public.family_members set is_active=false where id=m;
 result:=public.calendar_read(p,'2099-05-04','2099-05-10',null);
 if exists(select 1 from jsonb_array_elements(result->'occurrences') x where x->'owner'->>'id'=m::text) then raise exception 'inactive owner visible'; end if;
 if exists(select 1 from jsonb_array_elements(result->'members') x where x->>'id'=m::text) then raise exception 'inactive profile visible'; end if;
 update public.family_members set is_active=true where id=m;
 perform public.calendar_delete_event(m,series);
 if exists(select 1 from public.calendar_occurrence_exceptions where event_id=series) then raise exception 'orphan exception'; end if;
 if not exists(select 1 from public.calendar_events where id=once) then raise exception 'unrelated owner event deleted'; end if;
end;
$$;
reset role;
do $$
declare t text; r text; f record;
begin
 foreach t in array array['calendar_events','calendar_occurrence_exceptions'] loop
   if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS disabled'; end if;
   if exists(select 1 from pg_policies where schemaname='public' and tablename=t) then raise exception 'browser policy exists'; end if;
   foreach r in array array['anon','authenticated'] loop
     if has_table_privilege(r,'public.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser table grant'; end if;
   end loop;
 end loop;
 if not exists(select 1 from pg_constraint where conrelid='public.calendar_events'::regclass and confrelid='public.family_members'::regclass and contype='f') then raise exception 'owner FK absent'; end if;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'calendar_%' loop
   if f.prosecdef or not ('search_path=""'=any(f.proconfig)) then raise exception 'unsafe calendar function'; end if;
   if has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'browser RPC execute grant'; end if;
 end loop;
end;
$$;
set constraints all immediate;
rollback;
select count(*) as synthetic_calendar_members_remaining from public.family_members where id in
 ('c3111111-1111-4111-8111-111111111111','c3222222-2222-4222-8222-222222222222','c3333333-3333-4333-8333-333333333333','c3444444-4444-4444-8444-444444444444');
