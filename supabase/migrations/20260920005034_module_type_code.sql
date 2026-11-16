-- Additive: optional type_code on each module (e.g. 60146).
-- Drawings live in public/module-types/{type_code}.png. No modules inserted.

alter table public.modules
  add column if not exists type_code text;
