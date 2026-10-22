begin;
insert into public.family_members(id,display_name,role) values
 ('e4111111-1111-4111-8111-111111111111','Synthetic Grade Admin','ADMIN'),
 ('e4222222-2222-4222-8222-222222222222','Synthetic Grade Member','MEMBER'),
 ('e4333333-3333-4333-8333-333333333333','Synthetic Grade Parent','PARENT'),
 ('e4444444-4444-4444-8444-444444444444','Synthetic Grade Inactive','MEMBER');
update public.family_members set is_active=false where id='e4444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare a uuid:='e4111111-1111-4111-8111-111111111111';b uuid:='e4222222-2222-4222-8222-222222222222';p uuid:='e4333333-3333-4333-8333-333333333333';inactive uuid:='e4444444-4444-4444-8444-444444444444';actor uuid;sid uuid;cid uuid;aid uuid;foreign_course uuid;foreign_assessment uuid;config jsonb;data jsonb;bad jsonb;
begin
 foreach actor in array array[a,b] loop
  perform public.study_mutate(actor,'semesters',null,'{"name":"Synthetic semester","startDate":"2026-01-01","endDate":"2027-12-31","isActive":true}'::jsonb,false);
  sid:=(public.study_read(actor,'2026-10-22')->'semesters'->0->>'id')::uuid;
  perform public.study_mutate(actor,'courses',null,jsonb_build_object('name','Synthetic course','semesterId',sid,'code',null),false);
  cid:=(public.study_assessment_read(actor,null)->'courses'->0->>'id')::uuid;
  config:=jsonb_build_object('courseId',cid,'title','Synthetic assessment','assessmentType','MIDTERM','score',8.7,'maxScore',10,'letterGrade',null,'weightPercent',30,'assessedAt','2026-10-22','note',null);
  perform public.study_assessment_mutate(actor,null,config,false);
  data:=public.study_assessment_read(actor,cid);aid:=(data->'assessments'->0->>'id')::uuid;
  if jsonb_array_length(data->'assessments')<>1 or (data->'assessments'->0->>'score')::numeric<>8.7 then raise exception 'create/read grade failed';end if;
  perform public.study_assessment_mutate(actor,aid,config||'{"score":9.5,"title":"Synthetic updated"}'::jsonb,false);
  begin update public.study_assessments set owner_member_id=case when actor=a then b else a end where id=aid;raise exception 'grade owner changed';exception when insufficient_privilege then null;end;
  if (public.study_assessment_read(actor,null)->'assessments'->0->>'score')::numeric<>9.5 then raise exception 'update failed';end if;
  begin perform public.study_mutate(actor,'courses',cid,null,true);raise exception 'course cascaded grades';exception when foreign_key_violation then null;end;
  for bad in select value from jsonb_array_elements('[{"score":-1},{"score":11},{"maxScore":0},{"maxScore":null},{"weightPercent":101},{"weightPercent":-1},{"title":" "},{"assessmentType":"GPA"},{"score":0.12345}]'::jsonb) loop
   begin perform public.study_assessment_mutate(actor,null,config||bad,false);raise exception 'invalid assessment accepted';exception when check_violation then null;end;
  end loop;
  perform public.study_assessment_mutate(actor,null,config||'{"score":null,"maxScore":null,"letterGrade":"A"}'::jsonb,false);
  perform public.study_assessment_mutate(actor,aid,null,true);
  if jsonb_array_length(public.study_assessment_read(actor,null)->'assessments')<>1 then raise exception 'delete affected wrong rows';end if;
 end loop;
 foreign_course:=(public.study_assessment_read(b,null)->'courses'->0->>'id')::uuid;foreign_assessment:=(public.study_assessment_read(b,null)->'assessments'->0->>'id')::uuid;
 if jsonb_array_length(public.study_assessment_read(a,null)->'assessments')<>1 then raise exception 'cross owner grade leak';end if;
 begin perform public.study_assessment_read(a,foreign_course);raise exception 'ADMIN read member course';exception when no_data_found then null;end;
 begin perform public.study_assessment_mutate(a,foreign_assessment,config,false);raise exception 'ADMIN edited member assessment';exception when no_data_found then null;end;
 begin perform public.study_assessment_mutate(a,foreign_assessment,null,true);raise exception 'ADMIN deleted member assessment';exception when no_data_found then null;end;
 begin perform public.study_assessment_mutate(a,null,config||jsonb_build_object('courseId',foreign_course),false);raise exception 'foreign course accepted';exception when foreign_key_violation then null;end;
 foreign_course:=(public.study_assessment_read(a,null)->'courses'->0->>'id')::uuid;foreign_assessment:=(public.study_assessment_read(a,null)->'assessments'->0->>'id')::uuid;
 begin perform public.study_assessment_read(b,foreign_course);raise exception 'MEMBER read ADMIN course';exception when no_data_found then null;end;
 begin perform public.study_assessment_mutate(b,foreign_assessment,null,true);raise exception 'MEMBER deleted ADMIN grade';exception when no_data_found then null;end;
 foreach actor in array array[p,inactive] loop
  begin perform public.study_assessment_read(actor,null);raise exception 'forbidden grade read';exception when insufficient_privilege then null;end;
  begin perform public.study_assessment_mutate(actor,null,config,false);raise exception 'forbidden grade create';exception when insufficient_privilege then null;end;
  begin perform public.study_assessment_mutate(actor,foreign_assessment,null,true);raise exception 'forbidden grade delete';exception when insufficient_privilege then null;end;
 end loop;
end $$;
reset role;
do $$ declare f record;begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='study_assessments' and column_name='percentage') then raise exception 'redundant percentage stored';end if;
 if not(select relrowsecurity from pg_class where oid='public.study_assessments'::regclass) or exists(select 1 from pg_policies where schemaname='public' and tablename='study_assessments') then raise exception 'unsafe assessment RLS';end if;
 if has_table_privilege('anon','public.study_assessments','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.study_assessments','SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser grant';end if;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'study_assessment_%' loop
  if f.prosecdef or not('search_path=""'=any(f.proconfig)) or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'unsafe assessment RPC';end if;
 end loop;
end $$;
set constraints all immediate;
rollback;
select count(*) as synthetic_grade_members_remaining from public.family_members where id in('e4111111-1111-4111-8111-111111111111','e4222222-2222-4222-8222-222222222222','e4333333-3333-4333-8333-333333333333','e4444444-4444-4444-8444-444444444444');
