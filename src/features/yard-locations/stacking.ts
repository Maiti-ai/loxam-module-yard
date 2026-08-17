import type {StackLevel} from "../../types/database";

/** Physical stack: bottom, middle, top. There is no fourth level. */
export const MAX_STACK_HEIGHT = 3;

/** Internal identifiers stay GROUND / LEVEL_1 / LEVEL_2 for DB compatibility. */
export const STACK_LEVELS_BOTTOM_UP: readonly StackLevel[] = [
  "GROUND",
  "LEVEL_1",
  "LEVEL_2",
];

export const STACK_LEVEL_NUMBER: Record<StackLevel, 0 | 1 | 2> = {
  GROUND: 0,
  LEVEL_1: 1,
  LEVEL_2: 2,
};

export type StackOccupancyCell = {
  slotId?: string;
  level: StackLevel;
  occupant: {moduleId: string} | null;
};

function occupantId(cell: StackOccupancyCell | undefined, ignoreModuleId?: string) {
  const id = cell?.occupant?.moduleId;
  if (!id || id === ignoreModuleId) {
    return null;
  }
  return id;
}

function cellFor(levels: StackOccupancyCell[], level: StackLevel) {
  return levels.find((item) => item.level === level);
}

/**
 * First free level from the bottom. Never skips a free lower level,
 * so a new placement cannot float above an empty Niveau 0 or 1.
 */
export function firstFreeLevel(
  levels: StackOccupancyCell[],
  options?: {ignoreModuleId?: string},
): StackLevel | null {
  if (levels.length === 0) {
    return null;
  }

  for (const level of STACK_LEVELS_BOTTOM_UP) {
    const cell = cellFor(levels, level);
    if (!cell) {
      continue;
    }
    if (!occupantId(cell, options?.ignoreModuleId)) {
      return level;
    }
  }

  return null;
}

export function firstFreeCell<T extends StackOccupancyCell>(
  levels: T[],
  options?: {ignoreModuleId?: string},
): T | null {
  const level = firstFreeLevel(levels, options);
  if (!level) {
    return null;
  }
  return levels.find((item) => item.level === level) ?? null;
}

export function stackOccupancy(
  levels: StackOccupancyCell[],
  options?: {ignoreModuleId?: string},
) {
  const occupied = STACK_LEVELS_BOTTOM_UP.filter((level) => {
    const cell = cellFor(levels, level);
    return Boolean(occupantId(cell, options?.ignoreModuleId));
  }).length;

  return {occupied, total: MAX_STACK_HEIGHT};
}

export function isStackFull(
  levels: StackOccupancyCell[],
  options?: {ignoreModuleId?: string},
) {
  return levels.length > 0 && firstFreeLevel(levels, options) === null;
}

/**
 * True when a higher level is occupied while a lower one is empty.
 * Existing records are left untouched; new placements still fill bottom-up.
 */
export function hasInconsistentStack(levels: StackOccupancyCell[]) {
  let seenEmpty = false;
  for (const level of STACK_LEVELS_BOTTOM_UP) {
    const occupied = Boolean(cellFor(levels, level)?.occupant);
    if (!occupied) {
      seenEmpty = true;
    } else if (seenEmpty) {
      return true;
    }
  }
  return false;
}
