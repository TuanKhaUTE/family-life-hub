begin;
create temp table c1_checks(label text);
grant select,insert on c1_checks to service_role;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'FAILED: %',label; end if; insert into pg_temp.c1_checks values(label); end $$;
create function pg_temp.reject(statement text,state text,label text) returns void language plpgsql as $$ declare actual text; begin begin execute statement; exception when others then get stacked diagnostics actual=returned_sqlstate; end; perform pg_temp.ok(actual=state,label); end $$;
insert into public.family_members(id,display_name,role) values
 ('cc111111-1111-4111-8111-111111111111','Synthetic C1 Parent','PARENT'),
 ('cc222222-2222-4222-8222-222222222222','Synthetic C1 Admin','ADMIN'),
 ('cc333333-3333-4333-8333-333333333333','Synthetic C1 Member','MEMBER');
set local role service_role;
do $$
#variable_conflict use_variable
declare p uuid:='cc111111-1111-4111-8111-111111111111'; a uuid:='cc222222-2222-4222-8222-222222222222'; m uuid:='cc333333-3333-4333-8333-333333333333';
 sid uuid:='cc444444-4444-4444-8444-444444444444'; fid uuid:='cc555555-5555-4555-8555-555555555555'; rid uuid:='cc666666-6666-4666-8666-666666666666'; kind text; id uuid; value jsonb; result jsonb; stamp timestamptz;
begin
 foreach kind in array array['STUDY','FITNESS'] loop
  id:=case when kind='STUDY' then sid else fid end;
  value:=jsonb_build_object('requestId',id,'title','Synthetic planned block','startsAt',(((now() at time zone 'Asia/Ho_Chi_Minh')::date-1)+time '09:00') at time zone 'Asia/Ho_Chi_Minh','endsAt',(((now() at time zone 'Asia/Ho_Chi_Minh')::date-1)+time '10:00') at time zone 'Asia/Ho_Chi_Minh','courseId',null,'note',null);
  perform public.activity_plan_save(m,kind,null,value);
  perform pg_temp.ok(public.activity_plan_save(m,kind,null,value)=id,'create retry reuses identity '||kind);
  result:=public.activity_plan_read(m,kind);
  perform pg_temp.ok(jsonb_array_length(result->'facts')=0,'plan adds zero progress '||kind);
  perform pg_temp.ok((select calendar_type='PERSONAL' from public.calendar_events where calendar_events.id=id),'plan is personal '||kind);
  perform pg_temp.ok(not exists(select 1 from jsonb_array_elements(public.calendar_read(a,(now() at time zone 'Asia/Ho_Chi_Minh')::date-1,(now() at time zone 'Asia/Ho_Chi_Minh')::date,null,'FAMILY')->'occurrences') r where r->'event'->>'id'=id::text),'family read excludes activity '||kind);
  perform pg_temp.ok(jsonb_array_length(public.activity_plan_read(a,kind,id)->'plans')=0,'admin cannot read sibling plan '||kind);
  perform pg_temp.reject(format('select public.activity_plan_read(%L,%L)',p,kind),'42501','parent cannot read private plans '||kind);
  perform pg_temp.reject(format('select public.activity_plan_complete(%L,%L,90,null,false)',a,id),'P0002','admin cannot complete sibling plan '||kind);
  perform public.activity_plan_complete(m,id,90,'Synthetic completion',false);
  select completed_at into stamp from public.personal_activity_plans where personal_activity_plans.id=id;
  perform public.activity_plan_complete(m,id,120,'Retry must not overwrite',false);
  result:=public.activity_plan_read(m,kind);
  perform pg_temp.ok(jsonb_array_length(result->'facts')=1 and result->'facts'->0->>'minutes'='90','completion retry counts actual duration once '||kind);
  perform pg_temp.ok((select completed_at=stamp from public.personal_activity_plans where personal_activity_plans.id=id),'first completion timestamp retained '||kind);
  perform public.activity_plan_complete(m,id,100,'Corrected actual duration',true);
  result:=public.activity_plan_read(m,kind);
  perform pg_temp.ok(jsonb_array_length(result->'facts')=1 and result->'facts'->0->>'minutes'='100','correction updates one actual record '||kind);
  perform pg_temp.reject(format('update public.calendar_events set calendar_type=%L where id=%L','FAMILY',id),'23514','linked activity cannot be published '||kind);
  perform pg_temp.reject(format('select public.activity_plan_cancel(%L,%L)',m,id),'P5001','completed history cannot be cancelled '||kind);
 end loop;
 value:=jsonb_build_object('requestId',rid,'title','Synthetic rescheduled block','startsAt',(((now() at time zone 'Asia/Ho_Chi_Minh')::date+2)+time '09:00') at time zone 'Asia/Ho_Chi_Minh','endsAt',(((now() at time zone 'Asia/Ho_Chi_Minh')::date+2)+time '10:00') at time zone 'Asia/Ho_Chi_Minh','courseId',null,'note',null);
 perform public.activity_plan_save(m,'STUDY',null,value);
 value:=value||jsonb_build_object('startsAt',(((now() at time zone 'Asia/Ho_Chi_Minh')::date+3)+time '09:00') at time zone 'Asia/Ho_Chi_Minh','endsAt',(((now() at time zone 'Asia/Ho_Chi_Minh')::date+3)+time '10:00') at time zone 'Asia/Ho_Chi_Minh');
 perform public.activity_plan_save(m,'STUDY',rid,value);
 perform pg_temp.ok((select count(*)=1 from public.calendar_events where calendar_events.id=rid),'reschedule updates one calendar event');
 perform pg_temp.reject(format('select public.activity_plan_complete(%L,%L,90,null,false)',m,rid),'P5001','cannot complete future block');
 perform public.activity_plan_cancel(m,rid);
 perform public.activity_plan_cancel(m,rid);
 perform pg_temp.ok((select cancelled from public.personal_activity_plans where personal_activity_plans.id=rid),'cancel is idempotent');
end $$;
reset role;
select pg_temp.ok(relrowsecurity,'activity RLS enabled') from pg_class where oid='public.personal_activity_plans'::regclass;
select pg_temp.ok(not has_table_privilege('anon','public.personal_activity_plans','SELECT') and not has_table_privilege('authenticated','public.personal_activity_plans','UPDATE'),'browser table access denied');
select pg_temp.ok(not prosecdef and proconfig @> array['search_path=""'] and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE'),'restricted invoker RPC '||proname) from pg_proc where pronamespace='public'::regnamespace and proname like 'activity_%';
select count(*) as passed_checks from pg_temp.c1_checks;
rollback;
