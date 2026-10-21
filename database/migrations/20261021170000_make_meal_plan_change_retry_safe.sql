create or replace function public.change_self_service_meal_request(
  p_actor_member_id uuid,
  p_request_id uuid,
  p_mode text,
  p_deadline_at timestamptz,
  p_parent_message text default null,
  p_options text[] default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.meal_requests%rowtype;
  v_message text := nullif(btrim(p_parent_message), '');
  v_options text[];
  v_existing_options text[];
begin
  if not exists (
    select 1 from public.family_members as member
    where member.id = p_actor_member_id
      and member.role = 'PARENT'
      and member.is_active
  ) then
    raise exception 'meal plan change requires an active parent'
      using errcode = '42501';
  end if;

  select request.* into v_request
  from public.meal_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'meal request does not exist' using errcode = 'P0002';
  end if;
  if p_mode not in ('OPEN_CHOICE', 'OPTION_POLL') then
    raise exception 'invalid meal mode' using errcode = '22023';
  end if;
  if p_deadline_at is null or p_deadline_at <= now() then
    raise exception 'interactive meal request requires a future deadline'
      using errcode = '22023';
  end if;
  if v_message is not null and char_length(v_message) > 300 then
    raise exception 'parent message is too long' using errcode = '22001';
  end if;

  select coalesce(array_agg(btrim(item.label) order by item.ordinality), '{}')
  into v_options
  from unnest(coalesce(p_options, '{}')) with ordinality as item(label, ordinality);

  if p_mode = 'OPEN_CHOICE' and cardinality(v_options) <> 0 then
    raise exception 'open choice cannot have options' using errcode = '22023';
  end if;
  if p_mode = 'OPTION_POLL' and cardinality(v_options) not between 2 and 5 then
    raise exception 'option poll requires two to five options'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_options) as item(label)
    where item.label = '' or char_length(item.label) > 120
  ) or (
    select count(*) from unnest(v_options) as item(label)
  ) <> (
    select count(distinct lower(item.label))
    from unnest(v_options) as item(label)
  ) then
    raise exception 'meal options are invalid' using errcode = '22023';
  end if;

  if v_request.status = 'OPEN' then
    select coalesce(array_agg(option.label order by option.sort_order), '{}')
    into v_existing_options
    from public.meal_request_options as option
    where option.meal_request_id = p_request_id;

    if v_request.mode = p_mode
      and v_request.deadline_at = p_deadline_at
      and v_request.parent_message is not distinct from v_message
      and v_existing_options is not distinct from v_options then
      perform public.sync_meal_request_notifications(v_request.id);
      return v_request.id;
    end if;

    raise exception 'meal request already has a different plan'
      using errcode = '23505';
  end if;

  if v_request.status <> 'SELF_SERVICE' then
    raise exception 'meal request is not self-service' using errcode = '23514';
  end if;

  delete from public.meal_responses where meal_request_id = p_request_id;
  delete from public.meal_request_options where meal_request_id = p_request_id;

  update public.meal_requests as request
  set
    mode = p_mode,
    status = 'OPEN',
    deadline_at = p_deadline_at,
    parent_message = v_message
  where request.id = p_request_id
  returning request.* into v_request;

  insert into public.meal_request_options (meal_request_id, label, sort_order)
  select v_request.id, item.label, item.ordinality::smallint
  from unnest(v_options) with ordinality as item(label, ordinality);

  perform public.sync_meal_request_notifications(v_request.id);
  return v_request.id;
end;
$$;

revoke all privileges on function public.change_self_service_meal_request(
  uuid, uuid, text, timestamptz, text, text[]
) from public, anon, authenticated;

grant execute on function public.change_self_service_meal_request(
  uuid, uuid, text, timestamptz, text, text[]
) to service_role;
