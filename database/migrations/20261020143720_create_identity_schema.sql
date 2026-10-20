create type public.family_member_role as enum ('ADMIN', 'PARENT', 'MEMBER');

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role public.family_member_role not null,
  avatar_type text,
  avatar_value text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_members_display_name_valid check (
    display_name = btrim(display_name)
    and char_length(display_name) between 1 and 100
  ),
  constraint family_members_avatar_pair_valid check (
    (avatar_type is null and avatar_value is null)
    or (
      avatar_type is not null
      and avatar_type = btrim(avatar_type)
      and char_length(avatar_type) > 0
      and avatar_value is not null
      and avatar_value = btrim(avatar_value)
      and char_length(avatar_value) > 0
    )
  )
);

create table public.auth_credentials (
  member_id uuid primary key,
  pin_hash text not null,
  pin_changed_at timestamptz not null default now(),
  failed_attempt_count integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_credentials_member_id_fkey
    foreign key (member_id)
    references public.family_members (id)
    on delete cascade,
  constraint auth_credentials_pin_hash_valid check (
    pin_hash = btrim(pin_hash)
    and char_length(pin_hash) >= 20
  ),
  constraint auth_credentials_failed_attempt_count_valid check (
    failed_attempt_count >= 0
  )
);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger family_members_set_updated_at
before update on public.family_members
for each row
execute function public.set_updated_at();

create trigger auth_credentials_set_updated_at
before update on public.auth_credentials
for each row
execute function public.set_updated_at();

alter table public.family_members enable row level security;
alter table public.auth_credentials enable row level security;

revoke all privileges on table public.family_members
from public, anon, authenticated;
revoke all privileges on table public.auth_credentials
from public, anon, authenticated;

grant select, insert, update, delete on table public.family_members
to service_role;
grant select, insert, update, delete on table public.auth_credentials
to service_role;

revoke all privileges on type public.family_member_role from public;
grant usage on type public.family_member_role to service_role;

revoke all privileges on function public.set_updated_at()
from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;
