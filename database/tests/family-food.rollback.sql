begin;
insert into public.family_members(id,display_name,role) values
 ('f5111111-1111-4111-8111-111111111111','Synthetic Food Parent','PARENT'),
 ('f5222222-2222-4222-8222-222222222222','Synthetic Food Admin','ADMIN'),
 ('f5333333-3333-4333-8333-333333333333','Synthetic Food Member','MEMBER'),
 ('f5444444-4444-4444-8444-444444444444','Synthetic Food Inactive','PARENT');
update public.family_members set is_active=false where id='f5444444-4444-4444-8444-444444444444';
set local role service_role;
do $$
declare
 p uuid:='f5111111-1111-4111-8111-111111111111'; a uuid:='f5222222-2222-4222-8222-222222222222'; m uuid:='f5333333-3333-4333-8333-333333333333'; inactive uuid:='f5444444-4444-4444-8444-444444444444';
 actor uuid; other_actor uuid; eid uuid; item_id uuid; data jsonb;
 input jsonb:='{"mealDate":"2001-10-22","mealType":"DINNER","note":null,"items":[{"name":"Synthetic dinner","amount":"100000"},{"name":"Synthetic soup","amount":"40000"},{"name":"Synthetic vegetables","amount":"30000"}]}';
begin
 perform public.family_food_mutate(p,null,input,false);
 perform public.family_food_mutate(p,null,input||'{"mealType":"BREAKFAST","items":[{"name":"Synthetic breakfast","amount":"120000"}]}',false);
 perform public.family_food_mutate(p,null,input||'{"mealDate":"2001-09-22","items":[{"name":"Synthetic prior","amount":"100000"}]}',false);
 foreach actor in array array[p,a,m] loop
  data:=public.family_food_read(actor,'2001-10-01',1);
  if data->>'currentTotal'<>'290000' or data->>'previousTotal'<>'100000' or data->>'breakfastTotal'<>'120000' or data->>'dinnerTotal'<>'170000' or data->>'totalCount'<>'2' then raise exception 'shared aggregation failed'; end if;
  if public.family_food_slot(actor,'2001-10-22','DINNER')->>'total'<>'170000' then raise exception 'slot aggregation failed'; end if;
 end loop;
 eid:=(public.family_food_slot(p,'2001-10-22','DINNER')->>'id')::uuid;
 foreach actor in array array[a,m,inactive] loop
  begin perform public.family_food_mutate(actor,null,input,false); raise exception 'non-parent created'; exception when insufficient_privilege then null; end;
  begin perform public.family_food_mutate(actor,eid,input,false); raise exception 'non-parent edited'; exception when insufficient_privilege then null; end;
  begin perform public.family_food_mutate(actor,eid,null,true); raise exception 'non-parent deleted'; exception when insufficient_privilege then null; end;
 end loop;
 begin perform public.family_food_read(inactive,'2001-10-01',1); raise exception 'inactive read'; exception when insufficient_privilege then null; end;
 begin perform public.family_food_mutate(p,null,input,false); raise exception 'duplicate slot'; exception when unique_violation then null; end;
 begin perform public.family_food_mutate(p,eid,input||'{"mealType":"LUNCH"}',false); raise exception 'lunch accepted'; exception when check_violation then null; end;
 begin perform public.family_food_mutate(p,eid,input||'{"items":[]}',false); raise exception 'empty items'; exception when invalid_parameter_value then null; end;
 begin perform public.family_food_mutate(p,eid,input||'{"items":[{"name":"Synthetic invalid","amount":"0"}]}',false); raise exception 'zero accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.family_food_mutate(p,eid,input||'{"items":[{"name":"Synthetic invalid","amount":"1.5"}]}',false); raise exception 'fraction accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.family_food_mutate(p,eid,input||'{"items":[{"name":"Synthetic invalid","amount":"1000000001"}]}',false); raise exception 'unbounded price'; exception when check_violation then null; end;
 begin perform public.family_food_mutate(p,eid,input||'{"items":[{"name":" ","amount":"1"}]}',false); raise exception 'blank name'; exception when check_violation then null; end;
 begin perform public.family_food_mutate(p,eid,input||jsonb_build_object('mealDate',(now() at time zone 'Asia/Ho_Chi_Minh')::date+1),false); raise exception 'future cost'; exception when invalid_parameter_value then null; end;
 -- Failed replacement rolls back header and every item, preserving the full meal.
 if public.family_food_slot(p,'2001-10-22','DINNER')->>'total'<>'170000' then raise exception 'non-atomic replacement'; end if;
 begin insert into public.family_food_expense_items(food_expense_id,name,amount,sort_order) values('ffffffff-ffff-4fff-8fff-ffffffffffff','Synthetic orphan',1,0); raise exception 'orphan item'; exception when foreign_key_violation then null; end;
 begin update public.family_food_expense_items set amount=-1 where food_expense_id=eid; raise exception 'negative direct amount'; exception when check_violation then null; end;
 begin delete from public.family_food_expense_items where food_expense_id=eid; set constraints all immediate; raise exception 'committed empty meal'; exception when check_violation then null; end;
 set constraints all deferred;
 perform public.family_food_mutate(p,eid,input||'{"items":[{"name":"Synthetic edited","amount":"180000"}]}',false);
 set constraints all immediate;
 if public.family_food_slot(m,'2001-10-22','DINNER')->>'total'<>'180000' then raise exception 'edit failed'; end if;
 item_id:=(select id from public.family_food_expense_items where food_expense_id=eid);
 perform public.family_food_mutate(p,eid,null,true);
 if exists(select 1 from public.family_food_expense_items where id=item_id) then raise exception 'delete cascade failed'; end if;
 -- All role pairs remain isolated in the existing PERSONAL domain.
 foreach actor in array array[p,a,m] loop
  perform public.personal_expense_mutate(actor,null,'{"amount":"123","spentOn":"2001-10-22","category":"OTHER","note":"Synthetic private"}',false);
 end loop;
 foreach actor in array array[p,a,m] loop
  data:=public.personal_expense_read(actor,'2001-10-01',1);
  if data->>'currentTotal'<>'123' or data->>'totalCount'<>'1' then raise exception 'personal privacy lost'; end if;
  foreach other_actor in array array[p,a,m] loop
   if actor=other_actor then continue; end if;
   eid:=(public.personal_expense_read(other_actor,'2001-10-01',1)->'expenses'->0->>'id')::uuid;
   if exists(select 1 from jsonb_array_elements(data->'expenses') x where x->>'id'=eid::text) then raise exception 'cross personal read'; end if;
   begin perform public.personal_expense_mutate(actor,eid,null,true); raise exception 'cross personal mutation'; exception when no_data_found then null; end;
  end loop;
 end loop;
end $$;
reset role;
do $$ declare t text; f record; begin
 foreach t in array array['family_food_expenses','family_food_expense_items'] loop
  if not(select relrowsecurity from pg_class where oid=('public.'||t)::regclass) or exists(select 1 from pg_policies where schemaname='public' and tablename=t) then raise exception 'unsafe food RLS'; end if;
  if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser table grants'; end if;
 end loop;
 if not exists(select 1 from pg_constraint where conrelid='public.family_food_expense_items'::regclass and contype='f' and confdeltype='c') then raise exception 'missing cascade FK'; end if;
 for f in select oid,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like 'family_food_%' loop
  if f.prosecdef or not('search_path=""'=any(f.proconfig)) or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'unsafe food RPC'; end if;
 end loop;
end $$;
set constraints all immediate;
rollback;
select count(*) as synthetic_food_members_remaining from public.family_members where id in('f5111111-1111-4111-8111-111111111111','f5222222-2222-4222-8222-222222222222','f5333333-3333-4333-8333-333333333333','f5444444-4444-4444-8444-444444444444');
