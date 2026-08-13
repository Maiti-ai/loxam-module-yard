export type AirConditioningRecord = {
  id: string;
  moduleId: string;
  brand: string | null;
  model: string | null;
  refrigerant: string | null;
  lastServiceAt: string | null;
  notes: string | null;
};
