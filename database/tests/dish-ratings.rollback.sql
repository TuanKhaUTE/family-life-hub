-- Synthetic fixtures only; the transaction and all ratings are rolled back.
begin;
insert into public.family_members(id,display_name,role,is_active) values
 ('e1111111-1111-4111-8111-111111111111','Synthetic Rating Parent','PARENT',true),
 ('e2222222-2222-4222-8222-222222222222','Synthetic Rating Admin','ADMIN',true),
 ('e3333333-3333-4333-8333-333333333333','Synthetic Rating Member','MEMBER',true),
 ('e4444444-4444-4444-8444-444444444444','Synthetic Rating Inactive','MEMBER',false);
set local role service_role;
do $$
declare
  p constant uuid := 'e1111111-1111-4111-8111-111111111111';
  a constant uuid := 'e2222222-2222-4222-8222-222222222222';
  m constant uuid := 'e3333333-3333-4333-8333-333333333333';
  inactive constant uuid := 'e4444444-4444-4444-8444-444444444444';
  result jsonb;
  meal_id uuid;
  dish_id uuid;
  soup_id uuid;
  other_dish_id uuid;
  rating_id uuid;
  created timestamptz;
  actor uuid;
  role_name text;
  function_oid oid;
  invalid_score integer;
  invalid_comment text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.final_meal_dish_ratings'::regclass)
    or exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'final_meal_dish_ratings') then
    raise exception 'RLS mismatch';
  end if;
  if exists(select 1 from pg_class, lateral aclexplode(coalesce(relacl, acldefault('r',relowner))) acl
    where oid = 'public.final_meal_dish_ratings'::regclass and acl.grantee = 0) then raise exception 'PUBLIC table privilege'; end if;
  foreach role_name in array array['anon','authenticated'] loop
    if has_table_privilege(role_name, 'public.final_meal_dish_ratings', 'SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser table grant'; end if;
  end loop;
  if not has_table_privilege('service_role', 'public.final_meal_dish_ratings', 'SELECT')
    or not has_table_privilege('service_role', 'public.final_meal_dish_ratings', 'INSERT')
    or not has_table_privilege('service_role', 'public.final_meal_dish_ratings', 'UPDATE') then raise exception 'missing backend grant'; end if;
  foreach function_oid in array array[
    'public.guard_dish_rating()'::regprocedure::oid,
    'public.read_final_meal_dish_ratings(uuid,uuid)'::regprocedure::oid,
    'public.save_final_meal_dish_rating(uuid,uuid,integer,text)'::regprocedure::oid
  ] loop
    if exists(select 1 from pg_proc where oid = function_oid and (prosecdef or not ('search_path=""' = any(proconfig)))) then raise exception 'unsafe function config'; end if;
    if exists(select 1 from pg_proc, lateral aclexplode(coalesce(proacl, acldefault('f',proowner))) acl where oid = function_oid and acl.grantee = 0) then raise exception 'PUBLIC execute'; end if;
    foreach role_name in array array['anon','authenticated'] loop
      if has_function_privilege(role_name,function_oid,'EXECUTE') then raise exception 'browser RPC privilege'; end if;
    end loop;
    if not has_function_privilege('service_role',function_oid,'EXECUTE') then raise exception 'missing backend RPC privilege'; end if;
  end loop;

  result := public.save_final_meal(p,'2098-06-15','DINNER',null,
    '[{"name":"Thịt kho","category":"MAIN","sort_order":0},{"name":"Canh cải","category":"SOUP","sort_order":1}]');
  meal_id := (result->>'id')::uuid;
  dish_id := (result->'final_meal_dishes'->0->>'id')::uuid;
  soup_id := (result->'final_meal_dishes'->1->>'id')::uuid;
  begin
    perform public.save_final_meal_dish_rating(a,dish_id,5,null);
    raise exception 'not-ready write accepted';
  exception when sqlstate 'P2002' then null; end;
  perform public.mark_final_meal_ready(p,'2098-06-15','DINNER',null);

  foreach actor in array array[p,inactive] loop
    begin
      perform public.save_final_meal_dish_rating(actor,dish_id,5,null);
      raise exception 'parent/inactive write accepted';
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    perform public.save_final_meal_dish_rating(a,'e9999999-9999-4999-8999-999999999999',5,null);
    raise exception 'nonexistent dish accepted';
  exception when no_data_found then null; end;
  foreach invalid_score in array array[0,6,-1] loop
    begin
      perform public.save_final_meal_dish_rating(a,dish_id,invalid_score,null);
      raise exception 'invalid score accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.save_final_meal_dish_rating(a,dish_id,null,null);
    raise exception 'null score accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_final_meal_dish_rating(a,dish_id,4,repeat('a',301));
    raise exception 'long comment accepted';
  exception when invalid_parameter_value then null; end;
  foreach invalid_comment in array array['', ' untrimmed', E'\tblank\n', repeat('b',301)] loop
    begin
      insert into public.final_meal_dish_ratings(final_meal_dish_id,member_id,rating,comment)
      values(dish_id,a,5,invalid_comment);
      raise exception 'invalid stored comment accepted';
    exception when check_violation then null; end;
  end loop;
  begin
    insert into public.final_meal_dish_ratings(final_meal_dish_id,member_id,rating) values(dish_id,a,6);
    raise exception 'table rating constraint missing';
  exception when check_violation then null; end;

  result := public.save_final_meal_dish_rating(a,dish_id,5,E' \tNgon lắm\n ');
  if result->>'comment' <> 'Ngon lắm' or result->>'memberId' <> a::text then raise exception 'normalization/ownership failed'; end if;
  select id, created_at into rating_id, created from public.final_meal_dish_ratings where final_meal_dish_id=dish_id and member_id=a;
  perform public.save_final_meal_dish_rating(m,dish_id,3,'Hơi mặn');
  perform public.save_final_meal_dish_rating(a,dish_id,4,'Lần này vừa miệng');
  if (select count(*) from public.final_meal_dish_ratings where final_meal_dish_id=dish_id) <> 2
    or not exists(select 1 from public.final_meal_dish_ratings where id=rating_id and rating=4 and created_at=created)
    or not exists(select 1 from public.final_meal_dish_ratings where final_meal_dish_id=dish_id and member_id=m and rating=3 and comment='Hơi mặn') then
    raise exception 'upsert duplicated or overwrote someone else';
  end if;
  begin
    insert into public.final_meal_dish_ratings(final_meal_dish_id,member_id,rating) values(dish_id,a,2);
    raise exception 'duplicate member/dish accepted';
  exception when unique_violation then null; end;
  begin
    update public.final_meal_dish_ratings set member_id=m where id=rating_id;
    raise exception 'rating ownership changed';
  exception when insufficient_privilege then null; end;
  begin
    update public.final_meal_dish_ratings set final_meal_dish_id=soup_id where id=rating_id;
    raise exception 'rating dish changed';
  exception when insufficient_privilege then null; end;
  result := public.read_final_meal_dish_ratings(a,meal_id);
  if jsonb_array_length(result->'dishes'->0->'ratings') <> 1
    or result->'dishes'->0->'ratings'->0->>'memberId' <> a::text
    or jsonb_array_length(result->'dishes'->1->'ratings') <> 0 then raise exception 'member privacy/unrated isolation failed'; end if;
  result := public.read_final_meal_dish_ratings(p,meal_id);
  if jsonb_array_length(result->'dishes'->0->'ratings') <> 2
    or result->'dishes'->0->'ratings'->0->>'displayName' not like 'Synthetic Rating %'
    or result::text like '%pin_hash%' or result::text like '%avatar%' then raise exception 'parent feedback projection failed'; end if;
  begin
    perform public.read_final_meal_dish_ratings(inactive,meal_id);
    raise exception 'inactive read accepted';
  exception when insufficient_privilege then null; end;
  perform public.save_final_meal_dish_rating(a,soup_id,2,repeat('a',300));
  result := public.save_final_meal_dish_rating(a,soup_id,3,E' \t\n ');
  if result->'comment' <> 'null'::jsonb then raise exception 'blank comment not normalized'; end if;

  -- Identical dish names on another meal remain independent instances.
  result := public.save_final_meal(p,'2098-06-16','DINNER',null,'[{"name":"Thịt kho","category":"MAIN","sort_order":0}]');
  other_dish_id := (result->'final_meal_dishes'->0->>'id')::uuid;
  perform public.mark_final_meal_ready(p,'2098-06-16','DINNER',null);
  perform public.save_final_meal_dish_rating(m,other_dish_id,1,null);
  if not exists(select 1 from public.final_meal_dish_ratings where final_meal_dish_id=dish_id and member_id=m and rating=3) then raise exception 'cross-meal feedback overwritten'; end if;
  delete from public.final_meal_dishes where id=soup_id;
  if exists(select 1 from public.final_meal_dish_ratings where final_meal_dish_id=soup_id) then raise exception 'dish cascade missing'; end if;
  delete from public.final_meals where id=meal_id;
  if exists(select 1 from public.final_meal_dish_ratings where final_meal_dish_id=dish_id) then raise exception 'meal cascade missing'; end if;
  delete from public.family_members where id=m;
  if exists(select 1 from public.final_meal_dish_ratings where member_id=m) then raise exception 'member cascade missing'; end if;
end;
$$;
set constraints all immediate;
rollback;
select count(*) as synthetic_rating_members_remaining from public.family_members
where id in ('e1111111-1111-4111-8111-111111111111','e2222222-2222-4222-8222-222222222222','e3333333-3333-4333-8333-333333333333','e4444444-4444-4444-8444-444444444444');
