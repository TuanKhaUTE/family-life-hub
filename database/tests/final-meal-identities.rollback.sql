-- Feature 2G: preserve identities while preparing, then lock served dishes.
begin;
insert into public.family_members(id,display_name,role) values
 ('f1111111-1111-4111-8111-111111111111','Synthetic Identity Parent','PARENT'),
 ('f2222222-2222-4222-8222-222222222222','Synthetic Identity Member','MEMBER');
set local role service_role;
do $$
declare
  p constant uuid := 'f1111111-1111-4111-8111-111111111111';
  m constant uuid := 'f2222222-2222-4222-8222-222222222222';
  meal jsonb;
  meal_id uuid;
  meat uuid;
  soup uuid;
  snapshot jsonb;
  feedback jsonb;
  dishes jsonb;
  foreign_dish uuid;
  role_name text;
begin
  meal := public.save_final_meal(p,'2097-07-15','DINNER',null,
    '[{"name":"Thịt kho","category":"MAIN","sort_order":0},{"name":"Canh cải","category":"SOUP","sort_order":1}]');
  meal_id := (meal->>'id')::uuid;
  meat := (meal->'final_meal_dishes'->0->>'id')::uuid;
  soup := (meal->'final_meal_dishes'->1->>'id')::uuid;
  dishes := jsonb_build_array(
    jsonb_build_object('id',soup,'name','Canh cải mới','category','SOUP','sort_order',0),
    jsonb_build_object('id',meat,'name','Thịt kho trứng','category','MAIN','sort_order',1),
    jsonb_build_object('name','Rau luộc','category','VEGETABLE','sort_order',2));
  meal := public.save_final_meal(p,'2097-07-15','DINNER',null,dishes);
  if (meal->'final_meal_dishes'->0->>'id')::uuid <> soup
    or (meal->'final_meal_dishes'->1->>'id')::uuid <> meat then raise exception 'preparing identities lost'; end if;
  dishes := jsonb_build_array(jsonb_build_object('id',meat,'name','Thịt kho trứng','category','MAIN','sort_order',0));
  meal := public.save_final_meal(p,'2097-07-15','DINNER',null,dishes);
  if exists(select 1 from public.final_meal_dishes where id=soup) then raise exception 'preparing removal failed'; end if;
  snapshot := public.read_final_meal(meal_id);
  meal := public.save_final_meal(p,'2097-07-16','LUNCH',null,'[{"name":"Historical lunch","category":"MAIN","sort_order":0}]');
  foreign_dish := (meal->'final_meal_dishes'->0->>'id')::uuid;
  begin
    perform public.save_final_meal(p,'2097-07-15','DINNER',null,jsonb_build_array(jsonb_build_object('id',foreign_dish,'name','Injected','category','MAIN','sort_order',0)));
    raise exception 'foreign identity accepted';
  exception when invalid_parameter_value then null; end;
  if public.read_final_meal(meal_id) <> snapshot then raise exception 'failed save was not atomic'; end if;
  perform public.mark_final_meal_ready(p,'2097-07-15','DINNER',null);
  perform public.save_final_meal_dish_rating(m,meat,5,'Ngon lắm');
  feedback := public.read_final_meal_dish_ratings(p,meal_id);
  begin
    perform public.save_final_meal(p,'2097-07-15','DINNER',null,dishes);
    raise exception 'ready save accepted';
  exception when sqlstate 'P2003' then null; end;
  begin
    update public.final_meal_dishes set name='Renamed' where id=meat;
    raise exception 'ready rename accepted';
  exception when sqlstate 'P2003' then null; end;
  begin
    update public.final_meal_dishes set sort_order=1 where id=meat;
    raise exception 'ready reorder accepted';
  exception when sqlstate 'P2003' then null; end;
  begin
    delete from public.final_meal_dishes where id=meat;
    raise exception 'ready removal accepted';
  exception when sqlstate 'P2003' then null; end;
  begin
    insert into public.final_meal_dishes(final_meal_id,name,category,sort_order) values(meal_id,'Extra','OTHER',1);
    raise exception 'ready addition accepted';
  exception when sqlstate 'P2003' then null; end;
  begin
    update public.final_meals set ready_at=null where id=meal_id;
    raise exception 'ready reset accepted';
  exception when sqlstate 'P2003' then null; end;
  perform public.mark_final_meal_ready(p,'2097-07-15','DINNER','Canh ở trong nồi nhé');
  if public.read_final_meal_dish_ratings(p,meal_id) <> feedback then raise exception 'ready edits lost ratings'; end if;
  if exists(select 1 from pg_proc where oid='public.guard_ready_meal_composition()'::regprocedure and (prosecdef or not ('search_path=""'=any(proconfig)))) then raise exception 'unsafe guard'; end if;
  foreach role_name in array array['anon','authenticated'] loop
    if has_function_privilege(role_name,'public.guard_ready_meal_composition()','EXECUTE') then raise exception 'browser guard access'; end if;
  end loop;
end;
$$;
set constraints all immediate;
rollback;
select count(*) as synthetic_identity_members_remaining from public.family_members
where id in ('f1111111-1111-4111-8111-111111111111','f2222222-2222-4222-8222-222222222222');
