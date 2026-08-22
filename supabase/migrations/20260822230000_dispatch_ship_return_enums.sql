-- Enums + columns for A → ship → return lifecycle.
-- RPC bodies live in the next migration (new enum labels cannot be used in the same transaction).

alter type public.dispatch_dossier_status add value if not exists 'PARTIALLY_SHIPPED';
alter type public.dispatch_dossier_status add value if not exists 'PARTIALLY_RETURNED';
alter type public.dispatch_dossier_status add value if not exists 'RETURNED';

alter type public.dispatch_slot_status add value if not exists 'SHIPPED';
alter type public.dispatch_slot_status add value if not exists 'RETURNED';

alter table public.dispatch_slots
  add column if not exists shipped_at timestamptz,
  add column if not exists shipped_by uuid references public.profiles (id) on delete set null,
  add column if not exists returned_at timestamptz,
  add column if not exists returned_by uuid references public.profiles (id) on delete set null,
  add column if not exists return_slot_id uuid references public.yard_slots (id) on delete set null;
