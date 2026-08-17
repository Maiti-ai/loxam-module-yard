-- Additive sync: every visible Schelle map cell becomes a real yard position.
-- Mirrors SCHELLE_BLOCK_SPEC in src/config/yard-geometry.ts.
-- Does not delete rows, positions, slots, modules, or history.

insert into public.yard_blocks (code, name, sort_order)
values
  ('A', 'Block A', 1),
  ('B', 'Block B', 2),
  ('C', 'Block C', 3),
  ('D', 'Block D', 4),
  ('F', 'Production', 6)
on conflict (code) do nothing;

do $$
begin
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
end $$;

-- Keep existing UUIDs. Only rename leftover MVP numeric codes (1 → P1) when
-- that P-code is not already present on the same block.
update public.yard_rows yr
set code = 'P' || yr.code
where yr.code ~ '^[0-9]+$'
  and not exists (
    select 1
    from public.yard_rows other
    where other.block_id = yr.block_id
      and other.code = 'P' || (yr.code::integer)::text
  );

with spec(block_code, row_code, sort_order, position_count) as (
  values
    ('A', 'P1', 1, 5),
    ('A', 'P2', 2, 5),
    ('A', 'P3', 3, 5),
    ('A', 'P4', 4, 5),
    ('A', 'P5', 5, 5),
    ('A', 'P6', 6, 5),
    ('A', 'P7', 7, 5),
    ('B', 'P1', 1, 6),
    ('B', 'P2', 2, 6),
    ('B', 'P3', 3, 6),
    ('B', 'P4', 4, 6),
    ('B', 'P5', 5, 6),
    ('B', 'P6', 6, 6),
    ('B', 'P7', 7, 6),
    ('B', 'P8', 8, 6),
    ('B', 'P9', 9, 6),
    ('C', 'P1', 1, 13),
    ('C', 'P2', 2, 13),
    ('C', 'P3', 3, 13),
    ('C', 'P4', 4, 13),
    ('D', 'P1', 1, 10),
    ('D', 'P2', 2, 10),
    ('D', 'P3', 3, 10),
    ('D', 'P4', 4, 10),
    ('D', 'P5', 5, 6),
    ('F', 'P1', 1, 4),
    ('F', 'P2', 2, 4),
    ('F', 'P3', 3, 4)
)
insert into public.yard_rows (block_id, code, sort_order)
select b.id, spec.row_code, spec.sort_order
from spec
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
)
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
);

-- Backfill any missing GROUND / LEVEL_1 / LEVEL_2 slots. Placement needs these.
insert into public.yard_slots (block_id, row_id, position_id, level)
select yr.block_id, yp.row_id, yp.id, lvl
from public.yard_positions yp
join public.yard_rows yr on yr.id = yp.row_id
cross join unnest(enum_range(null::public.stack_level)) as lvl
where not exists (
  select 1
  from public.yard_slots existing
  where existing.position_id = yp.id
    and existing.level = lvl
);
