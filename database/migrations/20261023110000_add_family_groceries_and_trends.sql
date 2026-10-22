-- Add shared groceries without changing existing breakfast/dinner records.
alter table public.family_food_expenses add column category text;
update public.family_food_expenses set category=meal_type where category is null;
alter table public.family_food_expenses alter column category set not null;
alter table public.family_food_expenses alter column meal_type drop not null;
alter table public.family_food_expenses drop constraint if exists family_food_expenses_meal_type_check;
alter table public.family_food_expenses drop constraint if exists family_food_expenses_meal_date_meal_type_key;
alter table public.family_food_expenses add constraint family_food_expenses_category_check
  check (category in ('BREAKFAST','DINNER','GROCERIES'));
alter table public.family_food_expenses add constraint family_food_expenses_category_shape_check
  check ((category in ('BREAKFAST','DINNER') and meal_type=category) or (category='GROCERIES' and meal_type is null));
create unique index family_food_expenses_meal_slot_key
  on public.family_food_expenses(meal_date,meal_type) where meal_type is not null;

create or replace function public.family_food_guard() returns trigger
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

create or replace function public.family_food_mutate(p_actor_member_id uuid,p_id uuid,p_input jsonb,p_remove boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare target uuid; item jsonb; position integer:=0; new_category text; new_meal_type text; amount bigint;
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
  if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'invalid food input' using errcode='22023'; end if;
  new_category:=coalesce(p_input->>'category',p_input->>'mealType');
  if new_category not in ('BREAKFAST','DINNER','GROCERIES') then raise exception 'invalid food category' using errcode='22023'; end if;
  new_meal_type:=case when new_category='GROCERIES' then null else new_category end;
  if new_category='GROCERIES' then
    if (p_input->>'amount') !~ '^[1-9][0-9]{0,9}$' then raise exception 'invalid grocery amount' using errcode='22023'; end if;
    amount:=(p_input->>'amount')::bigint;
  elsif jsonb_typeof(p_input->'items') is distinct from 'array' or jsonb_array_length(p_input->'items') not between 1 and 30 then
    raise exception 'invalid food item count' using errcode='22023';
  end if;
  if p_id is null then
    insert into public.family_food_expenses(meal_date,meal_type,category,note,created_by_member_id)
      values((p_input->>'mealDate')::date,new_meal_type,new_category,p_input->>'note',p_actor_member_id) returning id into target;
  else
    target:=p_id;
    update public.family_food_expenses set meal_date=(p_input->>'mealDate')::date,meal_type=new_meal_type,category=new_category,note=p_input->>'note' where id=target;
    delete from public.family_food_expense_items where food_expense_id=target;
  end if;
  if new_category='GROCERIES' then
    insert into public.family_food_expense_items(food_expense_id,name,amount,sort_order)
      values(target,'Đi chợ / nguyên liệu',amount,0);
    return;
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

create or replace function public.family_food_slot(p_actor_member_id uuid,p_date date,p_type text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in ('PARENT','ADMIN','MEMBER')) then raise exception 'active family reader required' using errcode='42501'; end if;
  if p_date is null or p_date not between date '2000-01-01' and date '2199-12-31' or p_type is null or p_type not in ('BREAKFAST','DINNER','GROCERIES') then raise exception 'invalid food slot' using errcode='22023'; end if;
  return (select jsonb_build_object('id',e.id,'mealDate',e.meal_date,'mealType',e.meal_type,'category',e.category,'note',e.note,
    'amount',case when e.category='GROCERIES' then (select sum(i.amount)::text from public.family_food_expense_items i where i.food_expense_id=e.id) else null end,
    'items',(select jsonb_agg(jsonb_build_object('name',i.name,'amount',i.amount::text) order by i.sort_order) from public.family_food_expense_items i where i.food_expense_id=e.id),
    'total',(select sum(i.amount)::text from public.family_food_expense_items i where i.food_expense_id=e.id))
    from public.family_food_expenses e where e.meal_date=p_date and e.category=p_type);
end $$;

create or replace function public.family_food_read(p_actor_member_id uuid,p_month date,p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.family_members where id=p_actor_member_id and is_active and role in ('PARENT','ADMIN','MEMBER')) then raise exception 'active family reader required' using errcode='42501'; end if;
  if p_month is null or p_month not between date '2000-01-01' and date '2199-12-01' or extract(day from p_month)<>1 or p_page is null or p_page not between 1 and 100000 then raise exception 'invalid food month/page' using errcode='22023'; end if;
  return (with totals as (
    select e.meal_date,e.category,i.amount from public.family_food_expenses e join public.family_food_expense_items i on i.food_expense_id=e.id
    where e.meal_date>=p_month-interval '1 month' and e.meal_date<p_month+interval '1 month'
  ) select jsonb_build_object(
    'currentTotal',coalesce(sum(amount) filter(where meal_date>=p_month),0)::text,
    'previousTotal',coalesce(sum(amount) filter(where meal_date<p_month),0)::text,
    'breakfastTotal',coalesce(sum(amount) filter(where meal_date>=p_month and category='BREAKFAST'),0)::text,
    'dinnerTotal',coalesce(sum(amount) filter(where meal_date>=p_month and category='DINNER'),0)::text,
    'groceriesTotal',coalesce(sum(amount) filter(where meal_date>=p_month and category='GROCERIES'),0)::text,
    'totalCount',(select count(*) from public.family_food_expenses where meal_date>=p_month and meal_date<p_month+interval '1 month'),
    'categories',(select coalesce(jsonb_agg(jsonb_build_object('category',category,'amount',amount::text) order by category),'[]'::jsonb) from (
      select c.category,coalesce(sum(i.amount),0) amount
      from (values ('BREAKFAST'),('DINNER'),('GROCERIES')) c(category)
      left join public.family_food_expenses e on e.category=c.category and e.meal_date>=p_month and e.meal_date<p_month+interval '1 month'
      left join public.family_food_expense_items i on i.food_expense_id=e.id group by c.category) category_totals),
    'dailyTrend',(select coalesce(jsonb_agg(jsonb_build_object('date',day_value,'amount',amount::text) order by day_value),'[]'::jsonb) from (
      select d.day::date day_value,coalesce(sum(i.amount),0) amount
      from generate_series(p_month,p_month+interval '1 month'-interval '1 day',interval '1 day') d(day)
      left join public.family_food_expenses e on e.meal_date=d.day::date
      left join public.family_food_expense_items i on i.food_expense_id=e.id group by d.day) daily_totals),
    'monthlyTrend',(select coalesce(jsonb_agg(jsonb_build_object('month',month_value,'amount',amount::text) order by month_value),'[]'::jsonb) from (
      select to_char(m.month,'YYYY-MM') month_value,coalesce(sum(i.amount),0) amount
      from generate_series(p_month-interval '5 months',p_month,interval '1 month') m(month)
      left join public.family_food_expenses e on e.meal_date>=m.month::date and e.meal_date<(m.month+interval '1 month')::date
      left join public.family_food_expense_items i on i.food_expense_id=e.id group by m.month) monthly_totals),
    'expenses',(select coalesce(jsonb_agg(public.family_food_slot(p_actor_member_id,e.meal_date,e.category) order by e.meal_date desc,e.id desc),'[]'::jsonb)
      from (select id,meal_date,category from public.family_food_expenses where meal_date>=p_month and meal_date<p_month+interval '1 month' order by meal_date desc,id desc limit 20 offset((p_page-1)*20)) e)
  ) from totals);
end $$;

revoke all privileges on function public.family_food_mutate(uuid,uuid,jsonb,boolean),public.family_food_slot(uuid,date,text),public.family_food_read(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.family_food_mutate(uuid,uuid,jsonb,boolean),public.family_food_slot(uuid,date,text),public.family_food_read(uuid,date,integer) to service_role;
