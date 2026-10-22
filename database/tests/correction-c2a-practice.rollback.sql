begin;
insert into public.family_members(id,display_name,role) values
 ('f2111111-1111-4111-8111-111111111111','Synthetic Practice Admin','ADMIN'),
 ('f2222222-2222-4222-8222-222222222222','Synthetic Practice Member','MEMBER'),
 ('f3333333-3333-4333-8333-333333333333','Synthetic Practice Parent','PARENT');
set local role service_role;
do $$
declare m uuid:='f2222222-2222-4222-8222-222222222222'; a uuid:='f2111111-1111-4111-8111-111111111111'; c uuid; s uuid; r uuid; data jsonb;
begin
 perform public.study_mutate(m,'semesters',null,'{"name":"Synthetic practice semester","startDate":"2026-01-01","endDate":"2027-12-31","isActive":true}'::jsonb,false);
 c:=(public.study_read(m,'2026-10-22')->'semesters'->0->>'id')::uuid;
 perform public.study_mutate(m,'courses',null,jsonb_build_object('name','Synthetic practice course','semesterId',c,'code',null),false);
 c:=(public.study_read(m,'2026-10-22')->'courses'->0->>'id')::uuid;
 perform public.study_course_practice_toggle(m,c,true);
 perform public.study_mutate(m,'sessions',null,jsonb_build_object('courseId',c,'studiedAt','2026-10-22','durationMinutes',90,'note',null),false);
 s:=(public.study_read(m,'2026-10-22')->'sessions'->0->>'id')::uuid;
 perform public.study_practice_mutate(m,null,jsonb_build_object('sessionId',s,'metricTitle','Listening','score',32,'maxScore',40,'note','Synthetic'),false);
 data:=public.study_practice_read(m,c);
 if jsonb_array_length(data->'results')<>1 or (data->'results'->0->>'score')::numeric<>32 or (data->'results'->0->>'maxScore')::numeric<>40 then raise exception 'practice result read failed'; end if;
 perform public.study_practice_mutate(m,(data->'results'->0->>'id')::uuid,jsonb_build_object('sessionId',s,'metricTitle','Reading','score',17,'maxScore',20,'note',null),false);
 data:=public.study_practice_read(m,c);
 if data->'results'->0->>'metricTitle'<>'Reading' then raise exception 'practice result update failed'; end if;
 begin perform public.study_practice_mutate(a,(data->'results'->0->>'id')::uuid,null,true); raise exception 'ADMIN crossed owner'; exception when no_data_found then null; end;
 begin perform public.study_practice_mutate(m,null,jsonb_build_object('sessionId',s,'metricTitle','Bad','score',18,'maxScore',0,'note',null),false); raise exception 'invalid max score accepted'; exception when check_violation then null; end;
 r:=(data->'results'->0->>'id')::uuid; perform public.study_practice_mutate(m,r,null,true);
 if jsonb_array_length((public.study_practice_read(m,c))->'results')<>0 then raise exception 'practice delete failed'; end if;
end $$;
reset role;
do $$ declare f record; begin
 if not(select relrowsecurity from pg_class where oid='public.study_practice_results'::regclass) then raise exception 'practice RLS disabled'; end if;
 if has_table_privilege('anon','public.study_practice_results','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.study_practice_results','SELECT,INSERT,UPDATE,DELETE') then raise exception 'practice browser grants'; end if;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'study_practice_%' loop
  if f.prosecdef or not('search_path=""'=any(f.proconfig)) or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'unsafe practice RPC'; end if;
 end loop;
end $$;
rollback;
select count(*) as synthetic_practice_members_remaining from public.family_members where id in('f2111111-1111-4111-8111-111111111111','f2222222-2222-4222-8222-222222222222','f3333333-3333-4333-8333-333333333333');
