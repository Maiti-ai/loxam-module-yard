/**
 * Schelle yard visual geometry.
 *
 * Visual layout only. Block letters and P-row data mappings stay in
 * SCHELLE_BLOCK_SPEC and must not be changed for occupancy / DB logic.
 *
 * SVG: top = rear, bottom = Brandekensweg / gate / PORTAIL.
 * Grey driving lanes follow the gaps BETWEEN the blocks.
 *
 * C  rear storage, full width. P1–P4 as east–west bands (P1 at the rear).
 * D  west, five visual bands (maritime / retours / lavage). Data still P1–P8.
 * F  west, below D, same outer size as D. 3 columns × 4 rows (P1–P3 × 4).
 * B  east of D, top edge aligned with D. P1–P9 bands, 6 positions R→L.
 * A  under B; bottom aligned with F. P1–P7 bands, 5 positions R→L.
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
 * x = P-rows stand as columns, P1 at the right.
 */
export type PRowAxis = "x" | "y";

/** Groups existing P-rows into one visual band. Data codes stay unchanged. */
export type VisualBand = {
  label: string;
  rowCodes: readonly string[];
};

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
  /** Position 1 is drawn at the bottom when pRowAxis is x. */
  positionsFromBottom?: boolean;
  title: string;
  visualBands?: readonly VisualBand[];
  slotRatio?: {w: number; h: number};
};

export type BlockLayoutSpec = {
  pRows: readonly string[];
  positionsPerRow: number;
};

export const SCHELLE_BLOCK_SPEC: Record<string, BlockLayoutSpec> = {
  C: {
    pRows: ["P1", "P2", "P3", "P4"],
    positionsPerRow: 13,
  },
  B: {
    pRows: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"],
    positionsPerRow: 6,
  },
  A: {
    pRows: ["P1", "P2", "P3", "P4", "P5", "P6", "P7"],
    positionsPerRow: 5,
  },
  D: {
    pRows: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
    positionsPerRow: 2,
  },
  F: {
    pRows: ["P1", "P2", "P3"],
    positionsPerRow: 4,
  },
};

/** Visible yard-map copy. Operational labels on the map are French. */
export const YARD_MAP_FR = {
  back: "ARRIÈRE",
  front: "AVANT",
  building: "BÂTIMENT",
  office: "BUREAU",
  gate: "PORTAIL",
  free: "LIBRE",
  occupied: "OCCUPÉ",
  rented: "LOUÉ",
} as const;

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
 * Named layout so block alignment stays maintainable.
 *
 *   C full width at the rear
 *   D (left)     B (right)   — tops aligned
 *   F (left)     A (right)   — bottoms aligned
 */
const LANE = 108;
const SPINE = 300;
const BA_LANE = 80;

const C_BOX = {x: 180, y: 260, width: 2440, height: 400};
const LEFT_X = 180;
const LEFT_W = 1080;
const DF_H = 960;
const D_Y = C_BOX.y + C_BOX.height + LANE;
const F_Y = D_Y + DF_H + LANE;
const F_BOTTOM = F_Y + DF_H;
const RIGHT_X = LEFT_X + LEFT_W + SPINE;
const RIGHT_W = C_BOX.x + C_BOX.width - RIGHT_X;
const BA_SPAN = F_BOTTOM - D_Y;
const B_H = Math.round((BA_SPAN - BA_LANE) * (9 / 16));
const A_H = BA_SPAN - BA_LANE - B_H;
const A_Y = D_Y + B_H + BA_LANE;
const C_RIGHT = C_BOX.x + C_BOX.width;
const OFFICE = {x: 300, y: F_BOTTOM + 92, width: 400, height: 176};
const GATE = {
  x: LEFT_X + LEFT_W + (SPINE - 160) / 2,
  y: OFFICE.y + OFFICE.height + 88,
  width: 160,
  height: 92,
};

export const SCHELLE_YARD: SchelleYardGeometry = {
  viewBox: {width: 2800, height: 3600},
  site: {
    polygon: [
      [920, 70],
      [560, 100],
      [240, 170],
      [90, 300],
      [55, 420],
      [48, 820],
      [48, 1880],
      [55, 2680],
      [80, 3120],
      [180, 3320],
      [420, 3440],
      [820, 3488],
      [1320, 3488],
      [1360, 3360],
      [1500, 3360],
      [1540, 3488],
      [1980, 3470],
      [2360, 3380],
      [2620, 3180],
      [2700, 2780],
      [2690, 1960],
      [2640, 1100],
      [2580, 380],
      [2480, 120],
      [1680, 58],
    ],
  },
  yardSurface: {
    polygon: [
      [200, 200],
      [140, 400],
      [120, 1780],
      [140, 2860],
      [240, 3180],
      [520, 3340],
      [820, 3380],
      [1320, 3380],
      [1360, 3260],
      [1500, 3260],
      [1540, 3380],
      [1960, 3350],
      [2320, 3220],
      [2500, 2980],
      [2560, 2580],
      [2540, 1180],
      [2460, 360],
      [2360, 180],
      [1680, 160],
      [920, 170],
    ],
  },
  roads: [
    {
      id: "aisle-south-of-c",
      x: C_BOX.x,
      y: C_BOX.y + C_BOX.height,
      width: C_BOX.width,
      height: LANE,
    },
    {
      id: "aisle-spine",
      x: LEFT_X + LEFT_W,
      y: D_Y,
      width: SPINE,
      height: BA_SPAN,
    },
    {
      id: "aisle-between-df",
      x: LEFT_X,
      y: D_Y + DF_H,
      width: LEFT_W,
      height: LANE,
    },
    {
      id: "aisle-between-ba",
      x: RIGHT_X,
      y: D_Y + B_H,
      width: RIGHT_W,
      height: BA_LANE,
    },
    {
      id: "aisle-east",
      x: C_RIGHT,
      y: C_BOX.y,
      width: LANE,
      height: F_BOTTOM - C_BOX.y,
    },
    {
      id: "aisle-west",
      x: C_BOX.x - LANE,
      y: C_BOX.y,
      width: LANE,
      height: F_BOTTOM - C_BOX.y,
    },
    {
      id: "aisle-south-court",
      x: LEFT_X,
      y: F_BOTTOM,
      width: LEFT_W + SPINE + RIGHT_W,
      height: 92,
    },
    {
      id: "aisle-entry",
      x: LEFT_X + LEFT_W,
      y: F_BOTTOM,
      width: SPINE,
      height: GATE.y + GATE.height - F_BOTTOM,
    },
  ],
  landmarks: [
    {
      id: "building",
      kind: "building",
      x: OFFICE.x,
      y: OFFICE.y,
      width: OFFICE.width,
      height: OFFICE.height,
    },
    {
      id: "gate",
      kind: "gate",
      x: GATE.x,
      y: GATE.y,
      width: GATE.width,
      height: GATE.height,
      label: YARD_MAP_FR.gate,
    },
    {
      id: "brandekensweg",
      kind: "label",
      x: 420,
      y: 3496,
      width: 1960,
      height: 48,
      label: "Brandekensweg",
    },
    {
      id: "molenberglei",
      kind: "label",
      x: 2720,
      y: 900,
      width: 48,
      height: 1200,
      label: "Molenberglei",
      rotate: 90,
    },
  ],
  blocks: {
    C: {
      code: "C",
      ...C_BOX,
      pRowAxis: "y",
      rowFromBack: true,
      positionsLeftToRight: false,
      title: "C — STOCKAGE",
      slotRatio: {w: 0.78, h: 0.64},
    },
    D: {
      code: "D",
      x: LEFT_X,
      y: D_Y,
      width: LEFT_W,
      height: DF_H,
      pRowAxis: "y",
      rowFromBack: true,
      positionsLeftToRight: false,
      title: "D — RETOURS / ARRIVÉES",
      visualBands: [
        {label: "CONTENEURS MARITIMES", rowCodes: ["P1"]},
        {label: "CONTENEURS MARITIMES", rowCodes: ["P2"]},
        {label: "RETOURS / ARRIVÉES", rowCodes: ["P3", "P4"]},
        {label: "RETOURS / ARRIVÉES", rowCodes: ["P5", "P6"]},
        {label: "ZONE DE LAVAGE", rowCodes: ["P7", "P8"]},
      ],
    },
    B: {
      code: "B",
      x: RIGHT_X,
      y: D_Y,
      width: RIGHT_W,
      height: B_H,
      pRowAxis: "y",
      rowFromBack: true,
      positionsLeftToRight: false,
      title: "B — STOCK",
      slotRatio: {w: 0.78, h: 0.64},
    },
    F: {
      code: "F",
      x: LEFT_X,
      y: F_Y,
      width: LEFT_W,
      height: DF_H,
      pRowAxis: "x",
      rowFromBack: true,
      positionsLeftToRight: false,
      positionsFromBottom: true,
      title: "F — ZONE DE PRODUCTION",
      slotRatio: {w: 0.86, h: 0.8},
    },
    A: {
      code: "A",
      x: RIGHT_X,
      y: A_Y,
      width: RIGHT_W,
      height: A_H,
      pRowAxis: "y",
      rowFromBack: true,
      positionsLeftToRight: false,
      title: "A — EXPÉDITION",
      slotRatio: {w: 0.78, h: 0.64},
    },
  },
};

export function geometryForBlock(code: string): BlockGeometry | null {
  return SCHELLE_YARD.blocks[code.trim().toUpperCase()] ?? null;
}

export function layoutSpecForBlock(code: string): BlockLayoutSpec | null {
  return SCHELLE_BLOCK_SPEC[code.trim().toUpperCase()] ?? null;
}
