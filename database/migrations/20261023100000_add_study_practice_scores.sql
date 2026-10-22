alter table public.study_courses
  add column practice_tracking boolean not null default false;

create table public.study_practice_results (
  id uuid primary key default gen_random_uuid(),
  owner_member_id uuid not null references public.family_members(id) on delete restrict,
  session_id uuid not null,
  metric_title text not null check(metric_title=btrim(metric_title) and char_length(metric_title) between 1 and 120),
  score numeric not null check(score>=0 and score<=1000000 and scale(score)<=4),
  max_score numeric not null check(max_score>0 and max_score<=1000000 and scale(max_score)<=4),
  note text check(note is null or(note=btrim(note) and char_length(note) between 1 and 1000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(score<=max_score),
  unique(owner_member_id,id),
  foreign key(session_id) references public.study_sessions(id) on delete restrict
);
create index study_practice_results_owner_session on public.study_practice_results(owner_member_id,session_id,created_at desc);

create function public.study_practice_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.family_members where id=new.owner_member_id and is_active and role in('ADMIN','MEMBER') for share;
  if not found then raise exception 'active Study owner required' using errcode='42501'; end if;
  if not exists(
    select 1
    from public.study_sessions s
    join public.study_courses c on c.id=s.course_id and c.owner_member_id=s.owner_member_id
    where s.id=new.session_id and s.owner_member_id=new.owner_member_id and c.practice_tracking
      and (s.activity_plan_id is null or exists(select 1 from public.personal_activity_plans p where p.id=s.activity_plan_id and p.owner_member_id=s.owner_member_id and p.completed_at is not null))
  ) then raise exception 'practice result requires completed tracked course session' using errcode='23514'; end if;
  if tg_op='UPDATE' and (new.id<>old.id or new.owner_member_id<>old.owner_member_id) then raise exception 'immutable practice owner' using errcode='42501'; end if;
  return new;
end $$;
create trigger study_practice_owner_guard before insert or update on public.study_practice_results for each row execute function public.study_practice_guard();
create trigger study_practice_updated before update on public.study_practice_results for each row execute function public.set_updated_at();
alter table public.study_practice_results enable row level security;
revoke all privileges on public.study_practice_results from public,anon,authenticated;
grant select,insert,update,delete on public.study_practice_results to service_role;

create function public.study_practice_mutate(p_actor_member_id uuid,p_id uuid,p_input jsonb,p_remove boolean default false) returns void
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid;
begin
  perform 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER') for share;
  if not found then raise exception 'Study access denied' using errcode='42501'; end if;
  if p_remove is null then raise exception 'invalid practice action' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('study:'||p_actor_member_id::text,0));
  if p_id is not null then
    select owner_member_id into owner_id from public.study_practice_results where id=p_id for update;
    if owner_id is distinct from p_actor_member_id then raise exception 'Study record not found' using errcode='P0002'; end if;
  end if;
  if p_remove then
    if p_id is null then raise exception 'Study identity required' using errcode='22023'; end if;
    delete from public.study_practice_results where id=p_id and owner_member_id=p_actor_member_id;
    return;
  end if;
  if jsonb_typeof(p_input) is distinct from 'object' or (p_input-'sessionId'-'metricTitle'-'score'-'maxScore'-'note')<>'{}'::jsonb then raise exception 'invalid practice input' using errcode='22023'; end if;
  if p_id is null then
    insert into public.study_practice_results(owner_member_id,session_id,metric_title,score,max_score,note)
    values(p_actor_member_id,(p_input->>'sessionId')::uuid,p_input->>'metricTitle',(p_input->>'score')::numeric,(p_input->>'maxScore')::numeric,nullif(p_input->>'note',''));
  else
    update public.study_practice_results set session_id=(p_input->>'sessionId')::uuid,metric_title=p_input->>'metricTitle',score=(p_input->>'score')::numeric,max_score=(p_input->>'maxScore')::numeric,note=nullif(p_input->>'note','') where id=p_id and owner_member_id=p_actor_member_id;
  end if;
end $$;

create function public.study_practice_read(p_actor_member_id uuid,p_course_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER')) then raise exception 'Study access denied' using errcode='42501'; end if;
  if p_course_id is not null and not exists(select 1 from public.study_courses where id=p_course_id and owner_member_id=p_actor_member_id and practice_tracking) then raise exception 'Study record not found' using errcode='P0002'; end if;
  return jsonb_build_object(
    'courses',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'practiceTracking',practice_tracking) order by name,id),'[]'::jsonb) from public.study_courses where owner_member_id=p_actor_member_id and(p_course_id is null or id=p_course_id)),
    'results',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'sessionId',r.session_id,'courseId',s.course_id,'courseName',c.name,'studiedAt',s.studied_at,'metricTitle',r.metric_title,'score',r.score,'maxScore',r.max_score,'note',r.note,'createdAt',r.created_at,'updatedAt',r.updated_at) order by s.studied_at,r.created_at,r.id),'[]'::jsonb)
      from public.study_practice_results r join public.study_sessions s on s.id=r.session_id and s.owner_member_id=r.owner_member_id join public.study_courses c on c.id=s.course_id and c.owner_member_id=s.owner_member_id
      where r.owner_member_id=p_actor_member_id and c.practice_tracking and(p_course_id is null or c.id=p_course_id))
  );
end $$;

create function public.study_course_practice_toggle(p_actor_member_id uuid,p_course_id uuid,p_enabled boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER') for share;
  if not found then raise exception 'Study access denied' using errcode='42501'; end if;
  if p_enabled is null then raise exception 'invalid practice setting' using errcode='22023'; end if;
  update public.study_courses set practice_tracking=p_enabled where id=p_course_id and owner_member_id=p_actor_member_id;
  if not found then raise exception 'Study record not found' using errcode='P0002'; end if;
end $$;

revoke all privileges on function public.study_practice_guard(),public.study_practice_mutate(uuid,uuid,jsonb,boolean),public.study_practice_read(uuid,uuid),public.study_course_practice_toggle(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.study_practice_guard(),public.study_practice_mutate(uuid,uuid,jsonb,boolean),public.study_practice_read(uuid,uuid),public.study_course_practice_toggle(uuid,uuid,boolean) to service_role;

create or replace function public.study_read(p_actor_member_id uuid,p_today date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare week_start date; week_end date; result jsonb;
begin
 if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER')) then raise exception 'Study access denied' using errcode='42501'; end if;
 if p_today is null or p_today not between date '2000-01-01' and date '2199-12-31' then raise exception 'invalid Study date' using errcode='22023'; end if;
 week_start:=p_today-(extract(isodow from p_today)::integer-1);week_end:=week_start+6;
 with weekly as(select course_id,duration_minutes from public.study_sessions where owner_member_id=p_actor_member_id and studied_at between week_start and week_end)
 select jsonb_build_object(
 'semesters',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'startDate',start_date,'endDate',end_date,'isActive',is_active) order by is_active desc,start_date desc,created_at desc,id),'[]'::jsonb) from public.study_semesters where owner_member_id=p_actor_member_id),
 'courses',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'semesterId',semester_id,'name',name,'code',code,'practiceTracking',practice_tracking) order by name,id),'[]'::jsonb) from public.study_courses where owner_member_id=p_actor_member_id),
 'goals',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'courseId',course_id,'title',title,'targetMinutes',target_minutes,'targetDate',target_date,'status',status) order by created_at desc,id),'[]'::jsonb) from public.study_goals where owner_member_id=p_actor_member_id),
 'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'courseId',course_id,'studiedAt',studied_at,'durationMinutes',duration_minutes,'note',note) order by studied_at desc,created_at desc,id),'[]'::jsonb) from(select * from public.study_sessions where owner_member_id=p_actor_member_id order by studied_at desc,created_at desc,id limit 50)s),
 'summary',jsonb_build_object('weekStart',week_start,'weekEnd',week_end,'totalMinutes',(select coalesce(sum(duration_minutes),0) from weekly),'sessionCount',(select count(*) from weekly),
 'courses',(select coalesce(jsonb_agg(jsonb_build_object('courseId',w.course_id,'name',coalesce(c.name,'Tự học'),'minutes',w.minutes) order by w.minutes desc,c.name),'[]'::jsonb) from(select course_id,sum(duration_minutes)minutes from weekly group by course_id)w left join public.study_courses c on c.id=w.course_id and c.owner_member_id=p_actor_member_id),
 'goals',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'targetMinutes',g.target_minutes,'targetDate',g.target_date,'minutes',(select coalesce(sum(w.duration_minutes),0) from weekly w where g.course_id is null or w.course_id=g.course_id)) order by g.created_at desc,g.id),'[]'::jsonb) from public.study_goals g where owner_member_id=p_actor_member_id and status='ACTIVE'))) into result;
 return result;
end $$;
revoke all privileges on function public.study_read(uuid,date) from public,anon,authenticated;
grant execute on function public.study_read(uuid,date) to service_role;
