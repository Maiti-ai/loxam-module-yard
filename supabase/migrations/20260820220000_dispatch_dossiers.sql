-- Dispatch dossiers: modules leaving production zone F must be assigned to a
-- reserved stack in shipping block A. Existing yard occupancy and movement
-- history stay the source of truth for physical location.

create type public.dispatch_dossier_status as enum (
  'ACTIVE',
  'READY_FOR_SHIPPING',
  'SHIPPED',
  'CANCELLED'
);

create type public.dispatch_slot_status as enum (
  'EMPTY',
  'ASSIGNED',
  'PLACED'
);

create table public.dispatch_dossiers (
  id uuid primary key default gen_random_uuid(),
  dossier_number text not null,
  customer_name text not null,
  site_location text not null,
  total_modules integer not null check (total_modules >= 1),
  status public.dispatch_dossier_status not null default 'ACTIVE',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dispatch_dossiers_number_normalized check (dossier_number = btrim(dossier_number)),
  constraint dispatch_dossiers_number_not_empty check (char_length(dossier_number) > 0)
);

create unique index dispatch_dossiers_number_uidx
  on public.dispatch_dossiers (lower(dossier_number));

create table public.dispatch_reserved_positions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dispatch_dossiers (id) on delete cascade,
  position_id uuid not null references public.yard_positions (id) on delete restrict,
  position_order integer not null check (position_order >= 1),
  blocking boolean not null default true,
  created_at timestamptz not null default now(),
  unique (dossier_id, position_order),
  unique (dossier_id, position_id)
);

create unique index dispatch_reserved_positions_blocking_uidx
  on public.dispatch_reserved_positions (position_id)
  where blocking;

create table public.dispatch_slots (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dispatch_dossiers (id) on delete cascade,
  reserved_position_id uuid not null references public.dispatch_reserved_positions (id) on delete cascade,
  sequence_number integer not null check (sequence_number >= 1),
  level public.stack_level not null,
  module_id uuid references public.modules (id) on delete restrict,
  status public.dispatch_slot_status not null default 'EMPTY',
  assigned_at timestamptz,
  placed_at timestamptz,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (dossier_id, sequence_number),
  unique (reserved_position_id, level)
);

create unique index dispatch_slots_module_uidx
  on public.dispatch_slots (module_id)
  where module_id is not null;

create index dispatch_slots_dossier_idx
  on public.dispatch_slots (dossier_id, sequence_number);

create trigger dispatch_dossiers_set_updated_at
  before update on public.dispatch_dossiers
  for each row execute function public.set_updated_at();

alter table public.dispatch_dossiers enable row level security;
alter table public.dispatch_reserved_positions enable row level security;
alter table public.dispatch_slots enable row level security;

revoke all on table public.dispatch_dossiers from anon, authenticated;
revoke all on table public.dispatch_reserved_positions from anon, authenticated;
revoke all on table public.dispatch_slots from anon, authenticated;

grant select on table public.dispatch_dossiers to authenticated;
grant select on table public.dispatch_reserved_positions to authenticated;
grant select on table public.dispatch_slots to authenticated;

create policy dispatch_dossiers_select_authenticated
  on public.dispatch_dossiers for select to authenticated
  using (true);

create policy dispatch_reserved_positions_select_authenticated
  on public.dispatch_reserved_positions for select to authenticated
  using (true);

create policy dispatch_slots_select_authenticated
  on public.dispatch_slots for select to authenticated
  using (true);

create or replace function public.record_module_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notes text;
begin
  v_notes := nullif(current_setting('app.movement_notes', true), '');

  if tg_op = 'INSERT' then
    insert into public.module_movements (
      module_id, from_slot_id, to_slot_id, moved_by, notes
    ) values (
      new.module_id,
      null,
      new.slot_id,
      new.updated_by,
      coalesce(v_notes, 'Current location set')
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if new.slot_id is distinct from old.slot_id then
      insert into public.module_movements (
        module_id, from_slot_id, to_slot_id, moved_by, notes
      ) values (
        new.module_id,
        old.slot_id,
        new.slot_id,
        new.updated_by,
        coalesce(v_notes, 'Module moved')
      );
    end if;
    return new;
  else
    insert into public.module_movements (
      module_id, from_slot_id, to_slot_id, moved_by, notes
    ) values (
      old.module_id,
      old.slot_id,
      null,
      old.updated_by,
      coalesce(v_notes, 'Module removed from yard')
    );
    return old;
  end if;
end;
$$;

create or replace function public.dispatch_required_ground_positions(p_total_modules integer)
returns integer
language sql
immutable
as $$
  select case
    when p_total_modules is null or p_total_modules < 1 then 0
    else ceil(p_total_modules::numeric / 3)::integer
  end
$$;

create or replace function public.dispatch_position_block_code(p_position_id uuid)
returns text
language sql
stable
as $$
  select b.code
  from public.yard_positions p
  join public.yard_rows r on r.id = p.row_id
  join public.yard_blocks b on b.id = r.block_id
  where p.id = p_position_id
$$;

create or replace function public.dispatch_position_is_fully_vacant(p_position_id uuid)
returns boolean
language sql
stable
as $$
  select exists (select 1 from public.yard_positions where id = p_position_id)
    and not exists (
      select 1
      from public.yard_slots s
      join public.module_locations l on l.slot_id = s.id
      where s.position_id = p_position_id
    )
$$;

create or replace function public.create_dispatch_dossier(
  p_dossier_number text,
  p_customer_name text,
  p_site_location text,
  p_total_modules integer,
  p_position_ids uuid[],
  p_first_module_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_number text := btrim(coalesce(p_dossier_number, ''));
  v_customer text := btrim(coalesce(p_customer_name, ''));
  v_site text := btrim(coalesce(p_site_location, ''));
  v_required integer;
  v_dossier_id uuid;
  v_reserved_id uuid;
  v_seq integer;
  v_pos_index integer;
  v_level public.stack_level;
  v_position_id uuid;
  v_block text;
  v_current_block text;
  v_slot_id uuid;
  v_from_slot uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;
  if not public.has_role(array['ADMIN', 'FORKLIFT_DRIVER', 'OFFICE', 'PRODUCTION']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;
  if v_number = '' or v_customer = '' or v_site = '' or p_total_modules is null or p_total_modules < 1 then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;
  if p_first_module_id is null then
    return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  end if;

  v_required := public.dispatch_required_ground_positions(p_total_modules);
  if p_position_ids is null or coalesce(array_length(p_position_ids, 1), 0) <> v_required then
    return jsonb_build_object('ok', false, 'error_code', 'INSUFFICIENT_SPACE');
  end if;
  if exists (
    select 1 from unnest(p_position_ids) as pid group by pid having count(*) > 1
  ) then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;
  if exists (
    select 1 from public.dispatch_dossiers d where lower(d.dossier_number) = lower(v_number)
  ) then
    return jsonb_build_object('ok', false, 'error_code', 'DOSSIER_EXISTS');
  end if;

  perform pg_advisory_xact_lock(8422026);
  perform pg_advisory_xact_lock(8422028, hashtext(p_first_module_id::text));

  select ml.slot_id, b.code
    into v_from_slot, v_current_block
  from public.modules m
  left join public.module_locations ml on ml.module_id = m.id
  left join public.yard_slots s on s.id = ml.slot_id
  left join public.yard_blocks b on b.id = s.block_id
  where m.id = p_first_module_id;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  end if;
  if v_current_block is distinct from 'F' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;
  if exists (select 1 from public.dispatch_slots ds where ds.module_id = p_first_module_id) then
    return jsonb_build_object('ok', false, 'error_code', 'MODULE_IN_DOSSIER');
  end if;

  for v_pos_index in 1 .. v_required loop
    v_position_id := p_position_ids[v_pos_index];
    perform 1 from public.yard_positions p where p.id = v_position_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'error_code', 'SLOT_MISSING');
    end if;
    v_block := public.dispatch_position_block_code(v_position_id);
    if v_block is distinct from 'A' then
      return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
    end if;
    if not public.dispatch_position_is_fully_vacant(v_position_id) then
      return jsonb_build_object('ok', false, 'error_code', 'POSITION_RESERVED');
    end if;
    if exists (
      select 1
      from public.dispatch_reserved_positions rp
      where rp.position_id = v_position_id and rp.blocking
    ) then
      return jsonb_build_object('ok', false, 'error_code', 'POSITION_RESERVED');
    end if;
  end loop;

  insert into public.dispatch_dossiers (
    dossier_number, customer_name, site_location, total_modules, status, created_by
  ) values (
    v_number, v_customer, v_site, p_total_modules, 'ACTIVE', v_user
  )
  returning id into v_dossier_id;

  for v_pos_index in 1 .. v_required loop
    insert into public.dispatch_reserved_positions (
      dossier_id, position_id, position_order, blocking
    ) values (
      v_dossier_id, p_position_ids[v_pos_index], v_pos_index, true
    );
  end loop;

  for v_seq in 1 .. p_total_modules loop
    v_pos_index := ((v_seq - 1) / 3) + 1;
    v_level := (array['GROUND', 'LEVEL_1', 'LEVEL_2']::public.stack_level[])[((v_seq - 1) % 3) + 1];
    select rp.id into strict v_reserved_id
    from public.dispatch_reserved_positions rp
    where rp.dossier_id = v_dossier_id and rp.position_order = v_pos_index;

    insert into public.dispatch_slots (
      dossier_id,
      reserved_position_id,
      sequence_number,
      level,
      module_id,
      status,
      assigned_at,
      assigned_by
    ) values (
      v_dossier_id,
      v_reserved_id,
      v_seq,
      v_level,
      case when v_seq = 1 then p_first_module_id else null end,
      case when v_seq = 1 then 'ASSIGNED'::public.dispatch_slot_status else 'EMPTY'::public.dispatch_slot_status end,
      case when v_seq = 1 then now() else null end,
      case when v_seq = 1 then v_user else null end
    )
    returning id into v_slot_id;
  end loop;

  insert into public.module_movements (module_id, from_slot_id, to_slot_id, moved_by, notes)
  values (
    p_first_module_id,
    v_from_slot,
    v_from_slot,
    v_user,
    format('Module gekoppeld aan dossier %s', v_number)
  );

  return jsonb_build_object(
    'ok', true,
    'dossier_id', v_dossier_id,
    'dossier_number', v_number,
    'sequence_number', 1,
    'total_modules', p_total_modules
  );
exception
  when unique_violation then
    if exists (
      select 1
      from public.dispatch_dossiers d
      where lower(d.dossier_number) = lower(v_number)
    ) then
      return jsonb_build_object('ok', false, 'error_code', 'DOSSIER_EXISTS');
    end if;
    return jsonb_build_object('ok', false, 'error_code', 'POSITION_RESERVED');
end;
$$;

create or replace function public.assign_module_to_dispatch_dossier(
  p_dossier_id uuid,
  p_module_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_status public.dispatch_dossier_status;
  v_total integer;
  v_number text;
  v_current_block text;
  v_from_slot uuid;
  v_slot public.dispatch_slots%rowtype;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;
  if not public.has_role(array['ADMIN', 'FORKLIFT_DRIVER', 'OFFICE', 'PRODUCTION']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;

  perform pg_advisory_xact_lock(('x' || substr(md5(p_dossier_id::text), 1, 16))::bit(64)::bigint);
  perform pg_advisory_xact_lock(8422028, hashtext(p_module_id::text));

  select d.status, d.total_modules, d.dossier_number
    into v_status, v_total, v_number
  from public.dispatch_dossiers d
  where d.id = p_dossier_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  end if;
  if v_status is distinct from 'ACTIVE' then
    return jsonb_build_object('ok', false, 'error_code', 'DOSSIER_FULL');
  end if;

  select ml.slot_id, b.code
    into v_from_slot, v_current_block
  from public.modules m
  left join public.module_locations ml on ml.module_id = m.id
  left join public.yard_slots s on s.id = ml.slot_id
  left join public.yard_blocks b on b.id = s.block_id
  where m.id = p_module_id;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  end if;
  if v_current_block is distinct from 'F' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;

  select ds.*
    into v_slot
  from public.dispatch_slots ds
  where ds.module_id = p_module_id;

  if found then
    if v_slot.dossier_id = p_dossier_id and v_slot.status = 'ASSIGNED' then
      return jsonb_build_object(
        'ok', true,
        'unchanged', true,
        'dossier_id', p_dossier_id,
        'dossier_number', v_number,
        'sequence_number', v_slot.sequence_number,
        'total_modules', v_total,
        'level', v_slot.level
      );
    end if;
    return jsonb_build_object('ok', false, 'error_code', 'MODULE_IN_DOSSIER');
  end if;

  select ds.*
    into v_slot
  from public.dispatch_slots ds
  where ds.dossier_id = p_dossier_id
    and ds.module_id is null
  order by ds.sequence_number
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'DOSSIER_FULL');
  end if;

  update public.dispatch_slots
  set
    module_id = p_module_id,
    status = 'ASSIGNED',
    assigned_at = now(),
    assigned_by = v_user
  where id = v_slot.id;

  insert into public.module_movements (module_id, from_slot_id, to_slot_id, moved_by, notes)
  values (
    p_module_id,
    v_from_slot,
    v_from_slot,
    v_user,
    format('Module gekoppeld aan dossier %s', v_number)
  );

  return jsonb_build_object(
    'ok', true,
    'dossier_id', p_dossier_id,
    'dossier_number', v_number,
    'sequence_number', v_slot.sequence_number,
    'total_modules', v_total,
    'level', v_slot.level
  );
end;
$$;

create or replace function public.confirm_dispatch_placement(
  p_module_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot public.dispatch_slots%rowtype;
  v_position_id uuid;
  v_target_slot uuid;
  v_occupant uuid;
  v_number text;
  v_total integer;
  v_from_slot uuid;
  v_block text;
  v_row text;
  v_pos text;
  v_placed integer;
  v_note text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;
  if not public.has_role(array['ADMIN', 'FORKLIFT_DRIVER', 'OFFICE', 'PRODUCTION']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;

  perform pg_advisory_xact_lock(('x' || substr(md5('place:' || p_module_id::text), 1, 16))::bit(64)::bigint);

  select ds.*
    into v_slot
  from public.dispatch_slots ds
  where ds.module_id = p_module_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  end if;
  if v_slot.status = 'PLACED' then
    select d.dossier_number, d.total_modules into v_number, v_total
    from public.dispatch_dossiers d
    where d.id = v_slot.dossier_id;
    select count(*) into v_placed
    from public.dispatch_slots
    where dossier_id = v_slot.dossier_id and status = 'PLACED';
    return jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'dossier_id', v_slot.dossier_id,
      'sequence_number', v_slot.sequence_number,
      'total_modules', v_total,
      'placed_count', v_placed,
      'status', case when v_placed >= v_total then 'READY_FOR_SHIPPING' else 'ACTIVE' end
    );
  end if;
  if v_slot.status is distinct from 'ASSIGNED' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;

  select rp.position_id, d.dossier_number, d.total_modules
    into v_position_id, v_number, v_total
  from public.dispatch_reserved_positions rp
  join public.dispatch_dossiers d on d.id = rp.dossier_id
  where rp.id = v_slot.reserved_position_id;

  select s.id, b.code, r.code, p.code
    into v_target_slot, v_block, v_row, v_pos
  from public.yard_slots s
  join public.yard_positions p on p.id = s.position_id
  join public.yard_rows r on r.id = s.row_id
  join public.yard_blocks b on b.id = s.block_id
  where s.position_id = v_position_id
    and s.level = v_slot.level
  for update of s;

  if v_target_slot is null then
    return jsonb_build_object('ok', false, 'error_code', 'SLOT_MISSING');
  end if;
  if v_block is distinct from 'A' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;

  select ml.module_id into v_occupant
  from public.module_locations ml
  where ml.slot_id = v_target_slot
  for update;

  if v_occupant is not null and v_occupant is distinct from p_module_id then
    return jsonb_build_object('ok', false, 'error_code', 'SLOT_OCCUPIED');
  end if;

  select ml.slot_id into v_from_slot
  from public.module_locations ml
  where ml.module_id = p_module_id
  for update;

  v_note := format(
    'Verplaatst van Productie F naar %s-%s-%s niveau %s voor dossier %s',
    v_block,
    v_row,
    v_pos,
    case v_slot.level
      when 'GROUND' then 0
      when 'LEVEL_1' then 1
      else 2
    end,
    v_number
  );
  perform set_config('app.movement_notes', v_note, true);

  if v_from_slot is null then
    insert into public.module_locations (module_id, slot_id, updated_by)
    values (p_module_id, v_target_slot, v_user);
  else
    update public.module_locations
    set slot_id = v_target_slot, updated_by = v_user, updated_at = now()
    where module_id = p_module_id;
  end if;

  update public.dispatch_slots
  set status = 'PLACED', placed_at = now()
  where id = v_slot.id;

  select count(*) into v_placed
  from public.dispatch_slots
  where dossier_id = v_slot.dossier_id and status = 'PLACED';

  if v_placed >= v_total then
    update public.dispatch_dossiers
    set status = 'READY_FOR_SHIPPING'
    where id = v_slot.dossier_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'dossier_id', v_slot.dossier_id,
    'sequence_number', v_slot.sequence_number,
    'total_modules', v_total,
    'placed_count', v_placed,
    'status', case when v_placed >= v_total then 'READY_FOR_SHIPPING' else 'ACTIVE' end,
    'slot_id', v_target_slot
  );
end;
$$;

create or replace function public.dispatch_sync_reservation_blocking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('SHIPPED', 'CANCELLED') then
    update public.dispatch_reserved_positions
    set blocking = false
    where dossier_id = new.id and blocking;
  elsif new.status in ('ACTIVE', 'READY_FOR_SHIPPING') then
    update public.dispatch_reserved_positions
    set blocking = true
    where dossier_id = new.id and not blocking;
  end if;
  return new;
end;
$$;

create trigger dispatch_dossiers_sync_blocking
  after insert or update of status on public.dispatch_dossiers
  for each row execute function public.dispatch_sync_reservation_blocking();

create or replace function public.guard_module_location_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_block text;
  v_to_position uuid;
  v_to_level public.stack_level;
  v_dispatch_confirm boolean;
begin
  select s.position_id, s.level
    into v_to_position, v_to_level
  from public.yard_slots s
  where s.id = new.slot_id;

  v_dispatch_confirm := exists (
    select 1
    from public.dispatch_slots ds
    join public.dispatch_reserved_positions rp on rp.id = ds.reserved_position_id
    where ds.module_id = new.module_id
      and ds.status = 'ASSIGNED'
      and rp.position_id = v_to_position
      and ds.level = v_to_level
  );

  if v_dispatch_confirm then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select b.code
      into v_from_block
    from public.yard_slots s
    join public.yard_blocks b on b.id = s.block_id
    where s.id = old.slot_id;

    if v_from_block is not distinct from 'F' then
      raise exception 'DISPATCH_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1
    from public.dispatch_reserved_positions rp
    where rp.position_id = v_to_position
      and rp.blocking
  ) then
    raise exception 'POSITION_RESERVED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger module_locations_guard_dispatch
  before insert or update of slot_id on public.module_locations
  for each row execute function public.guard_module_location_dispatch();

grant usage on type public.dispatch_dossier_status to authenticated;
grant usage on type public.dispatch_slot_status to authenticated;
grant execute on function public.dispatch_required_ground_positions(integer) to authenticated;
grant execute on function public.create_dispatch_dossier(text, text, text, integer, uuid[], uuid) to authenticated;
grant execute on function public.assign_module_to_dispatch_dossier(uuid, uuid) to authenticated;
grant execute on function public.confirm_dispatch_placement(uuid) to authenticated;
