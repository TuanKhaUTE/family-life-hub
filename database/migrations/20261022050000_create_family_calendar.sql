-- Calendar is intentionally family-visible. Browser database access remains
-- denied; RPC actor IDs come exclusively from authenticated backend sessions.
create function public.calendar_valid_weekdays(p_days integer[])
returns boolean language sql immutable security invoker set search_path = '' as $$
 select p_days is null or (cardinality(p_days) between 1 and 7
   and p_days <@ array[1,2,3,4,5,6,7]
   and array_position(p_days,null) is null
   and cardinality(p_days)=(select count(distinct d) from unnest(p_days) d));
$$;

create table public.calendar_events (
 id uuid primary key default gen_random_uuid(),
 owner_member_id uuid not null references public.family_members(id) on delete cascade,
 title text not null check (title=btrim(title,E' \t\n\r\f'||chr(11)) and char_length(title) between 1 and 120),
 category text not null check (category in ('SCHOOL','WORK','FITNESS','FAMILY','APPOINTMENT','PERSONAL','OTHER')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 note text check (note is null or (note=btrim(note,E' \t\n\r\f'||chr(11)) and char_length(note) between 1 and 1000)),
 weekdays integer[],
 recurrence_until date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (isfinite(starts_at) and isfinite(ends_at) and starts_at<ends_at and ends_at-starts_at<=interval '31 days'),
 check ((starts_at at time zone 'Asia/Ho_Chi_Minh')::date between date '2000-01-01' and date '2199-12-31'),
 check ((ends_at at time zone 'Asia/Ho_Chi_Minh')::date between date '2000-01-01' and date '2199-12-31'),
 check (public.calendar_valid_weekdays(weekdays)),
 check (weekdays is null or (starts_at at time zone 'Asia/Ho_Chi_Minh')::date=(ends_at at time zone 'Asia/Ho_Chi_Minh')::date),
 check (recurrence_until is null or (weekdays is not null and recurrence_until between (starts_at at time zone 'Asia/Ho_Chi_Minh')::date and date '2199-12-31'))
);
create index calendar_events_owner_start_idx on public.calendar_events(owner_member_id,starts_at);
create index calendar_events_start_idx on public.calendar_events(starts_at);

create table public.calendar_occurrence_exceptions (
 event_id uuid not null references public.calendar_events(id) on delete cascade,
 occurrence_date date not null check (occurrence_date between date '2000-01-01' and date '2199-12-31'),
 cancelled boolean not null,
 title text,
 starts_at timestamptz,
 ends_at timestamptz,
 note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(event_id,occurrence_date),
 check ((cancelled and title is null and starts_at is null and ends_at is null and note is null) or
   (not cancelled and title is not null and title=btrim(title,E' \t\n\r\f'||chr(11)) and char_length(title) between 1 and 120
    and starts_at is not null and ends_at is not null and isfinite(starts_at) and isfinite(ends_at) and starts_at<ends_at and ends_at-starts_at<=interval '31 days'
    and (starts_at at time zone 'Asia/Ho_Chi_Minh')::date between date '2000-01-01' and date '2199-12-31'
    and (ends_at at time zone 'Asia/Ho_Chi_Minh')::date between date '2000-01-01' and date '2199-12-31'
    and (note is null or (note=btrim(note,E' \t\n\r\f'||chr(11)) and char_length(note) between 1 and 1000))))
);

create function public.calendar_guard_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op='UPDATE' and new.owner_member_id<>old.owner_member_id then raise exception 'calendar owner is immutable' using errcode='42501'; end if;
 perform 1 from public.family_members where id=new.owner_member_id and is_active for share;
 if not found then raise exception 'active owner required' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
    or new.weekdays is distinct from old.weekdays or new.recurrence_until is distinct from old.recurrence_until)
    and exists(select 1 from public.calendar_occurrence_exceptions where event_id=old.id) then
   raise exception 'edit occurrences to preserve exceptions' using errcode='P3001';
 end if;
 return new;
end;
$$;
create trigger calendar_events_guard before insert or update on public.calendar_events for each row execute function public.calendar_guard_event();
create trigger calendar_events_updated before update on public.calendar_events for each row execute function public.set_updated_at();

create function public.calendar_guard_exception()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare e public.calendar_events%rowtype;
begin
 if tg_op='UPDATE' and (new.event_id<>old.event_id or new.occurrence_date<>old.occurrence_date) then raise exception 'occurrence identity is immutable' using errcode='42501'; end if;
 select * into e from public.calendar_events where id=new.event_id for update;
 if not found then raise exception 'event not found' using errcode='P0002'; end if;
 perform 1 from public.family_members where id=e.owner_member_id and is_active for share;
 if not found then raise exception 'active owner required' using errcode='42501'; end if;
 if e.weekdays is null or new.occurrence_date<(e.starts_at at time zone 'Asia/Ho_Chi_Minh')::date
    or (e.recurrence_until is not null and new.occurrence_date>e.recurrence_until)
    or not (extract(isodow from new.occurrence_date)::integer=any(e.weekdays)) then
   raise exception 'not a scheduled occurrence' using errcode='22023';
 end if;
 return new;
end;
$$;
create trigger calendar_exceptions_guard before insert or update on public.calendar_occurrence_exceptions for each row execute function public.calendar_guard_exception();
create trigger calendar_exceptions_updated before update on public.calendar_occurrence_exceptions for each row execute function public.set_updated_at();

create function public.calendar_event_json(e public.calendar_events)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('id',e.id,'ownerMemberId',e.owner_member_id,'title',e.title,'category',e.category,
  'startsAt',e.starts_at,'endsAt',e.ends_at,'note',e.note,'weekdays',e.weekdays,'recurrenceUntil',e.recurrence_until,'createdAt',e.created_at,'updatedAt',e.updated_at);
$$;

create function public.calendar_save_event(p_actor_member_id uuid,p_event_id uuid,p_title text,p_category text,
 p_starts_at timestamptz,p_ends_at timestamptz,p_note text,p_weekdays integer[],p_recurrence_until date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare e public.calendar_events%rowtype; result uuid;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active for share;
 if not found then raise exception 'active actor required' using errcode='42501'; end if;
 if p_event_id is null then
   insert into public.calendar_events(owner_member_id,title,category,starts_at,ends_at,note,weekdays,recurrence_until)
   values(p_actor_member_id,btrim(p_title,E' \t\n\r\f'||chr(11)),p_category,p_starts_at,p_ends_at,nullif(btrim(p_note,E' \t\n\r\f'||chr(11)),''),p_weekdays,p_recurrence_until) returning id into result;
 else
   select * into e from public.calendar_events where id=p_event_id for update;
   if not found then raise exception 'event not found' using errcode='P0002'; end if;
   if e.owner_member_id<>p_actor_member_id then raise exception 'owner required' using errcode='42501'; end if;
   update public.calendar_events set title=btrim(p_title,E' \t\n\r\f'||chr(11)),category=p_category,starts_at=p_starts_at,ends_at=p_ends_at,
     note=nullif(btrim(p_note,E' \t\n\r\f'||chr(11)),''),weekdays=p_weekdays,recurrence_until=p_recurrence_until where id=p_event_id returning id into result;
 end if;
 return result;
end;
$$;

create function public.calendar_delete_event(p_actor_member_id uuid,p_event_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare e public.calendar_events%rowtype;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active for share;
 if not found then raise exception 'active actor required' using errcode='42501'; end if;
 select * into e from public.calendar_events where id=p_event_id for update;
 if not found then raise exception 'event not found' using errcode='P0002'; end if;
 if e.owner_member_id<>p_actor_member_id then raise exception 'owner required' using errcode='42501'; end if;
 delete from public.calendar_events where id=p_event_id;
end;
$$;

create function public.calendar_save_exception(p_actor_member_id uuid,p_event_id uuid,p_occurrence_date date,p_cancelled boolean,
 p_title text,p_starts_at timestamptz,p_ends_at timestamptz,p_note text)
returns void language plpgsql security invoker set search_path = '' as $$
declare e public.calendar_events%rowtype;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active for share;
 if not found then raise exception 'active actor required' using errcode='42501'; end if;
 select * into e from public.calendar_events where id=p_event_id for update;
 if not found then raise exception 'event not found' using errcode='P0002'; end if;
 if e.owner_member_id<>p_actor_member_id then raise exception 'owner required' using errcode='42501'; end if;
 insert into public.calendar_occurrence_exceptions(event_id,occurrence_date,cancelled,title,starts_at,ends_at,note)
 values(p_event_id,p_occurrence_date,p_cancelled,btrim(p_title,E' \t\n\r\f'||chr(11)),p_starts_at,p_ends_at,nullif(btrim(p_note,E' \t\n\r\f'||chr(11)),''))
 on conflict(event_id,occurrence_date) do update set cancelled=excluded.cancelled,title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,note=excluded.note;
end;
$$;

create function public.calendar_read(p_actor_member_id uuid,p_from date,p_to date,p_owner_member_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb; lower_bound timestamptz; upper_bound timestamptz;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active;
 if not found then raise exception 'active actor required' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_from<date '2000-01-01' or p_to>date '2199-12-31' or p_to<p_from or p_to-p_from>30 then raise exception 'invalid range' using errcode='22023'; end if;
 lower_bound:=p_from::timestamp at time zone 'Asia/Ho_Chi_Minh';
 upper_bound:=(p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
 with eligible as (
   select e from public.calendar_events e join public.family_members m on m.id=e.owner_member_id
   where m.is_active and (p_owner_member_id is null or m.id=p_owner_member_id)
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
   from public.family_members where is_active
 ),'occurrences',(
   select coalesce(jsonb_agg(jsonb_build_object('event',public.calendar_event_json(e),'owner',jsonb_build_object('id',m.id,'displayName',m.display_name,'avatarType',m.avatar_type,'avatarValue',m.avatar_value),
     'date',o.occurrence_date,'title',o.title,'startsAt',o.starts_at,'endsAt',o.ends_at,'note',o.note,'cancelled',o.cancelled,'isException',o.is_exception) order by o.starts_at,o.event_id,o.occurrence_date),'[]'::jsonb)
   from occurrences o join public.calendar_events e on e.id=o.event_id join public.family_members m on m.id=e.owner_member_id
   where o.starts_at<upper_bound and o.ends_at>lower_bound
 )) into result;
 return result;
end;
$$;

alter table public.calendar_events enable row level security;
alter table public.calendar_occurrence_exceptions enable row level security;
revoke all privileges on public.calendar_events,public.calendar_occurrence_exceptions from public,anon,authenticated;
grant select,insert,update,delete on public.calendar_events,public.calendar_occurrence_exceptions to service_role;
do $$
declare f record;
begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in
 ('calendar_valid_weekdays','calendar_guard_event','calendar_guard_exception','calendar_event_json','calendar_save_event','calendar_delete_event','calendar_save_exception','calendar_read') loop
   execute format('revoke all privileges on function %s from public,anon,authenticated',f.signature);
   execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end;
$$;
