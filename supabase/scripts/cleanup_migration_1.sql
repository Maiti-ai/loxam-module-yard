-- Reset ONLY Loxam Module Yard objects from a partial run of
-- supabase/migrations/20260813140000_yard_schema.sql
--
-- Safe for this brand-new project: no production data.
-- Does not drop auth/storage/realtime schemas, auth.users, or extensions.
-- The only auth change is removing the trigger WE attached to auth.users.
--
-- Run this in the Supabase SQL Editor, then rerun 20260813140000_yard_schema.sql.

begin;

-- 1) View (depends on tables)
drop view if exists public.module_location_view cascade;

-- 2) Trigger we created on auth.users (do not drop auth.users)
drop trigger if exists on_auth_user_created on auth.users;

-- 3) Tables, children first. CASCADE removes their triggers and indexes.
drop table if exists public.air_conditioning_units cascade;
drop table if exists public.module_photos cascade;
drop table if exists public.module_locations cascade;
drop table if exists public.module_movements cascade;
drop table if exists public.modules cascade;
drop table if exists public.yard_slots cascade;
drop table if exists public.yard_positions cascade;
drop table if exists public.yard_rows cascade;
drop table if exists public.yard_blocks cascade;
drop table if exists public.module_types cascade;
drop table if exists public.profiles cascade;

-- 4) Named indexes in case they were left behind without a table
drop index if exists public.module_movements_module_id_moved_at_idx;
drop index if exists public.module_photos_module_id_idx;
drop index if exists public.air_conditioning_units_module_id_idx;
drop index if exists public.yard_slots_block_row_position_idx;

-- 5) Functions created by migration 1 (any signature in public)
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as ident
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at',
        'current_app_role',
        'has_role',
        'is_admin',
        'handle_new_user',
        'create_slots_for_position',
        'record_module_movement',
        'prevent_movement_mutation',
        'enforce_module_update_permissions',
        'enforce_airco_update_permissions'
      )
  loop
    execute format('drop function if exists %s cascade', fn.ident);
  end loop;
end;
$$;

-- 6) Enum types created by migration 1
drop type if exists public.app_role cascade;
drop type if exists public.stack_level cascade;
drop type if exists public.module_status cascade;

commit;

-- Remaining Loxam objects should be zero rows.
select 'type' as kind, t.typname as name
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname in ('app_role', 'stack_level', 'module_status')

union all
select 'table_or_view', c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'v')
  and c.relname in (
    'profiles',
    'module_types',
    'yard_blocks',
    'yard_rows',
    'yard_positions',
    'yard_slots',
    'modules',
    'module_locations',
    'module_movements',
    'module_photos',
    'air_conditioning_units',
    'module_location_view'
  )

union all
select 'function', p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_updated_at',
    'current_app_role',
    'has_role',
    'is_admin',
    'handle_new_user',
    'create_slots_for_position',
    'record_module_movement',
    'prevent_movement_mutation',
    'enforce_module_update_permissions',
    'enforce_airco_update_permissions'
  )

union all
select 'auth_trigger', tg.tgname
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth'
  and c.relname = 'users'
  and tg.tgname = 'on_auth_user_created'

order by 1, 2;
