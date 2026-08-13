import type {ModuleStatus, ModuleTypeCode} from "@/types/database";

export const MODULE_STATUSES: ModuleStatus[] = ["AVAILABLE", "RENTED"];

export const MODULE_TYPE_CODES: ModuleTypeCode[] = ["6x3", "3x3"];

export type {ModuleSummary} from "@/features/yard-locations/types";
export {listModuleSummaries, getModuleByNumber} from "./queries";
export {searchModules} from "./search";
