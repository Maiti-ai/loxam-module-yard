import type {StackLevel} from "@/types/database";

export const DISPATCH_BLOCK_CODE = "A";
export const DISPATCH_STACK_HEIGHT = 3;
export const DISPATCH_LEVELS: readonly StackLevel[] = ["GROUND", "LEVEL_1", "LEVEL_2"];

export function requiredGroundPositions(totalModules: number) {
  if (!Number.isInteger(totalModules) || totalModules < 1) {
    return 0;
  }
  return Math.ceil(totalModules / DISPATCH_STACK_HEIGHT);
}

export type DispatchSlotPlan = {
  sequenceNumber: number;
  positionOrder: number;
  level: StackLevel;
  levelNumber: 0 | 1 | 2;
};

export function buildDispatchSlotPlan(totalModules: number): DispatchSlotPlan[] {
  const required = requiredGroundPositions(totalModules);
  if (required === 0) {
    return [];
  }

  const slots: DispatchSlotPlan[] = [];
  for (let sequence = 1; sequence <= totalModules; sequence += 1) {
    const positionOrder = Math.floor((sequence - 1) / DISPATCH_STACK_HEIGHT) + 1;
    const levelIndex = (sequence - 1) % DISPATCH_STACK_HEIGHT;
    slots.push({
      sequenceNumber: sequence,
      positionOrder,
      level: DISPATCH_LEVELS[levelIndex] ?? "GROUND",
      levelNumber: levelIndex as 0 | 1 | 2,
    });
  }
  return slots;
}

export function isPositionFullyReservable(input: {
  blockCode: string;
  reserved?: boolean;
  hasLiveSlots: boolean;
  occupiedCount: number;
}) {
  return (
    input.blockCode.trim().toUpperCase() === DISPATCH_BLOCK_CODE &&
    input.hasLiveSlots &&
    !input.reserved &&
    input.occupiedCount === 0
  );
}
