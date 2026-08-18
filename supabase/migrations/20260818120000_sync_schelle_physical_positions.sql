-- Idempotent sync of the current Schelle yard map into yard_blocks / yard_rows /
-- yard_positions / yard_slots.
--
-- Source of truth: SCHELLE_BLOCK_SPEC in src/config/yard-geometry.ts
--   A  P1–P7 × 5  = 35
--   B  P1–P9 × 6  = 54
--   C  P1–P4 × 13 = 52
--   D  P1–P4 × 10 + P5 × 6 = 46
--   F  P1–P3 × 4  = 12
--   Total physical positions = 199
--
-- Canonical cell id is BLOCK-ROW-PP (example: D-P1-01). Row codes P1, P2, …
-- match map clicks. Existing MVP numeric row codes (1, 2) are renamed to P1, P2
-- when that P-code is not already present. Existing UUIDs, modules, and
-- occupancy are not deleted or moved.
--
-- Stacking:
--   A/B/C/D → GROUND + LEVEL_1 + LEVEL_2 (capacity 3)
--   F (production) → GROUND only (capacity 1)
--
-- Safe on hosted DBs that never received Phase 2 (no is_active column).

-- ---------------------------------------------------------------------------
-- F production positions must only receive Niveau 0 (GROUND).
-- ---------------------------------------------------------------------------
create or replace function public.create_slots_for_position()
returns trigger
language plpgsql
as $$
declare
  v_block_id uuid;
  v_block_code text;
begin
  select yr.block_id, b.code
    into strict v_block_id, v_block_code
  from public.yard_rows yr
  join public.yard_blocks b on b.id = yr.block_id
  where yr.id = new.row_id;

  insert into public.yard_slots (block_id, row_id, position_id, level)
  select v_block_id, new.row_id, new.id, lvl
  from unnest(enum_range(null::public.stack_level)) as lvl
  where v_block_code <> 'F' or lvl = 'GROUND'::public.stack_level;

  return new;
end;
$$;

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
    execute $sql$
      update public.yard_blocks
      set is_active = true
      where code in ('A', 'B', 'C', 'D', 'F')
    $sql$;
  end if;
end $$;

update public.yard_blocks
set name = 'Production', sort_order = 6
where code = 'F' and (name <> 'Production' or sort_order <> 6);

-- Keep existing row UUIDs. Map clicks use P-row codes (P1, P2, …).
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

-- Backfill slots the trigger did not create (older positions, or F GROUND-only).
insert into public.yard_slots (block_id, row_id, position_id, level)
select yr.block_id, yp.row_id, yp.id, lvl
from public.yard_positions yp
join public.yard_rows yr on yr.id = yp.row_id
join public.yard_blocks b on b.id = yr.block_id
cross join unnest(enum_range(null::public.stack_level)) as lvl
where (b.code <> 'F' or lvl = 'GROUND'::public.stack_level)
  and not exists (
    select 1
    from public.yard_slots existing
    where existing.position_id = yp.id
      and existing.level = lvl
  );

-- F must not keep empty stacked levels if they were created by the old trigger.
delete from public.yard_slots s
using public.yard_blocks b
where s.block_id = b.id
  and b.code = 'F'
  and s.level <> 'GROUND'::public.stack_level
  and not exists (
    select 1
    from public.module_locations ml
    where ml.slot_id = s.id
  );

do $$
declare
  a_count integer;
  b_count integer;
  c_count integer;
  d_count integer;
  f_count integer;
  total_count integer;
  a_slots integer;
  b_slots integer;
  c_slots integer;
  d_slots integer;
  f_slots integer;
  d_p1_01 uuid;
begin
  with spec(block_code, row_code, position_count) as (
    values
      ('A', 'P1', 5), ('A', 'P2', 5), ('A', 'P3', 5), ('A', 'P4', 5),
      ('A', 'P5', 5), ('A', 'P6', 5), ('A', 'P7', 5),
      ('B', 'P1', 6), ('B', 'P2', 6), ('B', 'P3', 6), ('B', 'P4', 6),
      ('B', 'P5', 6), ('B', 'P6', 6), ('B', 'P7', 6), ('B', 'P8', 6), ('B', 'P9', 6),
      ('C', 'P1', 13), ('C', 'P2', 13), ('C', 'P3', 13), ('C', 'P4', 13),
      ('D', 'P1', 10), ('D', 'P2', 10), ('D', 'P3', 10), ('D', 'P4', 10), ('D', 'P5', 6),
      ('F', 'P1', 4), ('F', 'P2', 4), ('F', 'P3', 4)
  ),
  matched as (
    select b.code as block_code, yp.id as position_id
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
    join public.yard_positions yp
      on yp.row_id = yr.id
      and yp.code ~ '^[0-9]+$'
      and yp.code::integer between 1 and spec.position_count
  )
  select
    count(*) filter (where block_code = 'A'),
    count(*) filter (where block_code = 'B'),
    count(*) filter (where block_code = 'C'),
    count(*) filter (where block_code = 'D'),
    count(*) filter (where block_code = 'F'),
    count(*)
  into a_count, b_count, c_count, d_count, f_count, total_count
  from matched;

  select
    count(*) filter (where b.code = 'A'),
    count(*) filter (where b.code = 'B'),
    count(*) filter (where b.code = 'C'),
    count(*) filter (where b.code = 'D'),
    count(*) filter (where b.code = 'F')
  into a_slots, b_slots, c_slots, d_slots, f_slots
  from public.yard_slots s
  join public.yard_blocks b on b.id = s.block_id
  join public.yard_positions yp on yp.id = s.position_id
  join public.yard_rows yr on yr.id = yp.row_id
  join (
    values
      ('A', 'P1', 5), ('A', 'P2', 5), ('A', 'P3', 5), ('A', 'P4', 5),
      ('A', 'P5', 5), ('A', 'P6', 5), ('A', 'P7', 5),
      ('B', 'P1', 6), ('B', 'P2', 6), ('B', 'P3', 6), ('B', 'P4', 6),
      ('B', 'P5', 6), ('B', 'P6', 6), ('B', 'P7', 6), ('B', 'P8', 6), ('B', 'P9', 6),
      ('C', 'P1', 13), ('C', 'P2', 13), ('C', 'P3', 13), ('C', 'P4', 13),
      ('D', 'P1', 10), ('D', 'P2', 10), ('D', 'P3', 10), ('D', 'P4', 10), ('D', 'P5', 6),
      ('F', 'P1', 4), ('F', 'P2', 4), ('F', 'P3', 4)
  ) as spec(block_code, row_code, position_count)
    on b.code = spec.block_code
    and (
      yr.code = spec.row_code
      or (
        yr.code ~ '^[0-9]+$'
        and 'P' || (yr.code::integer)::text = spec.row_code
      )
    )
    and yp.code ~ '^[0-9]+$'
    and yp.code::integer between 1 and spec.position_count;

  select yp.id into d_p1_01
  from public.yard_blocks b
  join public.yard_rows yr on yr.block_id = b.id
  join public.yard_positions yp on yp.row_id = yr.id
  where b.code = 'D'
    and (
      yr.code = 'P1'
      or (yr.code ~ '^[0-9]+$' and yr.code::integer = 1)
    )
    and yp.code ~ '^[0-9]+$'
    and yp.code::integer = 1;

  if a_count <> 35 or b_count <> 54 or c_count <> 52 or d_count <> 46 or f_count <> 12 or total_count <> 199 then
    raise exception
      'Schelle physical registry mismatch: A=% B=% C=% D=% F=% total=% (expected 35/54/52/46/12 = 199)',
      a_count, b_count, c_count, d_count, f_count, total_count;
  end if;

  if a_slots <> 105 or b_slots <> 162 or c_slots <> 156 or d_slots <> 138 or f_slots <> 12 then
    raise exception
      'Schelle slot capacity mismatch: A=% B=% C=% D=% F=% (expected 105/162/156/138/12 = 573)',
      a_slots, b_slots, c_slots, d_slots, f_slots;
  end if;

  if d_p1_01 is null then
    raise exception 'Canonical map cell D-P1-01 is missing from yard_positions';
  end if;
end $$;
