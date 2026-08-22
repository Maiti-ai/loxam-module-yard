"use server";

import {revalidatePath} from "next/cache";
import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import {asDispatchErrorCode, asDispatchRpc} from "@/features/dispatch/rpc";
import {requiredGroundPositions} from "@/features/dispatch/plan";
import {getDispatchDossier} from "@/features/dispatch/queries";
import type {ActionResult} from "@/lib/errors";
import {createClient} from "@/lib/supabase/server";
import type {DispatchDossierDetail} from "./types";

function authResult() {
  return {ok: false as const, code: "UNAUTHENTICATED" as const};
}

function forbiddenResult() {
  return {ok: false as const, code: "FORBIDDEN" as const};
}

type DossierPlanInput = {
  dossierId?: string | null;
  dossierNumber: string;
  customerName: string;
  siteLocation: string;
  totalModules: number;
  positionIds: string[];
  moduleIds: string[];
  activate: boolean;
};

async function saveDispatchDossier(
  input: DossierPlanInput,
): Promise<ActionResult<{dossierId: string; dossier: DispatchDossierDetail | null}>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return authResult();
  }
  if (!roleCan(profile.role, "planDispatch")) {
    return forbiddenResult();
  }

  const required = requiredGroundPositions(input.totalModules);
  if (input.activate) {
    if (required === 0 || input.positionIds.length !== required) {
      return {ok: false, code: "INSUFFICIENT_SPACE"};
    }
    if (input.moduleIds.length !== input.totalModules) {
      return {ok: false, code: "DISPATCH_WRONG_COUNT"};
    }
  } else if (input.positionIds.length > 0 && input.positionIds.length !== required) {
    return {ok: false, code: "INSUFFICIENT_SPACE"};
  } else if (input.moduleIds.length > input.totalModules) {
    return {ok: false, code: "DISPATCH_WRONG_COUNT"};
  }

  const supabase = await createClient();
  const rpc = await supabase.rpc("create_dispatch_dossier", {
    p_dossier_number: input.dossierNumber.trim(),
    p_customer_name: input.customerName.trim(),
    p_site_location: input.siteLocation.trim(),
    p_total_modules: input.totalModules,
    p_position_ids: input.positionIds,
    p_module_ids: input.moduleIds,
    p_dossier_id: input.dossierId ?? null,
    p_activate: input.activate,
  });

  if (rpc.error) {
    return {ok: false, code: "DISPATCH_FAILED"};
  }
  const payload = asDispatchRpc(rpc.data);
  if (!payload?.ok || !payload.dossier_id) {
    return {ok: false, code: asDispatchErrorCode(payload?.error_code)};
  }

  const dossier = await getDispatchDossier(payload.dossier_id);
  revalidatePath("/", "layout");
  return {ok: true, dossierId: payload.dossier_id, dossier};
}

export async function saveDispatchDossierDraftAction(input: {
  dossierId?: string | null;
  dossierNumber: string;
  customerName: string;
  siteLocation: string;
  totalModules: number;
  positionIds: string[];
  moduleIds: string[];
}): Promise<ActionResult<{dossierId: string; dossier: DispatchDossierDetail | null}>> {
  return saveDispatchDossier({...input, activate: false});
}

export async function activateDispatchDossierAction(input: {
  dossierId?: string | null;
  dossierNumber: string;
  customerName: string;
  siteLocation: string;
  totalModules: number;
  positionIds: string[];
  moduleIds: string[];
}): Promise<ActionResult<{dossierId: string; dossier: DispatchDossierDetail | null}>> {
  return saveDispatchDossier({...input, activate: true});
}

export async function cancelDispatchDossierAction(
  dossierId: string,
): Promise<ActionResult<{status: string}>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return authResult();
  }
  if (!roleCan(profile.role, "planDispatch")) {
    return forbiddenResult();
  }

  const supabase = await createClient();
  const rpc = await supabase.rpc("cancel_dispatch_dossier", {p_dossier_id: dossierId});
  if (rpc.error) {
    return {ok: false, code: "DISPATCH_FAILED"};
  }
  const payload = asDispatchRpc(rpc.data);
  if (!payload?.ok) {
    return {ok: false, code: asDispatchErrorCode(payload?.error_code)};
  }
  revalidatePath("/", "layout");
  return {ok: true, status: payload.status ?? "CANCELLED"};
}

export async function markDispatchProductionReadyAction(
  moduleId: string,
): Promise<ActionResult<{productionStatus: string}>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return authResult();
  }
  if (!roleCan(profile.role, "markDispatchReady")) {
    return forbiddenResult();
  }

  const supabase = await createClient();
  const rpc = await supabase.rpc("mark_dispatch_production_ready", {p_module_id: moduleId});
  if (rpc.error) {
    return {ok: false, code: "DISPATCH_FAILED"};
  }
  const payload = asDispatchRpc(rpc.data);
  if (!payload?.ok) {
    return {ok: false, code: asDispatchErrorCode(payload?.error_code)};
  }
  revalidatePath("/", "layout");
  return {ok: true, productionStatus: payload.production_status ?? "READY_FOR_DISPATCH"};
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
