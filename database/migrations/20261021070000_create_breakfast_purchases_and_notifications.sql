create table public.breakfast_purchases (
  id uuid primary key default gen_random_uuid(),
  breakfast_date date not null unique,
  confirmed_by_member_id uuid not null,
  message text,
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint breakfast_purchases_confirmed_by_member_id_fkey
    foreign key (confirmed_by_member_id)
    references public.family_members (id)
    on delete restrict,
  constraint breakfast_purchases_message_valid check (
    message is null
    or (
      message = btrim(message)
      and char_length(message) between 1 and 300
    )
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_member_id uuid not null,
  type text not null,
  title text not null,
  message text not null,
  related_resource_type text,
  related_resource_id uuid,
  related_date date,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_recipient_member_id_fkey
    foreign key (recipient_member_id)
    references public.family_members (id)
    on delete cascade,
  constraint notifications_type_valid check (
    type ~ '^[A-Z][A-Z0-9_]{0,79}$'
  ),
  constraint notifications_title_valid check (
    title = btrim(title)
    and char_length(title) between 1 and 120
  ),
  constraint notifications_message_valid check (
    message = btrim(message)
    and char_length(message) between 1 and 500
  ),
  constraint notifications_related_resource_valid check (
    (related_resource_type is null and related_resource_id is null)
    or (
      related_resource_type is not null
      and related_resource_type = btrim(related_resource_type)
      and char_length(related_resource_type) between 1 and 80
      and related_resource_id is not null
    )
  ),
  constraint notifications_recipient_event_key
    unique (
      recipient_member_id,
      type,
      related_resource_type,
      related_resource_id
    )
);

create index notifications_recipient_created_at_idx
on public.notifications (recipient_member_id, created_at desc);

create index notifications_recipient_unread_idx
on public.notifications (recipient_member_id, created_at desc)
where read_at is null;

create trigger breakfast_purchases_set_updated_at
before update on public.breakfast_purchases
for each row
execute function public.set_updated_at();

alter table public.breakfast_purchases enable row level security;
alter table public.notifications enable row level security;

revoke all privileges on table public.breakfast_purchases
from public, anon, authenticated;
revoke all privileges on table public.notifications
from public, anon, authenticated;

grant select, insert, update on table public.breakfast_purchases
to service_role;
grant select, insert, update on table public.notifications
to service_role;

create function public.confirm_breakfast_purchase(
  p_actor_member_id uuid,
  p_breakfast_date date,
  p_message text default null
)
returns table (
  id uuid,
  breakfast_date date,
  confirmed_by_member_id uuid,
  confirmed_by_display_name text,
  message text,
  purchased_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_message text;
  v_purchase public.breakfast_purchases%rowtype;
begin
  if not exists (
    select 1
    from public.family_members as member
    where member.id = p_actor_member_id
      and member.role = 'PARENT'
      and member.is_active
  ) then
    raise exception 'breakfast purchase requires an active parent'
      using errcode = '42501';
  end if;

  v_message := nullif(btrim(p_message), '');

  if v_message is not null and char_length(v_message) > 300 then
    raise exception 'breakfast purchase message is too long'
      using errcode = '22001';
  end if;

  insert into public.breakfast_purchases as purchase (
    breakfast_date,
    confirmed_by_member_id,
    message
  ) values (
    p_breakfast_date,
    p_actor_member_id,
    v_message
  )
  on conflict on constraint breakfast_purchases_breakfast_date_key
  do update set
    confirmed_by_member_id = excluded.confirmed_by_member_id,
    message = excluded.message
  returning purchase.* into v_purchase;

  insert into public.notifications (
    recipient_member_id,
    type,
    title,
    message,
    related_resource_type,
    related_resource_id,
    related_date
  )
  select
    member.id,
    'BREAKFAST_PURCHASED',
    'Breakfast purchased',
    coalesce(v_message, 'Breakfast has been purchased.'),
    'BREAKFAST_PURCHASE',
    v_purchase.id,
    v_purchase.breakfast_date
  from public.family_members as member
  where member.is_active
    and member.role in ('ADMIN', 'MEMBER')
  on conflict on constraint notifications_recipient_event_key
  do update set
    title = excluded.title,
    message = excluded.message,
    related_date = excluded.related_date;

  return query
  select
    v_purchase.id,
    v_purchase.breakfast_date,
    v_purchase.confirmed_by_member_id,
    member.display_name,
    v_purchase.message,
    v_purchase.purchased_at,
    v_purchase.created_at,
    v_purchase.updated_at
  from public.family_members as member
  where member.id = v_purchase.confirmed_by_member_id;
end;
$$;

revoke all privileges on function public.confirm_breakfast_purchase(
  uuid,
  date,
  text
) from public, anon, authenticated;

grant execute on function public.confirm_breakfast_purchase(
  uuid,
  date,
  text
) to service_role;
