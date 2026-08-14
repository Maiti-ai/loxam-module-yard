"use server";

import {revalidatePath} from "next/cache";
import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import {findLocationBySlot, getYardSnapshot} from "@/features/yard-locations/queries";
import {isUniqueViolation, type ActionResult} from "@/lib/errors";
import {createClient} from "@/lib/supabase/server";
import type {YardLocation} from "@/features/yard-locations/types";

export type MoveModuleResult = ActionResult<{location: YardLocation}>;

export async function moveModuleAction(
  moduleId: string,
  slotId: string,
): Promise<MoveModuleResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {ok: false, code: "UNAUTHENTICATED"};
  }
  if (!roleCan(profile.role, "moveModules")) {
    return {ok: false, code: "FORBIDDEN"};
  }

  const supabase = await createClient();

  const {data: slot, error: slotError} = await supabase
    .from("yard_slots")
    .select("id")
    .eq("id", slotId)
    .maybeSingle();

  if (slotError) {
    return {ok: false, code: "MOVE_FAILED"};
  }
  if (!slot) {
    return {ok: false, code: "SLOT_MISSING"};
  }

  const {data: occupant, error: occupantError} = await supabase
    .from("module_locations")
    .select("module_id, modules(module_number)")
    .eq("slot_id", slotId)
    .maybeSingle();

  if (occupantError) {
    return {ok: false, code: "MOVE_FAILED"};
  }

  if (occupant && occupant.module_id !== moduleId) {
    const occupantRow = occupant.modules as {module_number: string} | {module_number: string}[] | null;
    const occupantNumber = Array.isArray(occupantRow)
      ? occupantRow[0]?.module_number
      : occupantRow?.module_number;
    return {ok: false, code: "SLOT_OCCUPIED", occupantNumber: occupantNumber ?? null};
  }

  const {data: current, error: currentError} = await supabase
    .from("module_locations")
    .select("module_id, slot_id")
    .eq("module_id", moduleId)
    .maybeSingle();

  if (currentError) {
    return {ok: false, code: "MOVE_FAILED"};
  }

  if (current?.slot_id === slotId) {
    const snapshot = await getYardSnapshot();
    const location = findLocationBySlot(snapshot, slotId);
    if (!location) {
      return {ok: false, code: "SLOT_MISSING"};
    }
    return {ok: true, location};
  }

  const payload = {
    slot_id: slotId,
    updated_by: profile.id,
  };

  const write = current
    ? await supabase.from("module_locations").update(payload).eq("module_id", moduleId)
    : await supabase.from("module_locations").insert({
        module_id: moduleId,
        ...payload,
      });

  if (write.error) {
    if (isUniqueViolation(write.error)) {
      return {ok: false, code: "SLOT_OCCUPIED"};
    }
    return {ok: false, code: "MOVE_FAILED"};
  }

  const snapshot = await getYardSnapshot();
  const location = findLocationBySlot(snapshot, slotId);
  if (!location) {
    return {ok: false, code: "MOVE_FAILED"};
  }

  revalidatePath("/", "layout");
  return {ok: true, location};
}
