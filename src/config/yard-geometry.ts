/**
 * Schelle yard visual geometry, rebuilt from the marked inplantingsplan
 * (LOXAM 2, Brandekensweg 48/50, 2627 Schelle).
 *
 * Mapping report
 * --------------
 * SVG matches the scan: top = rear, bottom = Brandekensweg / gate.
 * Grey driving surface fills the inner yard; storage pads sit on it so
 * aisles stay visible between blocks. The office is only the south
 * bureau footprint, not the whole warehouse. Production F is the strip
 * immediately north of (behind) that office.
 *
 * C  back / north, full width. P1–P4 as east–west bands (P1 at the rear).
 *    13 positions on each band, numbered right → left.
 * D  west, south of C / north of F. ARRIVES + MARITIMES. P1–P8 along the
 *    south edge, right → left; two module depths.
 * B  east STOCK, south of C / north of A. P1–P9 bands, 6 positions R→L.
 * A  south-east VERZENDING / DEPARTS. P1–P7 bands, 5 positions R→L.
 * F  production strip directly behind the office. P1–P3 along the south
 *    edge, right → left.
 *
 * Keep handwritten block letters and P-numbers. Ignore 60150 / 60142 /
 * 60144 and other module/type notes. No Block E.
 */

export const PRODUCTION_BLOCK_CODE = "F";

export type Point = readonly [number, number];

export type LandmarkKind = "building" | "gate" | "label";

export type YardLandmark = {
  id: string;
  kind: LandmarkKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  points?: readonly Point[];
  rotate?: number;
};

export type RoadRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * y = P-rows are east–west bands, P1 at the rear (top).
 * x = P-rows stand as columns along the south edge, P1 at the right.
 */
export type PRowAxis = "x" | "y";

export type BlockGeometry = {
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pRowAxis: PRowAxis;
  /** P1 is at the BACK (top) when pRowAxis is y. */
  rowFromBack: boolean;
  /** Position 1 is on the east (right). */
  positionsLeftToRight: boolean;
  zoneLabel?: string;
};

export type BlockLayoutSpec = {
  pRows: readonly string[];
  positionsPerRow: number;
  zoneLabel?: string;
};

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
  yardSurface: {polygon: readonly Point[]};
  roads: readonly RoadRect[];
  landmarks: YardLandmark[];
  blocks: Record<string, BlockGeometry>;
};

export function polygonPoints(points: readonly Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/**
 * Large canvas so the real proportions stay readable.
 * Scale is taken from the scan; blocks are not recentred into a square.
 */
export const SCHELLE_YARD: SchelleYardGeometry = {
  viewBox: {width: 2560, height: 3300},
  site: {
    polygon: [
      [864, 95],
      [570, 120],
      [276, 186],
      [129, 296],
      [92, 394],
      [80, 786],
      [80, 1766],
      [85, 2501],
      [100, 2795],
      [154, 3003],
      [374, 3109],
      [766, 3138],
      [1256, 3138],
      [1280, 3028],
      [1415, 3028],
      [1440, 3138],
      [1844, 3126],
      [2187, 3077],
      [2420, 2893],
      [2461, 2599],
      [2452, 2011],
      [2403, 1276],
      [2354, 492],
      [2322, 174],
      [2187, 95],
      [1550, 80],
    ],
  },
  yardSurface: {
    polygon: [
      [220, 250],
      [180, 420],
      [170, 1760],
      [190, 2680],
      [280, 2920],
      [520, 3010],
      [760, 3040],
      [1260, 3040],
      [1288, 2940],
      [1408, 2940],
      [1440, 3040],
      [1820, 3020],
      [2140, 2940],
      [2280, 2760],
      [2320, 2480],
      [2300, 1260],
      [2240, 420],
      [2180, 220],
      [1560, 200],
      [900, 210],
    ],
  },
  roads: [
    {id: "aisle-south-of-c", x: 170, y: 700, width: 2140, height: 90},
    {id: "aisle-spine", x: 1140, y: 700, width: 430, height: 2220},
    {id: "aisle-west-court", x: 200, y: 1620, width: 940, height: 420},
    {id: "aisle-between-ba", x: 1580, y: 1938, width: 660, height: 60},
    {id: "aisle-east", x: 2220, y: 250, width: 120, height: 2700},
    {id: "aisle-entry", x: 1140, y: 2680, width: 430, height: 360},
  ],
  landmarks: [
    {
      id: "building",
      kind: "building",
      x: 520,
      y: 2480,
      width: 440,
      height: 230,
    },
    {id: "gate", kind: "gate", x: 1280, y: 2940, width: 128, height: 88, label: "gate"},
    {
      id: "brandekensweg",
      kind: "label",
      x: 400,
      y: 3160,
      width: 1760,
      height: 48,
      label: "Brandekensweg",
    },
    {
      id: "molenberglei",
      kind: "label",
      x: 2470,
      y: 900,
      width: 48,
      height: 1100,
      label: "Molenberglei",
      rotate: 90,
    },
  ],
  blocks: {
    C: {
      code: "C",
      x: 166,
      y: 340,
      width: 2053,
      height: 355,
      pRowAxis: "y",
      rowFromBack: true,
      positionsLeftToRight: false,
      zoneLabel: "storage",
    },
    D: {
      code: "D",
      x: 215,
      y: 798,
      width: 906,
      height: 809,
      pRowAxis: "x",
      rowFromBack: true,
      positionsLeftToRight: false,
      zoneLabel: "ARRIVES",
    },
    B: {
      code: "B",
      x: 1594,
      y: 855,
      width: 625,
      height: 1078,
      pRowAxis: "y",
      rowFromBack: true,
      positionsLeftToRight: false,
      zoneLabel: "STOCK",
    },
    F: {
      code: "F",
      x: 400,
      y: 2120,
      width: 700,
      height: 320,
      pRowAxis: "x",
      rowFromBack: true,
      positionsLeftToRight: false,
      zoneLabel: "production",
    },
    A: {
      code: "A",
      x: 1717,
      y: 2006,
      width: 502,
      height: 796,
      pRowAxis: "y",
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
