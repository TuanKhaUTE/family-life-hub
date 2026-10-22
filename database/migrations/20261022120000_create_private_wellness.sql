create table public.wellness_profiles (
  owner_member_id uuid primary key references public.family_members(id) on delete restrict,
  height_cm numeric check (height_cm between 100 and 250 and height_cm = round(height_cm, 2)),
  target_weight_kg numeric check (target_weight_kg between 20 and 350 and target_weight_kg = round(target_weight_kg, 2)),
  activity_level text check (activity_level in ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE')),
  updated_at timestamptz not null default now()
);

create table public.wellness_weight_logs (
  id uuid primary key default gen_random_uuid(),
  owner_member_id uuid not null references public.family_members(id) on delete restrict,
  logged_date date not null check (logged_date between date '2000-01-01' and date '2199-12-31'),
  weight_kg numeric not null check (weight_kg between 20 and 350 and weight_kg = round(weight_kg, 2)),
  note text check (note is null or (
    note = btrim(note, E' \t\n\r\f' || chr(11)) and char_length(note) between 1 and 1000
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_member_id, logged_date)
);

create function public.wellness_guard_owner() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.owner_member_id <> old.owner_member_id then
    raise exception 'immutable Wellness owner' using errcode = '42501';
  end if;
  perform 1 from public.family_members
    where id = new.owner_member_id and is_active and role in ('ADMIN', 'MEMBER') for share;
  if not found then
    raise exception 'active Wellness owner required' using errcode = '42501';
  end if;
  if tg_table_name = 'wellness_weight_logs' then
    if tg_op = 'UPDATE' and new.id <> old.id then
      raise exception 'immutable Wellness identity' using errcode = '42501';
    end if;
    if new.logged_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
      raise exception 'future measurement' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['wellness_profiles', 'wellness_weight_logs'] loop
    execute format('create trigger wellness_owner_guard before insert or update on public.%I for each row execute function public.wellness_guard_owner()', t);
    execute format('create trigger wellness_updated before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

create function public.wellness_mutate(
  p_actor_member_id uuid, p_kind text, p_id uuid, p_input jsonb, p_remove boolean default false
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.family_members
    where id = p_actor_member_id and is_active and role in ('ADMIN', 'MEMBER') for share;
  if not found then raise exception 'Wellness access denied' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('profile', 'logs') or p_remove is null then
    raise exception 'invalid Wellness action' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wellness:' || p_actor_member_id::text, 0));
  if p_kind = 'profile' then
    if p_id is not null then raise exception 'invalid profile identity' using errcode = '22023'; end if;
    if p_remove then
      delete from public.wellness_profiles where owner_member_id = p_actor_member_id;
      return;
    end if;
    if jsonb_typeof(p_input) is distinct from 'object' then
      raise exception 'invalid Wellness input' using errcode = '22023';
    end if;
    insert into public.wellness_profiles(owner_member_id, height_cm, target_weight_kg, activity_level)
      values (p_actor_member_id, (p_input->>'heightCm')::numeric, (p_input->>'targetWeightKg')::numeric, p_input->>'activityLevel')
      on conflict (owner_member_id) do update set
        height_cm = excluded.height_cm, target_weight_kg = excluded.target_weight_kg, activity_level = excluded.activity_level;
    return;
  end if;
  if p_id is not null then
    perform 1 from public.wellness_weight_logs
      where id = p_id and owner_member_id = p_actor_member_id for update;
    if not found then raise exception 'Wellness record not found' using errcode = 'P0002'; end if;
  end if;
  if p_remove then
    if p_id is null then raise exception 'measurement identity required' using errcode = '22023'; end if;
    delete from public.wellness_weight_logs where id = p_id and owner_member_id = p_actor_member_id;
    return;
  end if;
  if jsonb_typeof(p_input) is distinct from 'object' then
    raise exception 'invalid Wellness input' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.wellness_weight_logs(owner_member_id, logged_date, weight_kg, note)
      values (p_actor_member_id, (p_input->>'loggedDate')::date, (p_input->>'weightKg')::numeric, p_input->>'note');
  else
    update public.wellness_weight_logs set
      logged_date = (p_input->>'loggedDate')::date, weight_kg = (p_input->>'weightKg')::numeric, note = p_input->>'note'
      where id = p_id and owner_member_id = p_actor_member_id;
  end if;
end $$;

create function public.wellness_read(p_actor_member_id uuid, p_today date) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.family_members
    where id = p_actor_member_id and is_active and role in ('ADMIN', 'MEMBER')) then
    raise exception 'Wellness access denied' using errcode = '42501';
  end if;
  if p_today is null or p_today not between date '2000-01-01' and date '2199-12-31' then
    raise exception 'invalid Wellness date' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'profile', (select jsonb_build_object('heightCm', height_cm, 'targetWeightKg', target_weight_kg, 'activityLevel', activity_level)
      from public.wellness_profiles where owner_member_id = p_actor_member_id),
    'logs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'loggedDate', logged_date, 'weightKg', weight_kg, 'note', note)
      order by logged_date desc), '[]'::jsonb) from (
        select id, logged_date, weight_kg, note from public.wellness_weight_logs
        where owner_member_id = p_actor_member_id and logged_date <= p_today order by logged_date desc limit 31
      ) recent)
  );
end $$;

revoke all privileges on function public.wellness_guard_owner(), public.wellness_mutate(uuid,text,uuid,jsonb,boolean), public.wellness_read(uuid,date)
  from public, anon, authenticated;
grant execute on function public.wellness_guard_owner(), public.wellness_mutate(uuid,text,uuid,jsonb,boolean), public.wellness_read(uuid,date)
  to service_role;
