/**
 * Schelle yard visual geometry.
 *
 * Site: Loxam Module, Brandekensweg 48-50, 2627 Schelle.
 * This is an operational map, not a CAD drawing.
 *
 * Orientation (forklift driver at the gate looking into the yard):
 * - Bottom of the SVG = FRONT = Brandekensweg / gate / building
 * - Top of the SVG = BACK of the yard
 * - Row 1 is at the BACK; row numbers increase toward the FRONT
 *
 * Block letters, row counts, and manoeuvring zones follow the marked
 * Schelle ground-plan rules. Exact pixel coordinates live here so they
 * can be calibrated later without rewriting React components.
 *
 * To adjust layout later, edit SCHELLE_YARD below (or, later, load the
 * same JSON shape from app_settings / an admin form).
 */

export type LandmarkKind =
  | "pavement"
  | "road"
  | "building"
  | "gate"
  | "water"
  | "label";

export type YardLandmark = {
  id: string;
  kind: LandmarkKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  rotate?: number;
};

export type BlockGeometry = {
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Visual row axis: row 1 is at the BACK (smaller y). */
  rowFromBack: boolean;
  /** Positions increase left → right. */
  positionsLeftToRight: boolean;
};

export type SchelleYardGeometry = {
  viewBox: {width: number; height: number};
  site: {x: number; y: number; width: number; height: number};
  landmarks: YardLandmark[];
  blocks: Record<string, BlockGeometry>;
};

/**
 * Operational Schelle layout.
 *
 * Back (top): storage blocks A–D in a line.
 * Centre: main manoeuvring road.
 * Front (bottom): Block E, production Block F, workshop/office, gate, Brandekensweg.
 */
export const SCHELLE_YARD: SchelleYardGeometry = {
  viewBox: {width: 1100, height: 780},
  site: {x: 24, y: 28, width: 1052, height: 724},
  landmarks: [
    {
      id: "pavement",
      kind: "pavement",
      x: 36,
      y: 56,
      width: 1028,
      height: 620,
    },
    {
      id: "road-spine",
      kind: "road",
      x: 48,
      y: 318,
      width: 1004,
      height: 78,
    },
    {
      id: "road-gate",
      kind: "road",
      x: 820,
      y: 396,
      width: 72,
      height: 268,
    },
    {
      id: "building",
      kind: "building",
      x: 760,
      y: 430,
      width: 280,
      height: 168,
      label: "building",
    },
    {
      id: "gate",
      kind: "gate",
      x: 828,
      y: 632,
      width: 56,
      height: 36,
      label: "gate",
    },
    {
      id: "brandekensweg",
      kind: "label",
      x: 36,
      y: 700,
      width: 1028,
      height: 36,
      label: "Brandekensweg",
    },
  ],
  blocks: {
    A: {
      code: "A",
      x: 56,
      y: 72,
      width: 220,
      height: 228,
      rowFromBack: true,
      positionsLeftToRight: true,
    },
    B: {
      code: "B",
      x: 292,
      y: 72,
      width: 220,
      height: 228,
      rowFromBack: true,
      positionsLeftToRight: true,
    },
    C: {
      code: "C",
      x: 528,
      y: 72,
      width: 220,
      height: 228,
      rowFromBack: true,
      positionsLeftToRight: true,
    },
    D: {
      code: "D",
      x: 764,
      y: 72,
      width: 196,
      height: 188,
      rowFromBack: true,
      positionsLeftToRight: true,
    },
    E: {
      code: "E",
      x: 56,
      y: 422,
      width: 248,
      height: 196,
      rowFromBack: true,
      positionsLeftToRight: true,
    },
    F: {
      code: "F",
      x: 328,
      y: 422,
      width: 268,
      height: 196,
      rowFromBack: true,
      positionsLeftToRight: true,
    },
  },
};

export function geometryForBlock(code: string): BlockGeometry | null {
  return SCHELLE_YARD.blocks[code.trim().toUpperCase()] ?? null;
}
