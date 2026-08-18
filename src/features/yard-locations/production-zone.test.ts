import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {BLOCK_MAX_STACK_LEVELS, maxStackLevelsForBlock} from "../../config/yard";
import {positionsCountForRow, SCHELLE_BLOCK_SPEC} from "../../config/yard-geometry";
import {blockCapacity, positionCapacity, yardCapacity} from "./capacity";
import {displayBlocks} from "./display-blocks";
import {displayLevelsForBlock, destinationChoice, firstFreeLevel, hasInconsistentStack} from "./stacking";
import type {YardSnapshot} from "./types";

const emptySnapshot: YardSnapshot = {blocks: [], slotCount: 0, occupiedSlotCount: 0};

function cell(level: "GROUND" | "LEVEL_1" | "LEVEL_2", moduleId: string | null) {
  return {slotId: level, level, occupant: moduleId ? {moduleId} : null};
}

function emptyLevels() {
  return [cell("GROUND", null), cell("LEVEL_1", null), cell("LEVEL_2", null)];
}

function physicalCount(code: string) {
  const spec = SCHELLE_BLOCK_SPEC[code];
  assert.ok(spec);
  return spec.pRows.reduce((sum, row) => sum + positionsCountForRow(spec, row), 0);
}

describe("production zone F is non-stackable", () => {
  it("configures A/B/C/D as 3-high and F as 1-high", () => {
    assert.equal(BLOCK_MAX_STACK_LEVELS.A, 3);
    assert.equal(BLOCK_MAX_STACK_LEVELS.B, 3);
    assert.equal(BLOCK_MAX_STACK_LEVELS.C, 3);
    assert.equal(BLOCK_MAX_STACK_LEVELS.D, 3);
    assert.equal(BLOCK_MAX_STACK_LEVELS.F, 1);
    assert.equal(maxStackLevelsForBlock("F"), 1);
    assert.equal(maxStackLevelsForBlock("D"), 3);
  });

  it("TEST 1: F has 12 physical positions and total capacity 12", () => {
    const blocks = displayBlocks(emptySnapshot);
    const blockF = blocks.find((block) => block.code === "F");
    assert.ok(blockF);
    const physical = blockF.rows.flatMap((row) => row.positions).length;
    assert.equal(physical, 12);
    const capacity = blockCapacity(blockF);
    assert.equal(capacity.physicalPositions, 12);
    assert.equal(capacity.total, 12);
    assert.equal(capacity.occupied, 0);
    assert.equal(capacity.available, 12);
  });

  it("TEST 2: a normal block with 10 physical positions has capacity 30", () => {
    const capacity = blockCapacity({
      code: "D",
      rows: [{positions: Array.from({length: 10}, () => ({levels: []}))}],
    });
    assert.equal(capacity.physicalPositions, 10);
    assert.equal(capacity.total, 30);
  });

  it("TEST 3: empty F position can receive a module on Niveau 0 only", () => {
    const levels = emptyLevels();
    assert.deepEqual(destinationChoice(levels, {blockCode: "F"}), {ok: true, level: "GROUND"});
    assert.equal(firstFreeLevel(levels, {blockCode: "F"}), "GROUND");
  });

  it("TEST 4 / TEST 7: occupied F position rejects a second module and does not assign Niveau 1/2", () => {
    const levels = [cell("GROUND", "2000"), cell("LEVEL_1", null), cell("LEVEL_2", null)];
    assert.deepEqual(destinationChoice(levels, {blockCode: "F"}), {ok: false, reason: "full"});
    assert.equal(firstFreeLevel(levels, {blockCode: "F"}), null);
    assert.notEqual(firstFreeLevel(levels, {blockCode: "F"}), "LEVEL_1");
    assert.notEqual(firstFreeLevel(levels, {blockCode: "F"}), "LEVEL_2");
  });

  it("TEST 5: F position detail uses a single slot, not Niveau 0/1/2", () => {
    assert.deepEqual([...displayLevelsForBlock("F")], ["GROUND"]);
    const capacity = positionCapacity({levels: []}, {blockCode: "F"});
    assert.equal(capacity.total, 1);
    assert.equal(capacity.occupied, 0);
    assert.equal(capacity.available, 1);
  });

  it("TEST 6: D position detail still shows Niveau 0/1/2", () => {
    assert.deepEqual([...displayLevelsForBlock("D")], ["GROUND", "LEVEL_1", "LEVEL_2"]);
    const capacity = positionCapacity({levels: []}, {blockCode: "D"});
    assert.equal(capacity.total, 3);
  });

  it("TEST 8: dashboard capacity uses F ×1 and A/B/C/D ×3", () => {
    const expected =
      physicalCount("A") * 3 +
      physicalCount("B") * 3 +
      physicalCount("C") * 3 +
      physicalCount("D") * 3 +
      physicalCount("F") * 1;
    const capacity = yardCapacity(displayBlocks(emptySnapshot));
    assert.equal(capacity.total, expected);
    assert.equal(capacity.total, 573);
  });

  it("TEST 9: F corner counter max is 12, not 36", () => {
    const capacity = blockCapacity(displayBlocks(emptySnapshot).find((block) => block.code === "F")!);
    assert.equal(capacity.total, 12);
    assert.notEqual(capacity.total, 36);
    assert.equal(`${capacity.occupied} / ${capacity.total}`, "0 / 12");
  });

  it("TEST 10: moving D → F frees one stacked slot and consumes one production slot", () => {
    const dBefore = {
      code: "D",
      rows: [{positions: [{levels: [cell("GROUND", "m1"), cell("LEVEL_1", null), cell("LEVEL_2", null)]}]}],
    };
    const fBefore = {
      code: "F",
      rows: [{positions: [{levels: emptyLevels()}]}],
    };
    const dAfter = {
      code: "D",
      rows: [{positions: [{levels: emptyLevels()}]}],
    };
    const fAfter = {
      code: "F",
      rows: [{positions: [{levels: [cell("GROUND", "m1"), cell("LEVEL_1", null), cell("LEVEL_2", null)]}]}],
    };

    const before = yardCapacity([dBefore, fBefore]);
    const after = yardCapacity([dAfter, fAfter]);
    assert.equal(blockCapacity(dBefore).total, 3);
    assert.equal(blockCapacity(fBefore).total, 1);
    assert.equal(blockCapacity(dAfter).occupied, blockCapacity(dBefore).occupied - 1);
    assert.equal(blockCapacity(fAfter).occupied, blockCapacity(fBefore).occupied + 1);
    assert.equal(after.occupied, before.occupied);
    assert.equal(after.total, before.total);
  });

  it("reports Niveau 1/2 occupancy in F as inconsistent without deleting it", () => {
    const levels = [cell("GROUND", null), cell("LEVEL_1", "legacy"), cell("LEVEL_2", null)];
    assert.equal(hasInconsistentStack(levels, {blockCode: "F"}), true);
    assert.equal(levels[1]?.occupant?.moduleId, "legacy");
    assert.deepEqual(destinationChoice(levels, {blockCode: "F"}), {ok: false, reason: "full"});
  });
});
