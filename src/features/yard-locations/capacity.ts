import {DEFAULT_MAX_STACK_LEVELS, maxStackLevelsForBlock} from "../../config/yard";
import {MAX_STACK_HEIGHT, resolveMaxStackLevels, type StackRuleOptions} from "./stacking";

export type YardCapacity = {
  physicalPositions: number;
  total: number;
  occupied: number;
  available: number;
};

type OccupiedLevel = {
  level?: string;
  occupant: {moduleId: string} | null;
};

type CapacityPosition = {
  levels: OccupiedLevel[];
  maxStackLevels?: number;
};

type CapacityRow = {
  positions: CapacityPosition[];
};

export type CapacityBlock = {
  code?: string;
  maxStackLevels?: number;
  rows: CapacityRow[];
};

function clampCapacity(physicalPositions: number, occupiedRaw: number, maxStackLevels: number): YardCapacity {
  const height = Math.min(MAX_STACK_HEIGHT, Math.max(1, Math.trunc(maxStackLevels) || DEFAULT_MAX_STACK_LEVELS));
  const total = physicalPositions * height;
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

function heightForBlock(block: CapacityBlock) {
  if (block.maxStackLevels != null) {
    return resolveMaxStackLevels({maxStackLevels: block.maxStackLevels});
  }
  if (block.code) {
    return maxStackLevelsForBlock(block.code);
  }
  return DEFAULT_MAX_STACK_LEVELS;
}

/** One physical position contributes `maxStackLevels` module slots. */
export function positionCapacity(
  position: CapacityPosition,
  options?: StackRuleOptions,
): YardCapacity {
  const maxStackLevels = resolveMaxStackLevels({
    maxStackLevels: position.maxStackLevels ?? options?.maxStackLevels,
    blockCode: options?.blockCode,
  });
  return clampCapacity(1, occupiedModuleIds(position).size, maxStackLevels);
}

export function blockCapacity(block: CapacityBlock): YardCapacity {
  const maxStackLevels = heightForBlock(block);
  let physicalPositions = 0;
  let occupied = 0;
  for (const row of block.rows) {
    for (const position of row.positions) {
      physicalPositions += 1;
      occupied += occupiedModuleIds(position).size;
    }
  }
  return clampCapacity(physicalPositions, occupied, maxStackLevels);
}

export function yardCapacity(blocks: CapacityBlock[]): YardCapacity {
  const parts = blocks.map(blockCapacity);
  const physicalPositions = parts.reduce((sum, part) => sum + part.physicalPositions, 0);
  const total = parts.reduce((sum, part) => sum + part.total, 0);
  const occupied = parts.reduce((sum, part) => sum + part.occupied, 0);
  return {
    physicalPositions,
    total,
    occupied: Math.min(occupied, total),
    available: Math.max(0, total - occupied),
  };
}

export function formatOccupiedTotal(capacity: YardCapacity) {
  return `${capacity.occupied} / ${capacity.total}`;
}
