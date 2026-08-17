-- First-free stack assignment for new placements.
-- Physical positions have exactly three levels (GROUND, LEVEL_1, LEVEL_2).
-- This function locks the three slots, fills from the bottom, and never
-- overwrites an occupied level. Existing occupancy is not rewritten except
-- for the module being moved.

create or replace function public.assign_first_free_stack_slot(
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
  v_slot record;
  v_current_slot uuid;
  v_current_position uuid;
  v_chosen_id uuid;
  v_chosen_level public.stack_level;
  v_occupant uuid;
  v_reassigned boolean := false;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;

  if not public.has_role(array['ADMIN', 'FORKLIFT_DRIVER']::public.app_role[]) then
    return jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;

  if not exists (select 1 from public.modules where id = p_module_id) then
    return jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  end if;

  if not exists (select 1 from public.yard_slots where position_id = p_position_id) then
    return jsonb_build_object('ok', false, 'error_code', 'SLOT_MISSING');
  end if;

  perform s.id
  from public.yard_slots s
  where s.position_id = p_position_id
  for update;

  select ml.slot_id, s.position_id
    into v_current_slot, v_current_position
  from public.module_locations ml
  left join public.yard_slots s on s.id = ml.slot_id
  where ml.module_id = p_module_id;

  if v_current_slot is not null and v_current_position = p_position_id then
    select s.level into v_chosen_level
    from public.yard_slots s
    where s.id = v_current_slot;

    return jsonb_build_object(
      'ok', true,
      'slot_id', v_current_slot,
      'level', v_chosen_level,
      'reassigned', false,
      'unchanged', true
    );
  end if;

  for v_slot in
    select s.id, s.level
    from public.yard_slots s
    where s.position_id = p_position_id
    order by case s.level
      when 'GROUND' then 0
      when 'LEVEL_1' then 1
      when 'LEVEL_2' then 2
      else 9
    end
  loop
    select ml.module_id into v_occupant
    from public.module_locations ml
    where ml.slot_id = v_slot.id;

    if v_occupant is null or v_occupant = p_module_id then
      v_chosen_id := v_slot.id;
      v_chosen_level := v_slot.level;
      exit;
    end if;
  end loop;

  if v_chosen_id is null then
    return jsonb_build_object('ok', false, 'error_code', 'POSITION_FULL');
  end if;

  v_reassigned := p_preferred_level is not null
    and p_preferred_level is distinct from v_chosen_level;

  if v_current_slot is null then
    insert into public.module_locations (module_id, slot_id, updated_by)
    values (p_module_id, v_chosen_id, auth.uid());
  else
    update public.module_locations
    set slot_id = v_chosen_id, updated_by = auth.uid()
    where module_id = p_module_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'slot_id', v_chosen_id,
    'level', v_chosen_level,
    'reassigned', v_reassigned,
    'unchanged', false
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error_code', 'SLOT_OCCUPIED');
end;
$$;

revoke all on function public.assign_first_free_stack_slot(uuid, uuid, public.stack_level) from public;
grant execute on function public.assign_first_free_stack_slot(uuid, uuid, public.stack_level) to authenticated;
