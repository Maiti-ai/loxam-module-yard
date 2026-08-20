import {displayBlocks} from "@/features/yard-locations/display-blocks";
import {hasLivePlacementSlots} from "@/features/yard-locations/physical-registry";
import type {YardPositionNode, YardSnapshot} from "@/features/yard-locations/types";
import {isPositionFullyReservable} from "./plan";

export function occupiedLevelCount(position: YardPositionNode) {
  return position.levels.filter((level) => Boolean(level.occupant)).length;
}

export function isSnapshotPositionReservable(blockCode: string, position: YardPositionNode) {
  return isPositionFullyReservable({
    blockCode,
    reserved: Boolean(position.reservation),
    hasLiveSlots: hasLivePlacementSlots(position),
    occupiedCount: occupiedLevelCount(position),
  });
}

export function countReservableAPositions(snapshot: YardSnapshot) {
  let count = 0;
  for (const block of displayBlocks(snapshot)) {
    for (const row of block.rows) {
      for (const position of row.positions) {
        if (isSnapshotPositionReservable(block.code, position)) {
          count += 1;
        }
      }
    }
  }
  return count;
}

export function findBlockByCode(snapshot: YardSnapshot, code: string) {
  const wanted = code.trim().toUpperCase();
  return displayBlocks(snapshot).find((block) => block.code.trim().toUpperCase() === wanted) ?? null;
}
