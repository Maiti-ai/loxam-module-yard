import type {ModuleStatus} from "@/types/database";

export const MODULE_STATUSES: ModuleStatus[] = ["AVAILABLE", "RENTED"];

export {MODULE_TYPE_CODES} from "@/features/module-types/codes";

export type {ModuleSummary} from "@/features/yard-locations/types";
export {listModuleSummaries, getModuleByNumber} from "./queries";
export {searchModules} from "./search";
