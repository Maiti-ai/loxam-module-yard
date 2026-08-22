import {formatGroundPositionLabel, formatLevelLabel} from "@/lib/format";
import type {DispatchProductionStatus, StackLevel} from "@/types/database";

export function dispatchTargetLabel(input: {
  blockCode?: string | null;
  rowCode?: string | null;
  positionCode?: string | null;
  level?: string | null;
}) {
  const level: StackLevel =
    input.level === "LEVEL_1" || input.level === "LEVEL_2" || input.level === "GROUND"
      ? input.level
      : "GROUND";
  const cell = formatGroundPositionLabel({
    blockCode: input.blockCode ?? "A",
    rowCode: input.rowCode ?? "",
    positionCode: input.positionCode ?? "",
  });
  return `${cell} ${formatLevelLabel(level)}`;
}

export function productionStatusFromLocation(
  blockCode: string | null | undefined,
  slotStatus?: string | null,
): DispatchProductionStatus {
  if (slotStatus === "PLACED" || blockCode === "A") {
    return "IN_DISPATCH_ZONE";
  }
  if (blockCode === "F") {
    return "IN_PRODUCTION";
  }
  return "TO_PRODUCTION";
}

export function dispatchFlowKindFromLocation(
  blockCode: string | null | undefined,
  slotStatus?: string | null,
): "none" | "to_production" | "ready_for_dispatch" {
  const status = productionStatusFromLocation(blockCode, slotStatus);
  if (status === "IN_DISPATCH_ZONE") {
    return "none";
  }
  if (status === "IN_PRODUCTION") {
    return "ready_for_dispatch";
  }
  return "to_production";
}
