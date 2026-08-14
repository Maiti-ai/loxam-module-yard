export const EQUIPMENT_PLACEHOLDER_KEYS = [
  "outlets",
  "lighting",
  "motion",
  "kitchenette",
  "wc",
  "basin",
  "power",
  "airco",
] as const;

export type EquipmentPlaceholderKey = (typeof EQUIPMENT_PLACEHOLDER_KEYS)[number];
