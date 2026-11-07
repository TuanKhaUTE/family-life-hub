-- Personal week duplication keeps private calendar ownership in the database.
-- The existing two-argument family RPC remains unchanged for compatibility.
create function public.calendar_duplicate_week(
  p_actor_member_id uuid,
  p_source_week date,
  p_calendar_type text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source jsonb;
  target jsonb;
  item jsonb;
  source_event public.calendar_events%rowtype;
  source_plan public.personal_activity_plans%rowtype;
  is_activity_plan boolean := false;
  target_id uuid;
  shifted_start timestamptz;
  shifted_end timestamptz;
  target_week date := p_source_week + 7;
  added integer := 0;
begin
  if p_source_week is null or extract(isodow from p_source_week)<>1
     or p_source_week<date '2000-01-01' or p_source_week>date '2199-12-17'
     or p_calendar_type is null or p_calendar_type not in ('FAMILY','PERSONAL') then
    raise exception 'invalid calendar copy request' using errcode='22023';
  end if;

  -- Preserve the original family implementation and its response semantics.
  if p_calendar_type='FAMILY' then
    return public.calendar_duplicate_week(p_actor_member_id,p_source_week);
  end if;

  perform 1 from public.family_members
   where id=p_actor_member_id and is_active and role in ('ADMIN','MEMBER')
   for share;
  if not found then
    raise exception 'private calendar owner required' using errcode='42501';
  end if;

  -- Serialise retries for one owner while preserving atomicity.
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar:'||p_actor_member_id::text,0));
  source:=public.calendar_read(p_actor_member_id,p_source_week,p_source_week+6,p_actor_member_id,'PERSONAL');
  target:=public.calendar_read(p_actor_member_id,target_week,target_week+6,p_actor_member_id,'PERSONAL');

  for item in select value from jsonb_array_elements(source->'occurrences') loop
    if (item->>'cancelled')::boolean then continue; end if;

    select e.* into source_event
      from public.calendar_events e
     where e.id=(item->'event'->>'id')::uuid
       and e.owner_member_id=p_actor_member_id
       and e.calendar_type='PERSONAL';
    if not found then continue; end if;

    source_plan:=null;
    select p.* into source_plan
      from public.personal_activity_plans p
     where p.id=source_event.id and p.owner_member_id=p_actor_member_id;
    is_activity_plan:=found;

    -- A recurring series already producing the target occurrence is retained.
    if source_event.weekdays is not null and exists(
      select 1 from jsonb_array_elements(target->'occurrences') t
       where t->'event'->>'id'=source_event.id::text
         and (t->>'date')::date=(item->>'date')::date+7
         and not (t->>'cancelled')::boolean
    ) then continue; end if;

    shifted_start:=(((item->>'startsAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')+interval '7 days') at time zone 'Asia/Ho_Chi_Minh';
    shifted_end:=(((item->>'endsAt')::timestamptz at time zone 'Asia/Ho_Chi_Minh')+interval '7 days') at time zone 'Asia/Ho_Chi_Minh';

    -- Existing target items are never overwritten, including manually-created
    -- equivalents that did not originate from an earlier copy request.
    if is_activity_plan then
      if exists(
        select 1
          from public.calendar_events e
          join public.personal_activity_plans p on p.id=e.id and p.owner_member_id=e.owner_member_id
         where e.owner_member_id=p_actor_member_id
           and e.calendar_type='PERSONAL'
           and e.title=source_event.title
           and e.category=source_event.category
           and e.starts_at=shifted_start
           and e.ends_at=shifted_end
           and e.note is not distinct from source_event.note
           and p.kind=source_plan.kind
           and p.course_id is not distinct from source_plan.course_id
      ) then continue; end if;
    elsif exists(
      select 1 from public.calendar_events e
       where e.owner_member_id=p_actor_member_id
         and e.calendar_type='PERSONAL'
         and e.weekdays is null
         and e.title=source_event.title
         and e.category=source_event.category
         and e.starts_at=shifted_start
         and e.ends_at=shifted_end
         and e.note is not distinct from source_event.note
    ) then continue;
    end if;

    target_id:=null;
    insert into public.calendar_events(
      id,owner_member_id,calendar_type,title,category,starts_at,ends_at,note,
      weekdays,recurrence_until,copied_from_event_id,copied_from_date,copy_target_week
    ) values(
      gen_random_uuid(),p_actor_member_id,'PERSONAL',source_event.title,source_event.category,
      shifted_start,shifted_end,source_event.note,null,null,source_event.id,
      (item->>'date')::date,target_week
    ) on conflict do nothing returning id into target_id;
    if target_id is null then continue; end if;

    -- Activity plans are copied as fresh plans, never as completed sessions.
    if is_activity_plan then
      insert into public.personal_activity_plans(id,owner_member_id,kind,course_id)
      values(target_id,p_actor_member_id,source_plan.kind,source_plan.course_id);
    end if;
    added:=added+1;
  end loop;
  return added;
end;
$$;

revoke all privileges on function public.calendar_duplicate_week(uuid,date,text) from public,anon,authenticated;
grant execute on function public.calendar_duplicate_week(uuid,date,text) to service_role;
