-- F → A for a dossier module must use the stored dispatch_slots target
-- (position + level). Never first-free / auto-stack. If that exact slot is
-- occupied, fail instead of choosing another level.

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
