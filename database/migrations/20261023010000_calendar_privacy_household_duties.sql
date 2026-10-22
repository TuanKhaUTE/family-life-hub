-- Legacy child calendars remain private until an explicit owner edit publishes them.
alter table public.calendar_events add column calendar_type text not null default 'PERSONAL' check (calendar_type in ('FAMILY','PERSONAL'));
-- ADD COLUMN holds an exclusive table lock until this migration commits. Backfill
-- inactive parents too, without changing historical timestamps or weakening guards
-- for application traffic; restore both triggers before releasing the lock.
alter table public.calendar_events disable trigger calendar_events_guard;
alter table public.calendar_events disable trigger calendar_events_updated;
update public.calendar_events e set calendar_type='FAMILY' from public.family_members m where e.owner_member_id=m.id and m.role='PARENT';
alter table public.calendar_events enable trigger calendar_events_guard;
alter table public.calendar_events enable trigger calendar_events_updated;
alter table public.calendar_events alter column calendar_type set default 'FAMILY';

alter table public.calendar_events add column copied_from_event_id uuid;
alter table public.calendar_events add column copied_from_date date;
alter table public.calendar_events add column copy_target_week date;
create unique index calendar_copy_once on public.calendar_events(owner_member_id,copied_from_event_id,copied_from_date,copy_target_week);

create function public.calendar_guard_visibility() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.calendar_type='PERSONAL' and exists(select 1 from public.family_members where id=new.owner_member_id and role='PARENT') then
  raise exception 'parent uses family calendar' using errcode='42501';
 end if;
 return new;
end $$;
create trigger calendar_visibility_guard before insert or update on public.calendar_events for each row execute function public.calendar_guard_visibility();

create or replace function public.calendar_event_json(e public.calendar_events)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',e.id,'ownerMemberId',e.owner_member_id,'title',e.title,'category',e.category,'calendarType',e.calendar_type,
 'startsAt',e.starts_at,'endsAt',e.ends_at,'note',e.note,'weekdays',e.weekdays,'recurrenceUntil',e.recurrence_until,'createdAt',e.created_at,'updatedAt',e.updated_at);
$$;

-- Null type on legacy updates retains existing privacy; new callers send an explicit type.
create function public.calendar_save_event(p_actor_member_id uuid,p_event_id uuid,p_title text,p_category text,
 p_starts_at timestamptz,p_ends_at timestamptz,p_note text,p_weekdays integer[],p_recurrence_until date,p_calendar_type text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; kind text;
begin
 if p_calendar_type is not null and p_calendar_type not in ('FAMILY','PERSONAL') then raise exception 'invalid calendar type' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('calendar:'||p_actor_member_id::text,0));
 result:=public.calendar_save_event(p_actor_member_id,p_event_id,p_title,p_category,p_starts_at,p_ends_at,p_note,p_weekdays,p_recurrence_until);
 select coalesce(p_calendar_type,calendar_type) into kind from public.calendar_events where id=result;
 update public.calendar_events set calendar_type=kind where id=result;
 return result;
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
   where e.calendar_type=p_calendar_type and (p_calendar_type='FAMILY' or e.owner_member_id=p_actor_member_id) and m.is_active and (p_owner_member_id is null or m.id=p_owner_member_id)
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

-- Retire the broad legacy read contract too; it may never reveal private rows.
create or replace function public.calendar_read(p_actor_member_id uuid,p_from date,p_to date,p_owner_member_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select public.calendar_read(p_actor_member_id,p_from,p_to,p_owner_member_id,'FAMILY');
$$;

create function public.calendar_duplicate_week(p_actor_member_id uuid,p_source_week date)
returns integer language plpgsql security invoker set search_path='' as $$
declare source jsonb; target jsonb; item jsonb; added integer:=0; n integer; target_week date:=p_source_week+7;
begin
 if p_source_week is null or extract(isodow from p_source_week)<>1 or p_source_week<date '2000-01-01' or p_source_week>date '2199-12-17' then raise exception 'invalid source week' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('calendar:'||p_actor_member_id::text,0));
 perform 1 from public.calendar_events where owner_member_id=p_actor_member_id order by id for update;
 source:=public.calendar_read(p_actor_member_id,p_source_week,p_source_week+6,p_actor_member_id,'FAMILY');
 target:=public.calendar_read(p_actor_member_id,target_week,target_week+6,p_actor_member_id,'FAMILY');
 for item in select value from jsonb_array_elements(source->'occurrences') loop
  if (item->>'cancelled')::boolean or (item->>'startsAt')::timestamptz<(p_source_week::timestamp at time zone 'Asia/Ho_Chi_Minh') then continue; end if;
  -- An existing recurring instance already covers the next week.
  if exists(select 1 from jsonb_array_elements(target->'occurrences') t where t->'event'->>'id'=item->'event'->>'id' and (t->>'date')::date=(item->>'date')::date+7 and not (t->>'cancelled')::boolean) then continue; end if;
  insert into public.calendar_events(owner_member_id,calendar_type,title,category,starts_at,ends_at,note,copied_from_event_id,copied_from_date,copy_target_week)
  values(p_actor_member_id,'FAMILY',item->>'title',item->'event'->>'category',
   (((item->>'startsAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')+interval '7 days') at time zone 'Asia/Ho_Chi_Minh',
   (((item->>'endsAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')+interval '7 days') at time zone 'Asia/Ho_Chi_Minh',item->>'note',
   (item->'event'->>'id')::uuid,(item->>'date')::date,target_week) on conflict do nothing;
  get diagnostics n=row_count; added:=added+n;
 end loop;
 return added;
end $$;

-- Existing generic chore tables are retained as historical data, not merged or deleted.
create table public.household_duties (
 duty_date date primary key check(duty_date between date '2000-01-01' and date '2199-12-31'),
 id uuid not null unique default gen_random_uuid(),
 assigned_member_id uuid not null references public.family_members(id) on delete restrict,
 created_by_member_id uuid not null references public.family_members(id) on delete restrict,
 cancelled boolean not null default false,
 completed_at timestamptz,
 completed_by_member_id uuid references public.family_members(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((completed_at is null and completed_by_member_id is null) or
   (completed_at is not null and isfinite(completed_at) and completed_by_member_id is not null and completed_by_member_id=assigned_member_id and not cancelled))
);
create trigger household_duties_updated before update on public.household_duties for each row execute function public.set_updated_at();
create function public.household_duty_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.duty_date<>old.duty_date or new.created_by_member_id<>old.created_by_member_id or
  (old.completed_at is not null and (new.completed_at is distinct from old.completed_at or new.completed_by_member_id is distinct from old.completed_by_member_id or new.assigned_member_id<>old.assigned_member_id or new.cancelled))) then
  raise exception 'completion history is immutable' using errcode='P4001';
 end if;
 perform 1 from public.family_members where id=new.assigned_member_id and is_active for share;
 if not found then raise exception 'active assignee required' using errcode='22023'; end if;
 if tg_op='INSERT' then
  perform 1 from public.family_members where id=new.created_by_member_id and is_active and role='PARENT' for share;
  if not found then raise exception 'parent creator required' using errcode='42501'; end if;
 end if;
 return new;
end $$;
create trigger household_duty_guard before insert or update on public.household_duties for each row execute function public.household_duty_guard();

create function public.household_duty_read(p_actor_member_id uuid,p_from date,p_to date)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active;
 if not found then raise exception 'active actor required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_from<date '2000-01-01' or p_to>date '2199-12-31' or p_to<p_from or p_to-p_from>30 then raise exception 'invalid range' using errcode='22023'; end if;
 return jsonb_build_object('members',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'displayName',display_name,'avatarType',avatar_type,'avatarValue',avatar_value) order by created_at,id),'[]'::jsonb) from public.family_members where is_active),
 'duties',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'date',d.duty_date,'assignee',jsonb_build_object('id',m.id,'displayName',m.display_name,'avatarType',m.avatar_type,'avatarValue',m.avatar_value),
 'cancelled',d.cancelled,'completedAt',d.completed_at,'completedByMemberId',d.completed_by_member_id) order by d.duty_date),'[]'::jsonb)
 from public.household_duties d join public.family_members m on m.id=d.assigned_member_id where d.duty_date between p_from and p_to));
end $$;

create function public.household_duty_save_week(p_actor_member_id uuid,p_assignments jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb; day date; assignee uuid; existing public.household_duties%rowtype;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role='PARENT' for share;
 if not found then raise exception 'parent required' using errcode='42501'; end if;
 if jsonb_typeof(p_assignments) is distinct from 'array' then raise exception 'invalid assignments' using errcode='22023'; end if;
 if jsonb_array_length(p_assignments) not between 1 and 7 then raise exception 'invalid assignments' using errcode='22023'; end if;
 if (select count(distinct x->>'date') from jsonb_array_elements(p_assignments) x)<>jsonb_array_length(p_assignments) or
  (select max((x->>'date')::date)-min((x->>'date')::date) from jsonb_array_elements(p_assignments) x)>6 then raise exception 'invalid dates' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('household-duty',0));
 for item in select value from jsonb_array_elements(p_assignments) order by value->>'date' loop
  if jsonb_typeof(item)<>'object' or (item - 'date' - 'memberId')<>'{}'::jsonb or not(item ? 'date' and item ? 'memberId') then raise exception 'invalid assignment' using errcode='22023'; end if;
  day:=(item->>'date')::date;assignee:=(item->>'memberId')::uuid;
  if day is null or assignee is null then raise exception 'invalid assignment' using errcode='22023'; end if;
  select * into existing from public.household_duties where duty_date=day for update;
  if found and existing.completed_at is not null then
   if existing.assigned_member_id=assignee then continue; end if;
   raise exception 'completed duty retained' using errcode='P4001';
  end if;
  insert into public.household_duties(duty_date,assigned_member_id,created_by_member_id) values(day,assignee,p_actor_member_id)
  on conflict(duty_date) do update set assigned_member_id=excluded.assigned_member_id,cancelled=false;
 end loop;
end $$;

create function public.household_duty_duplicate_week(p_actor_member_id uuid,p_source_week date)
returns integer language plpgsql security invoker set search_path='' as $$
declare item public.household_duties%rowtype; existing public.household_duties%rowtype; added integer:=0;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role='PARENT' for share;
 if not found then raise exception 'parent required' using errcode='42501'; end if;
 if p_source_week is null or extract(isodow from p_source_week)<>1 or p_source_week<date '2000-01-01' or p_source_week>date '2199-12-17' then raise exception 'invalid week' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('household-duty',0));
 for item in select * from public.household_duties where duty_date between p_source_week and p_source_week+6 and not cancelled order by duty_date for update loop
  select * into existing from public.household_duties where duty_date=item.duty_date+7 for update;
  if found then
   if existing.assigned_member_id=item.assigned_member_id and not existing.cancelled then continue; end if;
   raise exception 'target week already scheduled' using errcode='P4001';
  end if;
  insert into public.household_duties(duty_date,assigned_member_id,created_by_member_id) values(item.duty_date+7,item.assigned_member_id,p_actor_member_id);
  added:=added+1;
 end loop;
 return added;
end $$;

create function public.household_duty_action(p_actor_member_id uuid,p_date date,p_action text)
returns void language plpgsql security invoker set search_path='' as $$
declare actor_role text; actor_name text; duty public.household_duties%rowtype;
begin
 select role::text,display_name into actor_role,actor_name from public.family_members where id=p_actor_member_id and is_active for share;
 if not found then raise exception 'active actor required' using errcode='42501'; end if;
 if p_date is null or p_action is null or p_action not in ('COMPLETE','CANCEL') then raise exception 'invalid action' using errcode='22023'; end if;
 if p_action='CANCEL' and actor_role<>'PARENT' then raise exception 'parent required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('household-duty',0));
 select * into duty from public.household_duties where duty_date=p_date for update;
 if not found then raise exception 'duty not found' using errcode='P0002'; end if;
 if p_action='COMPLETE' then
  if duty.assigned_member_id<>p_actor_member_id then raise exception 'assignee required' using errcode='42501'; end if;
  if p_date<>(now() at time zone 'Asia/Ho_Chi_Minh')::date or duty.cancelled then raise exception 'today pending duty required' using errcode='P4001'; end if;
  if duty.completed_at is not null then return; end if;
  update public.household_duties set completed_at=now(),completed_by_member_id=p_actor_member_id where duty_date=p_date;
  -- Notify the scheduling parent, never siblings or a technical administrator.
  insert into public.notifications(recipient_member_id,type,title,message,related_resource_type,related_resource_id,related_date)
  select m.id,'HOUSEHOLD_DUTY_COMPLETED',left(actor_name,70)||' đã hoàn thành việc nhà hôm nay','Rửa chén & Đổ rác','HOUSEHOLD_DUTY',duty.id,p_date
  from public.family_members m where m.id=duty.created_by_member_id and m.is_active and m.role='PARENT' and m.id<>p_actor_member_id
  on conflict on constraint notifications_recipient_event_key do update set title=excluded.title,message=excluded.message;
 else
  if duty.completed_at is not null then raise exception 'completed duty retained' using errcode='P4001'; end if;
  update public.household_duties set cancelled=true where duty_date=p_date and not cancelled;
 end if;
end $$;

alter table public.household_duties enable row level security;
revoke all privileges on public.household_duties from public,anon,authenticated;
grant select,insert,update on public.household_duties to service_role;
do $$ declare f record; begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and
 (proname like 'household_duty_%' or proname in ('calendar_guard_visibility','calendar_event_json','calendar_read','calendar_save_event','calendar_duplicate_week')) loop
  execute format('revoke all privileges on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
