-- Remove confirmed fictitious development fixtures created by
-- 20260813140200_seed_fictitious_dev_data.sql.
--
-- The historical seed migration is left intact (already applied remotely).
-- This follow-up only deletes matching fixture rows so a future migrate /
-- db reset does not leave those test modules in a production-like database.
--
-- Identification is by the original seed fingerprints (module_number + notes
-- + airco serial), not by number range or name format.
-- Yard structure, module types, profiles, functions, RPCs, indexes, enums,
-- and policies are not changed.

do $$
declare
  v_triggers_disabled boolean := false;
begin
  create temporary table _fictitious_seed_modules (
    id uuid primary key,
    module_number text not null
  ) on commit drop;

  insert into _fictitious_seed_modules (id, module_number)
  select m.id, m.module_number
  from public.modules m
  join public.air_conditioning_units ac on ac.module_id = m.id
  join (
    values
      ('2000', 'Ground stack base in Block A', 'CA-2000-8841'),
      ('2001', 'Stacked on 2000 at level 1', 'FL-2001-3320'),
      ('2002', 'Stacked on 2000 at level 2', 'PB-2002-1194'),
      ('2003', 'Adjacent ground position', 'CA-2003-5521'),
      ('2004', 'Rented, still parked in Block A', 'NM-2004-7782'),
      ('2005', 'Block B ground', 'FL-2005-0019'),
      ('2006', 'Stacked in Block B at level 1', 'PB-2006-4408'),
      ('2007', 'Rented fictitious site project', 'CA-2007-9630'),
      ('2008', 'Block A row 2', 'NM-2008-2177'),
      ('2009', 'Block B spare ground slot', 'FL-2009-6544')
  ) as seed(module_number, notes, serial_number)
    on seed.module_number = m.module_number
   and m.notes is not distinct from seed.notes
   and ac.serial_number = seed.serial_number;

  -- Dossiers that only exist around those seed modules.
  delete from public.dispatch_dossiers d
  where exists (
    select 1
    from public.dispatch_slots s
    join _fictitious_seed_modules fm on fm.id = s.module_id
    where s.dossier_id = d.id
  )
  and not exists (
    select 1
    from public.dispatch_slots s
    where s.dossier_id = d.id
      and s.module_id is not null
      and not exists (
        select 1
        from _fictitious_seed_modules fm
        where fm.id = s.module_id
      )
  );

  -- Empty wizard leftovers inspected on the hosted project: no modules, no
  -- reservations, created while only the seed modules existed.
  delete from public.dispatch_dossiers
  where (dossier_number, customer_name, site_location, status::text) in (
    ('14684;', 'Said', 'Schelle', 'CANCELLED'),
    ('3846382', 'Said', 'Schelle', 'DRAFT')
  );

  delete from storage.objects o
  using _fictitious_seed_modules fm
  where o.bucket_id = 'module-photos'
    and split_part(o.name, '/', 1) = fm.id::text;

  if to_regclass('public.damage_report_photos') is not null
     and to_regclass('public.damage_reports') is not null then
    delete from public.damage_report_photos drp
    using public.damage_reports dr, _fictitious_seed_modules fm
    where drp.report_id = dr.id
      and dr.module_id = fm.id;

    delete from public.damage_reports dr
    using _fictitious_seed_modules fm
    where dr.module_id = fm.id;
  end if;

  delete from public.module_photos
  where module_id in (select id from _fictitious_seed_modules);

  -- Location deletes would otherwise append movement rows; movement rows are
  -- otherwise immutable. Both triggers are re-enabled before this block
  -- finishes. Trigger definitions are unchanged.
  execute 'alter table public.module_locations disable trigger module_locations_record_movement';
  execute 'alter table public.module_movements disable trigger module_movements_immutable';
  v_triggers_disabled := true;

  begin
    delete from public.module_locations
    where module_id in (select id from _fictitious_seed_modules);

    delete from public.module_movements
    where module_id in (select id from _fictitious_seed_modules);

    delete from public.air_conditioning_units
    where module_id in (select id from _fictitious_seed_modules);

    delete from public.modules
    where id in (select id from _fictitious_seed_modules);
  exception
    when others then
      execute 'alter table public.module_movements enable trigger module_movements_immutable';
      execute 'alter table public.module_locations enable trigger module_locations_record_movement';
      raise;
  end;

  execute 'alter table public.module_movements enable trigger module_movements_immutable';
  execute 'alter table public.module_locations enable trigger module_locations_record_movement';
end
$$;
