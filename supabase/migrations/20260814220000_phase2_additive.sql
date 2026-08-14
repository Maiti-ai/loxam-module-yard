-- Phase 2 additive, backwards-compatible schema.
-- Does not drop existing yard cells, modules, photos, or history.
-- Existing fictitious modules 2000–2009 keep their current A/B locations.

-- ---------------------------------------------------------------------------
-- Catalog / settings
-- ---------------------------------------------------------------------------

alter table public.module_types
  add column if not exists type_number text,
  add column if not exists notes text,
  add column if not exists drawing_storage_path text,
  add column if not exists drawing_mime_type text;

alter table public.yard_blocks
  add column if not exists is_active boolean not null default true;

alter table public.module_photos
  add column if not exists category text not null default 'GENERAL';

alter table public.module_photos
  drop constraint if exists module_photos_category_check;

alter table public.module_photos
  add constraint module_photos_category_check
  check (category in ('GENERAL', 'TECHNICAL', 'DAMAGE', 'BEFORE_DEPARTURE', 'RETURN'));

create table if not exists public.app_settings (
  key text primary key,
  value_json jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value_json)
values ('AIRCO_MAINTENANCE_INTERVAL_MONTHS', 'null'::jsonb)
on conflict (key) do nothing;

create table if not exists public.equipment_kinds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  sort_order integer not null default 0,
  icon_storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.module_type_equipment (
  module_type_id uuid not null references public.module_types (id) on delete cascade,
  equipment_kind_id uuid not null references public.equipment_kinds (id) on delete cascade,
  quantity integer,
  notes text,
  primary key (module_type_id, equipment_kind_id)
);

-- Future damage workflow. No UI in Phase 2.
create table if not exists public.damage_reports (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete restrict,
  reported_by uuid references public.profiles (id) on delete set null,
  reported_at timestamptz not null default now(),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.damage_report_photos (
  report_id uuid not null references public.damage_reports (id) on delete cascade,
  photo_id uuid not null references public.module_photos (id) on delete cascade,
  primary key (report_id, photo_id)
);

insert into public.equipment_kinds (code, sort_order)
values
  ('outlets', 1),
  ('lighting', 2),
  ('motion', 3),
  ('kitchenette', 4),
  ('wc', 5),
  ('basin', 6),
  ('power', 7),
  ('airco', 8)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

create or replace view public.module_location_view
with (security_invoker = true) as
select
  m.id as module_id,
  m.module_number,
  m.status,
  m.rented_to_project,
  mt.code as module_type_code,
  mt.type_number as module_type_number,
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

create or replace view public.module_last_movement_view
with (security_invoker = true) as
select distinct on (module_id)
  module_id,
  moved_at,
  moved_by
from public.module_movements
order by module_id, moved_at desc;

-- ---------------------------------------------------------------------------
-- Operational role expansion (additive policies; data unchanged)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_airco_update_permissions()
returns trigger
language plpgsql
as $$
declare
  v_role public.app_role;
begin
  v_role := public.current_app_role();

  if v_role is null or v_role in ('ADMIN', 'OFFICE', 'FORKLIFT_DRIVER') then
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

drop policy if exists module_locations_write_movers on public.module_locations;
create policy module_locations_write_movers
  on public.module_locations for all to authenticated
  using (
    public.has_role(
      array['ADMIN', 'FORKLIFT_DRIVER', 'OFFICE', 'PRODUCTION']::public.app_role[]
    )
  )
  with check (
    public.has_role(
      array['ADMIN', 'FORKLIFT_DRIVER', 'OFFICE', 'PRODUCTION']::public.app_role[]
    )
  );

drop policy if exists module_movements_insert_movers on public.module_movements;
create policy module_movements_insert_movers
  on public.module_movements for insert to authenticated
  with check (
    public.has_role(
      array['ADMIN', 'FORKLIFT_DRIVER', 'OFFICE', 'PRODUCTION']::public.app_role[]
    )
  );

drop policy if exists module_photos_write_office_admin on public.module_photos;
create policy module_photos_insert_ops
  on public.module_photos for insert to authenticated
  with check (
    public.has_role(
      array['ADMIN', 'OFFICE', 'FORKLIFT_DRIVER', 'PRODUCTION']::public.app_role[]
    )
  );

create policy module_photos_update_ops
  on public.module_photos for update to authenticated
  using (
    public.has_role(
      array['ADMIN', 'OFFICE', 'FORKLIFT_DRIVER', 'PRODUCTION']::public.app_role[]
    )
  )
  with check (
    public.has_role(
      array['ADMIN', 'OFFICE', 'FORKLIFT_DRIVER', 'PRODUCTION']::public.app_role[]
    )
  );

create policy module_photos_delete_admin
  on public.module_photos for delete to authenticated
  using (public.is_admin());

drop policy if exists module_photos_storage_insert on storage.objects;
create policy module_photos_storage_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'module-photos'
    and public.has_role(
      array['ADMIN', 'OFFICE', 'FORKLIFT_DRIVER', 'PRODUCTION']::public.app_role[]
    )
  );

drop policy if exists module_photos_storage_update on storage.objects;
create policy module_photos_storage_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'module-photos'
    and public.has_role(
      array['ADMIN', 'OFFICE', 'FORKLIFT_DRIVER', 'PRODUCTION']::public.app_role[]
    )
  )
  with check (
    bucket_id = 'module-photos'
    and public.has_role(
      array['ADMIN', 'OFFICE', 'FORKLIFT_DRIVER', 'PRODUCTION']::public.app_role[]
    )
  );

drop policy if exists airco_insert_office_admin on public.air_conditioning_units;
create policy airco_insert_office_admin
  on public.air_conditioning_units for insert to authenticated
  with check (
    public.has_role(
      array['ADMIN', 'OFFICE', 'FORKLIFT_DRIVER']::public.app_role[]
    )
  );

drop policy if exists airco_update_ops on public.air_conditioning_units;
create policy airco_update_ops
  on public.air_conditioning_units for update to authenticated
  using (
    public.has_role(
      array['ADMIN', 'OFFICE', 'FORKLIFT_DRIVER', 'PRODUCTION']::public.app_role[]
    )
  )
  with check (
    public.has_role(
      array['ADMIN', 'OFFICE', 'FORKLIFT_DRIVER', 'PRODUCTION']::public.app_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------------

alter table public.app_settings enable row level security;
alter table public.equipment_kinds enable row level security;
alter table public.module_type_equipment enable row level security;
alter table public.damage_reports enable row level security;
alter table public.damage_report_photos enable row level security;

grant select on table public.app_settings to authenticated;
grant insert, update, delete on table public.app_settings to authenticated;
grant select on table public.equipment_kinds to authenticated;
grant insert, update, delete on table public.equipment_kinds to authenticated;
grant select on table public.module_type_equipment to authenticated;
grant insert, update, delete on table public.module_type_equipment to authenticated;
grant select, insert on table public.damage_reports to authenticated;
grant select, insert on table public.damage_report_photos to authenticated;
grant select on table public.module_last_movement_view to authenticated;

create policy app_settings_select_authenticated
  on public.app_settings for select to authenticated
  using (true);

create policy app_settings_admin_write
  on public.app_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy equipment_kinds_select_authenticated
  on public.equipment_kinds for select to authenticated
  using (true);

create policy equipment_kinds_admin_write
  on public.equipment_kinds for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy module_type_equipment_select_authenticated
  on public.module_type_equipment for select to authenticated
  using (true);

create policy module_type_equipment_admin_write
  on public.module_type_equipment for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy damage_reports_select_authenticated
  on public.damage_reports for select to authenticated
  using (true);

create policy damage_reports_insert_ops
  on public.damage_reports for insert to authenticated
  with check (
    public.has_role(
      array['ADMIN', 'FORKLIFT_DRIVER', 'OFFICE', 'PRODUCTION']::public.app_role[]
    )
  );

create policy damage_report_photos_select_authenticated
  on public.damage_report_photos for select to authenticated
  using (true);

create policy damage_report_photos_insert_ops
  on public.damage_report_photos for insert to authenticated
  with check (
    public.has_role(
      array['ADMIN', 'FORKLIFT_DRIVER', 'OFFICE', 'PRODUCTION']::public.app_role[]
    )
  );

-- Type-level technical drawings (image or PDF). Files added later.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'module-type-drawings',
  'module-type-drawings',
  false,
  20971520,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy module_type_drawings_storage_select
  on storage.objects for select to authenticated
  using (bucket_id = 'module-type-drawings');

create policy module_type_drawings_storage_admin
  on storage.objects for all to authenticated
  using (bucket_id = 'module-type-drawings' and public.is_admin())
  with check (bucket_id = 'module-type-drawings' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Schelle yard structure: add C–F and extra A/B cells. Never move existing modules.
-- ---------------------------------------------------------------------------

insert into public.yard_blocks (code, name, sort_order, is_active)
values
  ('C', 'Block C', 3, true),
  ('D', 'Block D', 4, true),
  ('E', 'Block E', 5, true),
  ('F', 'Production', 6, true)
on conflict (code) do nothing;

update public.yard_blocks set name = 'Production', sort_order = 6 where code = 'F' and name <> 'Production';

insert into public.yard_rows (block_id, code, sort_order)
select b.id, r.code, r.sort_order
from public.yard_blocks b
join (
  values
    ('A', '3', 3),
    ('A', '4', 4),
    ('B', '3', 3),
    ('B', '4', 4),
    ('C', '1', 1),
    ('C', '2', 2),
    ('C', '3', 3),
    ('C', '4', 4),
    ('D', '1', 1),
    ('D', '2', 2),
    ('D', '3', 3),
    ('E', '1', 1),
    ('E', '2', 2),
    ('E', '3', 3),
    ('F', '1', 1),
    ('F', '2', 2)
) as r(block_code, code, sort_order) on r.block_code = b.code
where not exists (
  select 1
  from public.yard_rows existing
  where existing.block_id = b.id and existing.code = r.code
);

insert into public.yard_positions (row_id, code, sort_order)
select yr.id, p.code, p.sort_order
from public.yard_rows yr
join public.yard_blocks b on b.id = yr.block_id
join (
  values
    ('A', 6),
    ('B', 6),
    ('C', 6),
    ('D', 5),
    ('E', 4),
    ('F', 4)
) as spec(block_code, position_count) on spec.block_code = b.code
join generate_series(1, spec.position_count) as n(num) on true
join lateral (
  select lpad(n.num::text, 2, '0') as code, n.num as sort_order
) as p on true
where not exists (
  select 1
  from public.yard_positions existing
  where existing.row_id = yr.id and existing.code = p.code
);
