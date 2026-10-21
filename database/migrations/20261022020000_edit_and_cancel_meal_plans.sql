alter table public.meal_requests drop constraint meal_requests_state_valid;
alter table public.meal_requests add constraint meal_requests_state_valid check (
  (status in ('OPEN','CLOSED') and mode in ('OPEN_CHOICE','OPTION_POLL') and deadline_at is not null)
  or (status = 'SELF_SERVICE' and mode is null and deadline_at is null)
  or (status = 'CANCELLED' and (
    (mode in ('OPEN_CHOICE','OPTION_POLL') and deadline_at is not null)
    or (mode is null and deadline_at is null)
  ))
);

alter table public.meal_request_options drop constraint meal_request_options_request_order_key;
alter table public.meal_request_options add constraint meal_request_options_request_order_key
  unique (meal_request_id, sort_order) deferrable initially immediate;

create or replace function public.sync_meal_request_notifications(p_request_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_request public.meal_requests%rowtype;
  v_label text;
  v_state text;
begin
  select * into strict v_request from public.meal_requests where id = p_request_id;
  v_label := case v_request.meal_type when 'LUNCH' then 'Bữa trưa' else 'Bữa tối' end;
  v_state := case
    when v_request.status = 'CANCELLED' then 'đã hủy kế hoạch'
    when v_request.status = 'SELF_SERVICE' then 'tự túc'
    when v_request.status = 'CLOSED' or v_request.deadline_at <= now() then 'đã đóng phản hồi'
    else 'cần bạn chọn món' end;
  insert into public.notifications (
    recipient_member_id,type,title,message,related_resource_type,related_resource_id,related_date
  ) select member.id,'MEAL_REQUEST_STATUS',v_label || ': ' || v_state,
    case when v_request.status = 'CANCELLED' then 'Kế hoạch bữa này đã hủy. Cả nhà không cần trả lời nữa nhé.'
      when v_request.status = 'CLOSED' or v_request.deadline_at <= now() then 'Bữa này đã ngừng nhận phản hồi.'
      else coalesce(v_request.parent_message, case when v_request.status = 'SELF_SERVICE'
        then 'Bữa này mọi người tự túc nhé.' else 'Cả nhà chọn món trước ' || to_char(v_request.deadline_at at time zone 'Asia/Ho_Chi_Minh','HH24:MI') || ' nhé.' end) end,
    'MEAL_REQUEST',v_request.id,v_request.meal_date
  from public.family_members as member where member.is_active and member.role in ('ADMIN','MEMBER')
  on conflict on constraint notifications_recipient_event_key do update set
    title=excluded.title,message=excluded.message,related_date=excluded.related_date;
end;
$$;

create function public.configure_meal_request(
  p_actor_member_id uuid, p_request_id uuid, p_status text, p_mode text,
  p_deadline_at timestamptz, p_parent_message text, p_options text[],
  p_confirm_response_reset boolean default false
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_request public.meal_requests%rowtype;
  v_options text[];
  v_message text := nullif(btrim(p_parent_message),'');
  v_invalid boolean;
begin
  if not exists(select 1 from public.family_members where id=p_actor_member_id and role='PARENT' and is_active) then
    raise exception 'active parent required' using errcode='42501';
  end if;
  select * into v_request from public.meal_requests where id=p_request_id;
  if not found then raise exception 'request not found' using errcode='P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_request.meal_date::text || ':' || v_request.meal_type,0));
  select * into v_request from public.meal_requests where id=p_request_id for update;
  if p_status is null or p_status not in ('OPEN','SELF_SERVICE','CANCELLED') then
    raise exception 'invalid status' using errcode='22023';
  end if;
  if p_status='CANCELLED' then
    update public.meal_requests set status='CANCELLED' where id=p_request_id;
    perform public.sync_meal_request_notifications(p_request_id);
    return p_request_id;
  end if;
  if v_message is not null and char_length(v_message)>300 then raise exception 'message too long' using errcode='22023'; end if;
  select coalesce(array_agg(btrim(label) order by position),'{}') into v_options
    from unnest(coalesce(p_options,'{}')) with ordinality as item(label,position);
  if p_mode is null or p_mode not in ('OPEN_CHOICE','OPTION_POLL','SELF_SERVICE')
    or (p_status='SELF_SERVICE') is distinct from (p_mode='SELF_SERVICE') then
    raise exception 'invalid mode' using errcode='22023';
  end if;
  if p_status='SELF_SERVICE' then
    if cardinality(v_options)<>0 or p_deadline_at is not null then raise exception 'invalid self service' using errcode='22023'; end if;
  else
    if p_deadline_at is null or p_deadline_at<=now() then raise exception 'future deadline required' using errcode='22023'; end if;
    if (p_mode='OPEN_CHOICE' and cardinality(v_options)<>0)
      or (p_mode='OPTION_POLL' and cardinality(v_options) not between 2 and 5)
      or exists(select 1 from unnest(v_options) as item(label) where label is null or char_length(label) not between 1 and 120)
      or cardinality(v_options)<>(select count(distinct lower(label)) from unnest(v_options) as item(label)) then
      raise exception 'invalid options' using errcode='22023';
    end if;
  end if;
  select exists (
    select 1 from public.meal_responses as response
    left join public.meal_request_options as option on option.id=response.option_id
    where response.meal_request_id=p_request_id and (
      p_status='SELF_SERVICE'
      or (response.response_type='CUSTOM' and p_mode<>'OPEN_CHOICE')
      or (response.response_type='SELECTED_OPTION' and (p_mode<>'OPTION_POLL' or not (option.label=any(v_options))))
    )
  ) into v_invalid;
  if v_invalid and not coalesce(p_confirm_response_reset,false) then
    raise exception 'response reset confirmation required' using errcode='P2002';
  end if;
  delete from public.meal_responses as response
  where response.meal_request_id=p_request_id and (
    p_status='SELF_SERVICE'
    or (response.response_type='CUSTOM' and p_mode<>'OPEN_CHOICE')
    or (response.response_type='SELECTED_OPTION' and (p_mode<>'OPTION_POLL' or not exists (
      select 1 from public.meal_request_options as option where option.id=response.option_id and option.label=any(v_options)
    )))
  );
  delete from public.meal_request_options where meal_request_id=p_request_id and not(label=any(v_options));
  set constraints public.meal_request_options_request_order_key deferred;
  update public.meal_request_options as option set sort_order=item.position::smallint
  from unnest(v_options) with ordinality as item(label,position)
  where option.meal_request_id=p_request_id and option.label=item.label;
  insert into public.meal_request_options(meal_request_id,label,sort_order)
  select p_request_id,item.label,item.position::smallint
  from unnest(v_options) with ordinality as item(label,position)
  where not exists(select 1 from public.meal_request_options as option where option.meal_request_id=p_request_id and option.label=item.label);
  set constraints public.meal_request_options_request_order_key immediate;
  update public.meal_requests set status=p_status,
    mode=case when p_status='SELF_SERVICE' then null else p_mode end,
    deadline_at=p_deadline_at,parent_message=v_message where id=p_request_id;
  perform public.sync_meal_request_notifications(p_request_id);
  return p_request_id;
end;
$$;

-- New creates may reuse a cancelled slot, while existing non-cancelled creates
-- retain the original idempotency/conflict behavior.
alter function public.create_meal_request(uuid,date,text,text,timestamptz,text,text[])
  rename to create_initial_meal_request;
create function public.create_meal_request(
  p_actor_member_id uuid,p_meal_date date,p_meal_type text,p_mode text,
  p_deadline_at timestamptz default null,p_parent_message text default null,p_options text[] default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_request public.meal_requests%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_meal_date::text || ':' || p_meal_type,0));
  select * into v_request from public.meal_requests where meal_date=p_meal_date and meal_type=p_meal_type for update;
  if found and v_request.status='CANCELLED' then
    return public.configure_meal_request(p_actor_member_id,v_request.id,case when p_mode='SELF_SERVICE' then 'SELF_SERVICE' else 'OPEN' end,p_mode,p_deadline_at,p_parent_message,p_options,false);
  end if;
  return public.create_initial_meal_request(p_actor_member_id,p_meal_date,p_meal_type,p_mode,p_deadline_at,p_parent_message,p_options);
end;
$$;

-- Serialize member saves with parent reconfiguration, so confirmation is
-- checked against all responses that exist at the time the edit is committed.
create or replace function public.save_meal_response(
  p_actor_member_id uuid,p_request_id uuid,p_response_type text,
  p_option_id uuid default null,p_custom_text text default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  perform 1 from public.meal_requests where id=p_request_id for update;
  insert into public.meal_responses as response(meal_request_id,member_id,response_type,option_id,custom_text)
  values(p_request_id,p_actor_member_id,p_response_type,p_option_id,nullif(btrim(p_custom_text),''))
  on conflict on constraint meal_responses_member_request_key do update set
    response_type=excluded.response_type,option_id=excluded.option_id,custom_text=excluded.custom_text
  returning response.id into v_id;
  return v_id;
end;
$$;

create function public.sync_meal_request_status_trigger()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin perform public.sync_meal_request_notifications(new.id); return null; end;
$$;
create trigger meal_requests_sync_status after update of status,deadline_at,parent_message on public.meal_requests
for each row execute function public.sync_meal_request_status_trigger();

revoke all on function public.configure_meal_request(uuid,uuid,text,text,timestamptz,text,text[],boolean),
  public.create_meal_request(uuid,date,text,text,timestamptz,text,text[]),public.sync_meal_request_status_trigger()
  from public,anon,authenticated;
grant execute on function public.configure_meal_request(uuid,uuid,text,text,timestamptz,text,text[],boolean),
  public.create_meal_request(uuid,date,text,text,timestamptz,text,text[]),public.sync_meal_request_status_trigger() to service_role;
