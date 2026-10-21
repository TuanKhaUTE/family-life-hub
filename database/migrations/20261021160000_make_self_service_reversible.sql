-- Keep one current notification for each member and meal request before
-- normalizing the event type used by all request states.
with ranked as (
  select
    notification.id,
    max(notification.read_at) over (
      partition by notification.recipient_member_id,
        notification.related_resource_id
    ) as preserved_read_at,
    row_number() over (
      partition by notification.recipient_member_id,
        notification.related_resource_id
      order by (notification.read_at is not null) desc,
        notification.created_at,
        notification.id
    ) as row_number
  from public.notifications as notification
  where notification.related_resource_type = 'MEAL_REQUEST'
), preserved as (
  update public.notifications as notification
  set read_at = ranked.preserved_read_at
  from ranked
  where notification.id = ranked.id
    and ranked.row_number = 1
  returning notification.id
)
delete from public.notifications as notification
using ranked
where notification.id = ranked.id
  and ranked.row_number > 1;

update public.notifications
set type = 'MEAL_REQUEST_STATUS'
where related_resource_type = 'MEAL_REQUEST';

create or replace function public.sync_meal_request_notifications(
  p_request_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.meal_requests%rowtype;
  v_meal_label text;
begin
  select request.* into v_request
  from public.meal_requests as request
  where request.id = p_request_id;

  if not found then
    raise exception 'meal request does not exist' using errcode = 'P0002';
  end if;

  v_meal_label := case v_request.meal_type
    when 'LUNCH' then 'Bữa trưa'
    else 'Bữa tối'
  end;

  insert into public.notifications (
    recipient_member_id,
    type,
    title,
    message,
    related_resource_type,
    related_resource_id,
    related_date
  )
  select
    member.id,
    'MEAL_REQUEST_STATUS',
    case
      when v_request.status = 'SELF_SERVICE'
        then v_meal_label || ': tự túc'
      else v_meal_label || ': cần bạn chọn món'
    end,
    coalesce(
      v_request.parent_message,
      case
        when v_request.status = 'SELF_SERVICE'
          then v_meal_label || ' hôm nay mọi người tự túc nhé.'
        else 'Hãy chọn món trước '
          || to_char(
            v_request.deadline_at at time zone 'Asia/Ho_Chi_Minh',
            'HH24:MI'
          ) || ' nhé.'
      end
    ),
    'MEAL_REQUEST',
    v_request.id,
    v_request.meal_date
  from public.family_members as member
  where member.is_active and member.role in ('ADMIN', 'MEMBER')
  on conflict on constraint notifications_recipient_event_key
  do update set
    title = excluded.title,
    message = excluded.message,
    related_date = excluded.related_date;
end;
$$;

create or replace function public.create_meal_request(
  p_actor_member_id uuid,
  p_meal_date date,
  p_meal_type text,
  p_mode text,
  p_deadline_at timestamptz default null,
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
  v_status text;
  v_stored_mode text;
begin
  if not exists (
    select 1 from public.family_members as member
    where member.id = p_actor_member_id
      and member.role = 'PARENT'
      and member.is_active
  ) then
    raise exception 'meal request requires an active parent'
      using errcode = '42501';
  end if;

  if p_meal_type not in ('LUNCH', 'DINNER') then
    raise exception 'invalid meal type' using errcode = '22023';
  end if;
  if p_mode not in ('OPEN_CHOICE', 'OPTION_POLL', 'SELF_SERVICE') then
    raise exception 'invalid meal mode' using errcode = '22023';
  end if;
  if v_message is not null and char_length(v_message) > 300 then
    raise exception 'parent message is too long' using errcode = '22001';
  end if;

  select coalesce(array_agg(btrim(item.label) order by item.ordinality), '{}')
  into v_options
  from unnest(coalesce(p_options, '{}')) with ordinality as item(label, ordinality);

  if p_mode = 'SELF_SERVICE' then
    if cardinality(v_options) <> 0 or p_deadline_at is not null then
      raise exception 'self-service cannot have options or deadline'
        using errcode = '22023';
    end if;
    v_status := 'SELF_SERVICE';
    v_stored_mode := null;
  else
    if p_deadline_at is null or p_deadline_at <= now() then
      raise exception 'interactive meal request requires a future deadline'
        using errcode = '22023';
    end if;
    v_status := 'OPEN';
    v_stored_mode := p_mode;
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
  end if;

  insert into public.meal_requests (
    meal_date, meal_type, mode, status, deadline_at,
    parent_message, created_by_member_id
  ) values (
    p_meal_date, p_meal_type, v_stored_mode, v_status,
    case when v_status = 'SELF_SERVICE' then null else p_deadline_at end,
    v_message, p_actor_member_id
  )
  on conflict on constraint meal_requests_slot_key do nothing
  returning * into v_request;

  if found then
    insert into public.meal_request_options (meal_request_id, label, sort_order)
    select v_request.id, item.label, item.ordinality::smallint
    from unnest(v_options) with ordinality as item(label, ordinality);
  else
    select request.* into v_request
    from public.meal_requests as request
    where request.meal_date = p_meal_date
      and request.meal_type = p_meal_type
    for update;

    select coalesce(array_agg(option.label order by option.sort_order), '{}')
    into v_existing_options
    from public.meal_request_options as option
    where option.meal_request_id = v_request.id;

    if v_request.created_by_member_id <> p_actor_member_id
      or v_request.mode is distinct from v_stored_mode
      or v_request.status <> v_status
      or v_request.deadline_at is distinct from (
        case when v_status = 'SELF_SERVICE' then null else p_deadline_at end
      )
      or v_request.parent_message is distinct from v_message
      or v_existing_options is distinct from v_options then
      raise exception 'meal slot already has a different request'
        using errcode = '23505';
    end if;
  end if;

  perform public.sync_meal_request_notifications(v_request.id);
  return v_request.id;
end;
$$;

create or replace function public.update_meal_request(
  p_actor_member_id uuid,
  p_request_id uuid,
  p_status text,
  p_deadline_at timestamptz,
  p_parent_message text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.meal_requests%rowtype;
  v_message text := nullif(btrim(p_parent_message), '');
begin
  if not exists (
    select 1 from public.family_members as member
    where member.id = p_actor_member_id
      and member.role = 'PARENT'
      and member.is_active
  ) then
    raise exception 'meal request update requires an active parent'
      using errcode = '42501';
  end if;

  select request.* into v_request
  from public.meal_requests as request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'meal request does not exist' using errcode = 'P0002';
  end if;
  if v_message is not null and char_length(v_message) > 300 then
    raise exception 'parent message is too long' using errcode = '22001';
  end if;
  if p_status not in ('OPEN', 'CLOSED', 'SELF_SERVICE') then
    raise exception 'invalid meal request status' using errcode = '22023';
  end if;
  if v_request.status = 'OPEN' and v_request.deadline_at <= now() then
    raise exception 'meal request is already closed' using errcode = '23514';
  end if;
  if v_request.status = 'CLOSED'
    or (v_request.status = 'SELF_SERVICE' and p_status <> 'SELF_SERVICE') then
    raise exception 'meal request can no longer be changed'
      using errcode = '23514';
  end if;
  if p_status = 'OPEN' and (p_deadline_at is null or p_deadline_at <= now()) then
    raise exception 'open meal request requires a future deadline'
      using errcode = '22023';
  end if;

  if p_status = 'SELF_SERVICE' then
    delete from public.meal_responses where meal_request_id = p_request_id;
    delete from public.meal_request_options where meal_request_id = p_request_id;
  end if;

  update public.meal_requests as request
  set
    status = p_status,
    mode = case when p_status = 'SELF_SERVICE' then null else request.mode end,
    deadline_at = case when p_status = 'SELF_SERVICE' then null else p_deadline_at end,
    parent_message = v_message
  where request.id = p_request_id
  returning request.* into v_request;

  if p_status in ('OPEN', 'SELF_SERVICE') then
    perform public.sync_meal_request_notifications(v_request.id);
  end if;
  return v_request.id;
end;
$$;

create function public.change_self_service_meal_request(
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
  if v_request.status <> 'SELF_SERVICE' then
    raise exception 'meal request is not self-service' using errcode = '23514';
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

create or replace function public.confirm_breakfast_purchase(
  p_actor_member_id uuid,
  p_breakfast_date date,
  p_message text default null
)
returns table (
  id uuid,
  breakfast_date date,
  confirmed_by_member_id uuid,
  confirmed_by_display_name text,
  message text,
  purchased_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_message text;
  v_purchase public.breakfast_purchases%rowtype;
begin
  if not exists (
    select 1 from public.family_members as member
    where member.id = p_actor_member_id
      and member.role = 'PARENT'
      and member.is_active
  ) then
    raise exception 'breakfast purchase requires an active parent'
      using errcode = '42501';
  end if;

  v_message := nullif(btrim(p_message), '');
  if v_message is not null and char_length(v_message) > 300 then
    raise exception 'breakfast purchase message is too long'
      using errcode = '22001';
  end if;

  insert into public.breakfast_purchases as purchase (
    breakfast_date, confirmed_by_member_id, message
  ) values (p_breakfast_date, p_actor_member_id, v_message)
  on conflict on constraint breakfast_purchases_breakfast_date_key
  do update set
    confirmed_by_member_id = excluded.confirmed_by_member_id,
    message = excluded.message
  returning purchase.* into v_purchase;

  insert into public.notifications (
    recipient_member_id, type, title, message,
    related_resource_type, related_resource_id, related_date
  )
  select
    member.id,
    'BREAKFAST_PURCHASED',
    'Đã mua bữa sáng',
    coalesce(v_message, 'Mẹ đã mua bữa sáng rồi nhé.'),
    'BREAKFAST_PURCHASE',
    v_purchase.id,
    v_purchase.breakfast_date
  from public.family_members as member
  where member.is_active and member.role in ('ADMIN', 'MEMBER')
  on conflict on constraint notifications_recipient_event_key
  do update set
    title = excluded.title,
    message = excluded.message,
    related_date = excluded.related_date;

  return query
  select
    v_purchase.id, v_purchase.breakfast_date,
    v_purchase.confirmed_by_member_id, member.display_name,
    v_purchase.message, v_purchase.purchased_at,
    v_purchase.created_at, v_purchase.updated_at
  from public.family_members as member
  where member.id = v_purchase.confirmed_by_member_id;
end;
$$;

do $$
declare
  v_request_id uuid;
begin
  for v_request_id in
    select request.id from public.meal_requests as request
  loop
    perform public.sync_meal_request_notifications(v_request_id);
  end loop;
end;
$$;

revoke all privileges on function public.sync_meal_request_notifications(uuid)
from public, anon, authenticated;
revoke all privileges on function public.change_self_service_meal_request(
  uuid, uuid, text, timestamptz, text, text[]
) from public, anon, authenticated;
revoke all privileges on function public.create_meal_request(
  uuid, date, text, text, timestamptz, text, text[]
) from public, anon, authenticated;
revoke all privileges on function public.update_meal_request(
  uuid, uuid, text, timestamptz, text
) from public, anon, authenticated;
revoke all privileges on function public.confirm_breakfast_purchase(
  uuid, date, text
) from public, anon, authenticated;

grant execute on function public.sync_meal_request_notifications(uuid)
to service_role;
grant execute on function public.change_self_service_meal_request(
  uuid, uuid, text, timestamptz, text, text[]
) to service_role;
grant execute on function public.create_meal_request(
  uuid, date, text, text, timestamptz, text, text[]
) to service_role;
grant execute on function public.update_meal_request(
  uuid, uuid, text, timestamptz, text
) to service_role;
grant execute on function public.confirm_breakfast_purchase(
  uuid, date, text
) to service_role;
