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
  status?: string;
  slot_id?: string;
  level?: string;
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
    case "DISPATCH_FAILED":
      return value;
    default:
      return "DISPATCH_FAILED";
  }
}
