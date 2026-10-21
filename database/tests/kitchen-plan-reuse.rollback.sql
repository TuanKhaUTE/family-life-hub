begin;
insert into public.family_members(id,display_name,role) values
 ('a1111111-1111-4111-8111-111111111111','Synthetic Kitchen Parent','PARENT'),
 ('a2222222-2222-4222-8222-222222222222','Synthetic Kitchen Member','MEMBER');
set local role service_role;
do $$
declare
  p constant uuid := 'a1111111-1111-4111-8111-111111111111';
  m constant uuid := 'a2222222-2222-4222-8222-222222222222';
  request_id uuid;
  reused uuid;
  choice uuid;
  notification_id uuid;
  original_read constant timestamptz := '2096-08-14 10:00:00Z';
begin
  request_id := public.create_meal_request(p,'2096-08-15','DINNER','OPTION_POLL','2096-08-15 10:00:00Z',null,array['Cơm gà rô ti','Bún bò']);
  select id into choice from public.meal_request_options where meal_request_id=request_id and label='Cơm gà rô ti';
  perform public.save_meal_response(m,request_id,'SELECTED_OPTION',choice,null);
  select id into notification_id from public.notifications where recipient_member_id=m and related_resource_id=request_id;
  update public.notifications set read_at=original_read where id=notification_id;
  perform public.configure_meal_request(p,request_id,'CANCELLED','OPTION_POLL','2096-08-15 10:00:00Z',null,array['Cơm gà rô ti','Bún bò'],false);
  if not exists(select 1 from public.notifications where id=notification_id and read_at=original_read and message like '%không cần trả lời%')
    or (select count(*) from public.notifications where recipient_member_id=m and related_resource_id=request_id)<>1 then raise exception 'cancelled notification stale or duplicated'; end if;
  begin
    perform public.save_meal_response(m,request_id,'NOT_EATING',null,null);
    raise exception 'cancelled response accepted';
  exception when check_violation then null; end;
  -- The server must refuse silent loss of incompatible historical responses.
  begin
    perform public.create_meal_request(p,'2096-08-15','DINNER','OPEN_CHOICE','2096-08-15 11:00:00Z',null,'{}');
    raise exception 'reuse reset lacked confirmation';
  exception when sqlstate 'P2002' then null; end;
  reused := public.create_meal_request(p,'2096-08-15','DINNER','OPEN_CHOICE','2096-08-15 11:00:00Z',null,'{}',true);
  if reused<>request_id or (select count(*) from public.meal_requests where meal_date='2096-08-15' and meal_type='DINNER')<>1 then raise exception 'slot not reused'; end if;
  if exists(select 1 from public.meal_responses where meal_request_id=request_id) then raise exception 'incompatible response remained'; end if;
  perform public.save_meal_response(m,request_id,'CUSTOM',null,'Cơm gà rô ti');
  if not exists(select 1 from public.notifications where id=notification_id and read_at=original_read and title like '%cần bạn chọn món%') then raise exception 'reused notification wrong'; end if;
end;
$$;
set constraints all immediate;
rollback;
select count(*) as synthetic_kitchen_members_remaining from public.family_members
where id in ('a1111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222');
