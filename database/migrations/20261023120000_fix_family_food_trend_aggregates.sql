-- Correct trend JSON aggregation without changing stored family-food data.
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
revoke all privileges on function public.family_food_read(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.family_food_read(uuid,date,integer) to service_role;
