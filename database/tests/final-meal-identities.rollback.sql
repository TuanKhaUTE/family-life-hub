-- All fixtures, edits, ratings, and notification fan-out are rolled back.
begin;
insert into public.family_members(id,display_name,role) values
 ('f1111111-1111-4111-8111-111111111111','Synthetic Identity Parent','PARENT'),
 ('f2222222-2222-4222-8222-222222222222','Synthetic Identity Member','MEMBER');
create function pg_temp.reject_synthetic_dish() returns trigger language plpgsql as $$
begin if new.name = 'Synthetic failure' then raise exception 'synthetic insert failure' using errcode='P2099'; end if; return new; end; $$;
create trigger synthetic_dish_failure before insert on public.final_meal_dishes for each row execute function pg_temp.reject_synthetic_dish();
set local role service_role;
do $$
declare
  p constant uuid := 'f1111111-1111-4111-8111-111111111111';
  m constant uuid := 'f2222222-2222-4222-8222-222222222222';
  meal jsonb;
  meal_id uuid;
  meat uuid;
  soup uuid;
  added uuid;
  foreign_dish uuid;
  snapshot jsonb;
  feedback_snapshot jsonb;
  dishes jsonb;
  role_name text;
begin
  meal := public.save_final_meal(p,'2097-07-15','DINNER',null,
    '[{"name":"Thịt kho","category":"MAIN","sort_order":0},{"name":"Canh cải","category":"SOUP","sort_order":1}]');
  meal_id := (meal->>'id')::uuid;
  meat := (meal->'final_meal_dishes'->0->>'id')::uuid;
  soup := (meal->'final_meal_dishes'->1->>'id')::uuid;
  perform public.mark_final_meal_ready(p,'2097-07-15','DINNER',null);
  perform public.save_final_meal_dish_rating(m,meat,5,'Ngon lắm');
  perform public.save_final_meal_dish_rating(m,soup,3,'Hơi mặn');

  dishes := jsonb_build_array(
    jsonb_build_object('id',meat,'name','Thịt kho trứng','category','MAIN','sort_order',0),
    jsonb_build_object('id',soup,'name','Canh cải','category','SOUP','sort_order',1));
  meal := public.save_final_meal(p,'2097-07-15','DINNER',null,dishes);
  if (meal->>'id')::uuid <> meal_id
    or not exists(select 1 from public.final_meal_dishes where id=meat and name='Thịt kho trứng')
    or not exists(select 1 from public.final_meal_dish_ratings where final_meal_dish_id=meat and member_id=m and rating=5 and comment='Ngon lắm') then
    raise exception 'rename lost dish identity or rating';
  end if;
  dishes := jsonb_build_array(
    jsonb_build_object('id',soup,'name','Canh cải','category','SOUP','sort_order',0),
    jsonb_build_object('id',meat,'name','Thịt kho trứng','category','MAIN','sort_order',1));
  meal := public.save_final_meal(p,'2097-07-15','DINNER',null,dishes);
  if (meal->'final_meal_dishes'->0->>'id')::uuid <> soup
    or (meal->'final_meal_dishes'->1->>'id')::uuid <> meat
    or (select count(*) from public.final_meal_dish_ratings where final_meal_dish_id in (meat,soup)) <> 2 then
    raise exception 'reorder lost identity or ratings';
  end if;
  dishes := dishes || '[{"name":"Rau luộc","category":"VEGETABLE","sort_order":2}]'::jsonb;
  meal := public.save_final_meal(p,'2097-07-15','DINNER',null,dishes);
  added := (meal->'final_meal_dishes'->2->>'id')::uuid;
  if added in (meat,soup) or (select count(*) from public.final_meal_dish_ratings where final_meal_dish_id in (meat,soup)) <> 2 then
    raise exception 'addition replaced existing identities';
  end if;
  perform public.save_final_meal_dish_rating(m,added,4,null);
  dishes := jsonb_build_array(
    jsonb_build_object('id',meat,'name','Thịt kho trứng','category','MAIN','sort_order',0),
    jsonb_build_object('id',added,'name','Rau luộc','category','SIDE','sort_order',1));
  meal := public.save_final_meal(p,'2097-07-15','DINNER',null,dishes);
  if exists(select 1 from public.final_meal_dishes where id=soup)
    or exists(select 1 from public.final_meal_dish_ratings where final_meal_dish_id=soup)
    or (select count(*) from public.final_meal_dish_ratings where final_meal_dish_id in (meat,added)) <> 2 then
    raise exception 'removal affected other dishes or failed to cascade';
  end if;
  snapshot := public.read_final_meal(meal_id);
  feedback_snapshot := public.read_final_meal_dish_ratings(p,meal_id);
  meal := public.save_final_meal(p,'2097-07-16','DINNER',null,'[{"name":"Món khác","category":"MAIN","sort_order":0}]');
  foreign_dish := (meal->'final_meal_dishes'->0->>'id')::uuid;
  begin
    perform public.save_final_meal(p,'2097-07-15','DINNER',null,
      jsonb_build_array(jsonb_build_object('id',foreign_dish,'name','Injected','category','MAIN','sort_order',0)));
    raise exception 'foreign dish injection accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_final_meal(p,'2097-07-15','DINNER',null,
      jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','Unknown','category','MAIN','sort_order',0)));
    raise exception 'unknown dish identity accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_final_meal(p,'2097-07-15','DINNER',null,
      jsonb_build_array(
        jsonb_build_object('id',meat,'name','A','category','MAIN','sort_order',0),
        jsonb_build_object('id',meat,'name','B','category','MAIN','sort_order',1)));
    raise exception 'duplicate dish identity accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_final_meal(p,'2097-07-17','DINNER',null,
      jsonb_build_array(jsonb_build_object('id',foreign_dish,'name','Injected','category','MAIN','sort_order',0)));
    raise exception 'new meal accepted another meals dish';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.final_meals where meal_date='2097-07-17' and meal_type='DINNER') then raise exception 'failed create left orphan meal'; end if;
  if public.read_final_meal(meal_id) <> snapshot or public.read_final_meal_dish_ratings(p,meal_id) <> feedback_snapshot then
    raise exception 'failed edits mutated meal or feedback';
  end if;
  if not exists(select 1 from public.final_meal_dishes where id=foreign_dish and name='Món khác') then raise exception 'foreign meal mutated'; end if;
  -- Force a failure after deletion/update/insertion, not just input validation.
  begin
    perform public.save_final_meal(p,'2097-07-15','DINNER',null,
      jsonb_build_array(jsonb_build_object('id',meat,'name','Edited before failure','category','MAIN','sort_order',0),
        jsonb_build_object('name','Synthetic failure','category','OTHER','sort_order',1)));
    raise exception 'injected failure did not run';
  exception when sqlstate 'P2099' then null; end;
  if public.read_final_meal(meal_id) <> snapshot or public.read_final_meal_dish_ratings(p,meal_id) <> feedback_snapshot then
    raise exception 'mid-save failure was not atomic';
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.final_meal_dishes'::regclass and conname='final_meal_dishes_order_key' and condeferrable) then raise exception 'order constraint cannot support swaps'; end if;
  if exists(select 1 from pg_proc where oid='public.save_final_meal(uuid,date,text,uuid,jsonb)'::regprocedure and (prosecdef or not ('search_path=""'=any(proconfig)))) then raise exception 'unsafe save function'; end if;
  foreach role_name in array array['anon','authenticated'] loop
    if has_function_privilege(role_name,'public.save_final_meal(uuid,date,text,uuid,jsonb)','EXECUTE') then raise exception 'browser RPC access'; end if;
  end loop;
end;
$$;
set constraints all immediate;
rollback;
select count(*) as synthetic_identity_members_remaining from public.family_members
where id in ('f1111111-1111-4111-8111-111111111111','f2222222-2222-4222-8222-222222222222');
