import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {isSnapshotPositionReservable, occupiedLevelCount} from "./availability";
import type {YardPositionNode} from "@/features/yard-locations/types";

const liveId = "11111111-1111-4111-8111-111111111111";
const slotA = "22222222-2222-4222-8222-222222222222";
const slotB = "33333333-3333-4333-8333-333333333333";
const slotC = "44444444-4444-4444-8444-444444444444";

function emptyA(): YardPositionNode {
  return {
    id: liveId,
    code: "4",
    sortOrder: 4,
    levels: [
      {slotId: slotA, level: "GROUND", occupant: null},
      {slotId: slotB, level: "LEVEL_1", occupant: null},
      {slotId: slotC, level: "LEVEL_2", occupant: null},
    ],
  };
}

describe("dispatch availability overlay", () => {
  it("accepts a fully empty live A position", () => {
    const position = emptyA();
    assert.equal(occupiedLevelCount(position), 0);
    assert.equal(isSnapshotPositionReservable("A", position), true);
  });

  it("rejects reserved, occupied, or non-A positions", () => {
    const reserved = emptyA();
    reserved.reservation = {
      dossierId: "d1",
      dossierNumber: "2026-4587",
      customerName: "PORR",
      siteLocation: "Peutie",
      placedCount: 0,
      totalModules: 6,
      status: "ACTIVE",
    };
    assert.equal(isSnapshotPositionReservable("A", reserved), false);
    assert.equal(isSnapshotPositionReservable("B", emptyA()), false);

    const occupied = emptyA();
    occupied.levels[0] = {
      ...occupied.levels[0],
      occupant: {
        moduleId: "m1",
        moduleNumber: "2000",
        status: "AVAILABLE",
        moduleTypeCode: "6x3",
        lengthM: 6,
        widthM: 3,
      },
    };
    assert.equal(occupiedLevelCount(occupied), 1);
    assert.equal(isSnapshotPositionReservable("A", occupied), false);
  });
});
