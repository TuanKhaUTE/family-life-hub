-- Calendar owns scheduled title/time/note. Domain metadata links to existing
-- completed-session tables, which remain the sole source of actual progress.
alter table public.calendar_events add constraint calendar_events_owner_id_key unique(owner_member_id,id);
create table public.personal_activity_plans (
 id uuid primary key,
 owner_member_id uuid not null references public.family_members(id) on delete restrict,
 kind text not null check(kind in('STUDY','FITNESS')),
 course_id uuid,
 completed_at timestamptz,
 cancelled boolean not null default false,
 foreign key(owner_member_id,id) references public.calendar_events(owner_member_id,id) on delete restrict,
 foreign key(owner_member_id,course_id) references public.study_courses(owner_member_id,id) on delete restrict,
 unique(owner_member_id,id),
 check(kind='STUDY' or course_id is null),
 check(completed_at is null or(isfinite(completed_at) and not cancelled))
);
alter table public.study_sessions add column activity_plan_id uuid unique;
alter table public.study_sessions add foreign key(owner_member_id,activity_plan_id) references public.personal_activity_plans(owner_member_id,id) on delete restrict;
alter table public.fitness_sessions add column activity_plan_id uuid unique;
alter table public.fitness_sessions add foreign key(owner_member_id,activity_plan_id) references public.personal_activity_plans(owner_member_id,id) on delete restrict;

create function public.activity_plan_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.family_members where id=new.owner_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'private activity owner required' using errcode='42501'; end if;
 if not exists(select 1 from public.calendar_events where id=new.id and owner_member_id=new.owner_member_id and calendar_type='PERSONAL' and weekdays is null and recurrence_until is null and (starts_at at time zone 'Asia/Ho_Chi_Minh')::date=(ends_at at time zone 'Asia/Ho_Chi_Minh')::date) then raise exception 'private dated event required' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.owner_member_id<>old.owner_member_id or new.kind<>old.kind or(old.completed_at is not null and new.completed_at is distinct from old.completed_at)) then raise exception 'immutable activity identity/completion' using errcode='23514'; end if;
 if new.completed_at is not null and not (
  (new.kind='STUDY' and exists(select 1 from public.study_sessions where activity_plan_id=new.id and owner_member_id=new.owner_member_id)) or
  (new.kind='FITNESS' and exists(select 1 from public.fitness_sessions where activity_plan_id=new.id and owner_member_id=new.owner_member_id))) then raise exception 'actual completed session required' using errcode='23514'; end if;
 return new;
end $$;
create trigger activity_plan_guard before insert or update on public.personal_activity_plans for each row execute function public.activity_plan_guard();

create function public.activity_due(p_ends_at timestamptz) returns timestamptz language sql immutable security invoker set search_path='' as $$
 select (((p_ends_at at time zone 'Asia/Ho_Chi_Minh')::date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
$$;
create function public.activity_calendar_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare plan public.personal_activity_plans%rowtype;
begin
 select * into plan from public.personal_activity_plans where id=old.id for update;
 if not found then return new; end if;
 if new.calendar_type<>'PERSONAL' or new.weekdays is not null or new.recurrence_until is not null or
  (new.starts_at at time zone 'Asia/Ho_Chi_Minh')::date<>(new.ends_at at time zone 'Asia/Ho_Chi_Minh')::date then
  raise exception 'activity remains a private dated block' using errcode='23514'; end if;
 if row(new.title,new.starts_at,new.ends_at,new.note,new.category) is distinct from row(old.title,old.starts_at,old.ends_at,old.note,old.category) and
  (plan.completed_at is not null or plan.cancelled or clock_timestamp()>=public.activity_due(old.ends_at)) then
  raise exception 'retain completed or due activity history' using errcode='P5001'; end if;
 return new;
end $$;
create trigger activity_calendar_guard before update on public.calendar_events for each row execute function public.activity_calendar_guard();

create function public.activity_session_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare plan public.personal_activity_plans%rowtype; link uuid;
begin
 if tg_op='DELETE' then
  if old.activity_plan_id is not null then raise exception 'correct actual duration instead of deleting linked completion' using errcode='23514'; end if;
  return old;
 end if;
 link:=new.activity_plan_id;
 if tg_op='UPDATE' and link is distinct from old.activity_plan_id then raise exception 'immutable activity completion identity' using errcode='23514'; end if;
 if link is null then return new; end if;
 select * into plan from public.personal_activity_plans where id=link and owner_member_id=new.owner_member_id;
 if not found or plan.cancelled or (tg_table_name='study_sessions' and plan.kind<>'STUDY') or (tg_table_name='fitness_sessions' and plan.kind<>'FITNESS') then raise exception 'invalid activity completion link' using errcode='23514'; end if;
 if tg_op='UPDATE' then
  if tg_table_name='study_sessions' then
   if new.studied_at<>old.studied_at or new.course_id is distinct from old.course_id then raise exception 'retain completion date/course' using errcode='23514'; end if;
  else
   if new.performed_at<>old.performed_at or new.plan_day_id is distinct from old.plan_day_id then raise exception 'retain completion date/plan' using errcode='23514'; end if;
  end if;
 end if;
 return new;
end $$;
create trigger activity_session_guard before insert or update or delete on public.study_sessions for each row execute function public.activity_session_guard();
create trigger activity_session_guard before insert or update or delete on public.fitness_sessions for each row execute function public.activity_session_guard();

create function public.activity_plan_save(p_actor_member_id uuid,p_kind text,p_id uuid,p_input jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare plan public.personal_activity_plans%rowtype; event public.calendar_events%rowtype; result uuid; wanted uuid; course uuid;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'private activity access denied' using errcode='42501'; end if;
 if p_kind is null or p_kind not in('STUDY','FITNESS') or jsonb_typeof(p_input) is distinct from 'object' or
  (p_input-'requestId'-'title'-'startsAt'-'endsAt'-'courseId'-'note')<>'{}'::jsonb then raise exception 'invalid activity' using errcode='22023'; end if;
 wanted:=(p_input->>'requestId')::uuid;course:=(p_input->>'courseId')::uuid;
 if wanted is null or (p_kind='FITNESS' and course is not null) or
  ((p_input->>'startsAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date<>((p_input->>'endsAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'invalid dated activity' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('calendar:'||p_actor_member_id::text,0));
 select * into event from public.calendar_events where id=coalesce(p_id,wanted) for update;
 select * into plan from public.personal_activity_plans where id=coalesce(p_id,wanted) for update;
 if plan.id is not null and (plan.owner_member_id<>p_actor_member_id or plan.kind<>p_kind) then raise exception 'activity not found' using errcode='P0002'; end if;
 if p_id is null then
  if plan.id is not null then
   if row(event.title,event.starts_at,event.ends_at,event.note,plan.course_id) is distinct from row(p_input->>'title',(p_input->>'startsAt')::timestamptz,(p_input->>'endsAt')::timestamptz,p_input->>'note',course) or plan.cancelled then raise exception 'create retry conflict' using errcode='P5001'; end if;
   return plan.id;
  end if;
  if event.id is not null then raise exception 'identity already in use' using errcode='P5001'; end if;
  insert into public.calendar_events(id,owner_member_id,calendar_type,title,category,starts_at,ends_at,note)
  values(wanted,p_actor_member_id,'PERSONAL',p_input->>'title',case when p_kind='STUDY' then 'SCHOOL' else 'FITNESS' end,(p_input->>'startsAt')::timestamptz,(p_input->>'endsAt')::timestamptz,p_input->>'note');
  insert into public.personal_activity_plans(id,owner_member_id,kind,course_id) values(wanted,p_actor_member_id,p_kind,course);
  return wanted;
 end if;
 if plan.id is null then raise exception 'activity not found' using errcode='P0002'; end if;
 if wanted<>p_id or plan.completed_at is not null or plan.cancelled or clock_timestamp()>=public.activity_due(event.ends_at) then raise exception 'retain due/completed activity' using errcode='P5001'; end if;
 result:=public.calendar_save_event(p_actor_member_id,p_id,p_input->>'title',case when p_kind='STUDY' then 'SCHOOL' else 'FITNESS' end,(p_input->>'startsAt')::timestamptz,(p_input->>'endsAt')::timestamptz,p_input->>'note',null,null,'PERSONAL');
 update public.personal_activity_plans set course_id=course where id=p_id;
 return result;
end $$;

create function public.activity_plan_complete(p_actor_member_id uuid,p_id uuid,p_minutes integer,p_note text,p_correct boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare plan public.personal_activity_plans%rowtype; event public.calendar_events%rowtype; today date:=(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'private activity access denied' using errcode='42501'; end if;
 if p_minutes is null or p_minutes not between 1 and 1440 or p_correct is null or (p_note is not null and (p_note<>btrim(p_note) or char_length(p_note) not between 1 and 1000)) then raise exception 'invalid completion' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('calendar:'||p_actor_member_id::text,0));
 select * into event from public.calendar_events where id=p_id and owner_member_id=p_actor_member_id for update;
 select * into plan from public.personal_activity_plans where id=p_id and owner_member_id=p_actor_member_id for update;
 if plan.id is null then raise exception 'activity not found' using errcode='P0002'; end if;
 if plan.cancelled or event.starts_at>clock_timestamp() then raise exception 'activity not ready for completion' using errcode='P5001'; end if;
 if plan.completed_at is not null and not p_correct then return; end if;
 if plan.completed_at is null and p_correct then raise exception 'complete activity first' using errcode='P5001'; end if;
 if plan.kind='STUDY' then
  if p_correct then update public.study_sessions set duration_minutes=p_minutes,note=p_note where activity_plan_id=p_id and owner_member_id=p_actor_member_id;
  else insert into public.study_sessions(owner_member_id,course_id,studied_at,duration_minutes,note,activity_plan_id) values(p_actor_member_id,plan.course_id,today,p_minutes,p_note,p_id); end if;
 else
  if p_correct then update public.fitness_sessions set duration_minutes=p_minutes,note=p_note where activity_plan_id=p_id and owner_member_id=p_actor_member_id;
  else insert into public.fitness_sessions(owner_member_id,performed_at,duration_minutes,title,note,activity_plan_id) values(p_actor_member_id,today,p_minutes,event.title,p_note,p_id); end if;
 end if;
 if plan.completed_at is null then update public.personal_activity_plans set completed_at=clock_timestamp() where id=p_id; end if;
end $$;

create function public.activity_plan_cancel(p_actor_member_id uuid,p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare plan public.personal_activity_plans%rowtype; event public.calendar_events%rowtype;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'private activity access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('calendar:'||p_actor_member_id::text,0));
 select * into event from public.calendar_events where id=p_id and owner_member_id=p_actor_member_id for update;
 select * into plan from public.personal_activity_plans where id=p_id and owner_member_id=p_actor_member_id for update;
 if plan.id is null then raise exception 'activity not found' using errcode='P0002'; end if;
 if plan.cancelled then return; end if;
 if plan.completed_at is not null or clock_timestamp()>=public.activity_due(event.ends_at) then raise exception 'retain due/completed history' using errcode='P5001'; end if;
 update public.personal_activity_plans set cancelled=true where id=p_id;
end $$;

create function public.activity_plan_read(p_actor_member_id uuid,p_kind text,p_id uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER')) then raise exception 'private activity access denied' using errcode='42501'; end if;
 if p_kind is null or p_kind not in('STUDY','FITNESS') then raise exception 'invalid activity kind' using errcode='22023'; end if;
 return jsonb_build_object('plans',(
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'note',e.note,'courseId',p.course_id,'completedAt',p.completed_at,'cancelled',p.cancelled,
   'actualMinutes',case when p.kind='STUDY' then s.duration_minutes else f.duration_minutes end,'completionNote',case when p.kind='STUDY' then s.note else f.note end) order by e.starts_at desc,p.id),'[]'::jsonb)
  from (select a.* from public.personal_activity_plans a join public.calendar_events c on c.id=a.id where a.owner_member_id=p_actor_member_id and a.kind=p_kind and(p_id is null or a.id=p_id) order by c.starts_at desc,a.id limit 200)p join public.calendar_events e on e.id=p.id
  left join public.study_sessions s on s.activity_plan_id=p.id left join public.fitness_sessions f on f.activity_plan_id=p.id),
 'schedule',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'endsAt',e.ends_at,'completedAt',p.completed_at,'cancelled',p.cancelled)),'[]'::jsonb) from public.personal_activity_plans p join public.calendar_events e on e.id=p.id where p.owner_member_id=p_actor_member_id and p.kind=p_kind),
 'facts',case when p_kind='STUDY' then (select coalesce(jsonb_agg(jsonb_build_object('date',studied_at,'minutes',duration_minutes)),'[]'::jsonb) from public.study_sessions where owner_member_id=p_actor_member_id)
 else (select coalesce(jsonb_agg(jsonb_build_object('date',performed_at,'minutes',duration_minutes)),'[]'::jsonb) from public.fitness_sessions where owner_member_id=p_actor_member_id) end);
end $$;

create or replace function public.calendar_event_json(e public.calendar_events)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',e.id,'ownerMemberId',e.owner_member_id,'title',e.title,'category',e.category,'calendarType',e.calendar_type,
 'startsAt',e.starts_at,'endsAt',e.ends_at,'note',e.note,'weekdays',e.weekdays,'recurrenceUntil',e.recurrence_until,'createdAt',e.created_at,'updatedAt',e.updated_at,
 'activity',(select jsonb_build_object('id',p.id,'kind',p.kind,'completedAt',p.completed_at) from public.personal_activity_plans p where p.id=e.id and e.calendar_type='PERSONAL'));
$$;

alter table public.personal_activity_plans enable row level security;
revoke all privileges on public.personal_activity_plans from public,anon,authenticated;
grant select,insert,update on public.personal_activity_plans to service_role;
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'activity_%' loop
  execute format('revoke all privileges on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

create or replace function public.calendar_read(p_actor_member_id uuid,p_from date,p_to date,p_owner_member_id uuid,p_calendar_type text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb; lower_bound timestamptz; upper_bound timestamptz;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active;
 if not found then raise exception 'active actor required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_from<date '2000-01-01' or p_to>date '2199-12-31' or p_to<p_from or p_to-p_from>30 then raise exception 'invalid range' using errcode='22023'; end if;
 if p_calendar_type not in ('FAMILY','PERSONAL') or p_calendar_type is null then raise exception 'invalid calendar type' using errcode='22023'; end if;
 if p_calendar_type='PERSONAL' and (exists(select 1 from public.family_members where id=p_actor_member_id and role='PARENT') or (p_owner_member_id is not null and p_owner_member_id<>p_actor_member_id)) then raise exception 'owner only' using errcode='42501'; end if;
 lower_bound:=p_from::timestamp at time zone 'Asia/Ho_Chi_Minh';
 upper_bound:=(p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
 with eligible as (
   select e from public.calendar_events e join public.family_members m on m.id=e.owner_member_id
   where not exists(select 1 from public.personal_activity_plans p where p.id=e.id and p.cancelled) and e.calendar_type=p_calendar_type and (p_calendar_type='FAMILY' or e.owner_member_id=p_actor_member_id) and m.is_active and (p_owner_member_id is null or m.id=p_owner_member_id)
 ), base as (
   select (q.e).id as event_id,((q.e).starts_at at time zone 'Asia/Ho_Chi_Minh')::date as occurrence_date,
     (q.e).title as title,(q.e).starts_at as starts_at,(q.e).ends_at as ends_at,(q.e).note as note,false as cancelled,false as is_exception
   from eligible q where (q.e).weekdays is null and (q.e).starts_at<upper_bound and (q.e).ends_at>lower_bound
   union all
   select (q.e).id,d::date,(q.e).title,
     (d::date+((q.e).starts_at at time zone 'Asia/Ho_Chi_Minh')::time) at time zone 'Asia/Ho_Chi_Minh',
     (d::date+((q.e).ends_at at time zone 'Asia/Ho_Chi_Minh')::time) at time zone 'Asia/Ho_Chi_Minh',
     (q.e).note,false,false
   from eligible q cross join lateral generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
   where (q.e).weekdays is not null and d::date>=((q.e).starts_at at time zone 'Asia/Ho_Chi_Minh')::date
     and ((q.e).recurrence_until is null or d::date<=(q.e).recurrence_until)
     and extract(isodow from d)::integer=any((q.e).weekdays)
 ), occurrences as (
   select b.* from base b where not exists(select 1 from public.calendar_occurrence_exceptions x where x.event_id=b.event_id and x.occurrence_date=b.occurrence_date)
   union all
   select x.event_id,x.occurrence_date,case when x.cancelled then (q.e).title else x.title end,
     case when x.cancelled then (x.occurrence_date+((q.e).starts_at at time zone 'Asia/Ho_Chi_Minh')::time) at time zone 'Asia/Ho_Chi_Minh' else x.starts_at end,
     case when x.cancelled then (x.occurrence_date+((q.e).ends_at at time zone 'Asia/Ho_Chi_Minh')::time) at time zone 'Asia/Ho_Chi_Minh' else x.ends_at end,
     case when x.cancelled then (q.e).note else x.note end,x.cancelled,true
   from public.calendar_occurrence_exceptions x join eligible q on (q.e).id=x.event_id
 )
 select jsonb_build_object('members',(
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'displayName',display_name,'avatarType',avatar_type,'avatarValue',avatar_value) order by created_at,id),'[]'::jsonb)
   from public.family_members where is_active and (p_calendar_type='FAMILY' or id=p_actor_member_id)
 ),'occurrences',(
   select coalesce(jsonb_agg(jsonb_build_object('event',public.calendar_event_json(e),'owner',jsonb_build_object('id',m.id,'displayName',m.display_name,'avatarType',m.avatar_type,'avatarValue',m.avatar_value),
     'date',o.occurrence_date,'title',o.title,'startsAt',o.starts_at,'endsAt',o.ends_at,'note',o.note,'cancelled',o.cancelled,'isException',o.is_exception) order by o.starts_at,o.event_id,o.occurrence_date),'[]'::jsonb)
   from occurrences o join public.calendar_events e on e.id=o.event_id join public.family_members m on m.id=e.owner_member_id
   where o.starts_at<upper_bound and o.ends_at>lower_bound
 )) into result;
 return result;
end;
$$;
