"use server";

import {revalidatePath} from "next/cache";
import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import type {ActionResult} from "@/lib/errors";
import {createClient} from "@/lib/supabase/server";

export type SaveAircoInput = {
  moduleId: string;
  aircoId?: string | null;
  brand: string;
  serialNumber: string;
  internalNumber: string;
  lastMaintenanceAt: string | null;
  notes: string | null;
};

export async function saveAircoAction(input: SaveAircoInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {ok: false, code: "UNAUTHENTICATED"};
  }

  const supabase = await createClient();
  const canManage = roleCan(profile.role, "manageAirco");
  const canMaintenance = roleCan(profile.role, "updateAircoMaintenance");

  if (!canManage && !canMaintenance) {
    return {ok: false, code: "FORBIDDEN"};
  }

  if (!input.aircoId) {
    if (!canManage) {
      return {ok: false, code: "FORBIDDEN"};
    }

    const {error} = await supabase.from("air_conditioning_units").insert({
      module_id: input.moduleId,
      brand: input.brand.trim(),
      serial_number: input.serialNumber.trim(),
      internal_number: input.internalNumber.trim(),
      last_maintenance_at: input.lastMaintenanceAt,
      notes: input.notes,
    });

    if (error) {
      return {ok: false, code: "SAVE_FAILED"};
    }

    revalidatePath("/", "layout");
    return {ok: true};
  }

  if (canManage) {
    const {error} = await supabase
      .from("air_conditioning_units")
      .update({
        brand: input.brand.trim(),
        serial_number: input.serialNumber.trim(),
        internal_number: input.internalNumber.trim(),
        last_maintenance_at: input.lastMaintenanceAt,
        notes: input.notes,
      })
      .eq("id", input.aircoId);

    if (error) {
      return {ok: false, code: "SAVE_FAILED"};
    }
  } else {
    const {error} = await supabase
      .from("air_conditioning_units")
      .update({
        last_maintenance_at: input.lastMaintenanceAt,
        notes: input.notes,
      })
      .eq("id", input.aircoId);

    if (error) {
      return {ok: false, code: "SAVE_FAILED"};
    }
  }

  revalidatePath("/", "layout");
  return {ok: true};
}

export async function saveAircoIntervalAction(months: number | null): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {ok: false, code: "UNAUTHENTICATED"};
  }
  if (!roleCan(profile.role, "manageSettings")) {
    return {ok: false, code: "FORBIDDEN"};
  }

  try {
    const {setAircoIntervalMonths} = await import("./settings");
    await setAircoIntervalMonths(months, profile.id);
  } catch {
    return {ok: false, code: "SAVE_FAILED"};
  }

  revalidatePath("/", "layout");
  return {ok: true};
}
