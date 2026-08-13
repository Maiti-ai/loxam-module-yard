export type AirConditioningRecord = {
  id: string;
  moduleId: string;
  brand: string;
  serialNumber: string;
  internalNumber: string;
  lastMaintenanceAt: string | null;
  notes: string | null;
};
