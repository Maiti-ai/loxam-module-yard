-- Preplan dispatch: dossiers are created by the atelier manager before
-- modules move to production. Enum values must be committed before use.

alter type public.dispatch_dossier_status add value if not exists 'DRAFT' before 'ACTIVE';

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'dispatch_production_status'
  ) then
    create type public.dispatch_production_status as enum (
      'TO_PRODUCTION',
      'IN_PRODUCTION',
      'READY_FOR_DISPATCH',
      'IN_DISPATCH_ZONE'
    );
  end if;
end
$$;

grant usage on type public.dispatch_production_status to authenticated;
