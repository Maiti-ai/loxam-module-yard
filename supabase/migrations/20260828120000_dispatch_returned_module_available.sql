-- Returned modules keep historical dispatch_slots rows but release the active assignment
-- so they can join a new dossier. Only ASSIGNED / PLACED / SHIPPED block reuse.

create or replace function public.dispatch_module_has_active_assignment(p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dispatch_slots ds
    where ds.module_id = p_module_id
      and ds.status in ('ASSIGNED', 'PLACED', 'SHIPPED')
  );
$$;

drop index if exists public.dispatch_slots_module_uidx;

create unique index if not exists dispatch_slots_active_module_uidx
  on public.dispatch_slots (module_id)
  where module_id is not null
    and status in ('ASSIGNED', 'PLACED', 'SHIPPED');

-- Patch create_dispatch_dossier: block only active slot assignments, not RETURNED history.
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
  v_dossier_id uuid := p_dossier_id;
  v_number text := btrim(p_dossier_number);
  v_customer text := btrim(p_customer_name);
  v_site text := btrim(p_site_location);
  v_required integer;
  v_position_count integer := coalesce(cardinality(p_position_ids), 0);
  v_module_count integer := coalesce(cardinality(p_module_ids), 0);
  v_pos_index integer;
  v_seq integer;
  v_level public.stack_level;
  v_reserved_id uuid;
  v_module_id uuid;
  v_module_status public.module_status;
  v_current_block text;
  v_position_id uuid;
  v_block text;
  v_prod public.dispatch_production_status;
  v_other uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;
  if not public.has_role(array['ADMIN', 'OFFICE']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;

  v_required := public.dispatch_required_ground_positions(p_total_modules);
  if p_activate then
    if v_required = 0 or v_position_count <> v_required or v_module_count <> p_total_modules then
      return jsonb_build_object('ok', false, 'error_code', 'INSUFFICIENT_SPACE');
    end if;
  elsif v_module_count > p_total_modules then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_WRONG_COUNT');
  end if;

  if v_number = '' or v_customer = '' or v_site = '' then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
  end if;

  if exists (
    select 1 from unnest(coalesce(p_module_ids, array[]::uuid[])) as mid group by mid having count(*) > 1
  ) then
    return jsonb_build_object('ok', false, 'error_code', 'MODULE_IN_DOSSIER');
  end if;

  perform pg_advisory_xact_lock(('x' || substr(md5('dossier:' || coalesce(v_dossier_id::text, v_number)), 1, 16))::bit(64)::bigint);

  if v_dossier_id is not null then
    select d.id into v_dossier_id
    from public.dispatch_dossiers d
    where d.id = v_dossier_id
      and d.status = 'DRAFT'
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_ALREADY_ACTIVE');
    end if;
    update public.dispatch_dossiers
    set
      dossier_number = v_number,
      customer_name = v_customer,
      site_location = v_site,
      total_modules = p_total_modules
    where id = v_dossier_id;
  else
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
    if v_current_block is distinct from 'A' then
      null;
    else
      return jsonb_build_object('ok', false, 'error_code', 'MODULE_UNAVAILABLE');
    end if;

    if exists (
      select 1
      from public.dispatch_slots ds
      where ds.module_id = v_module_id
        and ds.status in ('ASSIGNED', 'PLACED', 'SHIPPED')
        and ds.dossier_id is distinct from v_dossier_id
    ) then
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
        sequence_number,
        level,
        module_id,
        status
      ) values (
        v_dossier_id,
        v_seq,
        (array['GROUND', 'LEVEL_1', 'LEVEL_2']::public.stack_level[])[((v_seq - 1) % 3) + 1],
        p_module_ids[v_seq],
        'EMPTY'::public.dispatch_slot_status
      );
    end loop;
  end if;

  if p_activate then
    update public.dispatch_dossiers set status = 'ACTIVE' where id = v_dossier_id;
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
      where ds.module_id = any (coalesce(p_module_ids, array[]::uuid[]))
        and ds.status in ('ASSIGNED', 'PLACED', 'SHIPPED')
        and ds.dossier_id is distinct from v_dossier_id
    ) then
      return jsonb_build_object('ok', false, 'error_code', 'MODULE_IN_DOSSIER');
    end if;
    return jsonb_build_object('ok', false, 'error_code', 'POSITION_RESERVED');
end;
$$;

grant execute on function public.dispatch_module_has_active_assignment(uuid) to authenticated;

-- Operational RPCs must lock the active slot row, not historical RETURNED rows.
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
  v_target_level public.stack_level;
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
  v_written_level public.stack_level;
  v_written_position uuid;
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
    and ds.status in ('ASSIGNED', 'PLACED')
  order by case ds.status when 'PLACED' then 0 else 1 end
  limit 1
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

  select s.id, s.level, b.code, r.code, p.code
    into v_target_slot, v_target_level, v_block, v_row, v_pos
  from public.yard_slots s
  join public.yard_positions p on p.id = s.position_id
  join public.yard_rows r on r.id = s.row_id
  join public.yard_blocks b on b.id = s.block_id
  where s.position_id = v_position_id
    and s.level = v_slot.level
  for update of s;

  if v_target_slot is null or v_target_level is distinct from v_slot.level then
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
    return jsonb_build_object(
      'ok', false,
      'error_code', 'DISPATCH_TARGET_OCCUPIED',
      'block_code', v_block,
      'row_code', v_row,
      'position_code', v_pos,
      'level', v_slot.level
    );
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

  select s.position_id, s.level
    into v_written_position, v_written_level
  from public.module_locations ml
  join public.yard_slots s on s.id = ml.slot_id
  where ml.module_id = p_module_id;

  if v_written_position is distinct from v_position_id or v_written_level is distinct from v_slot.level then
    raise exception 'DISPATCH_FAILED' using errcode = 'P0001';
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
    'slot_id', v_target_slot,
    'level', v_slot.level
  );
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
    and ds.status in ('PLACED', 'SHIPPED')
  order by case ds.status when 'PLACED' then 0 else 1 end
  limit 1
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

create or replace function public.return_dispatch_module(
  p_module_id uuid,
  p_position_id uuid,
  p_preferred_level public.stack_level default null
)
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
  v_below public.stack_level;
  v_below_occupant uuid;
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
    and ds.status = 'SHIPPED'
  for update;

  if not found then
    select ds.*
      into v_slot
    from public.dispatch_slots ds
    where ds.module_id = p_module_id
      and ds.status = 'RETURNED'
    order by ds.returned_at desc nulls last
    limit 1
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
    end if;

    select d.dossier_number, d.customer_name, d.site_location, d.status, d.total_modules
      into v_number, v_customer, v_site, v_dossier_status, v_total
    from public.dispatch_dossiers d
    where d.id = v_slot.dossier_id;

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

  select d.dossier_number, d.customer_name, d.site_location, d.status, d.total_modules
    into v_number, v_customer, v_site, v_dossier_status, v_total
  from public.dispatch_dossiers d
  where d.id = v_slot.dossier_id
  for update;

  if v_dossier_status in ('DRAFT', 'CANCELLED') then
    return jsonb_build_object('ok', false, 'error_code', 'DISPATCH_FAILED');
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

  if p_preferred_level is not null then
    for v_below in select unnest(array['GROUND', 'LEVEL_1', 'LEVEL_2']::public.stack_level[]) loop
      exit when v_below = p_preferred_level;
      select s.id into v_target_slot
      from public.yard_slots s
      where s.position_id = p_position_id and s.level = v_below;
      if v_target_slot is null then
        return jsonb_build_object('ok', false, 'error_code', 'SLOT_MISSING');
      end if;
      select ml.module_id into v_below_occupant
      from public.module_locations ml
      where ml.slot_id = v_target_slot;
      if v_below_occupant is null then
        return jsonb_build_object('ok', false, 'error_code', 'POSITION_FULL');
      end if;
    end loop;

    select s.id, s.level, b.code, r.code, p.code
      into v_target_slot, v_target_level, v_block, v_row, v_pos
    from public.yard_slots s
    join public.yard_positions p on p.id = s.position_id
    join public.yard_rows r on r.id = s.row_id
    join public.yard_blocks b on b.id = s.block_id
    where s.position_id = p_position_id
      and s.level = p_preferred_level
    for update of s;

    if v_target_slot is null then
      return jsonb_build_object('ok', false, 'error_code', 'SLOT_MISSING');
    end if;

    select ml.module_id into v_occupant
    from public.module_locations ml
    where ml.slot_id = v_target_slot
    for update;

    if v_occupant is not null then
      return jsonb_build_object('ok', false, 'error_code', 'SLOT_OCCUPIED');
    end if;
  else
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
  end if;

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
    and ds.status in ('ASSIGNED', 'PLACED', 'SHIPPED')
    and d.status in (
      'ACTIVE',
      'READY_FOR_SHIPPING',
      'PARTIALLY_SHIPPED',
      'SHIPPED',
      'PARTIALLY_RETURNED',
      'RETURNED'
    )
  order by case ds.status
    when 'SHIPPED' then 0
    when 'PLACED' then 1
    when 'ASSIGNED' then 2
    else 3
  end
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

grant execute on function public.return_dispatch_module(uuid, uuid, public.stack_level) to authenticated;
