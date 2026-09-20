-- Additive catalog: real maritime container types 2.5x3 and 2.5x6.
-- Keeps existing 6x3 / 3x3 types. No modules are inserted.

alter table public.module_types
  add column if not exists type_number text,
  add column if not exists notes text,
  add column if not exists drawing_storage_path text,
  add column if not exists drawing_mime_type text;

alter table public.module_types
  drop constraint if exists module_types_code_check;

alter table public.module_types
  add constraint module_types_code_check
  check (code in ('6x3', '3x3', '2.5x3', '2.5x6'));

insert into public.module_types (
  code,
  length_m,
  width_m,
  name,
  type_number,
  notes
)
values
  ('2.5x3', 2.5, 3.0, 'Maritiem container 2,5 × 3 m', null, 'Maritiem container'),
  ('2.5x6', 2.5, 6.0, 'Maritiem container 2,5 × 6 m', '60179', 'Maritiem container')
on conflict (code) do update
set
  length_m = excluded.length_m,
  width_m = excluded.width_m,
  name = excluded.name,
  type_number = coalesce(public.module_types.type_number, excluded.type_number),
  notes = excluded.notes;
