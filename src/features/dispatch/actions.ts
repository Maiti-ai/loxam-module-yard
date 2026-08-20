"use server";

import {revalidatePath} from "next/cache";
import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import {asDispatchErrorCode, asDispatchRpc} from "@/features/dispatch/rpc";
import {requiredGroundPositions} from "@/features/dispatch/plan";
import {getPendingDispatchAssignment} from "@/features/dispatch/queries";
import type {ActionResult} from "@/lib/errors";
import {createClient} from "@/lib/supabase/server";
import type {DispatchAssignment} from "./types";

function authResult() {
  return {ok: false as const, code: "UNAUTHENTICATED" as const};
}

function forbiddenResult() {
  return {ok: false as const, code: "FORBIDDEN" as const};
}

export async function createDispatchDossierAction(input: {
  dossierNumber: string;
  customerName: string;
  siteLocation: string;
  totalModules: number;
  positionIds: string[];
  moduleId: string;
}): Promise<ActionResult<{assignment: DispatchAssignment}>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return authResult();
  }
  if (!roleCan(profile.role, "moveModules")) {
    return forbiddenResult();
  }

  const required = requiredGroundPositions(input.totalModules);
  if (required === 0 || input.positionIds.length !== required) {
    return {ok: false, code: "INSUFFICIENT_SPACE"};
  }

  const supabase = await createClient();
  const rpc = await supabase.rpc("create_dispatch_dossier", {
    p_dossier_number: input.dossierNumber.trim(),
    p_customer_name: input.customerName.trim(),
    p_site_location: input.siteLocation.trim(),
    p_total_modules: input.totalModules,
    p_position_ids: input.positionIds,
    p_first_module_id: input.moduleId,
  });

  if (rpc.error) {
    return {ok: false, code: "DISPATCH_FAILED"};
  }
  const payload = asDispatchRpc(rpc.data);
  if (!payload?.ok) {
    return {ok: false, code: asDispatchErrorCode(payload?.error_code)};
  }

  const assignment = await getPendingDispatchAssignment(input.moduleId);
  if (!assignment) {
    return {ok: false, code: "DISPATCH_FAILED"};
  }
  revalidatePath("/", "layout");
  return {ok: true, assignment};
}

export async function assignModuleToDispatchDossierAction(
  dossierId: string,
  moduleId: string,
): Promise<ActionResult<{assignment: DispatchAssignment}>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return authResult();
  }
  if (!roleCan(profile.role, "moveModules")) {
    return forbiddenResult();
  }

  const supabase = await createClient();
  const rpc = await supabase.rpc("assign_module_to_dispatch_dossier", {
    p_dossier_id: dossierId,
    p_module_id: moduleId,
  });
  if (rpc.error) {
    return {ok: false, code: "DISPATCH_FAILED"};
  }
  const payload = asDispatchRpc(rpc.data);
  if (!payload?.ok) {
    return {ok: false, code: asDispatchErrorCode(payload?.error_code)};
  }

  const assignment = await getPendingDispatchAssignment(moduleId);
  if (!assignment) {
    return {ok: false, code: "DISPATCH_FAILED"};
  }
  revalidatePath("/", "layout");
  return {ok: true, assignment};
}

export async function confirmDispatchPlacementAction(
  moduleId: string,
): Promise<ActionResult<{placedCount: number; totalModules: number; ready: boolean}>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return authResult();
  }
  if (!roleCan(profile.role, "moveModules")) {
    return forbiddenResult();
  }

  const supabase = await createClient();
  const rpc = await supabase.rpc("confirm_dispatch_placement", {
    p_module_id: moduleId,
  });
  if (rpc.error) {
    return {ok: false, code: "DISPATCH_FAILED"};
  }
  const payload = asDispatchRpc(rpc.data);
  if (!payload?.ok) {
    return {ok: false, code: asDispatchErrorCode(payload?.error_code)};
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    placedCount: payload.placed_count ?? 0,
    totalModules: payload.total_modules ?? 0,
    ready: payload.status === "READY_FOR_SHIPPING",
  };
}
