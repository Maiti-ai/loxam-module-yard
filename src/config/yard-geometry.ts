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
 * D  west, five horizontal rows L→R: 10+10 maritime, 10+10 retours, 6 wash.
 *    Visual P-codes P1–P5 match those five rows. Extra slots are overlay-only.
 * F  west, below D, same outer size as D. P1–P3 × 4 drawn as 4×3 horizontal rows.
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
  /** Slot fill inside each cell. For D, rectangles are portrait: height > width. */
  slotRatio?: {w: number; h: number};
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
  /**
   * Draw P-rows as columns transposed into horizontal visual rows
   * (4 rows × 3 modules for production zone F).
   */
  slotsAsHorizontalRows?: boolean;
  slotRatio?: {w: number; h: number};
};

export type BlockLayoutSpec = {
  pRows: readonly string[];
  positionsPerRow: number;
  /** Override slot count for a P-row (D wash row has 6 instead of 10). */
  positionsByRow?: Readonly<Record<string, number>>;
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
    pRows: ["P1", "P2", "P3", "P4", "P5"],
    positionsPerRow: 10,
    positionsByRow: {P5: 6},
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
const SPINE = 340;
const BA_LANE = 80;
const RIGHT_W = 1060;

const C_BOX = {x: 180, y: 260, width: 3280, height: 400};
const LEFT_X = 180;
const LEFT_W = 1880;
const DF_H = 960;
const D_Y = C_BOX.y + C_BOX.height + LANE;
const F_Y = D_Y + DF_H + LANE;
const F_BOTTOM = F_Y + DF_H;
const RIGHT_X = LEFT_X + LEFT_W + SPINE;
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
  viewBox: {width: 3720, height: 3600},
  site: {
    polygon: [
      [980, 70],
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
      [900, 3488],
      [1760, 3488],
      [1800, 3360],
      [1980, 3360],
      [2020, 3488],
      [2680, 3470],
      [3180, 3380],
      [3480, 3180],
      [3580, 2780],
      [3570, 1960],
      [3520, 1100],
      [3460, 380],
      [3320, 120],
      [2200, 58],
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
      [900, 3380],
      [1760, 3380],
      [1800, 3260],
      [1980, 3260],
      [2020, 3380],
      [2680, 3350],
      [3180, 3220],
      [3380, 2980],
      [3460, 2580],
      [3440, 1180],
      [3360, 360],
      [3200, 180],
      [2200, 160],
      [980, 170],
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
      x: 520,
      y: 3496,
      width: 2680,
      height: 48,
      label: "Brandekensweg",
    },
    {
      id: "molenberglei",
      kind: "label",
      x: 3600,
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
      positionsLeftToRight: true,
      title: "D — RETOURS / ARRIVÉES",
      visualBands: [
        {label: "CONTENEURS MARITIMES", rowCodes: ["P1"], slotRatio: {w: 0.34, h: 0.92}},
        {label: "CONTENEURS MARITIMES", rowCodes: ["P2"], slotRatio: {w: 0.34, h: 0.92}},
        {label: "RETOURS / ARRIVÉES", rowCodes: ["P3"], slotRatio: {w: 0.44, h: 0.88}},
        {label: "RETOURS / ARRIVÉES", rowCodes: ["P4"], slotRatio: {w: 0.44, h: 0.88}},
        {label: "ZONE DE LAVAGE", rowCodes: ["P5"], slotRatio: {w: 0.44, h: 0.88}},
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
      slotsAsHorizontalRows: true,
      title: "F — ZONE DE PRODUCTION",
      slotRatio: {w: 0.86, h: 0.7},
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

export function positionsCountForRow(spec: BlockLayoutSpec, pCode: string) {
  return spec.positionsByRow?.[pCode] ?? spec.positionsPerRow;
}
