create type public.breakfast_selection_type as enum (
  'SELECTED',
  'CUSTOM',
  'NOT_EATING'
);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dishes_created_by_fkey
    foreign key (created_by)
    references public.family_members (id)
    on delete set null,
  constraint dishes_name_valid check (
    name = btrim(name)
    and char_length(name) between 1 and 120
  )
);

create table public.breakfast_catalog (
  dish_id uuid primary key,
  display_order smallint not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint breakfast_catalog_dish_id_fkey
    foreign key (dish_id)
    references public.dishes (id)
    on delete restrict,
  constraint breakfast_catalog_display_order_valid check (
    display_order > 0
  )
);

create table public.breakfast_selections (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  breakfast_date date not null,
  selection_type public.breakfast_selection_type not null,
  dish_id uuid,
  custom_dish_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint breakfast_selections_member_id_fkey
    foreign key (member_id)
    references public.family_members (id)
    on delete cascade,
  constraint breakfast_selections_dish_id_fkey
    foreign key (dish_id)
    references public.dishes (id)
    on delete restrict,
  constraint breakfast_selections_member_date_key
    unique (member_id, breakfast_date),
  constraint breakfast_selections_choice_valid check (
    (
      selection_type = 'SELECTED'
      and dish_id is not null
      and custom_dish_name is null
    )
    or (
      selection_type = 'CUSTOM'
      and dish_id is null
      and custom_dish_name is not null
      and custom_dish_name = btrim(custom_dish_name)
      and char_length(custom_dish_name) between 1 and 120
    )
    or (
      selection_type = 'NOT_EATING'
      and dish_id is null
      and custom_dish_name is null
    )
  )
);

create index breakfast_selections_date_member_idx
on public.breakfast_selections (breakfast_date, member_id);

create index breakfast_selections_dish_id_idx
on public.breakfast_selections (dish_id)
where dish_id is not null;

create trigger dishes_set_updated_at
before update on public.dishes
for each row
execute function public.set_updated_at();

create trigger breakfast_catalog_set_updated_at
before update on public.breakfast_catalog
for each row
execute function public.set_updated_at();

create trigger breakfast_selections_set_updated_at
before update on public.breakfast_selections
for each row
execute function public.set_updated_at();

alter table public.dishes enable row level security;
alter table public.breakfast_catalog enable row level security;
alter table public.breakfast_selections enable row level security;

revoke all privileges on table public.dishes
from public, anon, authenticated;
revoke all privileges on table public.breakfast_catalog
from public, anon, authenticated;
revoke all privileges on table public.breakfast_selections
from public, anon, authenticated;

grant select, insert, update, delete on table public.dishes
to service_role;
grant select, insert, update, delete on table public.breakfast_catalog
to service_role;
grant select, insert, update, delete on table public.breakfast_selections
to service_role;

revoke all privileges on type public.breakfast_selection_type from public;
grant usage on type public.breakfast_selection_type to service_role;

with catalog_items (name, display_order) as (
  values
    ('Cơm tấm', 1),
    ('Bún chả', 2),
    ('Miến gà', 3),
    ('Bún thịt nướng', 4),
    ('Phở', 5),
    ('Bún riêu', 6),
    ('Bún bò', 7),
    ('Bánh cuốn', 8),
    ('Bánh mì', 9),
    ('Trứng ốp la + bánh mì sandwich + thịt nguội + xúc xích', 10),
    ('Mì gói', 11),
    ('Bánh canh cua', 12)
), inserted_dishes as (
  insert into public.dishes (name)
  select name
  from catalog_items
  order by display_order
  returning id, name
)
insert into public.breakfast_catalog (dish_id, display_order)
select inserted_dishes.id, catalog_items.display_order
from inserted_dishes
join catalog_items using (name)
order by catalog_items.display_order;
