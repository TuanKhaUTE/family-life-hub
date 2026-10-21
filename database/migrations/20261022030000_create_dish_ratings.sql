create table public.final_meal_dish_ratings (
  id uuid primary key default gen_random_uuid(),
  final_meal_dish_id uuid not null references public.final_meal_dishes(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or (
    comment = btrim(comment, E' \t\n\r\f' || chr(11)) and char_length(comment) between 1 and 300
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint final_meal_dish_ratings_owner_key unique (final_meal_dish_id, member_id)
);
create index final_meal_dish_ratings_member_idx on public.final_meal_dish_ratings(member_id);
create trigger final_meal_dish_ratings_updated before update on public.final_meal_dish_ratings
for each row execute function public.set_updated_at();

-- Lock the meal before the dish to serialize with the existing whole-list save.
-- Recheck the dish after waiting: it may have been replaced in that transaction.
create function public.guard_dish_rating()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_meal_id uuid;
  v_ready timestamptz;
begin
  if tg_op = 'UPDATE' and (new.member_id <> old.member_id or new.final_meal_dish_id <> old.final_meal_dish_id) then
    raise exception 'rating identity cannot change' using errcode = '42501';
  end if;
  perform 1 from public.family_members
  where id = new.member_id and is_active and role in ('ADMIN', 'MEMBER') for share;
  if not found then
    raise exception 'active non-parent required' using errcode = '42501';
  end if;
  select final_meal_id into v_meal_id from public.final_meal_dishes where id = new.final_meal_dish_id;
  if not found then
    raise exception 'dish not found' using errcode = 'P0002';
  end if;
  select ready_at into v_ready from public.final_meals where id = v_meal_id for update;
  perform 1 from public.final_meal_dishes where id = new.final_meal_dish_id and final_meal_id = v_meal_id for key share;
  if not found then
    raise exception 'dish no longer exists' using errcode = 'P0002';
  end if;
  if v_ready is null then
    raise exception 'meal is not ready' using errcode = 'P2002';
  end if;
  return new;
end;
$$;
create trigger final_meal_dish_ratings_guard before insert or update on public.final_meal_dish_ratings
for each row execute function public.guard_dish_rating();

alter table public.final_meal_dish_ratings enable row level security;
revoke all privileges on public.final_meal_dish_ratings from public, anon, authenticated;
grant select, insert, update on public.final_meal_dish_ratings to service_role;

create function public.read_final_meal_dish_ratings(p_actor_member_id uuid, p_meal_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_parent boolean;
  v_ready boolean;
begin
  select role = 'PARENT' into v_parent from public.family_members
  where id = p_actor_member_id and is_active;
  if not found then
    raise exception 'active member required' using errcode = '42501';
  end if;
  select ready_at is not null into v_ready from public.final_meals where id = p_meal_id;
  if not found then
    raise exception 'meal not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('mealId', p_meal_id, 'ready', v_ready, 'dishes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', dish.id, 'name', dish.name, 'category', dish.category, 'sortOrder', dish.sort_order,
      'ratings', (select coalesce(jsonb_agg(jsonb_build_object(
        'memberId', feedback.member_id, 'displayName', member.display_name,
        'rating', feedback.rating, 'comment', feedback.comment,
        'createdAt', feedback.created_at, 'updatedAt', feedback.updated_at
      ) order by feedback.created_at, feedback.id), '[]'::jsonb)
      from public.final_meal_dish_ratings as feedback
      join public.family_members as member on member.id = feedback.member_id
      where feedback.final_meal_dish_id = dish.id and (v_parent or feedback.member_id = p_actor_member_id))
    ) order by dish.sort_order), '[]'::jsonb)
    from public.final_meal_dishes as dish where dish.final_meal_id = p_meal_id
  ));
end;
$$;

create function public.save_final_meal_dish_rating(
  p_actor_member_id uuid, p_dish_id uuid, p_rating integer, p_comment text default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_rating public.final_meal_dish_ratings%rowtype;
  v_comment text := nullif(btrim(p_comment, E' \t\n\r\f' || chr(11)), '');
begin
  if p_rating is null or p_rating not between 1 and 5 or char_length(v_comment) > 300 then
    raise exception 'invalid feedback' using errcode = '22023';
  end if;
  insert into public.final_meal_dish_ratings (final_meal_dish_id, member_id, rating, comment)
  values (p_dish_id, p_actor_member_id, p_rating, v_comment)
  on conflict on constraint final_meal_dish_ratings_owner_key do update set
    rating = excluded.rating, comment = excluded.comment
  returning * into v_rating;
  return jsonb_build_object(
    'memberId', v_rating.member_id,
    'displayName', (select display_name from public.family_members where id = v_rating.member_id),
    'rating', v_rating.rating, 'comment', v_rating.comment,
    'createdAt', v_rating.created_at, 'updatedAt', v_rating.updated_at
  );
end;
$$;

revoke all privileges on function public.guard_dish_rating(),
  public.read_final_meal_dish_ratings(uuid,uuid), public.save_final_meal_dish_rating(uuid,uuid,integer,text)
from public, anon, authenticated;
grant execute on function public.guard_dish_rating(),
  public.read_final_meal_dish_ratings(uuid,uuid), public.save_final_meal_dish_rating(uuid,uuid,integer,text)
to service_role;
