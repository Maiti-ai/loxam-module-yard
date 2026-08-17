import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {StackLevel} from "../../types/database";
import {
  firstFreeLevel,
  hasInconsistentStack,
  isStackFull,
  MAX_STACK_HEIGHT,
  STACK_LEVELS_BOTTOM_UP,
  stackOccupancy,
} from "./stacking";
import {formatLevelCode, formatLevelLabel, formatCompactLocation} from "../../lib/format";

function cell(level: StackLevel, moduleId: string | null) {
  return {
    level,
    occupant: moduleId ? {moduleId} : null,
  };
}

function stack(
  ground: string | null,
  level1: string | null,
  level2: string | null,
) {
  return [cell("GROUND", ground), cell("LEVEL_1", level1), cell("LEVEL_2", level2)];
}

describe("maximum stack height", () => {
  it("allows exactly three levels and no fourth", () => {
    assert.equal(MAX_STACK_HEIGHT, 3);
    assert.deepEqual([...STACK_LEVELS_BOTTOM_UP], ["GROUND", "LEVEL_1", "LEVEL_2"]);
  });
});

describe("first-free-level bottom-up assignment", () => {
  it("TEST 1: 0 occupied -> assigns Niveau 0 (GROUND)", () => {
    assert.equal(firstFreeLevel(stack(null, null, null)), "GROUND");
  });

  it("TEST 2: Niveau 0 occupied -> assigns Niveau 1", () => {
    assert.equal(firstFreeLevel(stack("a", null, null)), "LEVEL_1");
  });

  it("TEST 3: Niveau 0 + Niveau 1 occupied -> assigns Niveau 2", () => {
    assert.equal(firstFreeLevel(stack("a", "b", null)), "LEVEL_2");
  });

  it("TEST 4: all 3 occupied -> placement rejected", () => {
    const levels = stack("a", "b", "c");
    assert.equal(firstFreeLevel(levels), null);
    assert.equal(isStackFull(levels), true);
    assert.deepEqual(stackOccupancy(levels), {occupied: 3, total: 3});
  });

  it("does not treat a position without slots as a full stack", () => {
    assert.equal(isStackFull([]), false);
    assert.equal(firstFreeLevel([]), null);
  });

  it("TEST 5: existing occupant is not overwritten", () => {
    const levels = stack("existing", null, null);
    assert.equal(firstFreeLevel(levels), "LEVEL_1");
    assert.equal(levels[0]?.occupant?.moduleId, "existing");
  });

  it("TEST 7: two placements cannot occupy the same level", () => {
    const first = firstFreeLevel(stack(null, null, null));
    assert.equal(first, "GROUND");
    const afterFirstCommit = stack("user-a", null, null);
    const second = firstFreeLevel(afterFirstCommit);
    assert.equal(second, "LEVEL_1");
    assert.notEqual(second, first);
    const afterSecondCommit = stack("user-a", "user-b", null);
    assert.equal(firstFreeLevel(afterSecondCommit), "LEVEL_2");
    assert.equal(firstFreeLevel(stack("user-a", "user-b", "user-c")), null);
  });

  it("never skips a free lower level (no floating modules)", () => {
    assert.equal(firstFreeLevel(stack(null, "floating", null)), "GROUND");
    assert.equal(firstFreeLevel(stack(null, null, "top")), "GROUND");
    assert.equal(firstFreeLevel(stack("a", null, "top")), "LEVEL_1");
  });

  it("ignores the moving module when it already occupies a slot in this stack", () => {
    assert.equal(firstFreeLevel(stack("self", null, null), {ignoreModuleId: "self"}), "GROUND");
    assert.equal(firstFreeLevel(stack("a", "self", null), {ignoreModuleId: "self"}), "LEVEL_1");
  });

  it("returns null when the position has no slots", () => {
    assert.equal(firstFreeLevel([]), null);
  });

  it("reports compact 0/3 through 3/3 occupancy", () => {
    assert.deepEqual(stackOccupancy(stack(null, null, null)), {occupied: 0, total: 3});
    assert.deepEqual(stackOccupancy(stack("a", null, null)), {occupied: 1, total: 3});
    assert.deepEqual(stackOccupancy(stack("a", "b", null)), {occupied: 2, total: 3});
    assert.deepEqual(stackOccupancy(stack("a", "b", "c")), {occupied: 3, total: 3});
  });
});

describe("inconsistent existing stacks", () => {
  it("detects a floating module without rewriting occupancy", () => {
    const levels = stack(null, "b", null);
    assert.equal(hasInconsistentStack(levels), true);
    assert.equal(levels[1]?.occupant?.moduleId, "b");
    assert.equal(firstFreeLevel(levels), "GROUND");
  });

  it("does not flag a valid bottom-up stack", () => {
    assert.equal(hasInconsistentStack(stack("a", null, null)), false);
    assert.equal(hasInconsistentStack(stack("a", "b", "c")), false);
  });
});

describe("visible level terminology", () => {
  it("TEST 8: visible UI says Niveau 0 instead of Gelijkvloers/GV/RDC", () => {
    for (const locale of ["nl", "fr"]) {
      assert.equal(formatLevelLabel("GROUND", locale), "Niveau 0");
      assert.equal(formatLevelCode("GROUND", locale), "0");
      assert.doesNotMatch(formatLevelLabel("GROUND", locale), /Gelijkvloers|GV|RDC|Rez-de-chaussée/i);
      assert.equal(formatLevelLabel("LEVEL_1", locale), "Niveau 1");
      assert.equal(formatLevelLabel("LEVEL_2", locale), "Niveau 2");
    }
  });

  it("TEST 6: history location strings include the assigned level", () => {
    const text = formatCompactLocation({
      blockCode: "D",
      rowCode: "P2",
      positionCode: "1",
      level: "LEVEL_1",
      locale: "fr",
    });
    assert.match(text, /D/);
    assert.match(text, /P2/);
    assert.match(text, /1/);
    assert.match(text, /Niveau 1/);
  });
});
