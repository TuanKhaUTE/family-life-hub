-- Swapping two retained dishes must not conflict with their intermediate order.
alter table public.final_meal_dishes drop constraint final_meal_dishes_order_key;
alter table public.final_meal_dishes add constraint final_meal_dishes_order_key
  unique (final_meal_id, sort_order) deferrable initially immediate;

create or replace function public.save_final_meal(
  p_actor_member_id uuid,
  p_meal_date date,
  p_meal_type text,
  p_meal_request_id uuid,
  p_dishes jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_item jsonb;
  v_position bigint;
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
  for v_item, v_position in select item, position from jsonb_array_elements(p_dishes) with ordinality as entry(item, position) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid dish object' using errcode = '22023';
    end if;
    if v_item - array['id','name','category','sort_order'] <> '{}'::jsonb
      or jsonb_typeof(v_item -> 'name') is distinct from 'string'
      or char_length(btrim(v_item ->> 'name')) not between 1 and 120
      or v_item ->> 'category' is null
      or v_item ->> 'category' not in ('MAIN','SOUP','SIDE','VEGETABLE','OTHER')
      or v_item -> 'sort_order' is distinct from to_jsonb(v_position - 1) then
      raise exception 'invalid final meal dishes' using errcode = '22023';
    end if;
    if v_item ? 'id' and (jsonb_typeof(v_item -> 'id') is distinct from 'string'
      or (v_item ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
      raise exception 'invalid dish identity' using errcode = '22023';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(p_dishes) as item where item ? 'id'
    group by (item ->> 'id')::uuid having count(*) > 1
  ) then
    raise exception 'duplicate dish identity' using errcode = '22023';
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

  -- Validate identity ownership before deleting, updating, or inserting any dish.
  if exists (
    select 1 from jsonb_array_elements(p_dishes) as item where item ? 'id'
    and not exists (select 1 from public.final_meal_dishes
      where id = (item ->> 'id')::uuid and final_meal_id = v_id)
  ) then
    raise exception 'dish does not belong to this final meal' using errcode = '22023';
  end if;
  set constraints public.final_meal_dishes_order_key deferred;
  delete from public.final_meal_dishes as dish where dish.final_meal_id = v_id
    and not exists (select 1 from jsonb_array_elements(p_dishes) as item
      where item ? 'id' and (item ->> 'id')::uuid = dish.id);
  update public.final_meal_dishes as dish set
    name = btrim(item ->> 'name'), category = item ->> 'category',
    sort_order = (item ->> 'sort_order')::smallint
  from jsonb_array_elements(p_dishes) as item
  where item ? 'id' and dish.id = (item ->> 'id')::uuid and dish.final_meal_id = v_id;
  insert into public.final_meal_dishes (final_meal_id, name, category, sort_order)
  select v_id, btrim(item ->> 'name'), item ->> 'category', (item ->> 'sort_order')::smallint
  from jsonb_array_elements(p_dishes) as item where not (item ? 'id');
  set constraints public.final_meal_dishes_order_key immediate;
  return public.read_final_meal(v_id);
end;
$$;

revoke all privileges on function public.save_final_meal(uuid,date,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_final_meal(uuid,date,text,uuid,jsonb) to service_role;
