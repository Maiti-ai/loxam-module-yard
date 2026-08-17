-- Runtime-callable, idempotent registry sync for every visible Schelle cell.
-- Matches SCHELLE_BLOCK_SPEC / 20260817210000_sync_schelle_physical_positions.sql.
-- Does not delete, restack, or alter existing occupancy.
-- SECURITY DEFINER: forklift operators can SELECT positions but cannot INSERT
-- them (admin-only RLS). Placement must still be able to materialize missing
-- spec cells.

create or replace function public.ensure_schelle_physical_positions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  insert into public.yard_blocks (code, name, sort_order)
  values
    ('A', 'Block A', 1),
    ('B', 'Block B', 2),
    ('C', 'Block C', 3),
    ('D', 'Block D', 4),
    ('F', 'Production', 6)
  on conflict (code) do nothing;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'yard_blocks'
      and column_name = 'is_active'
  ) then
    update public.yard_blocks
    set is_active = true
    where code in ('A', 'B', 'C', 'D', 'F');
  end if;

  update public.yard_rows yr
  set code = 'P' || yr.code
  where yr.code ~ '^[0-9]+$'
    and not exists (
      select 1
      from public.yard_rows other
      where other.block_id = yr.block_id
        and other.code = 'P' || (yr.code::integer)::text
    );

  insert into public.yard_rows (block_id, code, sort_order)
  select b.id, spec.row_code, spec.sort_order
  from (
    values
      ('A', 'P1', 1),
      ('A', 'P2', 2),
      ('A', 'P3', 3),
      ('A', 'P4', 4),
      ('A', 'P5', 5),
      ('A', 'P6', 6),
      ('A', 'P7', 7),
      ('B', 'P1', 1),
      ('B', 'P2', 2),
      ('B', 'P3', 3),
      ('B', 'P4', 4),
      ('B', 'P5', 5),
      ('B', 'P6', 6),
      ('B', 'P7', 7),
      ('B', 'P8', 8),
      ('B', 'P9', 9),
      ('C', 'P1', 1),
      ('C', 'P2', 2),
      ('C', 'P3', 3),
      ('C', 'P4', 4),
      ('D', 'P1', 1),
      ('D', 'P2', 2),
      ('D', 'P3', 3),
      ('D', 'P4', 4),
      ('D', 'P5', 5),
      ('F', 'P1', 1),
      ('F', 'P2', 2),
      ('F', 'P3', 3)
  ) as spec(block_code, row_code, sort_order)
  join public.yard_blocks b on b.code = spec.block_code
  where not exists (
    select 1
    from public.yard_rows existing
    where existing.block_id = b.id
      and (
        existing.code = spec.row_code
        or (
          existing.code ~ '^[0-9]+$'
          and 'P' || (existing.code::integer)::text = spec.row_code
        )
      )
  );

  with spec(block_code, row_code, position_count) as (
    values
      ('A', 'P1', 5),
      ('A', 'P2', 5),
      ('A', 'P3', 5),
      ('A', 'P4', 5),
      ('A', 'P5', 5),
      ('A', 'P6', 5),
      ('A', 'P7', 5),
      ('B', 'P1', 6),
      ('B', 'P2', 6),
      ('B', 'P3', 6),
      ('B', 'P4', 6),
      ('B', 'P5', 6),
      ('B', 'P6', 6),
      ('B', 'P7', 6),
      ('B', 'P8', 6),
      ('B', 'P9', 6),
      ('C', 'P1', 13),
      ('C', 'P2', 13),
      ('C', 'P3', 13),
      ('C', 'P4', 13),
      ('D', 'P1', 10),
      ('D', 'P2', 10),
      ('D', 'P3', 10),
      ('D', 'P4', 10),
      ('D', 'P5', 6),
      ('F', 'P1', 4),
      ('F', 'P2', 4),
      ('F', 'P3', 4)
  ),
  target_rows as (
    select distinct on (spec.block_code, spec.row_code)
      spec.block_code,
      spec.row_code,
      spec.position_count,
      yr.id as row_id
    from spec
    join public.yard_blocks b on b.code = spec.block_code
    join public.yard_rows yr
      on yr.block_id = b.id
      and (
        yr.code = spec.row_code
        or (
          yr.code ~ '^[0-9]+$'
          and 'P' || (yr.code::integer)::text = spec.row_code
        )
      )
    order by spec.block_code, spec.row_code,
      case when yr.code like 'P%' then 0 else 1 end,
      yr.sort_order
  ),
  inserted_positions as (
    insert into public.yard_positions (row_id, code, sort_order)
    select
      target_rows.row_id,
      lpad(n.num::text, 2, '0'),
      n.num
    from target_rows
    join generate_series(1, target_rows.position_count) as n(num) on true
    where not exists (
      select 1
      from public.yard_positions existing
      where existing.row_id = target_rows.row_id
        and (
          existing.code = lpad(n.num::text, 2, '0')
          or (
            existing.code ~ '^[0-9]+$'
            and existing.code::integer = n.num
          )
        )
    )
    returning id
  )
  select count(*)::integer into inserted from inserted_positions;

  insert into public.yard_slots (block_id, row_id, position_id, level)
  select yr.block_id, yp.row_id, yp.id, lvl
  from public.yard_positions yp
  join public.yard_rows yr on yr.id = yp.row_id
  join public.yard_blocks b on b.id = yr.block_id
  cross join unnest(enum_range(null::public.stack_level)) as lvl
  where b.code in ('A', 'B', 'C', 'D', 'F')
    and not exists (
      select 1
      from public.yard_slots existing
      where existing.position_id = yp.id
        and existing.level = lvl
    );

  return inserted;
end;
$$;

revoke all on function public.ensure_schelle_physical_positions() from public;
grant execute on function public.ensure_schelle_physical_positions() to authenticated;

select public.ensure_schelle_physical_positions();
