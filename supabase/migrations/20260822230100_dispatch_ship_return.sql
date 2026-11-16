-- Ship / return RPCs and guards (after enum values committed).

create or replace function public.is_dispatch_return_arrivals_slot(p_slot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.yard_slots s
    join public.yard_rows r on r.id = s.row_id
    join public.yard_blocks b on b.id = s.block_id
    where s.id = p_slot_id
      and b.code = 'D'
      and r.code in ('P3', 'P4')
  );
$$;

create or replace function public.is_dispatch_return_arrivals_position(p_position_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.yard_positions p
    join public.yard_rows r on r.id = p.row_id
    join public.yard_blocks b on b.id = r.block_id
    where p.id = p_position_id
      and b.code = 'D'
      and r.code in ('P3', 'P4')
  );
$$;

create or replace function public.dispatch_recompute_dossier_status(p_dossier_id uuid)
returns public.dispatch_dossier_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_placed integer;
  v_shipped integer;
  v_returned integer;
  v_status public.dispatch_dossier_status;
begin
  select d.total_modules, d.status
    into v_total, v_status
  from public.dispatch_dossiers d
  where d.id = p_dossier_id
  for update;

  if not found then
    return null;
  end if;
  if v_status in ('DRAFT', 'CANCELLED') then
    return v_status;
  end if;

  select
    count(*) filter (where status = 'PLACED'),
    count(*) filter (where status = 'SHIPPED'),
    count(*) filter (where status = 'RETURNED')
  into v_placed, v_shipped, v_returned
  from public.dispatch_slots
  where dossier_id = p_dossier_id;

  if v_returned >= v_total then
    v_status := 'RETURNED';
  elsif v_returned > 0 then
    v_status := 'PARTIALLY_RETURNED';
  elsif v_shipped >= v_total then
    v_status := 'SHIPPED';
  elsif v_shipped > 0 then
    v_status := 'PARTIALLY_SHIPPED';
  elsif v_placed >= v_total then
    v_status := 'READY_FOR_SHIPPING';
  else
    v_status := 'ACTIVE';
  end if;

  update public.dispatch_dossiers
  set status = v_status
  where id = p_dossier_id;

  return v_status;
end;
$$;

create or replace function public.dispatch_release_reserved_position_if_idle(p_reserved_position_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reserved_position_id is null then
    return;
  end if;
  if exists (
    select 1
    from public.dispatch_slots ds
    where ds.reserved_position_id = p_reserved_position_id
      and ds.status in ('ASSIGNED', 'PLACED')
  ) then
    return;
  end if;
  update public.dispatch_reserved_positions
  set blocking = false
  where id = p_reserved_position_id
    and blocking;
end;
$$;

create or replace function public.dispatch_sync_reservation_blocking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('SHIPPED', 'RETURNED', 'CANCELLED') then
    update public.dispatch_reserved_positions
    set blocking = false
    where dossier_id = new.id and blocking;
  elsif new.status in ('DRAFT', 'ACTIVE', 'READY_FOR_SHIPPING') then
    update public.dispatch_reserved_positions
    set blocking = true
    where dossier_id = new.id and not blocking;
  end if;
  -- PARTIALLY_SHIPPED / PARTIALLY_RETURNED: per-position blocking is managed by ship/return RPCs.
  return new;
end;
$$;

create or replace function public.ship_dispatch_module(p_module_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot public.dispatch_slots%rowtype;
  v_number text;
  v_customer text;
  v_site text;
  v_dossier_status public.dispatch_dossier_status;
  v_total integer;
  v_block text;
  v_position_id uuid;
  v_slot_level public.stack_level;
  v_actual_position uuid;
  v_actual_level public.stack_level;
  v_from_slot uuid;
  v_shipped integer;
  v_placed_remaining integer;
  v_note text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;
  if not public.has_role(array['ADMIN', 'FORKLIFT_DRIVER', 'OFFICE', 'PRODUCTION']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;

  perform pg_advisory_xact_lock(('x' || substr(md5('ship:' || p_module_id::text), 1, 16))::bit(64)::bigint);

  select ds.*
    into v_slot
  from public.dispatch_slots ds
  where ds.module_id = p_module_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  end if;

  select d.dossier_number, d.customer_name, d.site_location, d.status, d.total_modules
    into v_number, v_customer, v_site, v_dossier_status, v_total
  from public.dispatch_dossiers d
  where d.id = v_slot.dossier_id
  for update;

  if v_dossier_status in ('DRAFT', 'CANCELLED') then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;

  if v_slot.status in ('SHIPPED', 'RETURNED') then
    select count(*) into v_shipped
    from public.dispatch_slots
    where dossier_id = v_slot.dossier_id and status in ('SHIPPED', 'RETURNED');
    return jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'dossier_id', v_slot.dossier_id,
      'shipped_count', v_shipped,
      'total_modules', v_total,
      'status', v_dossier_status
    );
  end if;

  if v_slot.status is distinct from 'PLACED' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_NOT_READY_TO_SHIP');
  end if;
  if v_slot.reserved_position_id is null then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_INCOMPLETE');
  end if;

  select rp.position_id into v_position_id
  from public.dispatch_reserved_positions rp
  where rp.id = v_slot.reserved_position_id;

  select ml.slot_id, s.position_id, s.level, b.code
    into v_from_slot, v_actual_position, v_actual_level, v_block
  from public.module_locations ml
  join public.yard_slots s on s.id = ml.slot_id
  join public.yard_blocks b on b.id = s.block_id
  where ml.module_id = p_module_id
  for update of ml;

  if v_from_slot is null or v_block is distinct from 'A' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_NOT_IN_A');
  end if;
  if v_actual_position is distinct from v_position_id or v_actual_level is distinct from v_slot.level then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_WRONG_SLOT');
  end if;

  v_note := format(
    'Module %s verzonden voor dossier %s naar %s – %s.',
    (select module_number from public.modules where id = p_module_id),
    v_number,
    v_customer,
    v_site
  );
  perform set_config('app.movement_notes', v_note, true);

  delete from public.module_locations where module_id = p_module_id;

  update public.modules
  set
    status = 'RENTED',
    rented_to_project = left(format('%s – %s', v_customer, v_site), 200)
  where id = p_module_id;

  update public.dispatch_slots
  set
    status = 'SHIPPED',
    shipped_at = now(),
    shipped_by = v_user
  where id = v_slot.id;

  perform public.dispatch_release_reserved_position_if_idle(v_slot.reserved_position_id);
  v_dossier_status := public.dispatch_recompute_dossier_status(v_slot.dossier_id);

  select count(*) into v_shipped
  from public.dispatch_slots
  where dossier_id = v_slot.dossier_id and status in ('SHIPPED', 'RETURNED');
  select count(*) into v_placed_remaining
  from public.dispatch_slots
  where dossier_id = v_slot.dossier_id and status = 'PLACED';

  return jsonb_build_object(
    'ok', true,
    'dossier_id', v_slot.dossier_id,
    'shipped_count', v_shipped,
    'placed_remaining', v_placed_remaining,
    'total_modules', v_total,
    'status', v_dossier_status
  );
end;
$$;

create or replace function public.return_dispatch_module(p_module_id uuid, p_position_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot public.dispatch_slots%rowtype;
  v_number text;
  v_customer text;
  v_site text;
  v_dossier_status public.dispatch_dossier_status;
  v_total integer;
  v_block text;
  v_row text;
  v_pos text;
  v_target_slot uuid;
  v_target_level public.stack_level;
  v_level public.stack_level;
  v_occupant uuid;
  v_existing uuid;
  v_returned integer;
  v_on_rent integer;
  v_note text;
  v_module_number text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;
  if not public.has_role(array['ADMIN', 'FORKLIFT_DRIVER', 'OFFICE', 'PRODUCTION']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;

  perform pg_advisory_xact_lock(('x' || substr(md5('return:' || p_module_id::text), 1, 16))::bit(64)::bigint);
  perform pg_advisory_xact_lock(('x' || substr(md5('pos:' || p_position_id::text), 1, 16))::bit(64)::bigint);

  select ds.*
    into v_slot
  from public.dispatch_slots ds
  where ds.module_id = p_module_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  end if;

  select d.dossier_number, d.customer_name, d.site_location, d.status, d.total_modules
    into v_number, v_customer, v_site, v_dossier_status, v_total
  from public.dispatch_dossiers d
  where d.id = v_slot.dossier_id
  for update;

  if v_dossier_status in ('DRAFT', 'CANCELLED') then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;

  if v_slot.status = 'RETURNED' then
    select count(*) into v_returned
    from public.dispatch_slots
    where dossier_id = v_slot.dossier_id and status = 'RETURNED';
    return jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'dossier_id', v_slot.dossier_id,
      'returned_count', v_returned,
      'total_modules', v_total,
      'status', v_dossier_status,
      'slot_id', v_slot.return_slot_id
    );
  end if;

  if v_slot.status is distinct from 'SHIPPED' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_NOT_ON_RENT');
  end if;

  select ml.slot_id into v_existing
  from public.module_locations ml
  where ml.module_id = p_module_id;
  if v_existing is not null then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_ALREADY_ON_YARD');
  end if;

  if not public.is_dispatch_return_arrivals_position(p_position_id) then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_RETURN_ZONE_REQUIRED');
  end if;

  v_target_slot := null;
  for v_level in select unnest(array['GROUND', 'LEVEL_1', 'LEVEL_2']::public.stack_level[]) loop
    select s.id, s.level, b.code, r.code, p.code
      into v_target_slot, v_target_level, v_block, v_row, v_pos
    from public.yard_slots s
    join public.yard_positions p on p.id = s.position_id
    join public.yard_rows r on r.id = s.row_id
    join public.yard_blocks b on b.id = s.block_id
    where s.position_id = p_position_id
      and s.level = v_level
    for update of s;

    if v_target_slot is null then
      continue;
    end if;

    select ml.module_id into v_occupant
    from public.module_locations ml
    where ml.slot_id = v_target_slot
    for update;

    if v_occupant is null then
      exit;
    end if;
    v_target_slot := null;
  end loop;

  if v_target_slot is null then
    return jsonb_build_object('ok', false, 'error_code', 'POSITION_FULL');
  end if;
  if not public.is_dispatch_return_arrivals_slot(v_target_slot) then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_RETURN_ZONE_REQUIRED');
  end if;

  select module_number into v_module_number from public.modules where id = p_module_id;
  v_note := format(
    'Module %s retour ontvangen voor dossier %s en geplaatst in D Retour/Arrivées %s-%s-%s niveau %s.',
    v_module_number,
    v_number,
    v_block,
    v_row,
    v_pos,
    case v_target_level when 'GROUND' then 0 when 'LEVEL_1' then 1 else 2 end
  );
  perform set_config('app.movement_notes', v_note, true);

  insert into public.module_locations (module_id, slot_id, updated_by)
  values (p_module_id, v_target_slot, v_user);

  update public.modules
  set status = 'AVAILABLE', rented_to_project = null
  where id = p_module_id;

  update public.dispatch_slots
  set
    status = 'RETURNED',
    returned_at = now(),
    returned_by = v_user,
    return_slot_id = v_target_slot
  where id = v_slot.id;

  v_dossier_status := public.dispatch_recompute_dossier_status(v_slot.dossier_id);

  select count(*) into v_returned
  from public.dispatch_slots
  where dossier_id = v_slot.dossier_id and status = 'RETURNED';
  select count(*) into v_on_rent
  from public.dispatch_slots
  where dossier_id = v_slot.dossier_id and status = 'SHIPPED';

  return jsonb_build_object(
    'ok', true,
    'dossier_id', v_slot.dossier_id,
    'returned_count', v_returned,
    'on_rent_count', v_on_rent,
    'total_modules', v_total,
    'status', v_dossier_status,
    'slot_id', v_target_slot,
    'level', v_target_level,
    'block_code', v_block,
    'row_code', v_row,
    'position_code', v_pos
  );
end;
$$;

create or replace function public.guard_module_location_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to_block text;
  v_from_block text;
  v_to_position uuid;
  v_to_level public.stack_level;
  v_slot_id uuid;
  v_reserved_position uuid;
  v_slot_level public.stack_level;
  v_slot_status public.dispatch_slot_status;
  v_number text;
  v_own_target boolean := false;
begin
  select s.position_id, s.level, b.code
    into v_to_position, v_to_level, v_to_block
  from public.yard_slots s
  join public.yard_blocks b on b.id = s.block_id
  where s.id = new.slot_id;

  if tg_op = 'UPDATE' then
    select b.code
      into v_from_block
    from public.yard_slots s
    join public.yard_blocks b on b.id = s.block_id
    where s.id = old.slot_id;
  else
    v_from_block := public.dispatch_module_block_code(new.module_id);
  end if;

  select ds.id, rp.position_id, ds.level, ds.status, d.dossier_number
    into v_slot_id, v_reserved_position, v_slot_level, v_slot_status, v_number
  from public.dispatch_slots ds
  join public.dispatch_dossiers d on d.id = ds.dossier_id
  left join public.dispatch_reserved_positions rp on rp.id = ds.reserved_position_id
  where ds.module_id = new.module_id
    and d.status in (
      'ACTIVE',
      'READY_FOR_SHIPPING',
      'PARTIALLY_SHIPPED',
      'SHIPPED',
      'PARTIALLY_RETURNED',
      'RETURNED'
    )
  limit 1;

  if v_slot_id is not null and v_slot_status = 'SHIPPED' then
    if public.is_dispatch_return_arrivals_slot(new.slot_id) then
      return new;
    end if;
    raise exception 'DISPATCH_RETURN_ZONE_REQUIRED' using errcode = 'P0001';
  end if;

  v_own_target := (
    v_slot_id is not null
    and v_slot_status in ('ASSIGNED', 'PLACED', 'EMPTY')
    and v_reserved_position is not null
    and v_reserved_position = v_to_position
    and v_slot_level = v_to_level
  );

  if v_slot_id is not null and v_slot_status in ('ASSIGNED', 'PLACED', 'EMPTY') then
    if v_own_target then
      return new;
    end if;

    if v_from_block is not distinct from 'F' then
      raise exception 'DISPATCH_REQUIRED' using errcode = 'P0001';
    end if;

    if v_from_block is not distinct from 'A' then
      raise exception 'DISPATCH_REQUIRED' using errcode = 'P0001';
    end if;

    if v_to_block is distinct from 'F' then
      raise exception 'DISPATCH_DESTINATION_MUST_BE_F' using errcode = 'P0001';
    end if;

    perform set_config(
      'app.movement_notes',
      format('Module verplaatst naar Productie F voor dossier %s.', v_number),
      true
    );
    return new;
  end if;

  if not v_own_target then
    if exists (
      select 1
      from public.dispatch_reserved_positions rp
      where rp.position_id = v_to_position
        and rp.blocking
    ) then
      raise exception 'POSITION_RESERVED' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

grant execute on function public.is_dispatch_return_arrivals_slot(uuid) to authenticated;
grant execute on function public.is_dispatch_return_arrivals_position(uuid) to authenticated;
grant execute on function public.dispatch_recompute_dossier_status(uuid) to authenticated;
grant execute on function public.ship_dispatch_module(uuid) to authenticated;
grant execute on function public.return_dispatch_module(uuid, uuid) to authenticated;
