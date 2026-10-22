begin;
insert into public.family_members(id,display_name,role) values
 ('f6111111-1111-4111-8111-111111111111','Synthetic Share Admin','ADMIN'),
 ('f6222222-2222-4222-8222-222222222222','Synthetic Share Member','MEMBER'),
 ('f6333333-3333-4333-8333-333333333333','Synthetic Share Parent','PARENT'),
 ('f6444444-4444-4444-8444-444444444444','Synthetic Share Inactive','MEMBER');
update public.family_members set is_active=false where id='f6444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare
 a uuid:='f6111111-1111-4111-8111-111111111111'; b uuid:='f6222222-2222-4222-8222-222222222222'; p uuid:='f6333333-3333-4333-8333-333333333333'; inactive uuid:='f6444444-4444-4444-8444-444444444444';
 actor uuid; sid uuid; cid uuid; source_a uuid; source_b uuid; extra_a uuid; shared uuid; again uuid; sibling uuid; extra_share uuid; created timestamptz; data jsonb;
begin
 foreach actor in array array[a,b] loop
  perform public.study_mutate(actor,'semesters',null,'{"name":"Synthetic semester","startDate":"2001-01-01","endDate":"2001-12-31","isActive":true}',false);
  sid:=(select id from public.study_semesters where owner_member_id=actor);
  perform public.study_mutate(actor,'courses',null,jsonb_build_object('name','Synthetic course','semesterId',sid,'code','PRIVATE'),false);
  cid:=(select id from public.study_courses where owner_member_id=actor);
  perform public.study_assessment_mutate(actor,null,jsonb_build_object('courseId',cid,'title','Synthetic shared midterm','assessmentType','MIDTERM','score',8.7,'maxScore',10,'weightPercent',30,'note','Synthetic private assessment note','assessedAt','2001-10-22'),false);
  perform public.study_assessment_mutate(actor,null,jsonb_build_object('courseId',cid,'title','Synthetic private other grade','assessmentType','FINAL','score',6,'maxScore',10,'note','Synthetic never shared'),false);
  perform public.study_mutate(actor,'goals',null,'{"title":"Synthetic private goal","status":"ACTIVE"}',false);
  perform public.study_mutate(actor,'sessions',null,'{"studiedAt":"2001-10-22","durationMinutes":20,"note":"Synthetic private study"}',false);
  perform public.fitness_mutate(actor,'sessions',null,'{"performedAt":"2001-10-22","title":"Synthetic private workout","durationMinutes":30}',false);
  perform public.wellness_mutate(actor,'logs',null,'{"loggedDate":"2001-10-22","weightKg":60,"note":"Synthetic private wellness"}',false);
 end loop;
 source_a:=(select id from public.study_assessments where owner_member_id=a and title='Synthetic shared midterm');
 source_b:=(select id from public.study_assessments where owner_member_id=b and title='Synthetic shared midterm');
 extra_a:=(select id from public.study_assessments where owner_member_id=a and title='Synthetic private other grade');
 foreach actor in array array[a,b,p] loop
  if public.private_share_received(actor,1)->>'totalCount'<>'0' then raise exception 'shared without consent';end if;
  perform public.personal_expense_mutate(actor,null,'{"amount":"123","spentOn":"2001-10-22","category":"OTHER","note":"Synthetic private money"}',false);
 end loop;
 data:=public.private_share_owner(a,'STUDY_ASSESSMENT',source_a);
 if exists(select 1 from jsonb_array_elements(data->'recipients') x where x->>'id' in(a::text,inactive::text)) then raise exception 'self/inactive eligible';end if;
 if not exists(select 1 from jsonb_array_elements(data->'recipients') x where x->>'id'=p::text) then raise exception 'parent not eligible';end if;
 shared:=public.private_share_create(a,'STUDY_ASSESSMENT',source_a,p);
 created:=(select created_at from public.private_record_shares where id=shared);
 again:=public.private_share_create(a,'STUDY_ASSESSMENT',source_a,p);
 if again<>shared or (select created_at from public.private_record_shares where id=shared)<>created or (select count(*) from public.private_record_shares where owner_member_id=a)<>1 then raise exception 'duplicate not idempotent';end if;
 data:=public.private_share_received(p,1);
 if data->>'totalCount'<>'1' or data->'records'->0->'assessment'->>'score'<>'8.7' then raise exception 'explicit recipient read failed';end if;
 if (data->'records'->0->'assessment') ?| array['note','weightPercent','courseId','id','ownerMemberId']
  or (data->'records'->0->'owner') ?| array['id','role','isActive']
  or data::text like '%Synthetic private%' or data::text like '%Synthetic never shared%' then raise exception 'unsafe received projection';end if;
 if public.private_share_received(b,1)->>'totalCount'<>'0' then raise exception 'automatic sibling sharing';end if;
 if jsonb_array_length(public.study_assessment_read(b,null)->'assessments')<>2 then raise exception 'private grade scope changed';end if;
 begin perform public.study_assessment_read(b,(select course_id from public.study_assessments where id=source_a));raise exception 'foreign course exposed';exception when no_data_found then null;end;
 begin perform public.study_assessment_read(p,null);raise exception 'parent private grades';exception when insufficient_privilege then null;end;
 begin perform public.study_read(p,'2001-10-22');raise exception 'parent private study';exception when insufficient_privilege then null;end;
 begin perform public.fitness_read(p,'2001-10-22');raise exception 'parent fitness';exception when insufficient_privilege then null;end;
 begin perform public.wellness_read(p,'2001-10-22');raise exception 'parent wellness';exception when insufficient_privilege then null;end;
 if jsonb_array_length(public.fitness_read(b,'2001-10-22')->'sessions')<>1 or jsonb_array_length(public.wellness_read(b,'2001-10-22')->'logs')<>1 then raise exception 'private module isolation changed';end if;
 foreach actor in array array[a,b,p] loop
  if public.personal_expense_read(actor,'2001-10-01',1)->>'currentTotal'<>'123' then raise exception 'personal money isolation changed';end if;
 end loop;
 begin perform public.private_share_create(b,'STUDY_ASSESSMENT',source_a,p);raise exception 'recipient reshare';exception when no_data_found then null;end;
 begin perform public.private_share_create(a,'STUDY_ASSESSMENT',source_b,p);raise exception 'ADMIN ownership bypass';exception when no_data_found then null;end;
 begin perform public.private_share_owner(b,'STUDY_ASSESSMENT',source_a);raise exception 'recipient owner-list read';exception when no_data_found then null;end;
 begin perform public.private_share_create(p,'STUDY_ASSESSMENT',source_a,b);raise exception 'parent reshare';exception when insufficient_privilege then null;end;
 begin perform public.private_share_revoke(b,shared);raise exception 'recipient revoke';exception when no_data_found then null;end;
 begin perform public.private_share_revoke(p,shared);raise exception 'parent revoke';exception when insufficient_privilege then null;end;
 begin perform public.study_assessment_mutate(b,source_a,null,true);raise exception 'recipient source delete';exception when no_data_found then null;end;
 begin perform public.private_share_create(a,'STUDY_ASSESSMENT',source_a,a);raise exception 'self share';exception when invalid_parameter_value then null;end;
 begin perform public.private_share_create(a,'STUDY_ASSESSMENT',source_a,inactive);raise exception 'inactive recipient';exception when invalid_parameter_value then null;end;
 begin perform public.private_share_create(a,'FITNESS_SESSION',source_a,p);raise exception 'future type enabled';exception when invalid_parameter_value then null;end;
 begin insert into public.private_record_shares(owner_member_id,recipient_member_id,resource_type,resource_id) values(a,p,'STUDY_ASSESSMENT',source_b);raise exception 'foreign direct source';exception when foreign_key_violation then null;end;
 begin insert into public.private_record_shares(owner_member_id,recipient_member_id,resource_type,resource_id) values(a,b,'WELLNESS_WEIGHT_LOG',source_a);raise exception 'future direct type';exception when check_violation then null;end;
 update public.family_members set is_active=false where id=a;
 if public.private_share_received(p,1)->>'totalCount'<>'0' then raise exception 'inactive owner exposed';end if;
 update public.family_members set is_active=true where id=a;
 update public.family_members set is_active=false where id=p;
 begin perform public.private_share_received(p,1);raise exception 'inactive recipient read';exception when insufficient_privilege then null;end;
 update public.family_members set is_active=true where id=p;
 perform public.private_share_revoke(a,shared);
 if public.private_share_received(p,1)->>'totalCount'<>'0' or not exists(select 1 from public.study_assessments where id=source_a) then raise exception 'revoke failed or touched source';end if;
 shared:=public.private_share_create(a,'STUDY_ASSESSMENT',source_a,p);
 sibling:=public.private_share_create(a,'STUDY_ASSESSMENT',source_a,b);
 extra_share:=public.private_share_create(a,'STUDY_ASSESSMENT',extra_a,p);
 if public.private_share_received(b,1)->>'totalCount'<>'1' then raise exception 'explicit sibling read failed';end if;
 perform public.study_assessment_mutate(a,source_a,null,true);
 if exists(select 1 from public.private_record_shares where id in(shared,sibling)) or not exists(select 1 from public.private_record_shares where id=extra_share) then raise exception 'source cascade scope incorrect';end if;
 if public.private_share_received(p,1)->>'totalCount'<>'1' or public.private_share_received(b,1)->>'totalCount'<>'0' then raise exception 'deleted source still received';end if;
end $$;
reset role;
do $$ declare f record;begin
 if not(select relrowsecurity from pg_class where oid='public.private_record_shares'::regclass) or exists(select 1 from pg_policies where schemaname='public' and tablename='private_record_shares') then raise exception 'unsafe sharing RLS';end if;
 if has_table_privilege('anon','public.private_record_shares','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.private_record_shares','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('service_role','public.private_record_shares','UPDATE') then raise exception 'unsafe share grants';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.private_record_shares'::regclass and confrelid='public.study_assessments'::regclass and confdeltype='c' and contype='f') then raise exception 'missing source cascade FK';end if;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'private_share_%' loop
  if f.prosecdef or not('search_path=""'=any(f.proconfig)) or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'unsafe sharing RPC';end if;
 end loop;
end $$;
rollback;
select count(*) as synthetic_share_members_remaining from public.family_members where id in('f6111111-1111-4111-8111-111111111111','f6222222-2222-4222-8222-222222222222','f6333333-3333-4333-8333-333333333333','f6444444-4444-4444-8444-444444444444');
