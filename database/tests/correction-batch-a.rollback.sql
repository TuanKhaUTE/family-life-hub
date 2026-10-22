begin;
set local role service_role;
do $$
declare
 m uuid='fa700000-0000-4000-8000-000000000001';
 p uuid='fa700000-0000-4000-8000-000000000002';
 other_member uuid='fa700000-0000-4000-8000-000000000003';
 req uuid='fa700000-0000-4000-8000-000000000011';
 n uuid='fa700000-0000-4000-8000-000000000021';
 old_read timestamptz='2026-10-21T01:00:00Z';
 d date; response_id uuid; purchase_id uuid;
begin
 if public.breakfast_window_open('2026-10-23','2026-10-22T10:59:59.999Z')
 or not public.breakfast_window_open('2026-10-23','2026-10-22T11:00:00Z')
 or not public.breakfast_window_open('2026-10-23','2026-10-22T17:59:59.999Z')
 or public.breakfast_window_open('2026-10-23','2026-10-22T18:00:00Z') then raise exception 'incorrect family-time boundaries';end if;
 insert into public.family_members(id,display_name,role) values(m,'Synthetic Child','MEMBER'),(p,'Synthetic Parent','PARENT'),(other_member,'Synthetic Other','MEMBER');
 d=(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
 if (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::time>=time '18:00' then d=d+1;end if;
 if public.breakfast_window_open(d,clock_timestamp()) and not exists(select 1 from public.breakfast_purchases where breakfast_date=d) then
  insert into public.breakfast_selections(member_id,breakfast_date,selection_type,custom_dish_name) values(m,d,'CUSTOM','Synthetic breakfast');
  update public.breakfast_selections set custom_dish_name='Synthetic changed breakfast' where member_id=m and breakfast_date=d;
  if (select count(*) from public.breakfast_selections where member_id=m)<>1 then raise exception 'breakfast update duplicated history';end if;
  begin insert into public.breakfast_selections(member_id,breakfast_date,selection_type) values(p,d,'NOT_EATING');raise exception 'parent response accepted';exception when insufficient_privilege then null;end;
  -- Never call fan-out against real recipients. Only synthetic parent/purchase/notification rows are involved.
  if exists(select 1 from public.breakfast_purchases where breakfast_date=d) then
   raise exception 'existing real purchase overlaps synthetic date; no changes permitted';
  end if;
  insert into public.breakfast_purchases(breakfast_date,confirmed_by_member_id,message) values(d,p,'Synthetic message') returning id into purchase_id;
  begin update public.breakfast_selections set custom_dish_name='Late change' where member_id=m;raise exception 'post-purchase edit accepted';exception when sqlstate 'P1001' then null;end;
  if not exists(select 1 from public.breakfast_selections where member_id=m and custom_dish_name='Synthetic changed breakfast') then raise exception 'purchase destroyed selection';end if;
 end if;
 begin insert into public.breakfast_selections(member_id,breakfast_date,selection_type) values(m,d+2,'NOT_EATING');raise exception 'pre-open response accepted';exception when sqlstate 'P1001' then null;end;
 begin insert into public.breakfast_selections(member_id,breakfast_date,selection_type) values(m,d-2,'NOT_EATING');raise exception 'late response accepted';exception when sqlstate 'P1001' then null;end;
 if exists(select 1 from public.breakfast_selections where member_id=other_member) then raise exception 'missing response became persisted';end if;
 insert into public.notifications(id,recipient_member_id,type,title,message) values(n,m,'SYNTHETIC','Synthetic notice','Synthetic notice');
 update public.notifications set read_at=old_read where id=n and recipient_member_id=m and read_at is null;
 update public.notifications set read_at=clock_timestamp() where id=n and recipient_member_id=other_member and read_at is null;
 update public.notifications set read_at=clock_timestamp() where id=n and recipient_member_id=m and read_at is null;
 if (select read_at from public.notifications where id=n) is distinct from old_read then raise exception 'read timestamp changed on retry';end if;
 if (select count(*) from public.notifications where recipient_member_id=m and read_at is null)<>0 then raise exception 'unread count wrong';end if;
 insert into public.meal_requests(id,created_by_member_id,meal_date,meal_type,mode,status,deadline_at) values(req,p,'2098-09-14','DINNER','OPTION_POLL','OPEN','2098-09-14T07:00:00Z');
 insert into public.meal_request_options(meal_request_id,label,sort_order) values(req,'Synthetic A',1),(req,'Synthetic B',2);
 response_id=public.save_meal_response(m,req,'CUSTOM',null,'Con ăn cơm gà');
 perform public.save_meal_response(m,req,'CUSTOM',null,'Con ăn bún bò');
 if (select count(*) from public.meal_responses where meal_request_id=req and member_id=m)<>1 then raise exception 'response update duplicated row';end if;
 if (select count(*) from public.meal_request_options where meal_request_id=req)<>2 then raise exception 'legacy options destroyed';end if;
 begin perform public.save_meal_response(p,req,'CUSTOM',null,'Unauthorized');raise exception 'parent response accepted';exception when check_violation then null;end;
 -- Direct inserts do not fan out notifications. Never update a request's state here:
 -- its existing status trigger targets every active family member.
 insert into public.meal_requests(id,created_by_member_id,meal_date,meal_type,mode,status,deadline_at) values('fa700000-0000-4000-8000-000000000012',p,'2098-09-15','DINNER','OPEN_CHOICE','CLOSED','2098-09-15T07:00:00Z');
 begin perform public.save_meal_response(m,'fa700000-0000-4000-8000-000000000012','CUSTOM',null,'Late');raise exception 'late dinner accepted';exception when check_violation then null;end;
end $$;
reset role;
do $$begin
 if has_function_privilege('anon','public.breakfast_window_open(date,timestamptz)','execute') or has_function_privilege('authenticated','public.guard_breakfast_cycle()','execute') then raise exception 'unsafe function grants';end if;
 if exists(select 1 from pg_proc where oid in('public.breakfast_window_open(date,timestamptz)'::regprocedure,'public.guard_breakfast_cycle()'::regprocedure,'public.validate_meal_response()'::regprocedure) and prosecdef) then raise exception 'unsafe definer context';end if;
end $$;
rollback;
select count(*) as synthetic_members_remaining from public.family_members where id in('fa700000-0000-4000-8000-000000000001','fa700000-0000-4000-8000-000000000002','fa700000-0000-4000-8000-000000000003');
