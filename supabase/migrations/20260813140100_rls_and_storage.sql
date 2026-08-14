-- Row Level Security and Storage.
-- Authorization is enforced in Postgres. Hidden UI controls are not sufficient.

alter table public.profiles enable row level security;
alter table public.module_types enable row level security;
alter table public.yard_blocks enable row level security;
alter table public.yard_rows enable row level security;
alter table public.yard_positions enable row level security;
alter table public.yard_slots enable row level security;
alter table public.modules enable row level security;
alter table public.module_locations enable row level security;
alter table public.module_movements enable row level security;
alter table public.module_photos enable row level security;
alter table public.air_conditioning_units enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.module_types from anon, authenticated;
revoke all on table public.yard_blocks from anon, authenticated;
revoke all on table public.yard_rows from anon, authenticated;
revoke all on table public.yard_positions from anon, authenticated;
revoke all on table public.yard_slots from anon, authenticated;
revoke all on table public.modules from anon, authenticated;
revoke all on table public.module_locations from anon, authenticated;
revoke all on table public.module_movements from anon, authenticated;
revoke all on table public.module_photos from anon, authenticated;
revoke all on table public.air_conditioning_units from anon, authenticated;
revoke all on table public.module_location_view from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select on table public.module_types to authenticated;
grant select on table public.yard_blocks to authenticated;
grant select on table public.yard_rows to authenticated;
grant select on table public.yard_positions to authenticated;
grant select on table public.yard_slots to authenticated;
grant select, insert, update, delete on table public.modules to authenticated;
grant select, insert, update, delete on table public.module_locations to authenticated;
grant select, insert on table public.module_movements to authenticated;
grant select, insert, update, delete on table public.module_photos to authenticated;
grant select, insert, update, delete on table public.air_conditioning_units to authenticated;
grant select on table public.module_location_view to authenticated;

grant insert, update, delete on table public.module_types to authenticated;
grant insert, update, delete on table public.yard_blocks to authenticated;
grant insert, update, delete on table public.yard_rows to authenticated;
grant insert, update, delete on table public.yard_positions to authenticated;
grant insert, update, delete on table public.yard_slots to authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- profiles
create policy profiles_select_authenticated
  on public.profiles for select to authenticated
  using (true);

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_app_role());

create policy profiles_admin_update
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- catalog / yard structure: all signed-in roles can read; ADMIN can write
create policy module_types_select_authenticated
  on public.module_types for select to authenticated
  using (true);

create policy module_types_admin_write
  on public.module_types for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy yard_blocks_select_authenticated
  on public.yard_blocks for select to authenticated
  using (true);

create policy yard_blocks_admin_write
  on public.yard_blocks for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy yard_rows_select_authenticated
  on public.yard_rows for select to authenticated
  using (true);

create policy yard_rows_admin_write
  on public.yard_rows for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy yard_positions_select_authenticated
  on public.yard_positions for select to authenticated
  using (true);

create policy yard_positions_admin_write
  on public.yard_positions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy yard_slots_select_authenticated
  on public.yard_slots for select to authenticated
  using (true);

create policy yard_slots_admin_write
  on public.yard_slots for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- modules
create policy modules_select_authenticated
  on public.modules for select to authenticated
  using (true);

create policy modules_insert_admin
  on public.modules for insert to authenticated
  with check (public.is_admin());

create policy modules_update_admin_office
  on public.modules for update to authenticated
  using (public.has_role(array['ADMIN', 'OFFICE']::public.app_role[]))
  with check (public.has_role(array['ADMIN', 'OFFICE']::public.app_role[]));

create policy modules_delete_admin
  on public.modules for delete to authenticated
  using (public.is_admin());

-- current locations: ADMIN and FORKLIFT_DRIVER may move modules
create policy module_locations_select_authenticated
  on public.module_locations for select to authenticated
  using (true);

create policy module_locations_write_movers
  on public.module_locations for all to authenticated
  using (public.has_role(array['ADMIN', 'FORKLIFT_DRIVER']::public.app_role[]))
  with check (public.has_role(array['ADMIN', 'FORKLIFT_DRIVER']::public.app_role[]));

-- movement history: readable by all staff; inserts from movers + location trigger
create policy module_movements_select_authenticated
  on public.module_movements for select to authenticated
  using (true);

create policy module_movements_insert_movers
  on public.module_movements for insert to authenticated
  with check (public.has_role(array['ADMIN', 'FORKLIFT_DRIVER']::public.app_role[]));

-- photos
create policy module_photos_select_authenticated
  on public.module_photos for select to authenticated
  using (true);

create policy module_photos_write_office_admin
  on public.module_photos for all to authenticated
  using (public.has_role(array['ADMIN', 'OFFICE']::public.app_role[]))
  with check (public.has_role(array['ADMIN', 'OFFICE']::public.app_role[]));

-- air-conditioning
create policy airco_select_authenticated
  on public.air_conditioning_units for select to authenticated
  using (true);

create policy airco_insert_office_admin
  on public.air_conditioning_units for insert to authenticated
  with check (public.has_role(array['ADMIN', 'OFFICE']::public.app_role[]));

create policy airco_update_ops
  on public.air_conditioning_units for update to authenticated
  using (public.has_role(array['ADMIN', 'OFFICE', 'PRODUCTION']::public.app_role[]))
  with check (public.has_role(array['ADMIN', 'OFFICE', 'PRODUCTION']::public.app_role[]));

create policy airco_delete_office_admin
  on public.air_conditioning_units for delete to authenticated
  using (public.has_role(array['ADMIN', 'OFFICE']::public.app_role[]));

-- Private Storage bucket. Image bytes live here; captions/paths live in module_photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'module-photos',
  'module-photos',
  false,
  20971520,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy module_photos_storage_select
  on storage.objects for select to authenticated
  using (bucket_id = 'module-photos');

create policy module_photos_storage_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'module-photos'
    and public.has_role(array['ADMIN', 'OFFICE']::public.app_role[])
  );

create policy module_photos_storage_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'module-photos'
    and public.has_role(array['ADMIN', 'OFFICE']::public.app_role[])
  )
  with check (
    bucket_id = 'module-photos'
    and public.has_role(array['ADMIN', 'OFFICE']::public.app_role[])
  );

create policy module_photos_storage_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'module-photos'
    and public.has_role(array['ADMIN', 'OFFICE']::public.app_role[])
  );
