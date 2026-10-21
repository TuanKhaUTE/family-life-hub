-- The parent may adjust preparation, but served dishes must remain stable for
-- ratings. Row locks serialize these checks with mark-ready and meal saves.
create function public.guard_ready_meal_composition()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_meal_id uuid;
  v_ready timestamptz;
begin
  if tg_table_name = 'final_meals' then
    if old.ready_at is not null and (
      new.ready_at is distinct from old.ready_at
      or new.meal_date is distinct from old.meal_date
      or new.meal_type is distinct from old.meal_type
    ) then
      raise exception 'ready meal is locked' using errcode = 'P2003';
    end if;
    return new;
  end if;
  if tg_op in ('UPDATE','DELETE') then
    v_meal_id := old.final_meal_id;
    select ready_at into v_ready from public.final_meals where id=v_meal_id for update;
    if v_ready is not null then raise exception 'ready dishes are locked' using errcode='P2003'; end if;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    select ready_at into v_ready from public.final_meals where id=new.final_meal_id for update;
    if v_ready is not null then raise exception 'ready dishes are locked' using errcode='P2003'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger final_meal_dishes_lock_ready before insert or update or delete on public.final_meal_dishes
for each row execute function public.guard_ready_meal_composition();
create trigger final_meals_keep_ready before update on public.final_meals
for each row execute function public.guard_ready_meal_composition();
revoke all privileges on function public.guard_ready_meal_composition() from public, anon, authenticated;
grant execute on function public.guard_ready_meal_composition() to service_role;

-- Preserve the existing seven-argument RPC. This explicit overload lets a
-- parent confirm discarding incompatible historical responses on slot reuse.
create function public.create_meal_request(
  p_actor_member_id uuid, p_meal_date date, p_meal_type text, p_mode text,
  p_deadline_at timestamptz, p_parent_message text, p_options text[],
  p_confirm_response_reset boolean
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_request public.meal_requests%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_meal_date::text || ':' || p_meal_type,0));
  select * into v_request from public.meal_requests where meal_date=p_meal_date and meal_type=p_meal_type for update;
  if found and v_request.status='CANCELLED' and p_confirm_response_reset then
    return public.configure_meal_request(p_actor_member_id,v_request.id,
      case when p_mode='SELF_SERVICE' then 'SELF_SERVICE' else 'OPEN' end,
      p_mode,p_deadline_at,p_parent_message,p_options,true);
  end if;
  return public.create_meal_request(p_actor_member_id,p_meal_date,p_meal_type,p_mode,p_deadline_at,p_parent_message,p_options);
end;
$$;
revoke all privileges on function public.create_meal_request(uuid,date,text,text,timestamptz,text,text[],boolean) from public,anon,authenticated;
grant execute on function public.create_meal_request(uuid,date,text,text,timestamptz,text,text[],boolean) to service_role;
