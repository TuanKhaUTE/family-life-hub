-- Family time is explicit; no database/session/device timezone is authoritative.
create function public.breakfast_window_open(p_date date,p_now timestamptz)
returns boolean language sql immutable security invoker set search_path='' as $$
 select p_now>=((p_date-1)+time '18:00') at time zone 'Asia/Ho_Chi_Minh'
 and p_now<(p_date+time '01:00') at time zone 'Asia/Ho_Chi_Minh';
$$;

create function public.guard_breakfast_cycle() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('breakfast-cycle:'||new.breakfast_date::text,0));
 if tg_table_name='breakfast_purchases' then return new;end if;
 if not public.breakfast_window_open(new.breakfast_date,clock_timestamp())
 or exists(select 1 from public.breakfast_purchases where breakfast_date=new.breakfast_date) then
  raise exception 'breakfast selection window closed' using errcode='P1001';end if;
 if not exists(select 1 from public.family_members where id=new.member_id and is_active and role in('ADMIN','MEMBER')) then
  raise exception 'active response owner required' using errcode='42501';end if;
 if tg_op='UPDATE' and (new.member_id<>old.member_id or new.breakfast_date<>old.breakfast_date) then
  raise exception 'breakfast identity cannot change' using errcode='42501';end if;
 return new;
end $$;
create trigger breakfast_cycle_guard before insert or update on public.breakfast_selections for each row execute function public.guard_breakfast_cycle();
create trigger breakfast_purchase_cycle_guard before insert or update on public.breakfast_purchases for each row execute function public.guard_breakfast_cycle();

-- Existing polls/options remain readable. An active legacy dinner can accept the
-- same free-text response as new dinners, without deleting its previous options.
create or replace function public.validate_meal_response() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.meal_requests%rowtype;
begin
 select * into r from public.meal_requests where id=new.meal_request_id;
 if not found then raise exception 'meal request does not exist' using errcode='23503';end if;
 if r.status<>'OPEN' or r.deadline_at<=clock_timestamp() then raise exception 'meal request closed' using errcode='23514';end if;
 if not exists(select 1 from public.family_members where id=new.member_id and is_active and role in('ADMIN','MEMBER')) then
  raise exception 'active non-parent response owner required' using errcode='23514';end if;
 if r.mode='OPEN_CHOICE' and new.response_type not in('CUSTOM','NOT_EATING') then raise exception 'invalid open response' using errcode='23514';end if;
 if r.mode='OPTION_POLL' and new.response_type not in('SELECTED_OPTION','NOT_EATING') and not(r.meal_type='DINNER' and new.response_type='CUSTOM') then
  raise exception 'invalid poll response' using errcode='23514';end if;
 return new;
end $$;
revoke all privileges on function public.breakfast_window_open(date,timestamptz),public.guard_breakfast_cycle(),public.validate_meal_response() from public,anon,authenticated;
grant execute on function public.breakfast_window_open(date,timestamptz),public.guard_breakfast_cycle(),public.validate_meal_response() to service_role;
