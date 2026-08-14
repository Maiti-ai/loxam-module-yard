-- Phase 2 follow-up: P-rows from the marked Schelle inplantingsplan.
-- Additive only. Existing modules stay in their current slots.
-- Numeric row codes (1, 2, …) are renamed to P1, P2, … — those P-numbers
-- are permanent yard rows, not module IDs.
-- Extra P-rows/positions are added only where the plan shows them.

-- Rename existing numeric row codes to P-codes without colliding.
update public.yard_rows yr
set code = 'P' || yr.code
where yr.code ~ '^[0-9]+$'
  and not exists (
    select 1
    from public.yard_rows other
    where other.block_id = yr.block_id
      and other.code = 'P' || yr.code
  );

-- Plan-derived P-rows (do not invent extra P-numbers).
insert into public.yard_rows (block_id, code, sort_order)
select b.id, spec.code, spec.sort_order
from public.yard_blocks b
join (
  values
    ('C', 'P1', 1),
    ('C', 'P2', 2),
    ('C', 'P3', 3),
    ('C', 'P4', 4),
    ('B', 'P1', 1),
    ('B', 'P2', 2),
    ('B', 'P3', 3),
    ('B', 'P4', 4),
    ('B', 'P5', 5),
    ('B', 'P6', 6),
    ('B', 'P7', 7),
    ('B', 'P8', 8),
    ('B', 'P9', 9),
    ('A', 'P1', 1),
    ('A', 'P2', 2),
    ('A', 'P3', 3),
    ('A', 'P4', 4),
    ('A', 'P5', 5),
    ('A', 'P6', 6),
    ('A', 'P7', 7),
    ('D', 'P1', 1),
    ('D', 'P2', 2),
    ('D', 'P3', 3),
    ('D', 'P4', 4),
    ('D', 'P5', 5),
    ('D', 'P6', 6),
    ('D', 'P7', 7),
    ('D', 'P8', 8),
    ('F', 'P1', 1),
    ('F', 'P2', 2),
    ('F', 'P3', 3)
) as spec(block_code, code, sort_order) on spec.block_code = b.code
where not exists (
  select 1
  from public.yard_rows existing
  where existing.block_id = b.id and existing.code = spec.code
);

-- Position counts from the plan (R1 = east / right on A, B, C).
insert into public.yard_positions (row_id, code, sort_order)
select yr.id, p.code, p.sort_order
from public.yard_rows yr
join public.yard_blocks b on b.id = yr.block_id
join (
  values
    ('A', 5),
    ('B', 6),
    ('C', 13),
    ('D', 2),
    ('F', 4)
) as spec(block_code, position_count) on spec.block_code = b.code
join generate_series(1, spec.position_count) as n(num) on true
join lateral (
  select lpad(n.num::text, 2, '0') as code, n.num as sort_order
) as p on true
where yr.code like 'P%'
  and not exists (
    select 1
    from public.yard_positions existing
    where existing.row_id = yr.id and existing.code = p.code
  );

-- Block E is not clearly lettered with its own P-grid on the scan.
update public.yard_blocks
set is_active = false
where code = 'E';
