begin;
insert into public.family_members(id,display_name,role) values
 ('c4111111-1111-4111-8111-111111111111','Synthetic Chore Parent','PARENT'),
 ('c4222222-2222-4222-8222-222222222222','Synthetic Chore Admin','ADMIN'),
 ('c4333333-3333-4333-8333-333333333333','Synthetic Chore Member','MEMBER'),
 ('c4444444-4444-4444-8444-444444444444','Synthetic Chore Inactive','MEMBER');
update public.family_members set is_active=false where id='c4444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare
 p constant uuid:='c4111111-1111-4111-8111-111111111111'; a constant uuid:='c4222222-2222-4222-8222-222222222222'; m constant uuid:='c4333333-3333-4333-8333-333333333333'; inactive constant uuid:='c4444444-4444-4444-8444-444444444444';
 config jsonb; weekly jsonb; sid uuid; wid uuid; result jsonb; actor uuid; completed timestamptz; nid uuid; read_time constant timestamptz:='2099-05-01T00:00:00Z'; today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 config:=jsonb_build_object('requestId','c4555555-5555-4555-8555-555555555555','title','Synthetic dishes','category','DISHES','scheduledDate',today,'scheduledTime',null,'assignedMemberId',m,'weeklyAssignments','[]'::jsonb,'recurrenceUntil',null,'note',null);
 sid:=public.chore_save(p,null,config);
 if public.chore_save(p,null,config)<>sid or (select count(*) from public.chore_schedules where request_key='c4555555-5555-4555-8555-555555555555')<>1 then raise exception 'create retry duplicated'; end if;
 if (select count(*) from public.notifications where related_resource_id=sid and recipient_member_id=m and type='CHORE_ASSIGNMENT')<>1 then raise exception 'assignment notification wrong'; end if;
 select id into nid from public.notifications where related_resource_id=sid and recipient_member_id=m;
 update public.notifications set read_at=read_time where id=nid;
 foreach actor in array array[p,a,m] loop
   result:=public.chore_read(actor,today,today,null);
   if not exists(select 1 from jsonb_array_elements(result->'chores') x where x->'schedule'->>'id'=sid::text and x->>'status'='PENDING') then raise exception 'family visibility wrong'; end if;
 end loop;
 foreach actor in array array[a,m] loop
   begin perform public.chore_save(actor,null,config); raise exception 'non-parent create'; exception when insufficient_privilege then null; end;
   begin perform public.chore_save(actor,sid,config); raise exception 'non-parent edit'; exception when insufficient_privilege then null; end;
   begin perform public.chore_cancel_schedule(actor,sid); raise exception 'non-parent cancel'; exception when insufficient_privilege then null; end;
   begin perform public.chore_set_occurrence(actor,sid,today,'CANCEL'); raise exception 'non-parent occurrence cancel'; exception when insufficient_privilege then null; end;
 end loop;
 begin perform public.chore_set_occurrence(a,sid,today,'COMPLETE'); raise exception 'wrong assignee completion'; exception when insufficient_privilege then null; end;
 begin perform public.chore_set_occurrence(p,sid,today,'COMPLETE'); raise exception 'parent completion bypass'; exception when insufficient_privilege then null; end;
 perform public.chore_set_occurrence(m,sid,today,'COMPLETE');
 select completed_at into completed from public.chore_occurrences where schedule_id=sid and occurrence_date=today;
 perform public.chore_set_occurrence(m,sid,today,'COMPLETE');
 if completed is null or not exists(select 1 from public.chore_occurrences where schedule_id=sid and occurrence_date=today and status='COMPLETED' and completed_at=completed and completed_by_member_id=m and assigned_member_id=m) then raise exception 'completion retry changed metadata'; end if;
 if (select count(*) from public.chore_occurrences where schedule_id=sid)<>1 then raise exception 'duplicate completion'; end if;
 begin perform public.chore_set_occurrence(p,sid,today,'CANCEL'); raise exception 'completed work cancelled'; exception when sqlstate 'P4001' then null; end;
 perform public.chore_save(p,sid,config||jsonb_build_object('assignedMemberId',a,'title','Synthetic reassigned'));
 if not exists(select 1 from public.notifications where id=nid and read_at=read_time and message like '%không còn giao cho bạn%') then raise exception 'old assignment notice stale/read_at lost'; end if;
 if (select count(*) from public.notifications where related_resource_id=sid and recipient_member_id=a)<>1 then raise exception 'new recipient notification missing'; end if;
 perform public.chore_save(p,sid,config||jsonb_build_object('assignedMemberId',m,'title','Synthetic edited'));
 if not exists(select 1 from public.notifications where id=nid and read_at=read_time and message like '%Synthetic edited%') then raise exception 'notification identity/read_at lost'; end if;
 if not exists(select 1 from public.chore_occurrences where schedule_id=sid and assigned_member_id=m and completed_at=completed) then raise exception 'completed assignment changed'; end if;
 begin perform public.chore_save(p,null,config||jsonb_build_object('assignedMemberId',inactive,'requestId','c4666666-6666-4666-8666-666666666666')); raise exception 'inactive assignee accepted'; exception when invalid_parameter_value or check_violation then null; end;
 begin perform public.chore_read(inactive,today,today,null); raise exception 'inactive actor read'; exception when insufficient_privilege then null; end;
 begin perform public.chore_save(p,null,config||jsonb_build_object('assignedMemberId','c4999999-9999-4999-8999-999999999999','requestId','c4999999-9999-4999-8999-999999999999')); raise exception 'missing member accepted'; exception when invalid_parameter_value or foreign_key_violation then null; end;
 begin perform public.chore_save(p,null,config||jsonb_build_object('scheduledTime','24:00','requestId','c4999999-9999-4999-8999-999999999999')); raise exception 'invalid time accepted'; exception when check_violation then null; end;
 begin perform public.chore_read(p,today,today+31,null); raise exception 'unbounded range accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.chore_save(p,null,config||jsonb_build_object('title',' ','requestId','c4888888-8888-4888-8888-888888888888')); raise exception 'blank title accepted'; exception when check_violation or invalid_parameter_value then null; end;
 weekly:=config||jsonb_build_object('requestId','c4777777-7777-4777-8777-777777777777','scheduledDate','2099-05-04','assignedMemberId',null,'recurrenceUntil','2099-05-31','weeklyAssignments',jsonb_build_array(jsonb_build_object('weekday',1,'memberId',m),jsonb_build_object('weekday',2,'memberId',a)));
 wid:=public.chore_save(p,null,weekly);
 result:=public.chore_read(p,'2099-05-04','2099-05-10',null);
 if (select count(*) from jsonb_array_elements(result->'chores') x where x->'schedule'->>'id'=wid::text)<>2 then raise exception 'weekly expansion wrong'; end if;
 if not exists(select 1 from jsonb_array_elements(result->'chores') x where x->'schedule'->>'id'=wid::text and x->>'date'='2099-05-04' and x->'assignee'->>'id'=m::text) then raise exception 'weekday assignment wrong'; end if;
 begin perform public.chore_set_occurrence(m,wid,'2099-05-04','COMPLETE'); raise exception 'future completion accepted'; exception when sqlstate 'P4001' then null; end;
 perform public.chore_set_occurrence(p,wid,'2099-05-04','CANCEL');
 result:=public.chore_read(m,'2099-05-04','2099-05-12',null);
 if not exists(select 1 from jsonb_array_elements(result->'chores') x where x->'schedule'->>'id'=wid::text and x->>'date'='2099-05-04' and x->>'status'='CANCELLED')
 or not exists(select 1 from jsonb_array_elements(result->'chores') x where x->'schedule'->>'id'=wid::text and x->>'date'='2099-05-11' and x->>'status'='PENDING') then raise exception 'cancellation affected other weeks'; end if;
 perform public.chore_cancel_schedule(p,wid);perform public.chore_cancel_schedule(p,wid);
 if not exists(select 1 from public.chore_schedules where id=wid and cancelled) then raise exception 'schedule not cancelled'; end if;
 if exists(select 1 from public.notifications where related_resource_id=wid and title not like '%đã hủy%') then raise exception 'cancel notification stale'; end if;
 if exists(select 1 from public.notifications where related_resource_id in(sid,wid) group by recipient_member_id,type,related_resource_id having count(*)>1) then raise exception 'duplicate notifications'; end if;
end;
$$;
reset role;
do $$ declare t text; f record; begin
 foreach t in array array['chore_schedules','chore_weekly_assignments','chore_occurrences'] loop
  if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS absent'; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename=t) then raise exception 'browser policy exists'; end if;
  if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser grant'; end if;
 end loop;
 if not exists(select 1 from pg_constraint where conrelid='public.chore_weekly_assignments'::regclass and confrelid='public.family_members'::regclass and contype='f') then raise exception 'assignee FK missing'; end if;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'chore_%' loop
  if f.prosecdef or not ('search_path=""'=any(f.proconfig)) or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'unsafe chore function'; end if;
 end loop;
end $$;
set constraints all immediate;
rollback;
select count(*) as synthetic_chore_members_remaining from public.family_members where id in('c4111111-1111-4111-8111-111111111111','c4222222-2222-4222-8222-222222222222','c4333333-3333-4333-8333-333333333333','c4444444-4444-4444-8444-444444444444');
