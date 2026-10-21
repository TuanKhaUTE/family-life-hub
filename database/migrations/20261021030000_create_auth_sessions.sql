create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint auth_sessions_member_id_fkey
    foreign key (member_id)
    references public.family_members (id)
    on delete cascade,
  constraint auth_sessions_token_hash_valid check (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint auth_sessions_expiry_valid check (
    expires_at > created_at
  )
);

create index auth_sessions_member_id_idx
on public.auth_sessions (member_id);

create index auth_sessions_expires_at_idx
on public.auth_sessions (expires_at);

alter table public.auth_sessions enable row level security;

revoke all privileges on table public.auth_sessions
from public, anon, authenticated;

grant select, insert, update, delete on table public.auth_sessions
to service_role;
