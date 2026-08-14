export const PHOTO_CATEGORIES = [
  "GENERAL",
  "TECHNICAL",
  "DAMAGE",
  "BEFORE_DEPARTURE",
  "RETURN",
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const DEFAULT_PHOTO_CATEGORY: PhotoCategory = "GENERAL";
