import type {ModuleTypeCode} from "@/types/database";

export const MODULE_TYPE_CODES: ModuleTypeCode[] = ["2.5x3", "2.5x6", "3x3", "6x3"];

const TYPE_CODE_SET = new Set<string>(MODULE_TYPE_CODES);

export function asTypeCode(value: string | null | undefined): ModuleTypeCode {
  if (value && TYPE_CODE_SET.has(value)) {
    return value as ModuleTypeCode;
  }
  return "6x3";
}

export function isCompactModuleType(code: ModuleTypeCode) {
  return code === "3x3" || code === "2.5x3";
}

export function staticTypeDrawingUrl(code: ModuleTypeCode): string | null {
  if (code === "2.5x3") {
    return "/type-drawings/2.5x3.png";
  }
  if (code === "2.5x6") {
    return "/type-drawings/2.5x6.png";
  }
  return null;
}
