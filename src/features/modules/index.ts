import type {ModuleStatus} from "@/types/database";

export const MODULE_STATUSES: ModuleStatus[] = [
  "available",
  "reserved",
  "on_site",
  "maintenance",
  "retired",
];

export type YardModule = {
  id: string;
  serialNumber: string;
  name: string | null;
  status: ModuleStatus;
  yardLocationId: string | null;
};
