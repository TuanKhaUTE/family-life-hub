create table public.personal_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_member_id uuid not null references public.family_members(id) on delete restrict,
  amount bigint not null check (amount between 1 and 1000000000),
  spent_on date not null check (spent_on between date '2000-01-01' and date '2199-12-31'),
  category text not null check (category in ('FOOD','TRANSPORT','SHOPPING','ENTERTAINMENT','STUDY','FITNESS','BILLS','OTHER')),
  note text check (note is null or (note = btrim(note,E' \t\n\r\f'||chr(11)) and char_length(note) between 1 and 1000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index personal_expenses_owner_date on public.personal_expenses(owner_member_id,spent_on desc,created_at desc,id desc);

create function public.personal_expense_guard_owner() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.owner_member_id <> old.owner_member_id) then
    raise exception 'immutable personal expense identity' using errcode = '42501';
  end if;
  perform 1 from public.family_members
    where id = new.owner_member_id and is_active and role in ('PARENT','ADMIN','MEMBER') for share;
  if not found then raise exception 'active expense owner required' using errcode = '42501'; end if;
  if new.spent_on > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'future personal expense' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger personal_expense_owner_guard before insert or update on public.personal_expenses
  for each row execute function public.personal_expense_guard_owner();
create trigger personal_expense_updated before update on public.personal_expenses
  for each row execute function public.set_updated_at();
alter table public.personal_expenses enable row level security;
revoke all privileges on public.personal_expenses from public,anon,authenticated;
grant select,insert,update,delete on public.personal_expenses to service_role;

create function public.personal_expense_mutate(p_actor_member_id uuid,p_id uuid,p_input jsonb,p_remove boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.family_members
    where id = p_actor_member_id and is_active and role in ('PARENT','ADMIN','MEMBER') for share;
  if not found then raise exception 'personal expense access denied' using errcode = '42501'; end if;
  if p_remove is null then raise exception 'invalid expense action' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('personal-expense:'||p_actor_member_id::text,0));
  if p_id is not null then
    perform 1 from public.personal_expenses where id = p_id and owner_member_id = p_actor_member_id for update;
    if not found then raise exception 'personal expense not found' using errcode = 'P0002'; end if;
  end if;
  if p_remove then
    if p_id is null then raise exception 'expense identity required' using errcode = '22023'; end if;
    delete from public.personal_expenses where id = p_id and owner_member_id = p_actor_member_id;
    return;
  end if;
  if jsonb_typeof(p_input) is distinct from 'object' then
    raise exception 'invalid expense input' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.personal_expenses(owner_member_id,amount,spent_on,category,note)
      values (p_actor_member_id,(p_input->>'amount')::bigint,(p_input->>'spentOn')::date,p_input->>'category',p_input->>'note');
  else
    update public.personal_expenses set amount = (p_input->>'amount')::bigint, spent_on = (p_input->>'spentOn')::date,
      category = p_input->>'category', note = p_input->>'note' where id = p_id and owner_member_id = p_actor_member_id;
  end if;
end $$;

create function public.personal_expense_read(p_actor_member_id uuid,p_month date,p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.family_members where id = p_actor_member_id and is_active and role in ('PARENT','ADMIN','MEMBER')) then
    raise exception 'personal expense access denied' using errcode = '42501';
  end if;
  if p_month is null or p_month not between date '2000-01-01' and date '2199-12-01'
    or extract(day from p_month) <> 1 or p_page is null or p_page not between 1 and 100000 then
    raise exception 'invalid expense month/page' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'currentTotal',(select coalesce(sum(amount),0)::text from public.personal_expenses
      where owner_member_id = p_actor_member_id and spent_on >= p_month and spent_on < p_month + interval '1 month'),
    'previousTotal',(select coalesce(sum(amount),0)::text from public.personal_expenses
      where owner_member_id = p_actor_member_id and spent_on >= p_month - interval '1 month' and spent_on < p_month),
    'totalCount',(select count(*) from public.personal_expenses
      where owner_member_id = p_actor_member_id and spent_on >= p_month and spent_on < p_month + interval '1 month'),
    'categories',(select coalesce(jsonb_agg(jsonb_build_object('category',category,'amount',total::text) order by total desc,category),'[]'::jsonb)
      from (select category,sum(amount) as total from public.personal_expenses
        where owner_member_id = p_actor_member_id and spent_on >= p_month and spent_on < p_month + interval '1 month' group by category) breakdown),
    'expenses',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount::text,'spentOn',spent_on,'category',category,'note',note)
      order by spent_on desc,created_at desc,id desc),'[]'::jsonb) from (
        select id,amount,spent_on,category,note,created_at from public.personal_expenses
        where owner_member_id = p_actor_member_id and spent_on >= p_month and spent_on < p_month + interval '1 month'
        order by spent_on desc,created_at desc,id desc limit 20 offset ((p_page-1)*20)
      ) recent)
  );
end $$;
revoke all privileges on function public.personal_expense_guard_owner(),public.personal_expense_mutate(uuid,uuid,jsonb,boolean),public.personal_expense_read(uuid,date,integer)
  from public,anon,authenticated;
grant execute on function public.personal_expense_guard_owner(),public.personal_expense_mutate(uuid,uuid,jsonb,boolean),public.personal_expense_read(uuid,date,integer)
  to service_role;
