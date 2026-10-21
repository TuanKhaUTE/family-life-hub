alter table public.meal_requests
  add constraint meal_requests_id_slot_key unique (id, meal_date, meal_type);

create table public.final_meals (
  id uuid primary key default gen_random_uuid(),
  meal_date date not null,
  meal_type text not null check (meal_type in ('LUNCH', 'DINNER')),
  meal_request_id uuid,
  finalized_by_member_id uuid not null references public.family_members(id) on delete restrict,
  ready_at timestamptz,
  ready_message text check (
    ready_message is null or
    (ready_message = btrim(ready_message) and char_length(ready_message) between 1 and 300)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint final_meals_slot_key unique (meal_date, meal_type),
  constraint final_meals_request_slot_fkey
    foreign key (meal_request_id, meal_date, meal_type)
    references public.meal_requests(id, meal_date, meal_type) on delete restrict,
  constraint final_meals_ready_message_state check (ready_at is not null or ready_message is null)
);

create table public.final_meal_dishes (
  id uuid primary key default gen_random_uuid(),
  final_meal_id uuid not null references public.final_meals(id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  category text not null check (category in ('MAIN', 'SOUP', 'SIDE', 'VEGETABLE', 'OTHER')),
  sort_order smallint not null check (sort_order between 0 and 29),
  constraint final_meal_dishes_order_key unique (final_meal_id, sort_order)
);

create trigger final_meals_set_updated_at before update on public.final_meals
for each row execute function public.set_updated_at();

-- Serialize cooked/self-service changes for the same slot, including a slot
-- that does not yet have a request or final meal row to lock.
create function public.guard_final_meal_slot()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.meal_date::text || ':' || new.meal_type, 0)
  );
  if tg_table_name = 'meal_requests' then
    if new.status = 'SELF_SERVICE' and exists (
      select 1 from public.final_meals as meal
      where meal.meal_date = new.meal_date and meal.meal_type = new.meal_type
    ) then
      raise exception 'cooked meal already exists for slot' using errcode = 'P2001';
    end if;
  else
    if exists (
      select 1 from public.meal_requests as request
      where request.meal_date = new.meal_date and request.meal_type = new.meal_type
        and request.status = 'SELF_SERVICE'
    ) then
      raise exception 'change self-service plan before finalizing' using errcode = 'P2001';
    end if;
  end if;
  return new;
end;
$$;

create trigger final_meals_guard_slot before insert or update on public.final_meals
for each row execute function public.guard_final_meal_slot();
create trigger meal_requests_guard_final_meal before insert or update on public.meal_requests
for each row execute function public.guard_final_meal_slot();

-- A committed final meal must always have dishes. Defer until transaction end
-- so replacing the complete list can delete old rows before inserting new ones.
create function public.require_final_meal_dishes()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if tg_table_name = 'final_meals' then
    v_id := new.id;
  else
    v_id := old.final_meal_id;
  end if;
  if exists (select 1 from public.final_meals where id = v_id)
    and not exists (select 1 from public.final_meal_dishes where final_meal_id = v_id) then
    raise exception 'final meal requires at least one dish' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger final_meals_require_dishes
after insert or update on public.final_meals deferrable initially deferred
for each row execute function public.require_final_meal_dishes();
create constraint trigger final_meal_dishes_require_remaining
after delete or update on public.final_meal_dishes deferrable initially deferred
for each row execute function public.require_final_meal_dishes();

alter table public.final_meals enable row level security;
alter table public.final_meal_dishes enable row level security;
revoke all privileges on public.final_meals, public.final_meal_dishes from public, anon, authenticated;
grant select, insert, update, delete on public.final_meals, public.final_meal_dishes to service_role;

create function public.read_final_meal(p_meal_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select to_jsonb(meal) || jsonb_build_object('final_meal_dishes', (
    select coalesce(jsonb_agg(to_jsonb(dish) order by dish.sort_order), '[]'::jsonb)
    from public.final_meal_dishes as dish where dish.final_meal_id = meal.id
  ))
  from public.final_meals as meal where meal.id = p_meal_id;
$$;

create function public.save_final_meal(
  p_actor_member_id uuid,
  p_meal_date date,
  p_meal_type text,
  p_meal_request_id uuid,
  p_dishes jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.family_members
    where id = p_actor_member_id and role = 'PARENT' and is_active
  ) then
    raise exception 'active parent required' using errcode = '42501';
  end if;
  if p_meal_date is null or p_meal_type is null or p_meal_type not in ('LUNCH', 'DINNER')
    or p_dishes is null or jsonb_typeof(p_dishes) <> 'array' then
    raise exception 'invalid final meal input' using errcode = '22023';
  end if;
  if jsonb_array_length(p_dishes) not between 1 and 30 then
    raise exception 'one to thirty dishes required' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_dishes) with ordinality as item(dish, position)
    where jsonb_typeof(item.dish) <> 'object'
      or jsonb_typeof(item.dish -> 'name') is distinct from 'string'
      or char_length(btrim(item.dish ->> 'name')) not between 1 and 120
      or item.dish ->> 'category' is null
      or item.dish ->> 'category' not in ('MAIN', 'SOUP', 'SIDE', 'VEGETABLE', 'OTHER')
      or item.dish -> 'sort_order' is distinct from to_jsonb(item.position - 1)
  ) then
    raise exception 'invalid final meal dishes' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_meal_date::text || ':' || p_meal_type, 0)
  );
  insert into public.final_meals as meal (
    meal_date, meal_type, meal_request_id, finalized_by_member_id
  ) values (p_meal_date, p_meal_type, p_meal_request_id, p_actor_member_id)
  on conflict on constraint final_meals_slot_key do update set
    meal_request_id = excluded.meal_request_id,
    finalized_by_member_id = excluded.finalized_by_member_id
  returning meal.id into v_id;

  delete from public.final_meal_dishes where final_meal_id = v_id;
  insert into public.final_meal_dishes (final_meal_id, name, category, sort_order)
  select v_id, btrim(item ->> 'name'), item ->> 'category', (item ->> 'sort_order')::smallint
  from jsonb_array_elements(p_dishes) as item;
  return public.read_final_meal(v_id);
end;
$$;

create function public.mark_final_meal_ready(
  p_actor_member_id uuid,
  p_meal_date date,
  p_meal_type text,
  p_ready_message text default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_meal public.final_meals%rowtype;
  v_message text := nullif(btrim(p_ready_message), '');
  v_label text;
begin
  if not exists (
    select 1 from public.family_members
    where id = p_actor_member_id and role = 'PARENT' and is_active
  ) then
    raise exception 'active parent required' using errcode = '42501';
  end if;
  if v_message is not null and char_length(v_message) > 300 then
    raise exception 'ready message too long' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_meal_date::text || ':' || p_meal_type, 0)
  );
  update public.final_meals as meal
  set ready_at = coalesce(meal.ready_at, now()), ready_message = v_message
  where meal.meal_date = p_meal_date and meal.meal_type = p_meal_type
  returning meal.* into v_meal;
  if not found then
    raise exception 'save final meal before marking ready' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.final_meal_dishes where final_meal_id = v_meal.id) then
    raise exception 'final meal requires dishes' using errcode = '23514';
  end if;
  v_label := case p_meal_type when 'LUNCH' then 'Bữa trưa' else 'Bữa tối' end;
  insert into public.notifications (
    recipient_member_id, type, title, message,
    related_resource_type, related_resource_id, related_date
  )
  select member.id, 'MEAL_READY', v_label || ' đã sẵn sàng ✓',
    coalesce(v_message, 'Cả nhà cùng ăn cơm nhé!'), 'FINAL_MEAL', v_meal.id, v_meal.meal_date
  from public.family_members as member
  where member.is_active and member.role in ('ADMIN', 'MEMBER')
  on conflict on constraint notifications_recipient_event_key do update set
    title = excluded.title, message = excluded.message, related_date = excluded.related_date;
  return public.read_final_meal(v_meal.id);
end;
$$;

revoke all privileges on function public.guard_final_meal_slot() from public, anon, authenticated;
revoke all privileges on function public.require_final_meal_dishes() from public, anon, authenticated;
revoke all privileges on function public.read_final_meal(uuid) from public, anon, authenticated;
revoke all privileges on function public.save_final_meal(uuid,date,text,uuid,jsonb) from public, anon, authenticated;
revoke all privileges on function public.mark_final_meal_ready(uuid,date,text,text) from public, anon, authenticated;
grant execute on function public.guard_final_meal_slot(), public.require_final_meal_dishes(), public.read_final_meal(uuid),
  public.save_final_meal(uuid,date,text,uuid,jsonb), public.mark_final_meal_ready(uuid,date,text,text) to service_role;
