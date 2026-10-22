-- No scheduler and no real meal rows in this migration. An authenticated read
-- materializes only the relevant dinner question, once per existing slot key.
create function public.ensure_recurring_dinner(p_actor_member_id uuid,p_date date)
returns void language plpgsql security invoker set search_path='' as $$
declare parent_id uuid; today date:=(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active for share;
 if not found then raise exception 'active actor required' using errcode='42501'; end if;
 if p_date is null or p_date not in(today,today+1) then raise exception 'invalid dinner cycle' using errcode='22023'; end if;
 if clock_timestamp()<(((p_date-1)+time '18:00') at time zone 'Asia/Ho_Chi_Minh') then return; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_date::text||':DINNER',0));
 if exists(select 1 from public.meal_requests where meal_date=p_date and meal_type='DINNER') then return; end if;
 select id into parent_id from public.family_members where is_active and role='PARENT' order by(id=p_actor_member_id) desc,created_at,id limit 1 for share;
 if parent_id is null then raise exception 'active parent required' using errcode='42501'; end if;
 insert into public.meal_requests(meal_date,meal_type,mode,status,deadline_at,parent_message,created_by_member_id)
 values(p_date,'DINNER','OPEN_CHOICE','OPEN',(p_date+time '01:00') at time zone 'Asia/Ho_Chi_Minh',null,parent_id)
 on conflict on constraint meal_requests_slot_key do nothing;
end $$;
create function public.set_dinner_suggestion(p_actor_member_id uuid,p_id uuid,p_message text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.family_members where id=p_actor_member_id and is_active and role='PARENT' for share;
 if not found then raise exception 'active parent required' using errcode='42501'; end if;
 perform 1 from public.meal_requests where id=p_id and meal_type='DINNER' and status<>'CANCELLED' for update;
 if not found then raise exception 'dinner not found' using errcode='P0002'; end if;
 update public.meal_requests set parent_message=nullif(btrim(p_message),'') where id=p_id;
end $$;
create or replace function public.validate_meal_response() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.meal_requests%rowtype;
begin
 select * into r from public.meal_requests where id=new.meal_request_id for update;
 if not found then raise exception 'meal request does not exist' using errcode='23503';end if;
 if r.status<>'OPEN' or r.deadline_at<=clock_timestamp() or (r.meal_type='DINNER' and not public.breakfast_window_open(r.meal_date,clock_timestamp())) then raise exception 'meal request closed' using errcode='23514';end if;
 if not exists(select 1 from public.family_members where id=new.member_id and is_active and role in('ADMIN','MEMBER')) then raise exception 'active non-parent response owner required' using errcode='23514';end if;
 if r.mode='OPEN_CHOICE' and new.response_type not in('CUSTOM','NOT_EATING') then raise exception 'invalid open response' using errcode='23514';end if;
 if r.mode='OPTION_POLL' and new.response_type not in('SELECTED_OPTION','NOT_EATING') and not(r.meal_type='DINNER' and new.response_type='CUSTOM') then raise exception 'invalid poll response' using errcode='23514';end if;
 return new;
end $$;
revoke all on function public.ensure_recurring_dinner(uuid,date),public.set_dinner_suggestion(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ensure_recurring_dinner(uuid,date),public.set_dinner_suggestion(uuid,uuid,text) to service_role;
