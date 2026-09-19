import type {YardLevelCell} from "@/features/yard-locations/types";
import {stackOccupancy} from "@/features/yard-locations/stacking";

export function primaryOccupant(position: {levels: YardLevelCell[]}) {
  const ground = position.levels.find((level) => level.level === "GROUND");
  return ground?.occupant ?? position.levels.find((level) => level.occupant)?.occupant ?? null;
}

export function positionOccupancy(position: {levels: YardLevelCell[]}) {
  return stackOccupancy(position.levels);
}
