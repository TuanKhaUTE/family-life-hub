create table public.study_semesters (
 id uuid primary key default gen_random_uuid(),
 owner_member_id uuid not null references public.family_members(id) on delete restrict,
 name text not null check(name=btrim(name) and char_length(name) between 1 and 120),
 start_date date not null check(start_date between date '2000-01-01' and date '2199-12-31'),
 end_date date not null check(end_date between start_date and date '2199-12-31'),
 is_active boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(owner_member_id,id)
);
create unique index study_one_active_semester on public.study_semesters(owner_member_id) where is_active;
create table public.study_courses (
 id uuid primary key default gen_random_uuid(),owner_member_id uuid not null references public.family_members(id) on delete restrict,
 semester_id uuid not null,name text not null check(name=btrim(name) and char_length(name) between 1 and 120),
 code text check(code is null or(code=btrim(code) and char_length(code) between 1 and 40)),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(owner_member_id,id),
 foreign key(owner_member_id,semester_id) references public.study_semesters(owner_member_id,id) on delete restrict
);
create index study_courses_semester on public.study_courses(owner_member_id,semester_id);
create table public.study_goals (
 id uuid primary key default gen_random_uuid(),owner_member_id uuid not null references public.family_members(id) on delete restrict,
 course_id uuid,title text not null check(title=btrim(title) and char_length(title) between 1 and 160),
 target_minutes integer check(target_minutes between 1 and 10080),
 target_date date check(target_date between date '2000-01-01' and date '2199-12-31'),
 status text not null default 'ACTIVE' check(status in('ACTIVE','COMPLETED')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(owner_member_id,course_id) references public.study_courses(owner_member_id,id) on delete restrict
);
create index study_goals_owner on public.study_goals(owner_member_id,created_at);
create table public.study_sessions (
 id uuid primary key default gen_random_uuid(),owner_member_id uuid not null references public.family_members(id) on delete restrict,
 course_id uuid,studied_at date not null check(studied_at between date '2000-01-01' and date '2199-12-31'),
 duration_minutes integer not null check(duration_minutes between 1 and 1440),
 note text check(note is null or(note=btrim(note) and char_length(note) between 1 and 1000)),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(owner_member_id,course_id) references public.study_courses(owner_member_id,id) on delete restrict
);
create index study_sessions_owner_date on public.study_sessions(owner_member_id,studied_at desc,created_at desc);

create function public.study_guard_owner() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and(new.id<>old.id or new.owner_member_id<>old.owner_member_id) then raise exception 'immutable Study owner' using errcode='42501'; end if;
 perform 1 from public.family_members where id=new.owner_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'active Study owner required' using errcode='42501'; end if;
 if tg_table_name='study_sessions' then
  if new.studied_at>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'future Study session' using errcode='22023'; end if;
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['study_semesters','study_courses','study_goals','study_sessions'] loop
  execute format('create trigger study_owner_guard before insert or update on public.%I for each row execute function public.study_guard_owner()',t);
  execute format('create trigger study_updated before update on public.%I for each row execute function public.set_updated_at()',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all privileges on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end $$;

create function public.study_mutate(p_actor_member_id uuid,p_kind text,p_id uuid,p_input jsonb,p_remove boolean default false) returns void
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'Study access denied' using errcode='42501'; end if;
 if p_kind is null or p_kind not in('semesters','courses','goals','sessions') or p_remove is null then raise exception 'invalid Study kind' using errcode='22023'; end if;
 -- Serialize one owner's active-semester changes and related CRUD operations.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('study:'||p_actor_member_id::text,0));
 if p_id is not null then
  execute format('select owner_member_id from public.%I where id=$1 and owner_member_id=$2 for update','study_'||p_kind) into owner_id using p_id,p_actor_member_id;
  if owner_id is null then raise exception 'Study record not found' using errcode='P0002'; end if;
 end if;
 if p_remove then
  if p_id is null then raise exception 'Study identity required' using errcode='22023'; end if;
  execute format('delete from public.%I where id=$1 and owner_member_id=$2','study_'||p_kind) using p_id,p_actor_member_id;return;
 end if;
 if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'invalid Study input' using errcode='22023'; end if;
 if p_kind='semesters' then
  if (p_input->>'isActive')::boolean then update public.study_semesters set is_active=false where owner_member_id=p_actor_member_id and is_active and id is distinct from p_id; end if;
  if p_id is null then
   insert into public.study_semesters(owner_member_id,name,start_date,end_date,is_active) values(p_actor_member_id,p_input->>'name',(p_input->>'startDate')::date,(p_input->>'endDate')::date,(p_input->>'isActive')::boolean);
  else update public.study_semesters set name=p_input->>'name',start_date=(p_input->>'startDate')::date,end_date=(p_input->>'endDate')::date,is_active=(p_input->>'isActive')::boolean where id=p_id and owner_member_id=p_actor_member_id;end if;
 elsif p_kind='courses' then
  if p_id is null then
   insert into public.study_courses(owner_member_id,semester_id,name,code) values(p_actor_member_id,(p_input->>'semesterId')::uuid,p_input->>'name',p_input->>'code');
  else update public.study_courses set semester_id=(p_input->>'semesterId')::uuid,name=p_input->>'name',code=p_input->>'code' where id=p_id and owner_member_id=p_actor_member_id;end if;
 elsif p_kind='goals' then
  if p_id is null then
   insert into public.study_goals(owner_member_id,course_id,title,target_minutes,target_date,status) values(p_actor_member_id,(p_input->>'courseId')::uuid,p_input->>'title',(p_input->>'targetMinutes')::integer,(p_input->>'targetDate')::date,p_input->>'status');
  else update public.study_goals set course_id=(p_input->>'courseId')::uuid,title=p_input->>'title',target_minutes=(p_input->>'targetMinutes')::integer,target_date=(p_input->>'targetDate')::date,status=p_input->>'status' where id=p_id and owner_member_id=p_actor_member_id;end if;
 else
  if p_id is null then
   insert into public.study_sessions(owner_member_id,course_id,studied_at,duration_minutes,note) values(p_actor_member_id,(p_input->>'courseId')::uuid,(p_input->>'studiedAt')::date,(p_input->>'durationMinutes')::integer,p_input->>'note');
  else update public.study_sessions set course_id=(p_input->>'courseId')::uuid,studied_at=(p_input->>'studiedAt')::date,duration_minutes=(p_input->>'durationMinutes')::integer,note=p_input->>'note' where id=p_id and owner_member_id=p_actor_member_id;end if;
 end if;
end $$;

create function public.study_read(p_actor_member_id uuid,p_today date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare week_start date; week_end date; result jsonb;
begin
 if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER')) then raise exception 'Study access denied' using errcode='42501'; end if;
 if p_today is null or p_today not between date '2000-01-01' and date '2199-12-31' then raise exception 'invalid Study date' using errcode='22023'; end if;
 week_start:=p_today-(extract(isodow from p_today)::integer-1);week_end:=week_start+6;
 with weekly as(select course_id,duration_minutes from public.study_sessions where owner_member_id=p_actor_member_id and studied_at between week_start and week_end)
 select jsonb_build_object(
 'semesters',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'startDate',start_date,'endDate',end_date,'isActive',is_active) order by is_active desc,start_date desc,created_at desc,id),'[]'::jsonb) from public.study_semesters where owner_member_id=p_actor_member_id),
 'courses',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'semesterId',semester_id,'name',name,'code',code) order by name,id),'[]'::jsonb) from public.study_courses where owner_member_id=p_actor_member_id),
 'goals',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'courseId',course_id,'title',title,'targetMinutes',target_minutes,'targetDate',target_date,'status',status) order by created_at desc,id),'[]'::jsonb) from public.study_goals where owner_member_id=p_actor_member_id),
 'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'courseId',course_id,'studiedAt',studied_at,'durationMinutes',duration_minutes,'note',note) order by studied_at desc,created_at desc,id),'[]'::jsonb) from(select * from public.study_sessions where owner_member_id=p_actor_member_id order by studied_at desc,created_at desc,id limit 50)s),
 'summary',jsonb_build_object('weekStart',week_start,'weekEnd',week_end,'totalMinutes',(select coalesce(sum(duration_minutes),0) from weekly),'sessionCount',(select count(*) from weekly),
 'courses',(select coalesce(jsonb_agg(jsonb_build_object('courseId',w.course_id,'name',coalesce(c.name,'Tự học'),'minutes',w.minutes) order by w.minutes desc,c.name),'[]'::jsonb) from(select course_id,sum(duration_minutes)minutes from weekly group by course_id)w left join public.study_courses c on c.id=w.course_id and c.owner_member_id=p_actor_member_id),
 'goals',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'targetMinutes',g.target_minutes,'targetDate',g.target_date,'minutes',(select coalesce(sum(w.duration_minutes),0) from weekly w where g.course_id is null or w.course_id=g.course_id)) order by g.created_at desc,g.id),'[]'::jsonb) from public.study_goals g where owner_member_id=p_actor_member_id and status='ACTIVE'))) into result;
 return result;
end $$;
revoke all privileges on function public.study_guard_owner(),public.study_mutate(uuid,text,uuid,jsonb,boolean),public.study_read(uuid,date) from public,anon,authenticated;
grant execute on function public.study_guard_owner(),public.study_mutate(uuid,text,uuid,jsonb,boolean),public.study_read(uuid,date) to service_role;
