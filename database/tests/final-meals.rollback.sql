-- Run against a migrated database. All fixtures and writes roll back.
begin;
insert into public.family_members(id,display_name,role,is_active) values
 ('d1111111-1111-4111-8111-111111111111','Synthetic Final Parent','PARENT',true),
 ('d2222222-2222-4222-8222-222222222222','Synthetic Final Admin','ADMIN',true),
 ('d3333333-3333-4333-8333-333333333333','Synthetic Final Member','MEMBER',true),
 ('d4444444-4444-4444-8444-444444444444','Synthetic Final Inactive','MEMBER',false),
 ('d5555555-5555-4555-8555-555555555555','Synthetic Inactive Parent','PARENT',false);

set local role service_role;

do $$
declare
  p constant uuid := 'd1111111-1111-4111-8111-111111111111';
  a constant uuid := 'd2222222-2222-4222-8222-222222222222';
  m constant uuid := 'd3333333-3333-4333-8333-333333333333';
  inactive constant uuid := 'd4444444-4444-4444-8444-444444444444';
  ip constant uuid := 'd5555555-5555-4555-8555-555555555555';
  result jsonb;
  final_id uuid;
  request_id uuid;
  self_id uuid;
  response_id uuid;
  original_ready timestamptz;
  original_notification uuid;
  original_read constant timestamptz := '2099-05-10 10:00:00Z';
  actor uuid;
  role_name text;
  table_name text;
  function_oid oid;
begin
  foreach table_name in array array['final_meals','final_meal_dishes'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || table_name)::regclass)
      or exists(select 1 from pg_policies where schemaname = 'public' and tablename = table_name) then
      raise exception 'RLS security mismatch';
    end if;
    if exists (
      select 1 from pg_class, lateral aclexplode(coalesce(relacl, acldefault('r',relowner))) as acl
      where oid = ('public.' || table_name)::regclass and acl.grantee = 0
    ) then raise exception 'PUBLIC table access'; end if;
    foreach role_name in array array['anon','authenticated'] loop
      if has_table_privilege(role_name, 'public.' || table_name, 'SELECT,INSERT,UPDATE,DELETE') then raise exception 'browser table grant'; end if;
    end loop;
  end loop;
  foreach function_oid in array array[
    'public.save_final_meal(uuid,date,text,uuid,jsonb)'::regprocedure::oid,
    'public.mark_final_meal_ready(uuid,date,text,text)'::regprocedure::oid
  ] loop
    if exists(select 1 from pg_proc where oid = function_oid and (prosecdef or not ('search_path=""' = any(proconfig)))) then raise exception 'unsafe function config'; end if;
    if exists(select 1 from pg_proc, lateral aclexplode(coalesce(proacl, acldefault('f',proowner))) as acl where oid = function_oid and acl.grantee = 0) then raise exception 'PUBLIC function access'; end if;
    foreach role_name in array array['anon','authenticated'] loop
      if has_function_privilege(role_name, function_oid, 'EXECUTE') then raise exception 'browser RPC access'; end if;
    end loop;
    if not has_function_privilege('service_role',function_oid,'EXECUTE') then raise exception 'service RPC grant missing'; end if;
  end loop;

  foreach actor in array array[a,m,ip] loop
    begin
      perform public.save_final_meal(actor,'2099-05-10','DINNER',null,'[{"name":"Cơm","category":"MAIN","sort_order":0}]');
      raise exception 'unauthorized finalization';
    exception when insufficient_privilege then null; end;
  end loop;

  result := public.save_final_meal(p,'2099-05-10','DINNER',null,
    '[{"name":" Cơm gà rô ti ","category":"MAIN","sort_order":0},{"name":"Canh cải","category":"SOUP","sort_order":1},{"name":"Rau luộc","category":"VEGETABLE","sort_order":2}]');
  final_id := (result->>'id')::uuid;
  if result->'final_meal_dishes'->0->>'name' <> 'Cơm gà rô ti'
    or jsonb_array_length(result->'final_meal_dishes') <> 3 then raise exception 'dish order/name wrong'; end if;

  begin
    perform public.save_final_meal(p,'2099-05-10','DINNER',null,'[]');
    raise exception 'empty save accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_final_meal(p,'2099-05-10','DINNER',null,'[{"name":"Invalid","category":"INVALID","sort_order":0}]');
    raise exception 'bad category accepted';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.final_meal_dishes where final_meal_id=final_id) <> 3 then raise exception 'failed save mutated dishes'; end if;

  result := public.save_final_meal(p,'2099-05-10','DINNER',null,
    '[{"name":"Canh cải","category":"SOUP","sort_order":0},{"name":"Cơm gà rô ti","category":"MAIN","sort_order":1}]');
  if (result->>'id')::uuid <> final_id
    or result->'final_meal_dishes'->0->>'name' <> 'Canh cải'
    or (select count(*) from public.final_meals where meal_date='2099-05-10' and meal_type='DINNER') <> 1
    or (select count(*) from public.final_meal_dishes where final_meal_id=final_id) <> 2 then raise exception 'atomic replacement/slot mismatch'; end if;

  begin
    insert into public.final_meals(meal_date,meal_type,finalized_by_member_id) values('2099-05-10','DINNER',p);
    raise exception 'duplicate slot accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.final_meal_dishes(final_meal_id,name,category,sort_order) values('d9999999-9999-4999-8999-999999999999','Orphan','MAIN',0);
    raise exception 'orphan accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.final_meal_dishes(final_meal_id,name,category,sort_order) values(final_id,' ','MAIN',3);
    raise exception 'blank name accepted';
  exception when check_violation then null; end;
  begin
    insert into public.final_meal_dishes(final_meal_id,name,category,sort_order) values(final_id,'Test','INVALID',3);
    raise exception 'invalid category accepted';
  exception when check_violation then null; end;
  begin
    delete from public.final_meal_dishes where final_meal_id=final_id;
    set constraints final_meal_dishes_require_remaining immediate;
    raise exception 'zero dishes accepted';
  exception when check_violation then null; end;
  set constraints all deferred;

  request_id := public.create_meal_request(p,'2099-05-11','LUNCH','OPEN_CHOICE','2099-05-11 10:00:00Z',null,null);
  response_id := public.save_meal_response(m,request_id,'CUSTOM',null,'Synthetic child response');
  result := public.save_final_meal(p,'2099-05-11','LUNCH',request_id,'[{"name":"Cơm","category":"MAIN","sort_order":0}]');
  if (result->>'meal_request_id')::uuid <> request_id or not exists(select 1 from public.meal_responses where id=response_id and custom_text='Synthetic child response') then raise exception 'request linkage/response changed'; end if;
  begin
    perform public.save_final_meal(p,'2099-05-12','LUNCH',request_id,'[{"name":"Cơm","category":"MAIN","sort_order":0}]');
    raise exception 'mismatched request accepted';
  exception when foreign_key_violation then null; end;
  self_id := public.create_meal_request(p,'2099-05-12','DINNER','SELF_SERVICE',null,null,null);
  begin
    perform public.save_final_meal(p,'2099-05-12','DINNER',null,'[{"name":"Cơm","category":"MAIN","sort_order":0}]');
    raise exception 'self-service cooked meal accepted';
  exception when sqlstate 'P2001' then null; end;
  perform public.change_self_service_meal_request(p,self_id,'OPEN_CHOICE','2099-05-12 12:00:00Z',null,null);
  perform public.save_final_meal(p,'2099-05-12','DINNER',self_id,'[{"name":"Cơm","category":"MAIN","sort_order":0}]');
  begin
    perform public.update_meal_request(p,self_id,'SELF_SERVICE',null,null);
    raise exception 'self-service contradicted cooked meal';
  exception when sqlstate 'P2001' then null; end;

  foreach actor in array array[a,m,ip] loop
    begin
      perform public.mark_final_meal_ready(actor,'2099-05-10','DINNER',null);
      raise exception 'unauthorized ready';
    exception when insufficient_privilege then null; end;
  end loop;
  result := public.mark_final_meal_ready(p,'2099-05-10','DINNER','Cả nhà ăn nhé');
  original_ready := (result->>'ready_at')::timestamptz;
  if original_ready is null then raise exception 'ready timestamp missing'; end if;
  select id into original_notification from public.notifications where recipient_member_id=m and related_resource_id=final_id and type='MEAL_READY';
  update public.notifications set read_at=original_read where id=original_notification;
  result := public.mark_final_meal_ready(p,'2099-05-10','DINNER','Cả nhà ăn nhé');
  result := public.mark_final_meal_ready(p,'2099-05-10','DINNER','Canh còn nóng nhé');
  if (result->>'ready_at')::timestamptz <> original_ready then raise exception 'ready retry changed timestamp'; end if;
  if (select count(*) from public.notifications where related_resource_id=final_id and recipient_member_id in(a,m) and type='MEAL_READY') <> 2
    or exists(select 1 from public.notifications where related_resource_id=final_id and recipient_member_id in(p,inactive,ip)) then raise exception 'ready recipient mismatch'; end if;
  if not exists(select 1 from public.notifications where id=original_notification and read_at=original_read and message='Canh còn nóng nhé') then raise exception 'notification identity/read/message mismatch'; end if;
end;
$$;
set constraints all immediate;
rollback;
select
 (select count(*) from public.final_meals where meal_date between '2099-05-10' and '2099-05-12') as synthetic_final_meals,
 (select count(*) from public.family_members where id in ('d1111111-1111-4111-8111-111111111111','d2222222-2222-4222-8222-222222222222','d3333333-3333-4333-8333-333333333333','d4444444-4444-4444-8444-444444444444','d5555555-5555-4555-8555-555555555555')) as synthetic_members,
 (select count(*) from public.notifications where related_date between '2099-05-10' and '2099-05-12') as synthetic_notifications;
