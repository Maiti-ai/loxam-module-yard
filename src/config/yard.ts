/** Block F is the production zone on the real Schelle yard. */
export const PRODUCTION_BLOCK_CODE = "F";

export function isProductionBlock(code: string) {
  return code.trim().toUpperCase() === PRODUCTION_BLOCK_CODE;
}

/** Default for normal storage blocks A/B/C/D. */
export const DEFAULT_MAX_STACK_LEVELS = 3;

/**
 * Allowed modules per physical position.
 * This is the single source of truth for capacity, details, and placement.
 * F is production: one module, no stacking.
 */
export const BLOCK_MAX_STACK_LEVELS: Readonly<Record<string, number>> = {
  A: 3,
  B: 3,
  C: 3,
  D: 3,
  F: 1,
};

export function maxStackLevelsForBlock(code: string): number {
  const key = code.trim().toUpperCase();
  return BLOCK_MAX_STACK_LEVELS[key] ?? DEFAULT_MAX_STACK_LEVELS;
}
