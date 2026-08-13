-- Loxam Module Yard — database foundation
-- Hierarchical yard: block → row → position → level (GROUND, LEVEL_1, LEVEL_2)
-- Occupancy is unique per block + row + position + level.
-- Movement history is append-only.
--
-- Requires a clean public schema for these objects. If a previous SQL Editor
-- run failed partway, execute supabase/scripts/cleanup_migration_1.sql first.

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'ADMIN',
  'FORKLIFT_DRIVER',
  'OFFICE',
  'PRODUCTION'
);

create type public.stack_level as enum (
  'GROUND',
  'LEVEL_1',
  'LEVEL_2'
);

create type public.module_status as enum (
  'AVAILABLE',
  'RENTED'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.app_role not null default 'PRODUCTION',
  locale text not null default 'nl' check (locale in ('nl', 'fr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.has_role(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = any (roles)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'ADMIN'::public.app_role
$$;

create table public.module_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('6x3', '3x3')),
  length_m numeric(4, 1) not null,
  width_m numeric(4, 1) not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.yard_blocks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.yard_rows (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.yard_blocks (id) on delete cascade,
  code text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (block_id, code),
  unique (id, block_id)
);

create table public.yard_positions (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references public.yard_rows (id) on delete cascade,
  code text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (row_id, code),
  unique (id, row_id)
);

create table public.yard_slots (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.yard_blocks (id) on delete cascade,
  row_id uuid not null,
  position_id uuid not null,
  level public.stack_level not null,
  created_at timestamptz not null default now(),
  unique (position_id, level),
  unique (block_id, row_id, position_id, level),
  foreign key (row_id, block_id) references public.yard_rows (id, block_id) on delete cascade,
  foreign key (position_id, row_id) references public.yard_positions (id, row_id) on delete cascade
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  module_number text not null unique,
  module_type_id uuid not null references public.module_types (id),
  status public.module_status not null default 'AVAILABLE',
  rented_to_project text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modules_rental_consistency check (
    (status = 'AVAILABLE' and rented_to_project is null)
    or (status = 'RENTED' and rented_to_project is not null)
  )
);

create table public.module_locations (
  module_id uuid primary key references public.modules (id) on delete cascade,
  slot_id uuid not null unique references public.yard_slots (id),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.module_movements (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete restrict,
  from_slot_id uuid references public.yard_slots (id) on delete set null,
  to_slot_id uuid references public.yard_slots (id) on delete set null,
  moved_by uuid references public.profiles (id) on delete set null,
  moved_at timestamptz not null default now(),
  notes text
);

create table public.module_photos (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  byte_size integer,
  caption text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.air_conditioning_units (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  brand text not null,
  serial_number text not null unique,
  internal_number text not null,
  last_maintenance_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'locale', 'nl')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_slots_for_position()
returns trigger
language plpgsql
as $$
declare
  v_block_id uuid;
begin
  select block_id into strict v_block_id
  from public.yard_rows
  where id = new.row_id;

  insert into public.yard_slots (block_id, row_id, position_id, level)
  select v_block_id, new.row_id, new.id, lvl
  from unnest(enum_range(null::public.stack_level)) as lvl;

  return new;
end;
$$;

create trigger yard_positions_create_slots
  after insert on public.yard_positions
  for each row execute function public.create_slots_for_position();

create or replace function public.record_module_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.module_movements (
      module_id, from_slot_id, to_slot_id, moved_by, notes
    ) values (
      new.module_id, null, new.slot_id, new.updated_by, 'Current location set'
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if new.slot_id is distinct from old.slot_id then
      insert into public.module_movements (
        module_id, from_slot_id, to_slot_id, moved_by, notes
      ) values (
        new.module_id, old.slot_id, new.slot_id, new.updated_by, 'Module moved'
      );
    end if;
    return new;
  else
    insert into public.module_movements (
      module_id, from_slot_id, to_slot_id, moved_by, notes
    ) values (
      old.module_id, old.slot_id, null, old.updated_by, 'Module removed from yard'
    );
    return old;
  end if;
end;
$$;

create trigger module_locations_record_movement
  after insert or update or delete on public.module_locations
  for each row execute function public.record_module_movement();

create or replace function public.prevent_movement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'module_movements is immutable';
end;
$$;

create trigger module_movements_immutable
  before update or delete on public.module_movements
  for each row execute function public.prevent_movement_mutation();

create or replace function public.enforce_module_update_permissions()
returns trigger
language plpgsql
as $$
declare
  v_role public.app_role;
begin
  v_role := public.current_app_role();

  if v_role is null or v_role = 'ADMIN' then
    return new;
  end if;

  if v_role = 'OFFICE' then
    if new.module_number is distinct from old.module_number
      or new.module_type_id is distinct from old.module_type_id then
      raise exception 'OFFICE cannot change module number or type';
    end if;
    return new;
  end if;

  raise exception 'Role % cannot update modules', v_role;
end;
$$;

create trigger modules_enforce_update_permissions
  before update on public.modules
  for each row execute function public.enforce_module_update_permissions();

create or replace function public.enforce_airco_update_permissions()
returns trigger
language plpgsql
as $$
declare
  v_role public.app_role;
begin
  v_role := public.current_app_role();

  if v_role is null or v_role in ('ADMIN', 'OFFICE') then
    return new;
  end if;

  if v_role = 'PRODUCTION' then
    if new.module_id is distinct from old.module_id
      or new.brand is distinct from old.brand
      or new.serial_number is distinct from old.serial_number
      or new.internal_number is distinct from old.internal_number then
      raise exception 'PRODUCTION can only update airco maintenance fields';
    end if;
    return new;
  end if;

  raise exception 'Role % cannot update air-conditioning units', v_role;
end;
$$;

create trigger airco_enforce_update_permissions
  before update on public.air_conditioning_units
  for each row execute function public.enforce_airco_update_permissions();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_modules_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

create trigger set_module_locations_updated_at
  before update on public.module_locations
  for each row execute function public.set_updated_at();

create trigger set_airco_updated_at
  before update on public.air_conditioning_units
  for each row execute function public.set_updated_at();

create index module_movements_module_id_moved_at_idx
  on public.module_movements (module_id, moved_at desc);

create index module_photos_module_id_idx
  on public.module_photos (module_id);

create index air_conditioning_units_module_id_idx
  on public.air_conditioning_units (module_id);

create index yard_slots_block_row_position_idx
  on public.yard_slots (block_id, row_id, position_id);

create view public.module_location_view
with (security_invoker = true) as
select
  m.id as module_id,
  m.module_number,
  m.status,
  m.rented_to_project,
  mt.code as module_type_code,
  mt.length_m,
  mt.width_m,
  b.code as block_code,
  r.code as row_code,
  p.code as position_code,
  s.level,
  s.id as slot_id,
  ml.updated_at as located_at
from public.modules m
join public.module_types mt on mt.id = m.module_type_id
left join public.module_locations ml on ml.module_id = m.id
left join public.yard_slots s on s.id = ml.slot_id
left join public.yard_positions p on p.id = s.position_id
left join public.yard_rows r on r.id = s.row_id
left join public.yard_blocks b on b.id = s.block_id;
