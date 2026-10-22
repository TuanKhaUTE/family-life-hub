create table public.study_assessments (
 id uuid primary key default gen_random_uuid(),
 owner_member_id uuid not null references public.family_members(id) on delete restrict,
 course_id uuid not null,
 title text not null check(title=btrim(title,E' \t\n\r\f'||chr(11)) and char_length(title) between 1 and 160),
 assessment_type text not null check(assessment_type in('QUIZ','ASSIGNMENT','MIDTERM','FINAL','PROJECT','PRESENTATION','OTHER')),
 score numeric check(score between 0 and 1000000 and scale(score)<=4),
 max_score numeric check(max_score>0 and max_score<=1000000 and scale(max_score)<=4),
 letter_grade text check(letter_grade is null or(letter_grade=btrim(letter_grade,E' \t\n\r\f'||chr(11)) and char_length(letter_grade) between 1 and 20)),
 weight_percent numeric check(weight_percent between 0 and 100 and scale(weight_percent)<=4),
 assessed_at date check(assessed_at between date '2000-01-01' and date '2199-12-31'),
 note text check(note is null or(note=btrim(note,E' \t\n\r\f'||chr(11)) and char_length(note) between 1 and 1000)),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(score is null or(max_score is not null and score<=max_score)),
 foreign key(owner_member_id,course_id) references public.study_courses(owner_member_id,id) on delete restrict
);
create index study_assessments_owner_course_date on public.study_assessments(owner_member_id,course_id,assessed_at desc,created_at desc);
create trigger study_assessment_owner_guard before insert or update on public.study_assessments for each row execute function public.study_guard_owner();
create trigger study_assessment_updated before update on public.study_assessments for each row execute function public.set_updated_at();
alter table public.study_assessments enable row level security;
revoke all privileges on public.study_assessments from public,anon,authenticated;
grant select,insert,update,delete on public.study_assessments to service_role;

create function public.study_assessment_mutate(p_actor_member_id uuid,p_id uuid,p_input jsonb,p_remove boolean default false) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'Study access denied' using errcode='42501';end if;
 if p_remove is null then raise exception 'invalid Study action' using errcode='22023';end if;
 -- Share the existing Study lock so course deletion and assessment edits serialize.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('study:'||p_actor_member_id::text,0));
 if p_id is not null then
  perform 1 from public.study_assessments where id=p_id and owner_member_id=p_actor_member_id for update;
  if not found then raise exception 'Study record not found' using errcode='P0002';end if;
 end if;
 if p_remove then
  if p_id is null then raise exception 'Study identity required' using errcode='22023';end if;
  delete from public.study_assessments where id=p_id and owner_member_id=p_actor_member_id;return;
 end if;
 if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'invalid assessment input' using errcode='22023';end if;
 if p_id is null then
  insert into public.study_assessments(owner_member_id,course_id,title,assessment_type,score,max_score,letter_grade,weight_percent,assessed_at,note)
  values(p_actor_member_id,(p_input->>'courseId')::uuid,p_input->>'title',p_input->>'assessmentType',(p_input->>'score')::numeric,(p_input->>'maxScore')::numeric,p_input->>'letterGrade',(p_input->>'weightPercent')::numeric,(p_input->>'assessedAt')::date,p_input->>'note');
 else
  update public.study_assessments set course_id=(p_input->>'courseId')::uuid,title=p_input->>'title',assessment_type=p_input->>'assessmentType',score=(p_input->>'score')::numeric,max_score=(p_input->>'maxScore')::numeric,
   letter_grade=p_input->>'letterGrade',weight_percent=(p_input->>'weightPercent')::numeric,assessed_at=(p_input->>'assessedAt')::date,note=p_input->>'note'
   where id=p_id and owner_member_id=p_actor_member_id;
 end if;
end $$;
create function public.study_assessment_read(p_actor_member_id uuid,p_course_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER')) then raise exception 'Study access denied' using errcode='42501';end if;
 if p_course_id is not null and not exists(select 1 from public.study_courses where id=p_course_id and owner_member_id=p_actor_member_id) then raise exception 'Study record not found' using errcode='P0002';end if;
 return jsonb_build_object('courses',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id),'[]'::jsonb) from public.study_courses where owner_member_id=p_actor_member_id and(p_course_id is null or id=p_course_id)),
 'assessments',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'courseId',course_id,'title',title,'assessmentType',assessment_type,'score',score,'maxScore',max_score,'letterGrade',letter_grade,'weightPercent',weight_percent,'assessedAt',assessed_at,'note',note,'createdAt',created_at,'updatedAt',updated_at) order by assessed_at desc nulls last,created_at desc,id desc),'[]'::jsonb) from public.study_assessments where owner_member_id=p_actor_member_id and(p_course_id is null or course_id=p_course_id)));
end $$;
revoke all privileges on function public.study_assessment_mutate(uuid,uuid,jsonb,boolean),public.study_assessment_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.study_assessment_mutate(uuid,uuid,jsonb,boolean),public.study_assessment_read(uuid,uuid) to service_role;
