import type {ModuleStatus, ModuleTypeCode} from "@/types/database";

export const MODULE_STATUSES: ModuleStatus[] = ["AVAILABLE", "RENTED"];

export const MODULE_TYPE_CODES: ModuleTypeCode[] = ["6x3", "3x3"];

export type YardModule = {
  id: string;
  moduleNumber: string;
  moduleTypeCode: ModuleTypeCode;
  status: ModuleStatus;
  rentedToProject: string | null;
};
