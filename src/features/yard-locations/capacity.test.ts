import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {positionsCountForRow, SCHELLE_BLOCK_SPEC} from "../../config/yard-geometry";
import {MAX_STACK_HEIGHT} from "./stacking";
import {
  blockCapacity,
  formatOccupiedTotal,
  positionCapacity,
  yardCapacity,
  type CapacityBlock,
} from "./capacity";

function occupant(moduleId: string | null) {
  return moduleId ? {moduleId} : null;
}

function position(moduleIds: Array<string | null>) {
  const levels = ["GROUND", "LEVEL_1", "LEVEL_2"].map((level, index) => ({
    level,
    occupant: occupant(moduleIds[index] ?? null),
  }));
  return {levels};
}

function emptyPositions(count: number) {
  return Array.from({length: count}, () => position([null, null, null]));
}

function blockWithPositions(positions: ReturnType<typeof position>[]): CapacityBlock {
  return {rows: [{positions}]};
}

describe("yard module-slot capacity", () => {
  it("TEST 1: 10 physical positions and 0 modules => 30 / 0 / 30", () => {
    const capacity = blockCapacity(blockWithPositions(emptyPositions(10)));
    assert.equal(capacity.physicalPositions, 10);
    assert.equal(capacity.total, 30);
    assert.equal(capacity.occupied, 0);
    assert.equal(capacity.available, 30);
  });

  it("TEST 2: 10 physical positions and 7 modules => 30 / 7 / 23", () => {
    const positions = emptyPositions(10);
    positions[0] = position(["m1", "m2", "m3"]);
    positions[1] = position(["m4", "m5", null]);
    positions[2] = position(["m6", null, null]);
    positions[3] = position(["m7", null, null]);
    const capacity = blockCapacity(blockWithPositions(positions));
    assert.equal(capacity.total, 30);
    assert.equal(capacity.occupied, 7);
    assert.equal(capacity.available, 23);
  });

  it("TEST 3: placing a module increases occupied and decreases available", () => {
    const before = blockCapacity(blockWithPositions([position(["m1", null, null])]));
    const after = blockCapacity(blockWithPositions([position(["m1", "m2", null])]));
    assert.equal(after.occupied, before.occupied + 1);
    assert.equal(after.available, before.available - 1);
    assert.equal(after.total, before.total);
  });

  it("TEST 4: removing a module from the yard decreases occupied and increases available", () => {
    const before = blockCapacity(blockWithPositions([position(["m1", "m2", null])]));
    const after = blockCapacity(blockWithPositions([position(["m1", null, null])]));
    assert.equal(after.occupied, before.occupied - 1);
    assert.equal(after.available, before.available + 1);
    assert.equal(after.total, before.total);
  });

  it("TEST 5: a move between blocks keeps global totals and transfers one occupied slot", () => {
    const sourceBefore = blockWithPositions([
      position(["m1", null, null]),
      position([null, null, null]),
    ]);
    const destBefore = blockWithPositions([position([null, null, null])]);
    const sourceAfter = blockWithPositions([
      position([null, null, null]),
      position([null, null, null]),
    ]);
    const destAfter = blockWithPositions([position(["m1", null, null])]);

    const before = yardCapacity([sourceBefore, destBefore]);
    const after = yardCapacity([sourceAfter, destAfter]);

    assert.equal(after.total, before.total);
    assert.equal(after.occupied, before.occupied);
    assert.equal(after.available, before.available);
    assert.equal(blockCapacity(sourceAfter).occupied, blockCapacity(sourceBefore).occupied - 1);
    assert.equal(blockCapacity(destAfter).occupied, blockCapacity(destBefore).occupied + 1);
  });

  it("TEST 6: a position with 3 occupied levels contributes 3 occupied slots", () => {
    const capacity = positionCapacity(position(["a", "b", "c"]));
    assert.equal(capacity.physicalPositions, 1);
    assert.equal(capacity.total, MAX_STACK_HEIGHT);
    assert.equal(capacity.occupied, 3);
    assert.equal(capacity.available, 0);
  });

  it("TEST 7: dashboard total equals the sum of block capacities", () => {
    const blocks = [
      blockWithPositions(emptyPositions(4)),
      blockWithPositions(emptyPositions(6)),
      blockWithPositions([position(["a", "b", null])]),
    ];
    const yard = yardCapacity(blocks);
    const summedTotal = blocks.reduce((sum, block) => sum + blockCapacity(block).total, 0);
    assert.equal(yard.total, summedTotal);
    assert.equal(yard.total, 11 * 3);
  });

  it("TEST 8: sum of block occupied counts equals global occupied", () => {
    const blocks = [
      blockWithPositions([position(["a", "b", null]), position(["c", null, null])]),
      blockWithPositions([position(["d", "e", "f"])]),
    ];
    const yard = yardCapacity(blocks);
    const summedOccupied = blocks.reduce((sum, block) => sum + blockCapacity(block).occupied, 0);
    assert.equal(yard.occupied, summedOccupied);
    assert.equal(yard.occupied, 6);
  });

  it("TEST 9: historical movements are not counted, only current occupants", () => {
    const history = [{moduleId: "old", to: "A"}, {moduleId: "old", to: "B"}, {moduleId: "current", to: "A"}];
    const capacity = blockCapacity(
      blockWithPositions([position(["current", null, null]), position([null, null, null])]),
    );
    assert.equal(history.length, 3);
    assert.equal(capacity.occupied, 1);
    assert.equal(capacity.available, 5);
  });

  it("counts a physical position as 3 slots even when level rows are missing", () => {
    const capacity = positionCapacity({levels: []});
    assert.equal(capacity.total, 3);
    assert.equal(capacity.occupied, 0);
    assert.equal(capacity.available, 3);
  });

  it("never reports negative available or occupied above total", () => {
    const full = positionCapacity(position(["a", "b", "c"]));
    assert.ok(full.available >= 0);
    assert.ok(full.occupied <= full.total);
  });

  it("formats block counters as occupied / total", () => {
    assert.equal(formatOccupiedTotal(positionCapacity(position(["a", null, null]))), "1 / 3");
  });

  it("derives Schelle capacity from physical positions × 3, not a hardcoded total", () => {
    const byBlock = Object.fromEntries(
      Object.entries(SCHELLE_BLOCK_SPEC).map(([code, spec]) => {
        const physical = spec.pRows.reduce(
          (sum, row) => sum + positionsCountForRow(spec, row),
          0,
        );
        return [code, {physical, total: physical * MAX_STACK_HEIGHT}];
      }),
    );
    const physicalPositions = Object.values(byBlock).reduce((sum, item) => sum + item.physical, 0);
    const total = physicalPositions * MAX_STACK_HEIGHT;
    assert.equal(total, Object.values(byBlock).reduce((sum, item) => sum + item.total, 0));
    assert.ok(physicalPositions > 0);
    assert.equal(total, physicalPositions * 3);
  });
});

