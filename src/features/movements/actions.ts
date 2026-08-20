"use server";

import {revalidatePath} from "next/cache";
import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import {isProductionBlock} from "@/config/yard";
import {firstFreeLevel} from "@/features/yard-locations/stacking";
import {
  findBlockCodeForPosition,
  findLocationBySlot,
  findModuleLocationInSnapshot,
  findPositionInSnapshot,
  getYardSnapshot,
} from "@/features/yard-locations/queries";
import {
  findLivePosition,
  isSpecPhysicalCell,
  isUuid,
  parseCanonicalPositionCode,
} from "@/features/yard-locations/resolve-position";
import {maxStackLevelsForBlock} from "@/config/yard";
import {isUniqueViolation, type ActionResult, type AppErrorCode} from "@/lib/errors";
import {createClient} from "@/lib/supabase/server";
import type {Json, StackLevel} from "@/types/database";
import type {YardLocation} from "@/features/yard-locations/types";

export type MoveModuleResult = ActionResult<{
  location: YardLocation;
  reassigned?: boolean;
}>;

type AssignPayload = {
  ok?: boolean;
  slot_id?: string;
  level?: StackLevel;
  reassigned?: boolean;
  unchanged?: boolean;
  error_code?: string;
};

function asAssignPayload(value: Json | null): AssignPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as AssignPayload;
}

function asErrorCode(value: string | undefined): AppErrorCode {
  if (
    value === "UNAUTHENTICATED" ||
    value === "FORBIDDEN" ||
    value === "NOT_FOUND" ||
    value === "SLOT_OCCUPIED" ||
    value === "SLOT_MISSING" ||
    value === "POSITION_FULL" ||
    value === "MOVE_FAILED" ||
    value === "DISPATCH_REQUIRED" ||
    value === "POSITION_RESERVED"
  ) {
    return value;
  }
  return "MOVE_FAILED";
}

function guardCodeFromError(error: {code?: string; message?: string} | null): AppErrorCode | null {
  const message = error?.message ?? "";
  if (/DISPATCH_REQUIRED/.test(message)) {
    return "DISPATCH_REQUIRED";
  }
  if (/POSITION_RESERVED/.test(message)) {
    return "POSITION_RESERVED";
  }
  return null;
}

function isMissingRpc(error: {code?: string; message?: string} | null) {
  if (!error) {
    return false;
  }
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /assign_first_free_stack_slot|could not find the function/i.test(error.message ?? "")
  );
}

async function assignInApp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  moduleId: string,
  positionId: string,
  userId: string,
  preferredLevel: StackLevel | null,
): Promise<MoveModuleResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const {data: slots, error: slotsError} = await supabase
      .from("yard_slots")
      .select("id, position_id, level")
      .eq("position_id", positionId);

    if (slotsError) {
      return {ok: false, code: "MOVE_FAILED"};
    }
    if (!slots || slots.length === 0) {
      return {ok: false, code: "SLOT_MISSING"};
    }

    const slotIds = slots.map((slot) => slot.id);
    const {data: occupants, error: occupantsError} = await supabase
      .from("module_locations")
      .select("module_id, slot_id")
      .in("slot_id", slotIds);

    if (occupantsError) {
      return {ok: false, code: "MOVE_FAILED"};
    }

    const occupantBySlot = new Map(
      (occupants ?? []).map((row) => [row.slot_id, row.module_id]),
    );

    const {data: current, error: currentError} = await supabase
      .from("module_locations")
      .select("module_id, slot_id")
      .eq("module_id", moduleId)
      .maybeSingle();

    if (currentError) {
      return {ok: false, code: "MOVE_FAILED"};
    }

    const snapshot = await getYardSnapshot();
    if (current && slotIds.includes(current.slot_id)) {
      const location = findLocationBySlot(snapshot, current.slot_id);
      if (!location) {
        return {ok: false, code: "SLOT_MISSING"};
      }
      return {ok: true, location, reassigned: false};
    }

    const levels = slots.map((slot) => ({
      slotId: slot.id,
      level: slot.level,
      occupant: occupantBySlot.get(slot.id) ? {moduleId: occupantBySlot.get(slot.id) as string} : null,
    }));

    const blockCode = findBlockCodeForPosition(snapshot, positionId);
    const assignedLevel = firstFreeLevel(levels, {
      ignoreModuleId: moduleId,
      maxStackLevels: maxStackLevelsForBlock(blockCode ?? ""),
    });
    if (!assignedLevel) {
      return {ok: false, code: "POSITION_FULL"};
    }

    const chosen = slots.find((slot) => slot.level === assignedLevel);
    if (!chosen) {
      return {ok: false, code: "SLOT_MISSING"};
    }

    const payload = {slot_id: chosen.id, updated_by: userId};
    const write = current
      ? await supabase.from("module_locations").update(payload).eq("module_id", moduleId)
      : await supabase.from("module_locations").insert({
          module_id: moduleId,
          ...payload,
        });

    if (write.error) {
      const guarded = guardCodeFromError(write.error);
      if (guarded) {
        return {ok: false, code: guarded};
      }
      if (isUniqueViolation(write.error) && attempt === 0) {
        continue;
      }
      if (isUniqueViolation(write.error)) {
        return {ok: false, code: "POSITION_FULL"};
      }
      return {ok: false, code: "MOVE_FAILED"};
    }

    const nextSnapshot = await getYardSnapshot();
    const location = findLocationBySlot(nextSnapshot, chosen.id);
    if (!location) {
      return {ok: false, code: "MOVE_FAILED"};
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      location,
      reassigned: Boolean(preferredLevel && preferredLevel !== assignedLevel),
    };
  }

  return {ok: false, code: "POSITION_FULL"};
}

async function resolveLivePositionId(
  positionId: string,
): Promise<{ok: true; positionId: string} | {ok: false; code: "SLOT_MISSING"}> {
  const snapshot = await getYardSnapshot();
  if (isUuid(positionId)) {
    for (const block of snapshot.blocks) {
      for (const row of block.rows) {
        const match = row.positions.find((item) => item.id === positionId && item.levels.length > 0);
        if (match) {
          return {ok: true, positionId: match.id};
        }
      }
    }
    return {ok: false, code: "SLOT_MISSING"};
  }

  const parsed = parseCanonicalPositionCode(positionId);
  if (!parsed || !isSpecPhysicalCell(parsed.blockCode, parsed.rowCode, parsed.positionNumber)) {
    return {ok: false, code: "SLOT_MISSING"};
  }
  const live = findLivePosition(snapshot, parsed.blockCode, parsed.rowCode, parsed.positionNumber);
  if (!live) {
    return {ok: false, code: "SLOT_MISSING"};
  }
  return {ok: true, positionId: live.id};
}

export async function moveModuleAction(
  moduleId: string,
  positionId: string,
  preferredLevel?: StackLevel | null,
): Promise<MoveModuleResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {ok: false, code: "UNAUTHENTICATED"};
  }
  if (!roleCan(profile.role, "moveModules")) {
    return {ok: false, code: "FORBIDDEN"};
  }

  const snapshot = await getYardSnapshot();
  const current = findModuleLocationInSnapshot(snapshot, moduleId);
  if (current && isProductionBlock(current.blockCode)) {
    return {ok: false, code: "DISPATCH_REQUIRED"};
  }

  const resolved = await resolveLivePositionId(positionId);
  if (!resolved.ok) {
    return resolved;
  }
  const livePositionId = resolved.positionId;
  const target = findPositionInSnapshot(snapshot, livePositionId);
  if (target?.reservation) {
    return {ok: false, code: "POSITION_RESERVED"};
  }

  const supabase = await createClient();
  const rpc = await supabase.rpc("assign_first_free_stack_slot", {
    p_module_id: moduleId,
    p_position_id: livePositionId,
    p_preferred_level: preferredLevel ?? null,
  });

  if (rpc.error && isMissingRpc(rpc.error)) {
    return assignInApp(supabase, moduleId, livePositionId, profile.id, preferredLevel ?? null);
  }

  if (rpc.error) {
    const guarded = guardCodeFromError(rpc.error);
    if (guarded) {
      return {ok: false, code: guarded};
    }
    if (isUniqueViolation(rpc.error)) {
      return {ok: false, code: "SLOT_OCCUPIED"};
    }
    return {ok: false, code: "MOVE_FAILED"};
  }

  const payload = asAssignPayload(rpc.data);
  if (!payload?.ok) {
    return {ok: false, code: asErrorCode(payload?.error_code)};
  }
  if (!payload.slot_id) {
    return {ok: false, code: "MOVE_FAILED"};
  }

  const nextSnapshot = await getYardSnapshot();
  const location = findLocationBySlot(nextSnapshot, payload.slot_id);
  if (!location) {
    return {ok: false, code: "MOVE_FAILED"};
  }

  revalidatePath("/", "layout");
  return {ok: true, location, reassigned: Boolean(payload.reassigned)};
}
