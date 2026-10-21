create table public.meal_requests (
  id uuid primary key default gen_random_uuid(),
  meal_date date not null,
  meal_type text not null,
  mode text,
  status text not null,
  deadline_at timestamptz,
  parent_message text,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_requests_slot_key unique (meal_date, meal_type),
  constraint meal_requests_created_by_member_id_fkey
    foreign key (created_by_member_id)
    references public.family_members (id)
    on delete restrict,
  constraint meal_requests_meal_type_valid check (
    meal_type in ('LUNCH', 'DINNER')
  ),
  constraint meal_requests_state_valid check (
    (
      status in ('OPEN', 'CLOSED')
      and mode in ('OPEN_CHOICE', 'OPTION_POLL')
      and deadline_at is not null
    )
    or (
      status = 'SELF_SERVICE'
      and mode is null
      and deadline_at is null
    )
  ),
  constraint meal_requests_parent_message_valid check (
    parent_message is null
    or (
      parent_message = btrim(parent_message)
      and char_length(parent_message) between 1 and 300
    )
  )
);

create table public.meal_request_options (
  id uuid primary key default gen_random_uuid(),
  meal_request_id uuid not null,
  label text not null,
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  constraint meal_request_options_meal_request_id_fkey
    foreign key (meal_request_id)
    references public.meal_requests (id)
    on delete cascade,
  constraint meal_request_options_label_valid check (
    label = btrim(label)
    and char_length(label) between 1 and 120
  ),
  constraint meal_request_options_sort_order_valid check (
    sort_order between 1 and 5
  ),
  constraint meal_request_options_request_order_key
    unique (meal_request_id, sort_order),
  constraint meal_request_options_id_request_key
    unique (id, meal_request_id)
);

create unique index meal_request_options_request_label_key
on public.meal_request_options (meal_request_id, lower(label));

create table public.meal_responses (
  id uuid primary key default gen_random_uuid(),
  meal_request_id uuid not null,
  member_id uuid not null,
  response_type text not null,
  option_id uuid,
  custom_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_responses_meal_request_id_fkey
    foreign key (meal_request_id)
    references public.meal_requests (id)
    on delete cascade,
  constraint meal_responses_member_id_fkey
    foreign key (member_id)
    references public.family_members (id)
    on delete cascade,
  constraint meal_responses_option_request_fkey
    foreign key (option_id, meal_request_id)
    references public.meal_request_options (id, meal_request_id)
    on delete restrict,
  constraint meal_responses_member_request_key
    unique (meal_request_id, member_id),
  constraint meal_responses_shape_valid check (
    (
      response_type = 'SELECTED_OPTION'
      and option_id is not null
      and custom_text is null
    )
    or (
      response_type = 'CUSTOM'
      and option_id is null
      and custom_text is not null
      and custom_text = btrim(custom_text)
      and char_length(custom_text) between 1 and 120
    )
    or (
      response_type = 'NOT_EATING'
      and option_id is null
      and custom_text is null
    )
  )
);

create index meal_requests_current_idx
on public.meal_requests (meal_date, meal_type);

create index meal_responses_request_idx
on public.meal_responses (meal_request_id, member_id);

create trigger meal_requests_set_updated_at
before update on public.meal_requests
for each row execute function public.set_updated_at();

create trigger meal_responses_set_updated_at
before update on public.meal_responses
for each row execute function public.set_updated_at();

create function public.validate_meal_response()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.meal_requests%rowtype;
begin
  select request.*
  into v_request
  from public.meal_requests as request
  where request.id = new.meal_request_id;

  if not found then
    raise exception 'meal request does not exist'
      using errcode = '23503';
  end if;

  if v_request.status <> 'OPEN' or v_request.deadline_at <= now() then
    raise exception 'meal request is closed'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.family_members as member
    where member.id = new.member_id
      and member.is_active
      and member.role in ('ADMIN', 'MEMBER')
  ) then
    raise exception 'meal response requires an active non-parent member'
      using errcode = '23514';
  end if;

  if v_request.mode = 'OPEN_CHOICE'
    and new.response_type not in ('CUSTOM', 'NOT_EATING') then
    raise exception 'open choice requires custom or not-eating response'
      using errcode = '23514';
  end if;

  if v_request.mode = 'OPTION_POLL'
    and new.response_type not in ('SELECTED_OPTION', 'NOT_EATING') then
    raise exception 'option poll requires selected-option or not-eating response'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger meal_responses_validate
before insert or update on public.meal_responses
for each row execute function public.validate_meal_response();

alter table public.meal_requests enable row level security;
alter table public.meal_request_options enable row level security;
alter table public.meal_responses enable row level security;

revoke all privileges on table public.meal_requests
from public, anon, authenticated;
revoke all privileges on table public.meal_request_options
from public, anon, authenticated;
revoke all privileges on table public.meal_responses
from public, anon, authenticated;

grant select, insert, update, delete on table public.meal_requests
to service_role;
grant select, insert, update, delete on table public.meal_request_options
to service_role;
grant select, insert, update, delete on table public.meal_responses
to service_role;

create function public.create_meal_request(
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
    meal_date,
    meal_type,
    mode,
    status,
    deadline_at,
    parent_message,
    created_by_member_id
  ) values (
    p_meal_date,
    p_meal_type,
    v_stored_mode,
    v_status,
    case when v_status = 'SELF_SERVICE' then null else p_deadline_at end,
    v_message,
    p_actor_member_id
  )
  on conflict on constraint meal_requests_slot_key do nothing
  returning * into v_request;

  if found then
    insert into public.meal_request_options (
      meal_request_id,
      label,
      sort_order
    )
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
    case when v_status = 'SELF_SERVICE'
      then 'MEAL_SELF_SERVICE'
      else 'MEAL_REQUEST_CREATED'
    end,
    case
      when v_status = 'SELF_SERVICE' then initcap(lower(p_meal_type)) || ' is self-service'
      else initcap(lower(p_meal_type)) || ' choice needed'
    end,
    coalesce(
      v_message,
      case
        when v_status = 'SELF_SERVICE'
          then initcap(lower(p_meal_type)) || ' is self-service today.'
        else 'Please choose ' || lower(p_meal_type) || ' before '
          || to_char(p_deadline_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI') || '.'
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

  return v_request.id;
end;
$$;

create function public.update_meal_request(
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

  update public.meal_requests as request
  set
    status = p_status,
    mode = case when p_status = 'SELF_SERVICE' then null else request.mode end,
    deadline_at = case when p_status = 'SELF_SERVICE' then null else p_deadline_at end,
    parent_message = v_message
  where request.id = p_request_id
  returning request.* into v_request;

  if p_status in ('OPEN', 'SELF_SERVICE') then
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
      case when p_status = 'SELF_SERVICE'
        then 'MEAL_SELF_SERVICE'
        else 'MEAL_REQUEST_CREATED'
      end,
      case
        when p_status = 'SELF_SERVICE'
          then initcap(lower(v_request.meal_type)) || ' is self-service'
        else initcap(lower(v_request.meal_type)) || ' choice needed'
      end,
      coalesce(
        v_message,
        case
          when p_status = 'SELF_SERVICE'
            then initcap(lower(v_request.meal_type)) || ' is self-service today.'
          else 'Please choose ' || lower(v_request.meal_type) || ' before '
            || to_char(p_deadline_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI') || '.'
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
  end if;

  return v_request.id;
end;
$$;

create function public.save_meal_response(
  p_actor_member_id uuid,
  p_request_id uuid,
  p_response_type text,
  p_option_id uuid default null,
  p_custom_text text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_response_id uuid;
  v_custom_text text := nullif(btrim(p_custom_text), '');
begin
  insert into public.meal_responses as response (
    meal_request_id,
    member_id,
    response_type,
    option_id,
    custom_text
  ) values (
    p_request_id,
    p_actor_member_id,
    p_response_type,
    p_option_id,
    v_custom_text
  )
  on conflict on constraint meal_responses_member_request_key
  do update set
    response_type = excluded.response_type,
    option_id = excluded.option_id,
    custom_text = excluded.custom_text
  returning response.id into v_response_id;

  return v_response_id;
end;
$$;

revoke all privileges on function public.validate_meal_response()
from public, anon, authenticated;
revoke all privileges on function public.create_meal_request(
  uuid, date, text, text, timestamptz, text, text[]
) from public, anon, authenticated;
revoke all privileges on function public.update_meal_request(
  uuid, uuid, text, timestamptz, text
) from public, anon, authenticated;
revoke all privileges on function public.save_meal_response(
  uuid, uuid, text, uuid, text
) from public, anon, authenticated;

grant execute on function public.create_meal_request(
  uuid, date, text, text, timestamptz, text, text[]
) to service_role;
grant execute on function public.update_meal_request(
  uuid, uuid, text, timestamptz, text
) to service_role;
grant execute on function public.save_meal_response(
  uuid, uuid, text, uuid, text
) to service_role;
