-- Synthetic actors only. Every mutation is rolled back, including notifications.
begin;
create temporary table batch_b_checks(label text);
grant select,insert on batch_b_checks to service_role;
create function pg_temp.check_true(ok boolean,label text) returns void language plpgsql as $$
begin
 if ok is distinct from true then raise exception 'FAILED: %',label; end if;
 insert into pg_temp.batch_b_checks values(label);
end $$;
create function pg_temp.reject(statement text,expected_state text,label text) returns void language plpgsql as $$
declare actual text;
begin
 begin execute statement; exception when others then get stacked diagnostics actual=returned_sqlstate; end;
 perform pg_temp.check_true(actual=expected_state,label);
end $$;
insert into public.family_members(id,display_name,role) values
 ('cb111111-1111-4111-8111-111111111111','Synthetic Batch B Parent','PARENT'),
 ('cb222222-2222-4222-8222-222222222222','Synthetic Batch B Admin','ADMIN'),
 ('cb333333-3333-4333-8333-333333333333','Synthetic Batch B Member','MEMBER'),
 ('cb444444-4444-4444-8444-444444444444','Synthetic Batch B Inactive','MEMBER');
update public.family_members set is_active=false where id='cb444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare
 p uuid:='cb111111-1111-4111-8111-111111111111';
 a uuid:='cb222222-2222-4222-8222-222222222222';
 m uuid:='cb333333-3333-4333-8333-333333333333';
 inactive uuid:='cb444444-4444-4444-8444-444444444444';
 family_id uuid; private_a uuid; private_m uuid; recurring uuid; finite uuid; actor uuid; result jsonb; n integer; duty_id uuid; stamp timestamptz;
 today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if exists(select 1 from public.household_duties where duty_date between '2098-06-02' and '2098-06-16') then raise exception 'Synthetic verification dates already populated; refusing to alter existing assignments'; end if;
 family_id:=public.calendar_save_event(a,null,'Synthetic public','SCHOOL','2098-06-02 02:00Z','2098-06-02 04:00Z',null,null,null,'FAMILY');
 private_a:=public.calendar_save_event(a,null,'Synthetic private admin','PERSONAL','2098-06-02 05:00Z','2098-06-02 06:00Z',null,null,null,'PERSONAL');
 private_m:=public.calendar_save_event(m,null,'Synthetic private member','FITNESS','2098-06-02 05:00Z','2098-06-02 06:00Z',null,null,null,'PERSONAL');
 foreach actor in array array[p,a,m] loop
  result:=public.calendar_read(actor,'2098-06-02','2098-06-08',a,'FAMILY');
  perform pg_temp.check_true(jsonb_array_length(result->'occurrences')=1,'active family read '||actor);
  perform pg_temp.check_true(not (result::text like '%Synthetic private%'),'family response excludes private titles');
  result:=public.calendar_read(actor,'2098-06-02','2098-06-08',a);
  perform pg_temp.check_true(jsonb_array_length(result->'occurrences')=1,'legacy read excludes private rows');
 end loop;
 foreach actor in array array[a,m] loop
  result:=public.calendar_read(actor,'2098-06-02','2098-06-08',null,'PERSONAL');
  perform pg_temp.check_true(jsonb_array_length(result->'occurrences')=1 and result->'occurrences'->0->'owner'->>'id'=actor::text,'personal read is owner only');
  perform pg_temp.check_true(jsonb_array_length(result->'members')=1,'personal filter profiles are owner only');
  perform pg_temp.reject(format('select public.calendar_read(%L,%L,%L,%L,%L)',actor,'2098-06-02','2098-06-08',case when actor=a then m else a end,'PERSONAL'),'42501','sibling/admin foreign personal read denied');
 end loop;
 perform pg_temp.reject(format('select public.calendar_read(%L,%L,%L,null,%L)',p,'2098-06-02','2098-06-08','PERSONAL'),'42501','parent personal read denied');
 perform pg_temp.reject(format('select public.calendar_read(%L,%L,%L,null,%L)',inactive,'2098-06-02','2098-06-08','FAMILY'),'42501','inactive read denied');
 perform pg_temp.reject(format('select public.calendar_save_event(%L,null,%L,%L,%L,%L,null,null,null,%L)',p,'Synthetic invalid','OTHER','2098-06-02 02:00Z','2098-06-02 03:00Z','PERSONAL'),'42501','parent personal creation denied');
 foreach actor in array array[p,m] loop
  perform pg_temp.reject(format('select public.calendar_save_event(%L,%L,%L,%L,%L,%L,null,null,null,%L)',actor,family_id,'Forged','OTHER','2098-06-02 02:00Z','2098-06-02 03:00Z','FAMILY'),'42501','foreign family edit denied');
  perform pg_temp.reject(format('select public.calendar_delete_event(%L,%L)',actor,family_id),'42501','foreign family delete denied');
 end loop;
 perform pg_temp.reject(format('select public.calendar_delete_event(%L,%L)',a,private_m),'42501','admin cannot delete sibling personal');
 perform public.calendar_save_event(a,private_a,'Synthetic edited private','PERSONAL','2098-06-02 05:00Z','2098-06-02 06:00Z',null,null,null);
 perform pg_temp.check_true((select calendar_type='PERSONAL' from public.calendar_events where id=private_a),'legacy edit preserves private type');
 recurring:=public.calendar_save_event(a,null,'Synthetic recurring','SCHOOL','2098-06-02 08:00Z','2098-06-02 09:00Z',null,array[1,2,3,4,5],null,'FAMILY');
 n:=public.calendar_duplicate_week(a,'2098-06-02');
 perform pg_temp.check_true(n=1,'copy skips existing recurring instances and private events');
 perform pg_temp.check_true(public.calendar_duplicate_week(a,'2098-06-02')=0,'calendar copy retry adds no rows');
 perform pg_temp.check_true((select count(*)=1 from public.calendar_events where owner_member_id=a and copied_from_event_id=family_id),'one provenance copy');
 perform pg_temp.check_true((select count(*)=0 from public.calendar_events where owner_member_id<>a and copied_from_event_id is not null and copied_from_event_id in(family_id,private_a,private_m,recurring)),'copy cannot create foreign owner rows');
 finite:=public.calendar_save_event(m,null,'Synthetic finite recurrence','SCHOOL','2098-06-02 02:00Z','2098-06-02 03:00Z',null,array[1,2],'2098-06-08','FAMILY');
 perform public.calendar_save_exception(m,finite,'2098-06-03',true,null,null,null,null);
 perform public.calendar_save_exception(m,finite,'2098-06-02',false,'Synthetic moved occurrence','2098-06-04 03:00Z','2098-06-04 04:00Z',null);
 perform pg_temp.check_true(public.calendar_duplicate_week(m,'2098-06-02')=1,'copy omits cancelled occurrence and includes moved occurrence');
 perform pg_temp.check_true((select count(*)=1 and bool_and(starts_at='2098-06-11 03:00Z'::timestamptz) from public.calendar_events where copied_from_event_id=finite),'copy preserves effective local moved time');
 perform pg_temp.check_true(public.calendar_duplicate_week(m,'2098-06-02')=0,'moved/cancelled copy retry remains idempotent');
 foreach actor in array array[a,m] loop
  perform pg_temp.reject(format('select public.household_duty_save_week(%L,%L::jsonb)',actor,jsonb_build_array(jsonb_build_object('date','2098-06-02','memberId',m))),'42501','nonparent assignment denied');
  perform pg_temp.reject(format('select public.household_duty_duplicate_week(%L,%L)',actor,'2098-06-02'),'42501','nonparent duty copy denied');
 end loop;
 perform public.household_duty_save_week(p,jsonb_build_array(jsonb_build_object('date','2098-06-02','memberId',m),jsonb_build_object('date','2098-06-03','memberId',a)));
 perform public.household_duty_save_week(p,jsonb_build_array(jsonb_build_object('date','2098-06-02','memberId',m)));
 perform pg_temp.check_true((select count(*)=2 from public.household_duties where duty_date between '2098-06-02' and '2098-06-03'),'one assignment per date and retry');
 foreach actor in array array[p,a,m] loop
  result:=public.household_duty_read(actor,'2098-06-02','2098-06-03');
  perform pg_temp.check_true(jsonb_array_length(result->'duties')=2,'all active members read duty week');
 end loop;
 perform pg_temp.reject(format('select public.household_duty_save_week(%L,%L::jsonb)',p,jsonb_build_array(jsonb_build_object('date','2098-06-04','memberId',m),jsonb_build_object('date','2098-06-04','memberId',a))),'22023','duplicate dates rejected');
 perform pg_temp.reject(format('select public.household_duty_save_week(%L,%L::jsonb)',p,jsonb_build_array(jsonb_build_object('date','2098-06-04','memberId',m),jsonb_build_object('date','2098-06-05','memberId',inactive))),'22023','inactive assignee rolls back entire week');
 perform pg_temp.check_true(not exists(select 1 from public.household_duties where duty_date='2098-06-04'),'week update atomic on invalid later assignee');
 perform pg_temp.check_true(public.household_duty_duplicate_week(p,'2098-06-02')=2,'copies whole active duty week');
 perform pg_temp.check_true(public.household_duty_duplicate_week(p,'2098-06-02')=0,'duty copy retry is idempotent');
 perform public.household_duty_save_week(p,jsonb_build_array(jsonb_build_object('date','2098-06-10','memberId',m)));
 perform pg_temp.reject(format('select public.household_duty_duplicate_week(%L,%L)',p,'2098-06-02'),'P4001','copy never overwrites differing target');
 perform public.household_duty_save_week(p,jsonb_build_array(jsonb_build_object('date','2098-06-02','memberId',a)));
 perform pg_temp.check_true((select assigned_member_id=a from public.household_duties where duty_date='2098-06-02'),'parent reassigns pending date');
 perform pg_temp.reject(format('select public.household_duty_action(%L,%L,%L)',m,'2098-06-02','CANCEL'),'42501','member cannot cancel duty');
 perform pg_temp.reject(format('select public.household_duty_action(%L,%L,%L)',m,'2098-06-02','COMPLETE'),'42501','cannot complete another assignment');
 perform pg_temp.reject(format('select public.household_duty_action(%L,%L,%L)',a,'2098-06-02','COMPLETE'),'P4001','future completion refused');
 perform public.household_duty_action(p,'2098-06-02','CANCEL');
 perform pg_temp.check_true((select cancelled and completed_at is null from public.household_duties where duty_date='2098-06-02'),'cancel is not completion');
 -- Do not touch an existing real assignment for today.
 if not exists(select 1 from public.household_duties where duty_date=today) then
  perform public.household_duty_save_week(p,jsonb_build_array(jsonb_build_object('date',today,'memberId',m)));
  perform public.household_duty_action(m,today,'COMPLETE');
  select id,completed_at into duty_id,stamp from public.household_duties where duty_date=today;
  perform pg_temp.check_true(stamp is not null and (select completed_by_member_id=m from public.household_duties where duty_date=today),'completion records assignee/time');
  update public.notifications set read_at=now() where recipient_member_id=p and related_resource_type='HOUSEHOLD_DUTY' and related_resource_id=duty_id;
  perform public.household_duty_action(m,today,'COMPLETE');
  perform pg_temp.check_true((select completed_at=stamp from public.household_duties where duty_date=today),'completion retry retains timestamp');
  perform pg_temp.check_true((select count(*)=1 and bool_and(read_at is not null) from public.notifications where recipient_member_id=p and related_resource_id=duty_id and type='HOUSEHOLD_DUTY_COMPLETED'),'one parent notification retains read_at');
  perform pg_temp.check_true(not exists(select 1 from public.notifications where related_resource_id=duty_id and recipient_member_id<>p),'no sibling/admin/real recipient notifications');
  perform pg_temp.reject(format('select public.household_duty_save_week(%L,%L::jsonb)',p,jsonb_build_array(jsonb_build_object('date',today,'memberId',a))),'P4001','completed assignment retained');
  perform pg_temp.reject(format('select public.household_duty_action(%L,%L,%L)',p,today,'CANCEL'),'P4001','completed duty cannot be cancelled');
 else
  raise notice 'Today completion block skipped: an existing assignment was preserved';
 end if;
end $$;
reset role;
select pg_temp.check_true(relrowsecurity,'RLS enabled') from pg_class where oid='public.household_duties'::regclass;
select pg_temp.check_true(not has_table_privilege('anon','public.household_duties','SELECT') and not has_table_privilege('authenticated','public.household_duties','UPDATE'),'browser table access denied');
select pg_temp.check_true(not exists(select 1 from public.calendar_events e join public.family_members m on m.id=e.owner_member_id where m.role='PARENT' and e.calendar_type<>'FAMILY'),'all retained parent calendars classified family');
select pg_temp.check_true((select count(*)=3 and bool_and(tgenabled='O') from pg_trigger where tgrelid='public.calendar_events'::regclass and tgname in ('calendar_events_guard','calendar_events_updated','calendar_visibility_guard')),'runtime calendar guards restored');
select pg_temp.check_true(not prosecdef and proconfig @> array['search_path=""'] and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE'),'restricted invoker function '||proname)
from pg_proc where pronamespace='public'::regnamespace and (proname like 'household_duty_%' or proname in ('calendar_read','calendar_save_event','calendar_duplicate_week','calendar_guard_visibility'));
select count(*) as passed_security_checks from pg_temp.batch_b_checks;
rollback;
