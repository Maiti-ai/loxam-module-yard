import type {StackLevel} from "@/types/database";

export const STACK_LEVELS: StackLevel[] = ["GROUND", "LEVEL_1", "LEVEL_2"];

export type YardBlock = {
  id: string;
  code: string;
  name: string;
};

export type YardRow = {
  id: string;
  blockId: string;
  code: string;
};

export type YardPosition = {
  id: string;
  rowId: string;
  code: string;
};

export type YardSlot = {
  id: string;
  blockId: string;
  rowId: string;
  positionId: string;
  level: StackLevel;
};
