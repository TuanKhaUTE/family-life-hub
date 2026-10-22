begin;
insert into public.family_members(id,display_name,role) values
 ('f6111111-1111-4111-8111-111111111111','Synthetic Grocery Parent','PARENT'),
 ('f6222222-2222-4222-8222-222222222222','Synthetic Grocery Admin','ADMIN'),
 ('f6333333-3333-4333-8333-333333333333','Synthetic Grocery Member','MEMBER'),
 ('f6444444-4444-4444-8444-444444444444','Synthetic Grocery Inactive','PARENT');
update public.family_members set is_active=false where id='f6444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare
 p uuid:='f6111111-1111-4111-8111-111111111111'; a uuid:='f6222222-2222-4222-8222-222222222222'; m uuid:='f6333333-3333-4333-8333-333333333333'; inactive uuid:='f6444444-4444-4444-8444-444444444444';
 actor uuid; data jsonb; dinner_id uuid; grocery_id uuid;
 dinner jsonb:='{"mealDate":"2001-10-22","mealType":"DINNER","note":null,"items":[{"name":"Synthetic dinner","amount":"100000"},{"name":"Synthetic soup","amount":"70000"}]}';
 breakfast jsonb:='{"mealDate":"2001-10-23","mealType":"BREAKFAST","note":null,"items":[{"name":"Synthetic breakfast","amount":"120000"}]}';
 grocery jsonb:='{"mealDate":"2001-10-22","category":"GROCERIES","amount":"350000","note":"Synthetic groceries"}';
begin
 perform public.family_food_mutate(p,null,dinner,false);
 perform public.family_food_mutate(p,null,breakfast,false);
 perform public.family_food_mutate(p,null,grocery,false);
 perform public.family_food_mutate(p,null,dinner||'{"mealDate":"2001-09-22","items":[{"name":"Synthetic prior","amount":"100000"}]}',false);
 foreach actor in array array[p,a,m] loop
  data:=public.family_food_read(actor,'2001-10-01',1);
  if data->>'currentTotal'<>'640000' or data->>'previousTotal'<>'100000' or data->>'breakfastTotal'<>'120000' or data->>'dinnerTotal'<>'170000' or data->>'groceriesTotal'<>'350000' or data->>'totalCount'<>'3' then raise exception 'family food totals wrong'; end if;
  if (data->'categories'->0->>'amount')<>'120000' or (data->'categories'->1->>'amount')<>'170000' or (data->'categories'->2->>'amount')<>'350000' then raise exception 'category totals wrong'; end if;
  if jsonb_array_length(data->'dailyTrend')<>31 or jsonb_array_length(data->'monthlyTrend')<>6 then raise exception 'trend shape wrong'; end if;
 end loop;
 dinner_id:=(public.family_food_slot(p,'2001-10-22','DINNER')->>'id')::uuid;
 grocery_id:=(public.family_food_slot(p,'2001-10-22','GROCERIES')->>'id')::uuid;
 if public.family_food_slot(p,'2001-10-22','DINNER')->>'total'<>'170000' then raise exception 'meal data changed'; end if;
 if public.family_food_slot(p,'2001-10-22','GROCERIES')->>'amount'<>'350000' or public.family_food_slot(p,'2001-10-22','GROCERIES')->>'category'<>'GROCERIES' then raise exception 'grocery slot wrong'; end if;
 perform public.family_food_mutate(p,grocery_id,grocery||'{"amount":"360000"}',false);
 if public.family_food_slot(p,'2001-10-22','GROCERIES')->>'total'<>'360000' then raise exception 'grocery update failed'; end if;
 foreach actor in array array[a,m,inactive] loop
  begin perform public.family_food_mutate(actor,null,grocery,false); raise exception 'non-parent created'; exception when insufficient_privilege then null; end;
  begin perform public.family_food_mutate(actor,grocery_id,grocery,false); raise exception 'non-parent edited'; exception when insufficient_privilege then null; end;
  begin perform public.family_food_mutate(actor,grocery_id,null,true); raise exception 'non-parent deleted'; exception when insufficient_privilege then null; end;
 end loop;
 begin perform public.family_food_read(inactive,'2001-10-01',1); raise exception 'inactive read'; exception when insufficient_privilege then null; end;
 begin perform public.family_food_mutate(p,null,dinner,false); raise exception 'duplicate meal slot'; exception when unique_violation then null; end;
 begin perform public.family_food_mutate(p,null,grocery||'{"amount":"0"}',false); raise exception 'zero grocery accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.family_food_mutate(p,null,grocery||jsonb_build_object('mealDate',(now() at time zone 'Asia/Ho_Chi_Minh')::date+1),false); raise exception 'future grocery accepted'; exception when invalid_parameter_value then null; end;
 if not exists(select 1 from public.family_food_expenses where id=dinner_id and category='DINNER' and meal_type='DINNER') then raise exception 'existing meal record changed'; end if;
end $$;
reset role;
do $$ declare f record; t text; begin
 foreach t in array array['family_food_expenses','family_food_expense_items'] loop
  if not(select relrowsecurity from pg_class where oid=('public.'||t)::regclass) or exists(select 1 from pg_policies where schemaname='public' and tablename=t) then raise exception 'unsafe food RLS'; end if;
  if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser table grants'; end if;
 end loop;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='family_food_expenses_meal_slot_key') then raise exception 'missing meal slot uniqueness'; end if;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'family_food_%' loop
  if f.prosecdef or not('search_path=""'=any(f.proconfig)) or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'unsafe food RPC'; end if;
 end loop;
end $$;
set constraints all immediate;
rollback;
select count(*) as synthetic_food_members_remaining from public.family_members where id in('f6111111-1111-4111-8111-111111111111','f6222222-2222-4222-8222-222222222222','f6333333-3333-4333-8333-333333333333','f6444444-4444-4444-8444-444444444444');
