-- Fictitious development data only. No real customer or company records.

insert into public.module_types (code, length_m, width_m, name)
values
  ('6x3', 6.0, 3.0, '6x3 m'),
  ('3x3', 3.0, 3.0, '3x3 m')
on conflict (code) do nothing;

insert into public.yard_blocks (code, name, sort_order)
values
  ('A', 'Block A', 1),
  ('B', 'Block B', 2);

insert into public.yard_rows (block_id, code, sort_order)
select b.id, r.code, r.sort_order
from public.yard_blocks b
join (
  values
    ('A', '1', 1),
    ('A', '2', 2),
    ('B', '1', 1),
    ('B', '2', 2)
) as r(block_code, code, sort_order) on r.block_code = b.code;

insert into public.yard_positions (row_id, code, sort_order)
select yr.id, p.code, p.sort_order
from public.yard_rows yr
join public.yard_blocks b on b.id = yr.block_id
join (
  values
    ('A', '1', '01', 1),
    ('A', '1', '02', 2),
    ('A', '1', '03', 3),
    ('A', '2', '01', 1),
    ('A', '2', '02', 2),
    ('A', '2', '03', 3),
    ('B', '1', '01', 1),
    ('B', '1', '02', 2),
    ('B', '2', '01', 1),
    ('B', '2', '02', 2)
) as p(block_code, row_code, code, sort_order)
  on p.block_code = b.code and p.row_code = yr.code;

insert into public.modules (
  module_number,
  module_type_id,
  status,
  rented_to_project,
  notes
)
select x.module_number, mt.id, x.status::public.module_status, x.rented_to_project, x.notes
from (
  values
    ('2000', '6x3', 'AVAILABLE', null, 'Ground stack base in Block A'),
    ('2001', '6x3', 'AVAILABLE', null, 'Stacked on 2000 at level 1'),
    ('2002', '3x3', 'RENTED', 'Project Atlas', 'Stacked on 2000 at level 2'),
    ('2003', '6x3', 'AVAILABLE', null, 'Adjacent ground position'),
    ('2004', '3x3', 'RENTED', 'Project Beacon', 'Rented, still parked in Block A'),
    ('2005', '6x3', 'AVAILABLE', null, 'Block B ground'),
    ('2006', '3x3', 'AVAILABLE', null, 'Stacked in Block B at level 1'),
    ('2007', '6x3', 'RENTED', 'Project Harbor', 'Rented fictitious site project'),
    ('2008', '6x3', 'AVAILABLE', null, 'Block A row 2'),
    ('2009', '3x3', 'AVAILABLE', null, 'Block B spare ground slot')
) as x(module_number, type_code, status, rented_to_project, notes)
join public.module_types mt on mt.code = x.type_code;

-- Historical moves first (older timestamps), then current occupancy.
insert into public.module_movements (
  module_id, from_slot_id, to_slot_id, moved_at, notes
)
select
  m.id,
  origin.id,
  dest.id,
  x.moved_at,
  x.notes
from (
  values
    ('2004', 'B', '1', '01', 'GROUND', 'A', '2', '01', 'GROUND', timestamptz '2026-07-02 08:15+00', 'Moved from Block B to Block A before rental'),
    ('2007', 'A', '1', '03', 'GROUND', 'B', '2', '01', 'GROUND', timestamptz '2026-07-18 10:40+00', 'Relocated to Block B for Project Harbor'),
    ('2006', 'B', '1', '01', 'GROUND', 'B', '1', '01', 'LEVEL_1', timestamptz '2026-08-01 14:05+00', 'Stacked onto 2005')
) as x(
  module_number,
  from_block, from_row, from_position, from_level,
  to_block, to_row, to_position, to_level,
  moved_at, notes
)
join public.modules m on m.module_number = x.module_number
join public.yard_blocks fb on fb.code = x.from_block
join public.yard_rows fr on fr.block_id = fb.id and fr.code = x.from_row
join public.yard_positions fp on fp.row_id = fr.id and fp.code = x.from_position
join public.yard_slots origin on origin.position_id = fp.id and origin.level = x.from_level::public.stack_level
join public.yard_blocks tb on tb.code = x.to_block
join public.yard_rows tr on tr.block_id = tb.id and tr.code = x.to_row
join public.yard_positions tp on tp.row_id = tr.id and tp.code = x.to_position
join public.yard_slots dest on dest.position_id = tp.id and dest.level = x.to_level::public.stack_level;

insert into public.module_locations (module_id, slot_id)
select m.id, s.id
from (
  values
    ('2000', 'A', '1', '01', 'GROUND'),
    ('2001', 'A', '1', '01', 'LEVEL_1'),
    ('2002', 'A', '1', '01', 'LEVEL_2'),
    ('2003', 'A', '1', '02', 'GROUND'),
    ('2004', 'A', '2', '01', 'GROUND'),
    ('2005', 'B', '1', '01', 'GROUND'),
    ('2006', 'B', '1', '01', 'LEVEL_1'),
    ('2007', 'B', '2', '01', 'GROUND'),
    ('2008', 'A', '2', '02', 'GROUND'),
    ('2009', 'B', '1', '02', 'GROUND')
) as x(module_number, block_code, row_code, position_code, level)
join public.modules m on m.module_number = x.module_number
join public.yard_blocks b on b.code = x.block_code
join public.yard_rows r on r.block_id = b.id and r.code = x.row_code
join public.yard_positions p on p.row_id = r.id and p.code = x.position_code
join public.yard_slots s on s.position_id = p.id and s.level = x.level::public.stack_level;

insert into public.air_conditioning_units (
  module_id,
  brand,
  serial_number,
  internal_number,
  last_maintenance_at,
  notes
)
select
  m.id,
  x.brand,
  x.serial_number,
  x.internal_number,
  x.last_maintenance_at,
  x.notes
from (
  values
    ('2000', 'CoolAir', 'CA-2000-8841', 'AC-100', date '2026-03-12', 'Filter replaced'),
    ('2001', 'FrostLine', 'FL-2001-3320', 'AC-101', date '2026-04-02', null),
    ('2002', 'PolarBox', 'PB-2002-1194', 'AC-102', date '2026-01-20', 'Ready for Project Atlas'),
    ('2003', 'CoolAir', 'CA-2003-5521', 'AC-103', date '2026-05-18', null),
    ('2004', 'Nimbus', 'NM-2004-7782', 'AC-104', date '2026-02-27', 'Checked before Beacon rental'),
    ('2005', 'FrostLine', 'FL-2005-0019', 'AC-105', date '2026-06-09', null),
    ('2006', 'PolarBox', 'PB-2006-4408', 'AC-106', date '2025-12-14', 'Due for service'),
    ('2007', 'CoolAir', 'CA-2007-9630', 'AC-107', date '2026-07-01', 'Harbor project unit'),
    ('2008', 'Nimbus', 'NM-2008-2177', 'AC-108', date '2026-03-30', null),
    ('2009', 'FrostLine', 'FL-2009-6544', 'AC-109', date '2026-08-04', 'Latest service in yard')
) as x(module_number, brand, serial_number, internal_number, last_maintenance_at, notes)
join public.modules m on m.module_number = x.module_number;
