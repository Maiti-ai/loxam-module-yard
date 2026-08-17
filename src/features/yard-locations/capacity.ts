import {MAX_STACK_HEIGHT} from "./stacking";

export type YardCapacity = {
  physicalPositions: number;
  total: number;
  occupied: number;
  available: number;
};

type OccupiedLevel = {
  occupant: {moduleId: string} | null;
};

type CapacityPosition = {
  levels: OccupiedLevel[];
};

type CapacityRow = {
  positions: CapacityPosition[];
};

export type CapacityBlock = {
  rows: CapacityRow[];
};

function clampCapacity(physicalPositions: number, occupiedRaw: number): YardCapacity {
  const total = physicalPositions * MAX_STACK_HEIGHT;
  const occupied = Math.min(Math.max(0, occupiedRaw), total);
  return {
    physicalPositions,
    total,
    occupied,
    available: Math.max(0, total - occupied),
  };
}

function occupiedModuleIds(position: CapacityPosition) {
  const ids = new Set<string>();
  for (const level of position.levels) {
    const id = level.occupant?.moduleId;
    if (id) {
      ids.add(id);
    }
  }
  return ids;
}

/** One physical position always contributes 3 module slots. */
export function positionCapacity(position: CapacityPosition): YardCapacity {
  return clampCapacity(1, occupiedModuleIds(position).size);
}

export function blockCapacity(block: CapacityBlock): YardCapacity {
  let physicalPositions = 0;
  let occupied = 0;
  for (const row of block.rows) {
    for (const position of row.positions) {
      physicalPositions += 1;
      occupied += occupiedModuleIds(position).size;
    }
  }
  return clampCapacity(physicalPositions, occupied);
}

export function yardCapacity(blocks: CapacityBlock[]): YardCapacity {
  const parts = blocks.map(blockCapacity);
  return clampCapacity(
    parts.reduce((sum, part) => sum + part.physicalPositions, 0),
    parts.reduce((sum, part) => sum + part.occupied, 0),
  );
}

export function formatOccupiedTotal(capacity: YardCapacity) {
  return `${capacity.occupied} / ${capacity.total}`;
}
