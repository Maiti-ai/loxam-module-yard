import {DISPATCH_BLOCK_CODE} from "./plan";
import type {ModuleSummary} from "@/features/yard-locations/types";

export type DispatchEligibilityReason = "in_other_dossier" | "unavailable" | "in_dispatch_zone" | null;

export function moduleDispatchEligibility(
  module: ModuleSummary,
  occupiedModuleIds: ReadonlySet<string>,
  options?: {ignoreModuleIds?: ReadonlySet<string>},
): {selectable: boolean; reason: DispatchEligibilityReason} {
  const ignore = Boolean(options?.ignoreModuleIds?.has(module.id));
  if (!ignore && occupiedModuleIds.has(module.id)) {
    return {selectable: false, reason: "in_other_dossier"};
  }
  if (module.status !== "AVAILABLE") {
    return {selectable: false, reason: "unavailable"};
  }
  if (module.location?.blockCode.trim().toUpperCase() === DISPATCH_BLOCK_CODE) {
    return {selectable: false, reason: "in_dispatch_zone"};
  }
  return {selectable: true, reason: null};
}
