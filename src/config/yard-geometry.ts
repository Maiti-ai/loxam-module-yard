/**
 * Schelle yard visual geometry, traced from the marked inplantingsplan
 * (LOXAM 2, Brandekensweg 48/50, 2627 Schelle).
 *
 * Mapping report (scan = geometric source of truth)
 * -------------------------------------------------
 * Orientation of the SVG matches the scan: top = BACK (north-ish),
 * bottom = FRONT / Brandekensweg / gate. P1 is the rear row of each
 * block (closest to the back fence for that block).
 *
 * Site perimeter
 *   Irregular rectangle with a large rounded north-west corner, smaller
 *   rounded south-west and south-east corners, and a rectangular gate
 *   notch on Brandekensweg. Green landscape + trees sit between the
 *   fence and the inner perimeter road. Molenberglei runs along the
 *   east edge. The building and grids are NOT recentred to make the
 *   SVG rectangular.
 *
 * Building
 *   Real footprint in the south-west interior, west of the central
 *   north–south aisle. South annex (office / sanitary rooms) stays
 *   attached to the south face. It is a landmark, not a storage block.
 *
 * Block C — back / north
 *   Full-width 6×3 grid against the rear perimeter road.
 *   P1 (rear) … P4 (front of C). Columns R13 west → R1 east.
 *   13 positions per P-row.
 *
 * Block D — west, north of the building
 *   MARITIMES (rear, yellow) + ARRIVES (south of that) + RETOUR /
 *   Reinigen on the aisle side. P1 rear. Bottom of ARRIVES is marked
 *   P1…P8 west→east on the scan; the operational P-rows remain P1–P8.
 *
 * Block B — east STOCK (not a simplified centre rectangle)
 *   The 6-wide × 9-deep grid on the east side, south of C and north of
 *   A, against the east landscape strip. P1 rear … P9. R6 west → R1
 *   east. Labelled STOCK on the scan. No extra invented B geometry.
 *
 * Block A — south-east VERZENDING / DEPARTS
 *   Right-aligned with B, one aisle south of it. 5-wide × 7-deep.
 *   P1 rear … P7. R5 west → R1 east. DEPARTS highlight on mid rows.
 *   Does not swallow the open front yard or the building.
 *
 * Block F — production, east face of the building
 *   Narrow strip between the building and the central aisle, where the
 *   scan marks F. P1 rear … P3, 4 positions. Not moved to the front
 *   of the yard.
 *
 * Ignore: handwritten module/type numbers (60150, 60142, 60144, …)
 * and temporary notes. Keep block letters and P-row markings.
 *
 * Hierarchy: BLOCK → P-row → position → LEVEL
 * Example: C / P2 / 4 / Level 1
 */

export const PRODUCTION_BLOCK_CODE = "F";

export type Point = readonly [number, number];

export type LandmarkKind = "pavement" | "road" | "building" | "gate" | "label";

export type YardLandmark = {
  id: string;
  kind: LandmarkKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  /** When set, drawn as a polygon instead of the bounding rect. */
  points?: readonly Point[];
  rotate?: number;
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
  site: {polygon: readonly Point[]};
  pavement: {polygon: readonly Point[]};
  landmarks: YardLandmark[];
  blocks: Record<string, BlockGeometry>;
};

export function polygonPoints(points: readonly Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/**
 * Coordinates are proportional to the scan (origin near the NW fence).
 * Bottom = FRONT / gate / Brandekensweg. Top = BACK. P1 at the back.
 */
export const SCHELLE_YARD: SchelleYardGeometry = {
  viewBox: {width: 1000, height: 1280},
  site: {
    polygon: [
      [330, 18],
      [210, 28],
      [90, 55],
      [30, 100],
      [15, 140],
      [10, 300],
      [10, 700],
      [12, 1000],
      [18, 1120],
      [40, 1205],
      [130, 1248],
      [290, 1260],
      [490, 1260],
      [500, 1215],
      [555, 1215],
      [565, 1260],
      [730, 1255],
      [870, 1235],
      [965, 1160],
      [982, 1040],
      [978, 800],
      [958, 500],
      [938, 180],
      [925, 50],
      [870, 18],
      [610, 12],
    ],
  },
  pavement: {
    polygon: [
      [72, 108],
      [58, 160],
      [55, 700],
      [58, 1110],
      [120, 1218],
      [280, 1236],
      [488, 1236],
      [500, 1194],
      [555, 1194],
      [568, 1236],
      [740, 1230],
      [858, 1208],
      [918, 1132],
      [926, 780],
      [912, 170],
      [896, 72],
      [610, 54],
      [210, 72],
      [88, 96],
    ],
  },
  landmarks: [
    {
      id: "building",
      kind: "building",
      x: 132,
      y: 668,
      width: 348,
      height: 400,
      points: [
        [132, 668],
        [480, 668],
        [480, 1068],
        [390, 1068],
        [390, 1145],
        [210, 1145],
        [210, 1068],
        [132, 1068],
      ],
    },
    {id: "gate", kind: "gate", x: 500, y: 1215, width: 55, height: 42, label: "gate"},
    {
      id: "brandekensweg",
      kind: "label",
      x: 120,
      y: 1248,
      width: 720,
      height: 28,
      label: "Brandekensweg",
    },
    {
      id: "molenberglei",
      kind: "label",
      x: 948,
      y: 420,
      width: 36,
      height: 420,
      label: "Molenberglei",
      rotate: 90,
    },
  ],
  blocks: {
    C: {
      code: "C",
      x: 45,
      y: 118,
      width: 838,
      height: 145,
      rowFromBack: true,
      positionsLeftToRight: false,
      zoneLabel: "storage",
    },
    D: {
      code: "D",
      x: 65,
      y: 305,
      width: 370,
      height: 330,
      rowFromBack: true,
      positionsLeftToRight: true,
      zoneLabel: "ARRIVES",
    },
    B: {
      code: "B",
      x: 628,
      y: 328,
      width: 255,
      height: 440,
      rowFromBack: true,
      positionsLeftToRight: false,
      zoneLabel: "STOCK",
    },
    F: {
      code: "F",
      x: 488,
      y: 675,
      width: 118,
      height: 250,
      rowFromBack: true,
      positionsLeftToRight: true,
      zoneLabel: "production",
    },
    A: {
      code: "A",
      x: 670,
      y: 798,
      width: 213,
      height: 325,
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
