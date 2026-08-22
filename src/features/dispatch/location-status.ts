import {formatGroundPositionLabel, formatLevelLabel} from "@/lib/format";
import type {DispatchProductionStatus, StackLevel} from "@/types/database";

export const RETURN_ARRIVALS_BLOCK_CODE = "D";
export const RETURN_ARRIVALS_ROW_CODES = ["P3", "P4"] as const;

export function isReturnArrivalsRow(blockCode: string, rowCode: string) {
  return (
    blockCode.trim().toUpperCase() === RETURN_ARRIVALS_BLOCK_CODE &&
    RETURN_ARRIVALS_ROW_CODES.includes(rowCode.trim().toUpperCase() as (typeof RETURN_ARRIVALS_ROW_CODES)[number])
  );
}

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
): DispatchProductionStatus | null {
  if (slotStatus === "SHIPPED" || slotStatus === "RETURNED") {
    return null;
  }
  if (slotStatus === "PLACED" || blockCode === "A") {
    return "IN_DISPATCH_ZONE";
  }
  if (blockCode === "F") {
    return "IN_PRODUCTION";
  }
  return "TO_PRODUCTION";
}

export type DispatchFlowKind =
  | "none"
  | "to_production"
  | "ready_for_dispatch"
  | "ready_to_ship"
  | "on_rent"
  | "returned";

export function dispatchFlowKindFromLocation(
  blockCode: string | null | undefined,
  slotStatus?: string | null,
): DispatchFlowKind {
  if (slotStatus === "SHIPPED") {
    return "on_rent";
  }
  if (slotStatus === "RETURNED") {
    return "returned";
  }
  if (slotStatus === "PLACED" || blockCode === "A") {
    return "ready_to_ship";
  }
  if (blockCode === "F") {
    return "ready_for_dispatch";
  }
  return "to_production";
}

export function lifecycleLabelKey(slotStatus: string | null | undefined): string {
  if (slotStatus === "SHIPPED") {
    return "shipped";
  }
  if (slotStatus === "RETURNED") {
    return "returned";
  }
  if (slotStatus === "PLACED") {
    return "readyToShip";
  }
  return "inPreparation";
}
