import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {displayBlocks} from "./display-blocks";
import {destinationChoice, firstFreeLevel} from "./stacking";
import {positionCapacity} from "./capacity";
import type {YardSnapshot} from "./types";

const emptySnapshot: YardSnapshot = {blocks: [], slotCount: 0, occupiedSlotCount: 0};

function cell(level: "GROUND" | "LEVEL_1" | "LEVEL_2", moduleId: string | null) {
  return {slotId: level, level, occupant: moduleId ? {moduleId} : null};
}

describe("clickable physical positions", () => {
  it("TEST 9: every visible A/B/C/D/F position is a selectable target", () => {
    const blocks = displayBlocks(emptySnapshot);
    const codes = blocks.map((block) => block.code).sort();
    assert.deepEqual(codes, ["A", "B", "C", "D", "F"]);
    const expected: Record<string, number> = {A: 35, B: 54, C: 52, D: 46, F: 12};
    let total = 0;
    for (const block of blocks) {
      const positions = block.rows.flatMap((row) => row.positions);
      assert.ok(positions.length > 0, `block ${block.code} has no positions`);
      assert.equal(new Set(positions.map((item) => item.id)).size, positions.length);
      assert.equal(positions.length, expected[block.code], `block ${block.code} position count`);
      total += positions.length;
    }
    assert.equal(total, 199);
  });

  it("TEST 1: empty position reports 0/3 occupied", () => {
    const capacity = positionCapacity({levels: []});
    assert.equal(capacity.occupied, 0);
    assert.equal(capacity.total, 3);
    assert.equal(capacity.available, 3);
  });

  it("TEST 2: one module is shown on the correct level", () => {
    const levels = [cell("GROUND", "2000"), cell("LEVEL_1", null), cell("LEVEL_2", null)];
    assert.equal(levels.find((item) => item.level === "GROUND")?.occupant?.moduleId, "2000");
    assert.equal(levels.find((item) => item.level === "LEVEL_1")?.occupant, null);
  });

  it("TEST 4: move mode empty position auto-selects Niveau 0", () => {
    const levels = [cell("GROUND", null), cell("LEVEL_1", null), cell("LEVEL_2", null)];
    assert.deepEqual(destinationChoice(levels), {ok: true, level: "GROUND"});
  });

  it("TEST 5: move mode with Niveau 0 occupied auto-selects Niveau 1", () => {
    const levels = [cell("GROUND", "a"), cell("LEVEL_1", null), cell("LEVEL_2", null)];
    assert.deepEqual(destinationChoice(levels), {ok: true, level: "LEVEL_1"});
  });

  it("TEST 6: move mode with 0+1 occupied auto-selects Niveau 2", () => {
    const levels = [cell("GROUND", "a"), cell("LEVEL_1", "b"), cell("LEVEL_2", null)];
    assert.deepEqual(destinationChoice(levels), {ok: true, level: "LEVEL_2"});
  });

  it("TEST 7: move mode 3/3 occupied is rejected as full", () => {
    const levels = [cell("GROUND", "a"), cell("LEVEL_1", "b"), cell("LEVEL_2", "c")];
    assert.deepEqual(destinationChoice(levels), {ok: false, reason: "full"});
    assert.equal(firstFreeLevel(levels), null);
    const capacity = positionCapacity({
      levels: levels.map((item) => ({occupant: item.occupant ? {moduleId: item.occupant.moduleId} : null})),
    });
    assert.equal(capacity.occupied, 3);
    assert.equal(capacity.available, 0);
  });

  it("unconfigured visual position cannot be a move destination", () => {
    assert.deepEqual(destinationChoice([]), {ok: false, reason: "unconfigured"});
  });
});
