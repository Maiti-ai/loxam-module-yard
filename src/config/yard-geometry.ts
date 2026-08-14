/**
 * Schelle yard visual geometry, derived from the marked inplantingsplan
 * (LOXAM 2, Brandekensweg 48/50, 2627 Schelle, 1/200).
 *
 * KEEP from the plan:
 * - Block letters A, B, C, D, F (E is not clearly lettered on the scan)
 * - P-numbers as permanent ROW identifiers (P1, P2, …)
 *
 * IGNORE from the plan:
 * - handwritten module numbers
 * - type/reference numbers such as 60150, 60142
 *
 * Hierarchy:
 *   BLOCK → P-row (P1 at the BACK) → module position → LEVEL
 * Example: C → P2 → 4 → Level 1
 *
 * P-rows and position counts below are only those readable on the plan.
 * Do not invent extra P-numbers here.
 */

export const PRODUCTION_BLOCK_CODE = "F";

export type LandmarkKind =
  | "pavement"
  | "road"
  | "building"
  | "gate"
  | "label";

export type YardLandmark = {
  id: string;
  kind: LandmarkKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

export type BlockGeometry = {
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** P1 is at the BACK (smaller y / top of SVG). */
  rowFromBack: boolean;
  /** On the plan, R1 / position 1 is on the east (right) for A, B, C. */
  positionsLeftToRight: boolean;
  zoneLabel?: string;
};

export type BlockLayoutSpec = {
  pRows: readonly string[];
  positionsPerRow: number;
  zoneLabel?: string;
};

/**
 * Permanent P-rows readable on the marked plan.
 * Individual slots inside a P-row are numbered 1…N (shown as Position 4).
 */
export const SCHELLE_BLOCK_SPEC: Record<string, BlockLayoutSpec> = {
  C: {
    pRows: ["P1", "P2", "P3", "P4"],
    positionsPerRow: 13,
    zoneLabel: "storage",
  },
  B: {
    pRows: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"],
    positionsPerRow: 6,
    zoneLabel: "STOCK",
  },
  A: {
    pRows: ["P1", "P2", "P3", "P4", "P5", "P6", "P7"],
    positionsPerRow: 5,
    zoneLabel: "VERZENDING",
  },
  D: {
    pRows: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
    positionsPerRow: 2,
    zoneLabel: "ARRIVES",
  },
  F: {
    pRows: ["P1", "P2", "P3"],
    positionsPerRow: 4,
    zoneLabel: "production",
  },
};

export type SchelleYardGeometry = {
  viewBox: {width: number; height: number};
  site: {x: number; y: number; width: number; height: number};
  landmarks: YardLandmark[];
  blocks: Record<string, BlockGeometry>;
};

/**
 * Operational orientation: driver at Brandekensweg looking into the yard.
 * Bottom = FRONT / gate / Brandekensweg.
 * Top = BACK. P1 is at the back of each block.
 *
 * Physical arrangement from the plan:
 * - C: wide storage across the back
 * - D: arrivals / maritimes on the left
 * - F: production building, left-front of centre
 * - B: STOCK on the right
 * - A: VERZENDING / DEPARTS at the front-right
 */
export const SCHELLE_YARD: SchelleYardGeometry = {
  viewBox: {width: 1100, height: 820},
  site: {x: 20, y: 24, width: 1060, height: 772},
  landmarks: [
    {id: "pavement", kind: "pavement", x: 32, y: 52, width: 1036, height: 668},
    {id: "road-spine", kind: "road", x: 44, y: 268, width: 1012, height: 56},
    {id: "road-front", kind: "road", x: 44, y: 640, width: 1012, height: 40},
    {id: "molenberglei", kind: "road", x: 1008, y: 52, width: 48, height: 628},
    {id: "gate", kind: "gate", x: 720, y: 678, width: 70, height: 32, label: "gate"},
    {
      id: "brandekensweg",
      kind: "label",
      x: 32,
      y: 748,
      width: 1036,
      height: 32,
      label: "Brandekensweg",
    },
  ],
  blocks: {
    C: {
      code: "C",
      x: 48,
      y: 64,
      width: 940,
      height: 188,
      rowFromBack: true,
      positionsLeftToRight: false,
      zoneLabel: "storage",
    },
    D: {
      code: "D",
      x: 48,
      y: 336,
      width: 268,
      height: 196,
      rowFromBack: true,
      positionsLeftToRight: true,
      zoneLabel: "ARRIVES",
    },
    B: {
      code: "B",
      x: 360,
      y: 336,
      width: 300,
      height: 268,
      rowFromBack: true,
      positionsLeftToRight: false,
      zoneLabel: "STOCK",
    },
    F: {
      code: "F",
      x: 48,
      y: 544,
      width: 268,
      height: 88,
      rowFromBack: true,
      positionsLeftToRight: true,
      zoneLabel: "production",
    },
    A: {
      code: "A",
      x: 684,
      y: 400,
      width: 300,
      height: 252,
      rowFromBack: true,
      positionsLeftToRight: false,
      zoneLabel: "VERZENDING",
    },
  },
};

export function geometryForBlock(code: string): BlockGeometry | null {
  return SCHELLE_YARD.blocks[code.trim().toUpperCase()] ?? null;
}

export function layoutSpecForBlock(code: string): BlockLayoutSpec | null {
  return SCHELLE_BLOCK_SPEC[code.trim().toUpperCase()] ?? null;
}
