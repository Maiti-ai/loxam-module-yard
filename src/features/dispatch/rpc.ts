import type {Json} from "@/types/database";
import type {AppErrorCode} from "@/lib/errors";

export type DispatchRpcPayload = {
  ok?: boolean;
  error_code?: string;
  dossier_id?: string;
  dossier_number?: string;
  sequence_number?: number;
  total_modules?: number;
  placed_count?: number;
  shipped_count?: number;
  returned_count?: number;
  on_rent_count?: number;
  placed_remaining?: number;
  status?: string;
  production_status?: string;
  slot_id?: string;
  level?: string;
  block_code?: string;
  row_code?: string;
  position_code?: string;
  unchanged?: boolean;
};

export function asDispatchRpc(value: Json | null): DispatchRpcPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as DispatchRpcPayload;
}

export function asDispatchErrorCode(value: string | undefined): AppErrorCode {
  switch (value) {
    case "UNAUTHENTICATED":
    case "FORBIDDEN":
    case "NOT_FOUND":
    case "SLOT_OCCUPIED":
    case "SLOT_MISSING":
    case "POSITION_FULL":
    case "MOVE_FAILED":
    case "DISPATCH_REQUIRED":
    case "DOSSIER_EXISTS":
    case "DOSSIER_FULL":
    case "INSUFFICIENT_SPACE":
    case "POSITION_RESERVED":
    case "MODULE_IN_DOSSIER":
    case "MODULE_UNAVAILABLE":
    case "DISPATCH_FAILED":
    case "DISPATCH_INCOMPLETE":
    case "DISPATCH_WRONG_COUNT":
    case "DISPATCH_ALREADY_ACTIVE":
    case "DISPATCH_DESTINATION_MUST_BE_F":
    case "DISPATCH_NOT_IN_F":
    case "DISPATCH_NOT_IN_A":
    case "DISPATCH_WRONG_SLOT":
    case "DISPATCH_NOT_READY_TO_SHIP":
    case "DISPATCH_NOT_ON_RENT":
    case "DISPATCH_ALREADY_ON_YARD":
    case "DISPATCH_RETURN_ZONE_REQUIRED":
    case "DISPATCH_TARGET_OCCUPIED":
    case "PRODUCTION_NOT_READY":
      return value;
    default:
      return "DISPATCH_FAILED";
  }
}
