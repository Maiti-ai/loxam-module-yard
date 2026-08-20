import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  buildDispatchSlotPlan,
  isPositionFullyReservable,
  requiredGroundPositions,
} from "./plan";

describe("dispatch ground-position math", () => {
  it("reserves one A ground position per three modules", () => {
    assert.equal(requiredGroundPositions(1), 1);
    assert.equal(requiredGroundPositions(2), 1);
    assert.equal(requiredGroundPositions(3), 1);
    assert.equal(requiredGroundPositions(4), 2);
    assert.equal(requiredGroundPositions(5), 2);
    assert.equal(requiredGroundPositions(6), 2);
    assert.equal(requiredGroundPositions(7), 3);
    assert.equal(requiredGroundPositions(9), 3);
    assert.equal(requiredGroundPositions(10), 4);
    assert.equal(requiredGroundPositions(0), 0);
  });

  it("fills each reserved A position bottom-up through niveau 2", () => {
    const six = buildDispatchSlotPlan(6);
    assert.equal(six.length, 6);
    assert.deepEqual(
      six.map((slot) => [slot.sequenceNumber, slot.positionOrder, slot.levelNumber, slot.level]),
      [
        [1, 1, 0, "GROUND"],
        [2, 1, 1, "LEVEL_1"],
        [3, 1, 2, "LEVEL_2"],
        [4, 2, 0, "GROUND"],
        [5, 2, 1, "LEVEL_1"],
        [6, 2, 2, "LEVEL_2"],
      ],
    );

    const five = buildDispatchSlotPlan(5);
    assert.equal(five.at(-1)?.positionOrder, 2);
    assert.equal(five.at(-1)?.level, "LEVEL_1");
    assert.equal(five.filter((slot) => slot.positionOrder === 2).length, 2);
  });

  it("only allows fully empty unreserved A positions", () => {
    assert.equal(
      isPositionFullyReservable({
        blockCode: "A",
        reserved: false,
        hasLiveSlots: true,
        occupiedCount: 0,
      }),
      true,
    );
    assert.equal(
      isPositionFullyReservable({
        blockCode: "B",
        reserved: false,
        hasLiveSlots: true,
        occupiedCount: 0,
      }),
      false,
    );
    assert.equal(
      isPositionFullyReservable({
        blockCode: "A",
        reserved: true,
        hasLiveSlots: true,
        occupiedCount: 0,
      }),
      false,
    );
    assert.equal(
      isPositionFullyReservable({
        blockCode: "A",
        reserved: false,
        hasLiveSlots: true,
        occupiedCount: 1,
      }),
      false,
    );
  });
});
