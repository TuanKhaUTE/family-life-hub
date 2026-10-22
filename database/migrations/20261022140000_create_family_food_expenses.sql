-- Shared food costs are deliberately separate from owner-only personal_expenses.
create table public.family_food_expenses (
  id uuid primary key default gen_random_uuid(),
  meal_date date not null check (meal_date between date '2000-01-01' and date '2199-12-31'),
  meal_type text not null check (meal_type in ('BREAKFAST','DINNER')),
  note text check (note is null or (note = btrim(note,E' \t\n\r\f'||chr(11)) and char_length(note) between 1 and 1000)),
  created_by_member_id uuid not null references public.family_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_date,meal_type)
);
create table public.family_food_expense_items (
  id uuid primary key default gen_random_uuid(),
  food_expense_id uuid not null references public.family_food_expenses(id) on delete cascade,
  name text not null check (name=btrim(name,E' \t\n\r\f'||chr(11)) and char_length(name) between 1 and 120),
  amount bigint not null check (amount between 1 and 1000000000),
  sort_order integer not null check (sort_order between 0 and 29),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (food_expense_id,sort_order)
);
create index family_food_expenses_date on public.family_food_expenses(meal_date desc,id desc);
create trigger family_food_expenses_updated before update on public.family_food_expenses for each row execute function public.set_updated_at();
create trigger family_food_items_updated before update on public.family_food_expense_items for each row execute function public.set_updated_at();
alter table public.family_food_expenses enable row level security;
alter table public.family_food_expense_items enable row level security;
revoke all privileges on public.family_food_expenses,public.family_food_expense_items from public,anon,authenticated;
grant select,insert,update,delete on public.family_food_expenses,public.family_food_expense_items to service_role;

create function public.family_food_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.id<>old.id or new.created_by_member_id<>old.created_by_member_id) then
    raise exception 'immutable food expense identity' using errcode='42501';
  end if;
  perform 1 from public.family_members where id=new.created_by_member_id and is_active and role='PARENT' for share;
  if not found then raise exception 'active parent required' using errcode='42501'; end if;
  if new.meal_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'future food expense' using errcode='22023'; end if;
  return new;
end $$;
create trigger family_food_guard before insert or update on public.family_food_expenses for each row execute function public.family_food_guard();

-- Deferred checks allow atomic item replacement, but never a committed empty meal.
create function public.family_food_require_items() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target uuid;
begin
  if tg_table_name='family_food_expenses' then target:=new.id;
  elsif tg_op='DELETE' then target:=old.food_expense_id;
  else target:=old.food_expense_id;
  end if;
  if exists(select 1 from public.family_food_expenses where id=target)
    and not exists(select 1 from public.family_food_expense_items where food_expense_id=target) then
    raise exception 'food expense needs at least one item' using errcode='23514';
  end if;
  return null;
end $$;
create constraint trigger family_food_has_items after insert or update on public.family_food_expenses
  deferrable initially deferred for each row execute function public.family_food_require_items();
create constraint trigger family_food_keeps_items after delete or update on public.family_food_expense_items
  deferrable initially deferred for each row execute function public.family_food_require_items();

create function public.family_food_mutate(p_actor_member_id uuid,p_id uuid,p_input jsonb,p_remove boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare target uuid; item jsonb; position integer:=0;
begin
  perform 1 from public.family_members where id=p_actor_member_id and is_active and role='PARENT' for share;
  if not found then raise exception 'parent food management required' using errcode='42501'; end if;
  if p_remove is null then raise exception 'invalid food action' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('family-food',0));
  if p_id is not null then
    perform 1 from public.family_food_expenses where id=p_id for update;
    if not found then raise exception 'food expense not found' using errcode='P0002'; end if;
  end if;
  if p_remove then
    if p_id is null then raise exception 'food identity required' using errcode='22023'; end if;
    delete from public.family_food_expenses where id=p_id; return;
  end if;
  if jsonb_typeof(p_input) is distinct from 'object' or jsonb_typeof(p_input->'items') is distinct from 'array' then
    raise exception 'invalid food input' using errcode='22023';
  end if;
  if jsonb_array_length(p_input->'items') not between 1 and 30 then raise exception 'invalid food item count' using errcode='22023'; end if;
  if p_id is null then
    insert into public.family_food_expenses(meal_date,meal_type,note,created_by_member_id)
      values((p_input->>'mealDate')::date,p_input->>'mealType',p_input->>'note',p_actor_member_id) returning id into target;
  else
    target:=p_id;
    update public.family_food_expenses set meal_date=(p_input->>'mealDate')::date,meal_type=p_input->>'mealType',note=p_input->>'note' where id=target;
    delete from public.family_food_expense_items where food_expense_id=target;
  end if;
  for item in select value from jsonb_array_elements(p_input->'items') loop
    if jsonb_typeof(item->'amount') is distinct from 'string' or (item->>'amount') !~ '^[1-9][0-9]{0,9}$' then
      raise exception 'invalid food amount' using errcode='22023';
    end if;
    insert into public.family_food_expense_items(food_expense_id,name,amount,sort_order)
      values(target,item->>'name',(item->>'amount')::bigint,position);
    position:=position+1;
  end loop;
end $$;

create function public.family_food_slot(p_actor_member_id uuid,p_date date,p_type text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in ('PARENT','ADMIN','MEMBER')) then raise exception 'active family reader required' using errcode='42501'; end if;
  if p_date is null or p_date not between date '2000-01-01' and date '2199-12-31' or p_type is null or p_type not in ('BREAKFAST','DINNER') then raise exception 'invalid food slot' using errcode='22023'; end if;
  return (select jsonb_build_object('id',e.id,'mealDate',e.meal_date,'mealType',e.meal_type,'note',e.note,
    'items',(select jsonb_agg(jsonb_build_object('name',i.name,'amount',i.amount::text) order by i.sort_order) from public.family_food_expense_items i where i.food_expense_id=e.id),
    'total',(select sum(i.amount)::text from public.family_food_expense_items i where i.food_expense_id=e.id))
    from public.family_food_expenses e where e.meal_date=p_date and e.meal_type=p_type);
end $$;
create function public.family_food_read(p_actor_member_id uuid,p_month date,p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in ('PARENT','ADMIN','MEMBER')) then raise exception 'active family reader required' using errcode='42501'; end if;
  if p_month is null or p_month not between date '2000-01-01' and date '2199-12-01' or extract(day from p_month)<>1 or p_page is null or p_page not between 1 and 100000 then raise exception 'invalid food month/page' using errcode='22023'; end if;
  return (with totals as (
    select e.meal_date,e.meal_type,i.amount from public.family_food_expenses e join public.family_food_expense_items i on i.food_expense_id=e.id
    where e.meal_date>=p_month-interval '1 month' and e.meal_date<p_month+interval '1 month'
  ) select jsonb_build_object(
    'currentTotal',coalesce(sum(amount) filter(where meal_date>=p_month),0)::text,
    'previousTotal',coalesce(sum(amount) filter(where meal_date<p_month),0)::text,
    'breakfastTotal',coalesce(sum(amount) filter(where meal_date>=p_month and meal_type='BREAKFAST'),0)::text,
    'dinnerTotal',coalesce(sum(amount) filter(where meal_date>=p_month and meal_type='DINNER'),0)::text,
    'totalCount',(select count(*) from public.family_food_expenses where meal_date>=p_month and meal_date<p_month+interval '1 month'),
    'expenses',(select coalesce(jsonb_agg(public.family_food_slot(p_actor_member_id,e.meal_date,e.meal_type) order by e.meal_date desc,e.id desc),'[]'::jsonb)
      from (select id,meal_date,meal_type from public.family_food_expenses where meal_date>=p_month and meal_date<p_month+interval '1 month' order by meal_date desc,id desc limit 20 offset((p_page-1)*20)) e)
  ) from totals);
end $$;
revoke all privileges on function public.family_food_guard(),public.family_food_require_items(),public.family_food_mutate(uuid,uuid,jsonb,boolean),public.family_food_slot(uuid,date,text),public.family_food_read(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.family_food_guard(),public.family_food_require_items(),public.family_food_mutate(uuid,uuid,jsonb,boolean),public.family_food_slot(uuid,date,text),public.family_food_read(uuid,date,integer) to service_role;
