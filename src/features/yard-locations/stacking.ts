import {DEFAULT_MAX_STACK_LEVELS, maxStackLevelsForBlock} from "../../config/yard";
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

export type StackRuleOptions = {
  ignoreModuleId?: string;
  maxStackLevels?: number;
  blockCode?: string;
};

export function resolveMaxStackLevels(options?: StackRuleOptions) {
  if (options?.maxStackLevels != null) {
    return clampStackHeight(options.maxStackLevels);
  }
  if (options?.blockCode) {
    return maxStackLevelsForBlock(options.blockCode);
  }
  return DEFAULT_MAX_STACK_LEVELS;
}

function clampStackHeight(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_STACK_LEVELS;
  }
  return Math.min(MAX_STACK_HEIGHT, Math.max(1, Math.trunc(value)));
}

export function stackLevelsForHeight(maxStackLevels: number = DEFAULT_MAX_STACK_LEVELS) {
  return STACK_LEVELS_BOTTOM_UP.slice(0, clampStackHeight(maxStackLevels));
}

export function displayLevelsForBlock(blockCode: string) {
  return stackLevelsForHeight(maxStackLevelsForBlock(blockCode));
}

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

function hasOccupantAboveAllowed(
  levels: StackOccupancyCell[],
  maxStackLevels: number,
  ignoreModuleId?: string,
) {
  const allowed = new Set(stackLevelsForHeight(maxStackLevels));
  return levels.some((cell) => !allowed.has(cell.level) && Boolean(occupantId(cell, ignoreModuleId)));
}

/**
 * First free level from the bottom, limited to the block's max stack height.
 * Never skips a free lower allowed level. Occupants above the allowed height
 * (e.g. Niveau 1 in F) block placement without rewriting that data.
 */
export function firstFreeLevel(
  levels: StackOccupancyCell[],
  options?: StackRuleOptions,
): StackLevel | null {
  if (levels.length === 0) {
    return null;
  }

  const maxStackLevels = resolveMaxStackLevels(options);
  if (hasOccupantAboveAllowed(levels, maxStackLevels, options?.ignoreModuleId)) {
    return null;
  }

  for (const level of stackLevelsForHeight(maxStackLevels)) {
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
  options?: StackRuleOptions,
): T | null {
  const level = firstFreeLevel(levels, options);
  if (!level) {
    return null;
  }
  return levels.find((item) => item.level === level) ?? null;
}

export function stackOccupancy(
  levels: StackOccupancyCell[],
  options?: StackRuleOptions,
) {
  const maxStackLevels = resolveMaxStackLevels(options);
  const ids = new Set<string>();
  for (const cell of levels) {
    const id = occupantId(cell, options?.ignoreModuleId);
    if (id) {
      ids.add(id);
    }
  }

  return {
    occupied: Math.min(ids.size, maxStackLevels),
    total: maxStackLevels,
  };
}

export function isStackFull(
  levels: StackOccupancyCell[],
  options?: StackRuleOptions,
) {
  return levels.length > 0 && firstFreeLevel(levels, options) === null;
}

export type DestinationChoice =
  | {ok: true; level: StackLevel}
  | {ok: false; reason: "full" | "unconfigured"};

/** Move-mode destination from a tapped physical position. */
export function destinationChoice(
  levels: StackOccupancyCell[],
  options?: StackRuleOptions,
): DestinationChoice {
  if (levels.length === 0) {
    return {ok: false, reason: "unconfigured"};
  }
  const level = firstFreeLevel(levels, options);
  if (!level) {
    return {ok: false, reason: "full"};
  }
  return {ok: true, level};
}

export const DISPLAY_LEVELS = STACK_LEVELS_BOTTOM_UP;

/**
 * True when occupancy violates the block's stacking rule.
 * Existing records are left untouched.
 */
export function hasInconsistentStack(
  levels: StackOccupancyCell[],
  options?: StackRuleOptions,
) {
  const maxStackLevels = resolveMaxStackLevels(options);
  if (hasOccupantAboveAllowed(levels, maxStackLevels)) {
    return true;
  }

  let seenEmpty = false;
  for (const level of stackLevelsForHeight(maxStackLevels)) {
    const occupied = Boolean(cellFor(levels, level)?.occupant);
    if (!occupied) {
      seenEmpty = true;
    } else if (seenEmpty) {
      return true;
    }
  }
  return false;
}
