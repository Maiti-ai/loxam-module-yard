-- Replace F-exit dossier creation with Yves pre-planning:
-- pick concrete modules, set order, reserve A stacks, then activate.
-- Physical yard occupancy and movement history stay the source of truth.

alter table public.dispatch_slots
  alter column reserved_position_id drop not null;

alter table public.dispatch_slots
  add column if not exists production_status public.dispatch_production_status,
  add column if not exists placed_in_production_at timestamptz,
  add column if not exists production_ready_at timestamptz;

update public.dispatch_slots
set production_status = 'READY_FOR_DISPATCH'::public.dispatch_production_status
where status = 'ASSIGNED'
  and production_status is null;

update public.dispatch_slots
set production_status = 'IN_DISPATCH_ZONE'::public.dispatch_production_status
where status = 'PLACED'
  and production_status is null;

create or replace function public.dispatch_module_block_code(p_module_id uuid)
returns text
language sql
stable
as $$
  select b.code
  from public.module_locations ml
  join public.yard_slots s on s.id = ml.slot_id
  join public.yard_blocks b on b.id = s.block_id
  where ml.module_id = p_module_id
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
  elsif new.status in ('DRAFT', 'ACTIVE', 'READY_FOR_SHIPPING') then
    update public.dispatch_reserved_positions
    set blocking = true
    where dossier_id = new.id and not blocking;
  end if;
  return new;
end;
$$;

drop function if exists public.create_dispatch_dossier(text, text, text, integer, uuid[], uuid);
drop function if exists public.assign_module_to_dispatch_dossier(uuid, uuid);

create or replace function public.create_dispatch_dossier(
  p_dossier_number text,
  p_customer_name text,
  p_site_location text,
  p_total_modules integer,
  p_position_ids uuid[],
  p_module_ids uuid[],
  p_dossier_id uuid default null,
  p_activate boolean default false
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
  v_dossier_id uuid := p_dossier_id;
  v_status public.dispatch_dossier_status;
  v_module_count integer := coalesce(cardinality(p_module_ids), 0);
  v_position_count integer := coalesce(cardinality(p_position_ids), 0);
  v_pos_index integer;
  v_seq integer;
  v_position_id uuid;
  v_module_id uuid;
  v_block text;
  v_current_block text;
  v_module_status public.module_status;
  v_reserved_id uuid;
  v_level public.stack_level;
  v_prod public.dispatch_production_status;
  v_other uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;
  if not public.has_role(array['ADMIN', 'OFFICE']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;
  if v_number = '' or v_customer = '' or v_site = '' or p_total_modules is null or p_total_modules < 1 then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_INCOMPLETE');
  end if;

  v_required := public.dispatch_required_ground_positions(p_total_modules);
  if v_position_count not in (0, v_required) then
    return jsonb_build_object('ok', false, 'error_code', 'INSUFFICIENT_SPACE');
  end if;
  if v_module_count > p_total_modules then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_WRONG_COUNT');
  end if;
  if p_activate and (v_module_count <> p_total_modules or v_position_count <> v_required) then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_WRONG_COUNT');
  end if;
  if exists (
    select 1 from unnest(coalesce(p_position_ids, array[]::uuid[])) as pid group by pid having count(*) > 1
  ) then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;
  if exists (
    select 1 from unnest(coalesce(p_module_ids, array[]::uuid[])) as mid group by mid having count(*) > 1
  ) then
    return jsonb_build_object('ok', false, 'error_code', 'MODULE_IN_DOSSIER');
  end if;

  perform pg_advisory_xact_lock(8422026);

  if v_dossier_id is not null then
    select d.status into v_status
    from public.dispatch_dossiers d
    where d.id = v_dossier_id
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
    end if;
    if v_status is distinct from 'DRAFT' then
      return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_ALREADY_ACTIVE');
    end if;
    if exists (
      select 1
      from public.dispatch_dossiers d
      where lower(d.dossier_number) = lower(v_number)
        and d.id is distinct from v_dossier_id
    ) then
      return jsonb_build_object('ok', false, 'error_code', 'DOSSIER_EXISTS');
    end if;
    update public.dispatch_dossiers
    set
      dossier_number = v_number,
      customer_name = v_customer,
      site_location = v_site,
      total_modules = p_total_modules
    where id = v_dossier_id;
  else
    if exists (
      select 1 from public.dispatch_dossiers d where lower(d.dossier_number) = lower(v_number)
    ) then
      return jsonb_build_object('ok', false, 'error_code', 'DOSSIER_EXISTS');
    end if;
    insert into public.dispatch_dossiers (
      dossier_number, customer_name, site_location, total_modules, status, created_by
    ) values (
      v_number, v_customer, v_site, p_total_modules, 'DRAFT', v_user
    )
    returning id into v_dossier_id;
  end if;

  for v_seq in 1 .. v_module_count loop
    v_module_id := p_module_ids[v_seq];
    perform pg_advisory_xact_lock(8422028, hashtext(v_module_id::text));

    select m.status into v_module_status
    from public.modules m
    where m.id = v_module_id
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
    end if;
    if v_module_status is distinct from 'AVAILABLE' then
      return jsonb_build_object('ok', false, 'error_code', 'MODULE_UNAVAILABLE');
    end if;

    v_current_block := public.dispatch_module_block_code(v_module_id);
    if v_current_block is not distinct from 'A' then
      return jsonb_build_object('ok', false, 'error_code', 'MODULE_UNAVAILABLE');
    end if;

    select ds.dossier_id into v_other
    from public.dispatch_slots ds
    join public.dispatch_dossiers d on d.id = ds.dossier_id
    where ds.module_id = v_module_id
      and d.status in ('DRAFT', 'ACTIVE', 'READY_FOR_SHIPPING')
      and d.id is distinct from v_dossier_id;
    if v_other is not null then
      return jsonb_build_object('ok', false, 'error_code', 'MODULE_IN_DOSSIER');
    end if;
  end loop;

  for v_pos_index in 1 .. v_position_count loop
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
      where rp.position_id = v_position_id
        and rp.blocking
        and rp.dossier_id is distinct from v_dossier_id
    ) then
      return jsonb_build_object('ok', false, 'error_code', 'POSITION_RESERVED');
    end if;
  end loop;

  delete from public.dispatch_slots where dossier_id = v_dossier_id;
  delete from public.dispatch_reserved_positions where dossier_id = v_dossier_id;

  for v_pos_index in 1 .. v_position_count loop
    insert into public.dispatch_reserved_positions (
      dossier_id, position_id, position_order, blocking
    ) values (
      v_dossier_id, p_position_ids[v_pos_index], v_pos_index, true
    );
  end loop;

  if v_module_count > 0 and v_position_count = v_required then
    for v_seq in 1 .. v_module_count loop
      v_pos_index := ((v_seq - 1) / 3) + 1;
      v_level := (array['GROUND', 'LEVEL_1', 'LEVEL_2']::public.stack_level[])[((v_seq - 1) % 3) + 1];
      select rp.id into strict v_reserved_id
      from public.dispatch_reserved_positions rp
      where rp.dossier_id = v_dossier_id and rp.position_order = v_pos_index;

      v_prod := null;
      if p_activate then
        v_current_block := public.dispatch_module_block_code(p_module_ids[v_seq]);
        if v_current_block is not distinct from 'F' then
          v_prod := 'IN_PRODUCTION';
        else
          v_prod := 'TO_PRODUCTION';
        end if;
      end if;

      insert into public.dispatch_slots (
        dossier_id,
        reserved_position_id,
        sequence_number,
        level,
        module_id,
        status,
        assigned_at,
        assigned_by,
        production_status,
        placed_in_production_at
      ) values (
        v_dossier_id,
        v_reserved_id,
        v_seq,
        v_level,
        p_module_ids[v_seq],
        case when p_activate then 'ASSIGNED'::public.dispatch_slot_status else 'EMPTY'::public.dispatch_slot_status end,
        case when p_activate then now() else null end,
        case when p_activate then v_user else null end,
        v_prod,
        case when v_prod = 'IN_PRODUCTION' then now() else null end
      );
    end loop;
  elsif v_module_count > 0 then
    for v_seq in 1 .. v_module_count loop
      insert into public.dispatch_slots (
        dossier_id,
        reserved_position_id,
        sequence_number,
        level,
        module_id,
        status
      ) values (
        v_dossier_id,
        null,
        v_seq,
        'GROUND',
        p_module_ids[v_seq],
        'EMPTY'
      );
    end loop;
  end if;

  if p_activate then
    update public.dispatch_dossiers
    set status = 'ACTIVE'
    where id = v_dossier_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'dossier_id', v_dossier_id,
    'dossier_number', v_number,
    'total_modules', p_total_modules,
    'status', case when p_activate then 'ACTIVE' else 'DRAFT' end
  );
exception
  when unique_violation then
    if exists (
      select 1
      from public.dispatch_dossiers d
      where lower(d.dossier_number) = lower(v_number)
        and d.id is distinct from v_dossier_id
    ) then
      return jsonb_build_object('ok', false, 'error_code', 'DOSSIER_EXISTS');
    end if;
    if exists (
      select 1
      from public.dispatch_slots ds
      join public.dispatch_dossiers d on d.id = ds.dossier_id
      where ds.module_id = any (coalesce(p_module_ids, array[]::uuid[]))
        and d.id is distinct from v_dossier_id
        and d.status in ('DRAFT', 'ACTIVE', 'READY_FOR_SHIPPING')
    ) then
      return jsonb_build_object('ok', false, 'error_code', 'MODULE_IN_DOSSIER');
    end if;
    return jsonb_build_object('ok', false, 'error_code', 'POSITION_RESERVED');
end;
$$;

create or replace function public.cancel_dispatch_dossier(p_dossier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_status public.dispatch_dossier_status;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;
  if not public.has_role(array['ADMIN', 'OFFICE']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;

  perform pg_advisory_xact_lock(('x' || substr(md5('cancel:' || p_dossier_id::text), 1, 16))::bit(64)::bigint);

  select d.status into v_status
  from public.dispatch_dossiers d
  where d.id = p_dossier_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  end if;
  if v_status in ('SHIPPED', 'CANCELLED') then
    return jsonb_build_object('ok', true, 'unchanged', true, 'status', v_status);
  end if;

  update public.dispatch_slots
  set module_id = null
  where dossier_id = p_dossier_id
    and status is distinct from 'PLACED';

  update public.dispatch_dossiers
  set status = 'CANCELLED'
  where id = p_dossier_id;

  return jsonb_build_object('ok', true, 'dossier_id', p_dossier_id, 'status', 'CANCELLED');
end;
$$;

create or replace function public.mark_dispatch_production_ready(p_module_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_slot public.dispatch_slots%rowtype;
  v_status public.dispatch_dossier_status;
  v_number text;
  v_from_slot uuid;
  v_block text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;
  if not public.has_role(array['ADMIN', 'OFFICE', 'PRODUCTION']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;

  perform pg_advisory_xact_lock(8422028, hashtext(p_module_id::text));

  select ds.*
    into v_slot
  from public.dispatch_slots ds
  where ds.module_id = p_module_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  end if;

  select d.status, d.dossier_number
    into v_status, v_number
  from public.dispatch_dossiers d
  where d.id = v_slot.dossier_id
  for update;
  if v_status is distinct from 'ACTIVE' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_ALREADY_ACTIVE');
  end if;
  if v_slot.production_status = 'READY_FOR_DISPATCH' then
    return jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'dossier_id', v_slot.dossier_id,
      'production_status', v_slot.production_status
    );
  end if;
  if v_slot.production_status is distinct from 'IN_PRODUCTION' then
    return jsonb_build_object('ok', false, 'error_code', 'PRODUCTION_NOT_READY');
  end if;

  v_block := public.dispatch_module_block_code(p_module_id);
  if v_block is distinct from 'F' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_NOT_IN_F');
  end if;

  update public.dispatch_slots
  set
    production_status = 'READY_FOR_DISPATCH',
    production_ready_at = now()
  where id = v_slot.id;

  select ml.slot_id into v_from_slot
  from public.module_locations ml
  where ml.module_id = p_module_id;

  insert into public.module_movements (module_id, from_slot_id, to_slot_id, moved_by, notes)
  values (
    p_module_id,
    v_from_slot,
    v_from_slot,
    v_user,
    format('Productie klaar voor dossier %s', v_number)
  );

  return jsonb_build_object(
    'ok', true,
    'dossier_id', v_slot.dossier_id,
    'production_status', 'READY_FOR_DISPATCH'
  );
end;
$$;

create or replace function public.confirm_dispatch_placement(p_module_id uuid)
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
  v_from_block text;
  v_block text;
  v_row text;
  v_pos text;
  v_placed integer;
  v_note text;
  v_dossier_status public.dispatch_dossier_status;
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

  select d.dossier_number, d.total_modules, d.status
    into v_number, v_total, v_dossier_status
  from public.dispatch_dossiers d
  where d.id = v_slot.dossier_id
  for update;

  if v_slot.status = 'PLACED' or v_slot.production_status = 'IN_DISPATCH_ZONE' then
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

  if v_dossier_status is distinct from 'ACTIVE' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;
  if v_slot.production_status is distinct from 'READY_FOR_DISPATCH' then
    return jsonb_build_object('ok', false, 'error_code', 'PRODUCTION_NOT_READY');
  end if;
  if v_slot.reserved_position_id is null then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_INCOMPLETE');
  end if;

  v_from_block := public.dispatch_module_block_code(p_module_id);
  if v_from_block is distinct from 'F' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_NOT_IN_F');
  end if;

  select rp.position_id
    into v_position_id
  from public.dispatch_reserved_positions rp
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
    'Module verplaatst van Productie F naar %s-%s-%s niveau %s voor dossier %s.',
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
  set
    status = 'PLACED',
    placed_at = now(),
    production_status = 'IN_DISPATCH_ZONE'
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

create or replace function public.guard_module_location_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to_block text;
  v_to_position uuid;
  v_to_level public.stack_level;
  v_slot_id uuid;
  v_reserved_position uuid;
  v_slot_level public.stack_level;
  v_prod public.dispatch_production_status;
  v_number text;
  v_own_target boolean := false;
begin
  select s.position_id, s.level, b.code
    into v_to_position, v_to_level, v_to_block
  from public.yard_slots s
  join public.yard_blocks b on b.id = s.block_id
  where s.id = new.slot_id;

  select ds.id, rp.position_id, ds.level, ds.production_status, d.dossier_number
    into v_slot_id, v_reserved_position, v_slot_level, v_prod, v_number
  from public.dispatch_slots ds
  join public.dispatch_dossiers d on d.id = ds.dossier_id
  left join public.dispatch_reserved_positions rp on rp.id = ds.reserved_position_id
  where ds.module_id = new.module_id
    and d.status in ('ACTIVE', 'READY_FOR_SHIPPING')
  limit 1;

  v_own_target := (
    v_slot_id is not null
    and v_reserved_position is not null
    and v_reserved_position = v_to_position
    and v_slot_level = v_to_level
  );

  if v_slot_id is not null then
    if v_prod = 'TO_PRODUCTION' then
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

    if v_prod = 'IN_PRODUCTION' then
      if v_to_block is distinct from 'F' then
        raise exception 'PRODUCTION_NOT_READY' using errcode = 'P0001';
      end if;
      return new;
    end if;

    if v_prod = 'READY_FOR_DISPATCH' then
      if not v_own_target then
        raise exception 'DISPATCH_REQUIRED' using errcode = 'P0001';
      end if;
      return new;
    end if;
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

create or replace function public.dispatch_on_moved_to_production()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to_block text;
begin
  select b.code
    into v_to_block
  from public.yard_slots s
  join public.yard_blocks b on b.id = s.block_id
  where s.id = new.slot_id;

  if v_to_block is distinct from 'F' then
    return new;
  end if;

  update public.dispatch_slots ds
  set
    production_status = 'IN_PRODUCTION',
    placed_in_production_at = coalesce(ds.placed_in_production_at, now())
  from public.dispatch_dossiers d
  where ds.module_id = new.module_id
    and ds.dossier_id = d.id
    and d.status = 'ACTIVE'
    and ds.production_status = 'TO_PRODUCTION';

  return new;
end;
$$;

drop trigger if exists module_locations_dispatch_production on public.module_locations;
create trigger module_locations_dispatch_production
  after insert or update of slot_id on public.module_locations
  for each row execute function public.dispatch_on_moved_to_production();

grant execute on function public.dispatch_module_block_code(uuid) to authenticated;
grant execute on function public.create_dispatch_dossier(text, text, text, integer, uuid[], uuid[], uuid, boolean) to authenticated;
grant execute on function public.cancel_dispatch_dossier(uuid) to authenticated;
grant execute on function public.mark_dispatch_production_ready(uuid) to authenticated;
grant execute on function public.confirm_dispatch_placement(uuid) to authenticated;
