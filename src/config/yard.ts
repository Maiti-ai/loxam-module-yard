/** Block F is the production zone on the real Schelle yard. */
export const PRODUCTION_BLOCK_CODE = "F";

export function isProductionBlock(code: string) {
  return code.trim().toUpperCase() === PRODUCTION_BLOCK_CODE;
}
