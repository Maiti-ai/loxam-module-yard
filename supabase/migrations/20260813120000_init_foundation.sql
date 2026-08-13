-- Foundation schema for Loxam Module Yard.
-- This prepares tables for the MVP. It does not implement the yard map
-- or module workflow, and it does not insert real company data.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'manager', 'operator', 'viewer');
create type public.module_status as enum (
  'available',
  'reserved',
  'on_site',
  'maintenance',
  'retired'
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
  role public.app_role not null default 'viewer',
  locale text not null default 'nl' check (locale in ('nl', 'fr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.yard_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique,
  name text,
  status public.module_status not null default 'available',
  yard_location_id uuid references public.yard_locations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  from_location_id uuid references public.yard_locations (id) on delete set null,
  to_location_id uuid references public.yard_locations (id) on delete set null,
  moved_by uuid references public.profiles (id) on delete set null,
  moved_at timestamptz not null default now(),
  notes text
);

create table public.module_photos (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  storage_path text not null,
  caption text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.air_conditioning (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  brand text,
  model text,
  refrigerant text,
  last_service_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_yard_locations_updated_at
  before update on public.yard_locations
  for each row execute function public.set_updated_at();

create trigger set_modules_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

create trigger set_air_conditioning_updated_at
  before update on public.air_conditioning
  for each row execute function public.set_updated_at();

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

alter table public.profiles enable row level security;
alter table public.yard_locations enable row level security;
alter table public.modules enable row level security;
alter table public.movements enable row level security;
alter table public.module_photos enable row level security;
alter table public.air_conditioning enable row level security;

-- RLS policies will be added with the authentication MVP.
-- Until then, tables stay locked down for anon/authenticated clients.
-- The service_role key bypasses RLS for trusted server-side admin work.
