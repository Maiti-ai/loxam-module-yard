import type {YardLevelCell, YardPositionNode} from "@/features/yard-locations/types";

export function primaryOccupant(position: {levels: YardLevelCell[]}) {
  const ground = position.levels.find((level) => level.level === "GROUND");
  return ground?.occupant ?? position.levels.find((level) => level.occupant)?.occupant ?? null;
}

export function positionOccupancy(position: YardPositionNode) {
  const occupied = position.levels.filter((level) => level.occupant).length;
  return {occupied, total: position.levels.length};
}
