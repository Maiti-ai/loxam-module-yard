import type {DispatchProductionStatus} from "@/types/database";

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
