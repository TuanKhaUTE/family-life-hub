create table public.fitness_plans (
 id uuid primary key default gen_random_uuid(),owner_member_id uuid not null references public.family_members(id) on delete restrict,
 name text not null check(name=btrim(name,E' \t\n\r\f'||chr(11)) and char_length(name) between 1 and 120),
 note text check(note is null or(note=btrim(note,E' \t\n\r\f'||chr(11)) and char_length(note) between 1 and 1000)),
 is_active boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_member_id,id)
);
create unique index fitness_one_active_plan on public.fitness_plans(owner_member_id) where is_active;
create table public.fitness_plan_days (
 id uuid primary key default gen_random_uuid(),owner_member_id uuid not null references public.family_members(id) on delete restrict,
 plan_id uuid not null,weekday integer not null check(weekday between 1 and 7),
 title text not null check(title=btrim(title,E' \t\n\r\f'||chr(11)) and char_length(title) between 1 and 120),
 note text check(note is null or(note=btrim(note,E' \t\n\r\f'||chr(11)) and char_length(note) between 1 and 1000)),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_member_id,id),unique(plan_id,weekday),
 foreign key(owner_member_id,plan_id) references public.fitness_plans(owner_member_id,id) on delete restrict
);
create table public.fitness_goals (
 id uuid primary key default gen_random_uuid(),owner_member_id uuid not null references public.family_members(id) on delete restrict,
 weekly_session_target integer not null check(weekly_session_target between 1 and 21),is_active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index fitness_one_active_goal on public.fitness_goals(owner_member_id) where is_active;
create index fitness_goals_owner on public.fitness_goals(owner_member_id);
create table public.fitness_sessions (
 id uuid primary key default gen_random_uuid(),owner_member_id uuid not null references public.family_members(id) on delete restrict,
 plan_day_id uuid,performed_at date not null check(performed_at between date '2000-01-01' and date '2199-12-31'),
 duration_minutes integer check(duration_minutes between 1 and 1440),
 title text not null check(title=btrim(title,E' \t\n\r\f'||chr(11)) and char_length(title) between 1 and 120),
 note text check(note is null or(note=btrim(note,E' \t\n\r\f'||chr(11)) and char_length(note) between 1 and 1000)),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(owner_member_id,plan_day_id) references public.fitness_plan_days(owner_member_id,id) on delete restrict
);
create index fitness_sessions_owner_date on public.fitness_sessions(owner_member_id,performed_at desc,created_at desc);
create function public.fitness_guard_owner() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and(new.id<>old.id or new.owner_member_id<>old.owner_member_id) then raise exception 'immutable Fitness owner' using errcode='42501';end if;
 perform 1 from public.family_members where id=new.owner_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'active Fitness owner required' using errcode='42501';end if;
 if tg_table_name='fitness_sessions' then
  if new.performed_at>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'future completed workout' using errcode='22023';end if;
 end if;
 return new;
end $$;
do $$ declare t text;begin
 foreach t in array array['fitness_plans','fitness_plan_days','fitness_goals','fitness_sessions'] loop
  execute format('create trigger fitness_owner_guard before insert or update on public.%I for each row execute function public.fitness_guard_owner()',t);
  execute format('create trigger fitness_updated before update on public.%I for each row execute function public.set_updated_at()',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all privileges on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end $$;
create function public.fitness_mutate(p_actor_member_id uuid,p_kind text,p_id uuid,p_input jsonb,p_remove boolean default false) returns void
language plpgsql security invoker set search_path='' as $$
declare target_table text;found_owner uuid;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER') for share;
 if not found then raise exception 'Fitness access denied' using errcode='42501';end if;
 target_table:=case p_kind when 'plans' then 'fitness_plans' when 'days' then 'fitness_plan_days' when 'goals' then 'fitness_goals' when 'sessions' then 'fitness_sessions' else null end;
 if target_table is null or p_remove is null then raise exception 'invalid Fitness action' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fitness:'||p_actor_member_id::text,0));
 if p_id is not null then
  execute format('select owner_member_id from public.%I where id=$1 and owner_member_id=$2 for update',target_table) into found_owner using p_id,p_actor_member_id;
  if found_owner is null then raise exception 'Fitness record not found' using errcode='P0002';end if;
 end if;
 if p_remove then
  if p_id is null then raise exception 'Fitness identity required' using errcode='22023';end if;
  execute format('delete from public.%I where id=$1 and owner_member_id=$2',target_table) using p_id,p_actor_member_id;return;
 end if;
 if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'invalid Fitness input' using errcode='22023';end if;
 if p_kind='plans' then
  if (p_input->>'isActive')::boolean then update public.fitness_plans set is_active=false where owner_member_id=p_actor_member_id and is_active and id is distinct from p_id;end if;
  if p_id is null then insert into public.fitness_plans(owner_member_id,name,note,is_active) values(p_actor_member_id,p_input->>'name',p_input->>'note',(p_input->>'isActive')::boolean);
  else update public.fitness_plans set name=p_input->>'name',note=p_input->>'note',is_active=(p_input->>'isActive')::boolean where id=p_id and owner_member_id=p_actor_member_id;end if;
 elsif p_kind='days' then
  if p_id is null then insert into public.fitness_plan_days(owner_member_id,plan_id,weekday,title,note) values(p_actor_member_id,(p_input->>'planId')::uuid,(p_input->>'weekday')::integer,p_input->>'title',p_input->>'note');
  else update public.fitness_plan_days set plan_id=(p_input->>'planId')::uuid,weekday=(p_input->>'weekday')::integer,title=p_input->>'title',note=p_input->>'note' where id=p_id and owner_member_id=p_actor_member_id;end if;
 elsif p_kind='goals' then
  if (p_input->>'isActive')::boolean then update public.fitness_goals set is_active=false where owner_member_id=p_actor_member_id and is_active and id is distinct from p_id;end if;
  if p_id is null then insert into public.fitness_goals(owner_member_id,weekly_session_target,is_active) values(p_actor_member_id,(p_input->>'weeklySessionTarget')::integer,(p_input->>'isActive')::boolean);
  else update public.fitness_goals set weekly_session_target=(p_input->>'weeklySessionTarget')::integer,is_active=(p_input->>'isActive')::boolean where id=p_id and owner_member_id=p_actor_member_id;end if;
 else
  if p_id is null then insert into public.fitness_sessions(owner_member_id,plan_day_id,performed_at,duration_minutes,title,note) values(p_actor_member_id,(p_input->>'planDayId')::uuid,(p_input->>'performedAt')::date,(p_input->>'durationMinutes')::integer,p_input->>'title',p_input->>'note');
  else update public.fitness_sessions set plan_day_id=(p_input->>'planDayId')::uuid,performed_at=(p_input->>'performedAt')::date,duration_minutes=(p_input->>'durationMinutes')::integer,title=p_input->>'title',note=p_input->>'note' where id=p_id and owner_member_id=p_actor_member_id;end if;
 end if;
end $$;
create function public.fitness_read(p_actor_member_id uuid,p_today date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare week_start date;week_end date;result jsonb;
begin
 if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in('ADMIN','MEMBER')) then raise exception 'Fitness access denied' using errcode='42501';end if;
 if p_today is null or p_today not between date '2000-01-01' and date '2199-12-31' then raise exception 'invalid Fitness date' using errcode='22023';end if;
 week_start:=p_today-(extract(isodow from p_today)::integer-1);week_end:=week_start+6;
 with weekly as(select duration_minutes from public.fitness_sessions where owner_member_id=p_actor_member_id and performed_at between week_start and week_end),
 goal as(select weekly_session_target from public.fitness_goals where owner_member_id=p_actor_member_id and is_active),
 upcoming as(select d.id,d.title,day::date as workout_date,d.weekday from public.fitness_plan_days d join public.fitness_plans p on p.id=d.plan_id and p.owner_member_id=d.owner_member_id
 cross join lateral generate_series(p_today::timestamp,(p_today+7)::timestamp,interval '1 day')day
 where d.owner_member_id=p_actor_member_id and p.is_active and extract(isodow from day)::integer=d.weekday
 and not exists(select 1 from public.fitness_sessions s where s.owner_member_id=p_actor_member_id and s.plan_day_id=d.id and s.performed_at=day::date)
 order by day,d.id limit 1)
 select jsonb_build_object(
 'plans',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'note',note,'isActive',is_active) order by is_active desc,created_at desc,id),'[]'::jsonb) from public.fitness_plans where owner_member_id=p_actor_member_id),
 'days',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'planId',plan_id,'weekday',weekday,'title',title,'note',note) order by weekday,id),'[]'::jsonb) from public.fitness_plan_days where owner_member_id=p_actor_member_id),
 'goals',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'weeklySessionTarget',weekly_session_target,'isActive',is_active) order by is_active desc,created_at desc,id),'[]'::jsonb) from public.fitness_goals where owner_member_id=p_actor_member_id),
 'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'planDayId',plan_day_id,'performedAt',performed_at,'durationMinutes',duration_minutes,'title',title,'note',note) order by performed_at desc,created_at desc,id),'[]'::jsonb) from(select * from public.fitness_sessions where owner_member_id=p_actor_member_id order by performed_at desc,created_at desc,id limit 20)s),
 'summary',jsonb_build_object('weekStart',week_start,'weekEnd',week_end,'sessionsThisWeek',(select count(*) from weekly),'weeklyTarget',(select weekly_session_target from goal),
 'completionPercent',(select case when weekly_session_target is null then null else least(100,round((select count(*) from weekly)*100.0/weekly_session_target))::integer end from goal),
 'totalMinutes',(select coalesce(sum(duration_minutes),0) from weekly),'unrecordedDurationCount',(select count(*) from weekly where duration_minutes is null),
 'nextWorkout',(select jsonb_build_object('planDayId',id,'title',title,'date',workout_date,'weekday',weekday) from upcoming))) into result;
 return result;
end $$;
revoke all privileges on function public.fitness_guard_owner(),public.fitness_mutate(uuid,text,uuid,jsonb,boolean),public.fitness_read(uuid,date) from public,anon,authenticated;
grant execute on function public.fitness_guard_owner(),public.fitness_mutate(uuid,text,uuid,jsonb,boolean),public.fitness_read(uuid,date) to service_role;
