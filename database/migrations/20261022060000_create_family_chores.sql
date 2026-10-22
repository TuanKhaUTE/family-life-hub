-- Rules generate pending occurrences on reads. Only completion/cancellation
-- creates occurrence rows; no scheduler or daily materialization is needed.
create table public.chore_schedules (
 id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
 title text not null check(title=btrim(title,E' \t\n\r\f'||chr(11)) and char_length(title) between 1 and 120),
 category text not null check(category in('DISHES','TRASH','CLEANING','SHOPPING','LAUNDRY','OTHER')),
 scheduled_date date not null check(scheduled_date between date '2000-01-01' and date '2199-12-31'),
 scheduled_time time check(scheduled_time>=time '00:00' and scheduled_time<time '24:00' and extract(second from scheduled_time)=0),
 assigned_member_id uuid references public.family_members(id) on delete restrict,
 is_weekly boolean not null, recurrence_until date,
 note text check(note is null or (note=btrim(note,E' \t\n\r\f'||chr(11)) and char_length(note) between 1 and 1000)),
 created_by_member_id uuid not null references public.family_members(id) on delete restrict,
 cancelled boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((is_weekly and assigned_member_id is null) or (not is_weekly and assigned_member_id is not null and recurrence_until is null)),
 check(recurrence_until is null or recurrence_until between scheduled_date and date '2199-12-31')
);
create table public.chore_weekly_assignments (
 schedule_id uuid not null references public.chore_schedules(id) on delete cascade,
 weekday integer not null check(weekday between 1 and 7),
 assigned_member_id uuid not null references public.family_members(id) on delete restrict,
 primary key(schedule_id,weekday)
);
create index chore_weekly_assignee_idx on public.chore_weekly_assignments(assigned_member_id);
create index chore_schedule_date_idx on public.chore_schedules(scheduled_date);
create table public.chore_occurrences (
 schedule_id uuid not null references public.chore_schedules(id) on delete cascade,
 occurrence_date date not null check(occurrence_date between date '2000-01-01' and date '2199-12-31'),
 assigned_member_id uuid not null references public.family_members(id) on delete restrict,
 status text not null check(status in('COMPLETED','CANCELLED')),
 completed_at timestamptz,completed_by_member_id uuid references public.family_members(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(schedule_id,occurrence_date),
 check((status='COMPLETED' and completed_at is not null and isfinite(completed_at) and completed_by_member_id=assigned_member_id and completed_by_member_id is not null)
 or(status='CANCELLED' and completed_at is null and completed_by_member_id is null))
);
create index chore_occurrences_assignee_date_idx on public.chore_occurrences(assigned_member_id,occurrence_date);
create trigger chore_schedules_updated before update on public.chore_schedules for each row execute function public.set_updated_at();
create trigger chore_occurrences_updated before update on public.chore_occurrences for each row execute function public.set_updated_at();

create function public.chore_guard_schedule() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.request_key<>old.request_key or new.created_by_member_id<>old.created_by_member_id) then raise exception 'immutable chore identity' using errcode='42501'; end if;
 if tg_op='INSERT' and not exists(select 1 from public.family_members where id=new.created_by_member_id and is_active and role='PARENT') then raise exception 'active parent required' using errcode='42501'; end if;
 if new.assigned_member_id is not null and not exists(select 1 from public.family_members where id=new.assigned_member_id and is_active) then raise exception 'active assignee required' using errcode='22023'; end if;
 return new;
end $$;
create trigger chore_schedules_guard before insert or update on public.chore_schedules for each row execute function public.chore_guard_schedule();
create function public.chore_guard_weekday() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.chore_schedules where id=new.schedule_id and is_weekly for update;
 if not found then raise exception 'weekly schedule required' using errcode='22023'; end if;
 if not exists(select 1 from public.family_members where id=new.assigned_member_id and is_active) then raise exception 'active assignee required' using errcode='22023'; end if;
 return new;
end $$;
create trigger chore_weekly_guard before insert or update on public.chore_weekly_assignments for each row execute function public.chore_guard_weekday();

create function public.chore_schedule_json(s public.chore_schedules) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',s.id,'requestId',s.request_key,'title',s.title,'category',s.category,'scheduledDate',s.scheduled_date,
 'scheduledTime',case when s.scheduled_time is null then null else left(s.scheduled_time::text,5) end,
 'assignedMemberId',s.assigned_member_id,'weeklyAssignments',(select coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'memberId',assigned_member_id) order by weekday),'[]'::jsonb) from public.chore_weekly_assignments where schedule_id=s.id),
 'recurrenceUntil',s.recurrence_until,'note',s.note,'createdByMemberId',s.created_by_member_id,'cancelled',s.cancelled,'createdAt',s.created_at,'updatedAt',s.updated_at);
$$;
create function public.chore_assignee(p_schedule_id uuid,p_date date) returns uuid language sql stable security invoker set search_path='' as $$
 select case when s.is_weekly then (select assigned_member_id from public.chore_weekly_assignments where schedule_id=s.id and weekday=extract(isodow from p_date)::integer) else s.assigned_member_id end
 from public.chore_schedules s where id=p_schedule_id and p_date>=s.scheduled_date
 and (s.recurrence_until is null or p_date<=s.recurrence_until) and (s.is_weekly or p_date=s.scheduled_date);
$$;
create function public.chore_sync_notifications(p_schedule_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare s public.chore_schedules%rowtype;
begin
 select * into s from public.chore_schedules where id=p_schedule_id;
 if not found then raise exception 'chore missing' using errcode='P0002'; end if;
 update public.notifications set title=case when s.cancelled then 'Lịch việc nhà đã hủy' else 'Lịch việc nhà đã thay đổi' end,
 message=case when s.cancelled then s.title||': lịch việc này đã hủy.' else s.title||': việc này hiện không còn giao cho bạn.' end
 where type='CHORE_ASSIGNMENT' and related_resource_type='CHORE_SCHEDULE' and related_resource_id=s.id;
 if s.cancelled then return; end if;
 insert into public.notifications(recipient_member_id,type,title,message,related_resource_type,related_resource_id,related_date)
 select m.id,'CHORE_ASSIGNMENT','Việc nhà của bạn',s.title||' · '||case when s.is_weekly then 'Lặp hàng tuần: '||
 (select string_agg(case when weekday=7 then 'CN' else 'T'||(weekday+1)::text end,', ' order by weekday) from public.chore_weekly_assignments where schedule_id=s.id and assigned_member_id=m.id)
 else to_char(s.scheduled_date,'DD/MM/YYYY') end||' · '||case when s.scheduled_time is not null then left(s.scheduled_time::text,5) when s.category='DISHES' then 'Sau bữa tối' else 'Trong ngày' end,
 'CHORE_SCHEDULE',s.id,s.scheduled_date
 from public.family_members m where m.is_active and (m.id=s.assigned_member_id or exists(select 1 from public.chore_weekly_assignments w where w.schedule_id=s.id and w.assigned_member_id=m.id))
 on conflict on constraint notifications_recipient_event_key do update set title=excluded.title,message=excluded.message,related_date=excluded.related_date;
end $$;

create function public.chore_save(p_actor_member_id uuid,p_schedule_id uuid,p_input jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare s public.chore_schedules%rowtype; sid uuid; key uuid; weekly jsonb; v_weekly boolean; current_json jsonb;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role='PARENT' for share;
 if not found then raise exception 'active parent required' using errcode='42501'; end if;
 if jsonb_typeof(p_input) is distinct from 'object' or jsonb_typeof(p_input->'title') is distinct from 'string' or jsonb_typeof(p_input->'category') is distinct from 'string' then raise exception 'invalid chore input' using errcode='22023'; end if;
 key:=(p_input->>'requestId')::uuid;weekly:=p_input->'weeklyAssignments';
 if key is null or jsonb_typeof(weekly) is distinct from 'array' or jsonb_array_length(weekly)>7 then raise exception 'invalid weekly assignments' using errcode='22023'; end if;
 v_weekly:=jsonb_array_length(weekly)>0;
 if exists(select 1 from jsonb_array_elements(weekly) x where jsonb_typeof(x->'weekday') is distinct from 'number' or jsonb_typeof(x->'memberId') is distinct from 'string') then raise exception 'invalid weekday member' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(weekly) x group by x->>'weekday' having count(*)>1) then raise exception 'duplicate weekday' using errcode='22023'; end if;
 -- Lock retry identities before lookup so concurrent POST retries cannot duplicate.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chore:'||key::text,0));
 if p_schedule_id is null then
  select * into s from public.chore_schedules where request_key=key for update;
  if found then
   current_json:=public.chore_schedule_json(s)-array['id','createdByMemberId','cancelled','createdAt','updatedAt'];
   if current_json is distinct from p_input then raise exception 'retry key conflict' using errcode='P4001'; end if;
   perform public.chore_sync_notifications(s.id);return s.id;
  end if;
  insert into public.chore_schedules(request_key,title,category,scheduled_date,scheduled_time,assigned_member_id,is_weekly,recurrence_until,note,created_by_member_id)
  values(key,btrim(p_input->>'title',E' \t\n\r\f'||chr(11)),p_input->>'category',(p_input->>'scheduledDate')::date,(p_input->>'scheduledTime')::time,(p_input->>'assignedMemberId')::uuid,v_weekly,(p_input->>'recurrenceUntil')::date,nullif(btrim(p_input->>'note',E' \t\n\r\f'||chr(11)),''),p_actor_member_id) returning id into sid;
 else
  select * into s from public.chore_schedules where id=p_schedule_id for update;
  if not found then raise exception 'chore not found' using errcode='P0002'; end if;
  if s.request_key<>key or s.cancelled then raise exception 'chore state changed' using errcode='P4001'; end if;
  sid:=s.id;
  delete from public.chore_weekly_assignments where schedule_id=sid;
  update public.chore_schedules set title=btrim(p_input->>'title',E' \t\n\r\f'||chr(11)),category=p_input->>'category',scheduled_date=(p_input->>'scheduledDate')::date,scheduled_time=(p_input->>'scheduledTime')::time,
   assigned_member_id=(p_input->>'assignedMemberId')::uuid,is_weekly=v_weekly,recurrence_until=(p_input->>'recurrenceUntil')::date,note=nullif(btrim(p_input->>'note',E' \t\n\r\f'||chr(11)),'') where id=sid;
 end if;
 if v_weekly then
  insert into public.chore_weekly_assignments(schedule_id,weekday,assigned_member_id) select sid,(x->>'weekday')::integer,(x->>'memberId')::uuid from jsonb_array_elements(weekly) x;
 end if;
 perform public.chore_sync_notifications(sid);return sid;
end $$;

create function public.chore_cancel_schedule(p_actor_member_id uuid,p_schedule_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role='PARENT' for share;
 if not found then raise exception 'active parent required' using errcode='42501'; end if;
 perform 1 from public.chore_schedules where id=p_schedule_id for update;
 if not found then raise exception 'chore not found' using errcode='P0002'; end if;
 update public.chore_schedules set cancelled=true where id=p_schedule_id and not cancelled;
 perform public.chore_sync_notifications(p_schedule_id);
end $$;
create function public.chore_set_occurrence(p_actor_member_id uuid,p_schedule_id uuid,p_date date,p_action text) returns void language plpgsql security invoker set search_path='' as $$
declare s public.chore_schedules%rowtype; o public.chore_occurrences%rowtype; assignee uuid; actor_role text;
begin
 select role::text into actor_role from public.family_members where id=p_actor_member_id and is_active for share;
 if not found then raise exception 'active actor required' using errcode='42501'; end if;
 if p_action not in('COMPLETE','CANCEL') or p_action is null or p_date is null then raise exception 'invalid action' using errcode='22023'; end if;
 if p_action='CANCEL' and actor_role<>'PARENT' then raise exception 'parent required' using errcode='42501'; end if;
 select * into s from public.chore_schedules where id=p_schedule_id for update;
 if not found then raise exception 'chore not found' using errcode='P0002'; end if;
 select * into o from public.chore_occurrences where schedule_id=s.id and occurrence_date=p_date;
 assignee:=coalesce(o.assigned_member_id,public.chore_assignee(s.id,p_date));
 if assignee is null then raise exception 'not a scheduled occurrence' using errcode='22023'; end if;
 if p_action='COMPLETE' and assignee<>p_actor_member_id then raise exception 'assignee required' using errcode='42501'; end if;
 if o.status='COMPLETED' then
  if p_action='COMPLETE' then return; end if;
  raise exception 'completed work is retained' using errcode='P4001';
 end if;
 if p_action='COMPLETE' and (s.cancelled or o.status='CANCELLED' or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date) then raise exception 'chore unavailable for completion' using errcode='P4001'; end if;
 if not exists(select 1 from public.family_members where id=assignee and is_active) then raise exception 'inactive assignee' using errcode='22023'; end if;
 insert into public.chore_occurrences(schedule_id,occurrence_date,assigned_member_id,status,completed_at,completed_by_member_id)
 values(s.id,p_date,assignee,case when p_action='COMPLETE' then 'COMPLETED' else 'CANCELLED' end,case when p_action='COMPLETE' then now() else null end,case when p_action='COMPLETE' then p_actor_member_id else null end)
 on conflict(schedule_id,occurrence_date) do nothing;
end $$;

create function public.chore_read(p_actor_member_id uuid,p_from date,p_to date,p_member_id uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active;
 if not found then raise exception 'active actor required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_from<date '2000-01-01' or p_to>date '2199-12-31' or p_to<p_from or p_to-p_from>30 then raise exception 'invalid range' using errcode='22023'; end if;
 with base as (
  select s.id as schedule_id,s.scheduled_date as occurrence_date,s.assigned_member_id from public.chore_schedules s where not s.is_weekly and s.scheduled_date between p_from and p_to
  union all
  select s.id,d::date,w.assigned_member_id from public.chore_schedules s join public.chore_weekly_assignments w on w.schedule_id=s.id
  cross join lateral generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
  where s.is_weekly and d::date>=s.scheduled_date and (s.recurrence_until is null or d::date<=s.recurrence_until) and extract(isodow from d)::integer=w.weekday
 ), visible as (
  select b.schedule_id,b.occurrence_date,coalesce(o.assigned_member_id,b.assigned_member_id) as assigned_member_id,
   coalesce(o.status,case when s.cancelled then 'CANCELLED' else 'PENDING' end) as status,o.completed_at,o.completed_by_member_id
  from base b join public.chore_schedules s on s.id=b.schedule_id left join public.chore_occurrences o on o.schedule_id=b.schedule_id and o.occurrence_date=b.occurrence_date
  union all
  select o.schedule_id,o.occurrence_date,o.assigned_member_id,o.status,o.completed_at,o.completed_by_member_id from public.chore_occurrences o where o.occurrence_date between p_from and p_to
   and not exists(select 1 from base b where b.schedule_id=o.schedule_id and b.occurrence_date=o.occurrence_date)
 )
 select jsonb_build_object('members',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'displayName',display_name,'avatarType',avatar_type,'avatarValue',avatar_value) order by created_at,id),'[]'::jsonb) from public.family_members where is_active),
 'chores',(select coalesce(jsonb_agg(jsonb_build_object('schedule',public.chore_schedule_json(s),'date',v.occurrence_date,'assignee',jsonb_build_object('id',m.id,'displayName',m.display_name,'avatarType',m.avatar_type,'avatarValue',m.avatar_value),
 'status',v.status,'completedAt',v.completed_at,'completedByMemberId',v.completed_by_member_id) order by v.occurrence_date,s.scheduled_time nulls last,s.created_at,s.id),'[]'::jsonb)
 from visible v join public.chore_schedules s on s.id=v.schedule_id join public.family_members m on m.id=v.assigned_member_id where m.is_active and(p_member_id is null or m.id=p_member_id))) into result;
 return result;
end $$;

alter table public.chore_schedules enable row level security;
alter table public.chore_weekly_assignments enable row level security;
alter table public.chore_occurrences enable row level security;
revoke all privileges on public.chore_schedules,public.chore_weekly_assignments,public.chore_occurrences from public,anon,authenticated;
grant select,insert,update on public.chore_schedules,public.chore_occurrences to service_role;
grant select,insert,update,delete on public.chore_weekly_assignments to service_role;
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in
 ('chore_guard_schedule','chore_guard_weekday','chore_schedule_json','chore_assignee','chore_sync_notifications','chore_save','chore_cancel_schedule','chore_set_occurrence','chore_read') loop
  execute format('revoke all privileges on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
