import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {displayBlocks} from "./display-blocks";
import {
  auditYardPositions,
  clickPayloadMatchesRegistry,
  formatCanonicalPositionCode,
  getPhysicalPosition,
  occupancyLookup,
  obsoleteSnapshotPositions,
  parseCanonicalPositionCode,
  physicalRegistry,
  registryCapacityByBlock,
  validateRegisteredDestination,
} from "./physical-registry";
import {destinationChoice} from "./stacking";
import type {YardBlockNode, YardLevelCell, YardSnapshot} from "./types";

function emptyLevels(positionId: string): YardLevelCell[] {
  return (["GROUND", "LEVEL_1", "LEVEL_2"] as const).map((level) => ({
    slotId: `${positionId}:${level}`,
    level,
    occupant: null,
  }));
}

function mvpSnapshot(): YardSnapshot {
  function row(block: string, code: string, positionCount: number) {
    return {
      id: `mvp-row:${block}:${code}`,
      code,
      sortOrder: Number(code),
      positions: Array.from({length: positionCount}, (_, index) => {
        const positionCode = String(index + 1).padStart(2, "0");
        const id = `mvp-pos:${block}:${code}:${positionCode}`;
        return {id, code: positionCode, sortOrder: index + 1, levels: emptyLevels(id)};
      }),
    };
  }
  return {
    blocks: [
      {
        id: "mvp-A",
        code: "A",
        name: "Block A",
        sortOrder: 1,
        isActive: true,
        productionZone: false,
        rows: [row("A", "1", 3), row("A", "2", 3)],
      },
      {
        id: "mvp-B",
        code: "B",
        name: "Block B",
        sortOrder: 2,
        isActive: true,
        productionZone: false,
        rows: [row("B", "1", 2), row("B", "2", 2)],
      },
    ],
    slotCount: 0,
    occupiedSlotCount: 0,
  };
}

function completeSnapshot(): YardSnapshot {
  const byBlock = new Map<string, YardBlockNode>();
  let n = 0;
  for (const entry of physicalRegistry()) {
    const block =
      byBlock.get(entry.blockCode) ??
      ({
        id: `block:${entry.blockCode}`,
        code: entry.blockCode,
        name: `Block ${entry.blockCode}`,
        sortOrder: byBlock.size,
        isActive: true,
        productionZone: entry.blockCode === "F",
        rows: [],
      } satisfies YardBlockNode);
    let row = block.rows.find((item) => item.code === entry.rowCode);
    if (!row) {
      row = {
        id: `row:${entry.blockCode}:${entry.rowCode}`,
        code: entry.rowCode,
        sortOrder: block.rows.length + 1,
        positions: [],
      };
      block.rows.push(row);
    }
    n += 1;
    const positionId = `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
    row.positions.push({
      id: positionId,
      code: entry.positionCode,
      sortOrder: entry.positionNumber,
      canonicalCode: entry.canonicalCode,
      maxLevels: entry.maxLevels,
      levels: stackLevels(positionId, entry.maxLevels),
    });
    byBlock.set(entry.blockCode, block);
  }
  return {blocks: [...byBlock.values()], slotCount: 0, occupiedSlotCount: 0};
}

function stackLevels(positionId: string, maxLevels: number): YardLevelCell[] {
  const all = emptyLevels(positionId);
  return maxLevels === 1 ? all.slice(0, 1) : all;
}

describe("canonical physical position registry", () => {
  it("uses one BLOCK-ROW-PP formatter and parser for every current map cell", () => {
    const codes = physicalRegistry().map((entry) => entry.canonicalCode);
    assert.equal(new Set(codes).size, codes.length);
    for (const entry of physicalRegistry()) {
      assert.equal(
        formatCanonicalPositionCode(entry.blockCode, entry.rowCode, entry.positionNumber),
        entry.canonicalCode,
      );
      assert.deepEqual(parseCanonicalPositionCode(entry.canonicalCode), {
        blockCode: entry.blockCode,
        rowCode: entry.rowCode,
        positionNumber: entry.positionNumber,
        positionCode: entry.positionCode,
        canonicalCode: entry.canonicalCode,
      });
      assert.equal(parseCanonicalPositionCode(entry.canonicalCode.toLowerCase())?.canonicalCode, entry.canonicalCode);
      assert.equal(
        parseCanonicalPositionCode(`visual:${entry.blockCode}:${entry.rowCode}:${entry.positionNumber}`)?.canonicalCode,
        entry.canonicalCode,
      );
    }
    assert.deepEqual(parseCanonicalPositionCode("D-1-4"), {
      blockCode: "D",
      rowCode: "P1",
      positionNumber: 4,
      positionCode: "04",
      canonicalCode: "D-P1-04",
    });
    assert.equal(parseCanonicalPositionCode("D-P1-04")?.canonicalCode, "D-P1-04");
  });

  it("registers every visible A/B/C/D/F cell with the correct stack height", () => {
    const byBlock = registryCapacityByBlock();
    assert.deepEqual(Object.fromEntries([...byBlock.entries()].map(([code, value]) => [code, value])), {
      A: {physical: 35, capacity: 105, maxLevels: 3},
      B: {physical: 54, capacity: 162, maxLevels: 3},
      C: {physical: 52, capacity: 156, maxLevels: 3},
      D: {physical: 46, capacity: 138, maxLevels: 3},
      F: {physical: 12, capacity: 12, maxLevels: 1},
    });
    assert.equal(physicalRegistry().length, 199);
    assert.equal(physicalRegistry().reduce((sum, entry) => sum + entry.maxLevels, 0), 573);
    for (const entry of physicalRegistry()) {
      assert.equal(entry.maxLevels, entry.blockCode === "F" ? 1 : 3, entry.canonicalCode);
      assert.equal(entry.active, true);
    }
  });

  it("fails if the visible map and the registry diverge", () => {
    const displayed = displayBlocks({blocks: [], slotCount: 0, occupiedSlotCount: 0});
    const visible = displayed.flatMap((block) =>
      block.rows.flatMap((row) =>
        row.positions.map((position) => ({
          block: block.code,
          row: row.code,
          n: Number(position.code),
          canonical: position.canonicalCode,
        })),
      ),
    );
    const registry = physicalRegistry();
    assert.equal(visible.length, registry.length);
    const visibleCodes = new Set(visible.map((item) => item.canonical));
    const registryCodes = new Set(registry.map((entry) => entry.canonicalCode));
    assert.deepEqual([...visibleCodes].sort(), [...registryCodes].sort());
    for (const item of visible) {
      assert.equal(item.canonical, formatCanonicalPositionCode(item.block, item.row, item.n));
      assert.ok(clickPayloadMatchesRegistry({
        blockCode: item.block,
        rowCode: item.row,
        position: {
          id: item.canonical ?? "",
          code: String(item.n).padStart(2, "0"),
          canonicalCode: item.canonical,
        },
      }), item.canonical);
    }
  });

  it("validates, resolves, and looks up occupancy for every registered position", () => {
    const empty = {blocks: [], slotCount: 0, occupiedSlotCount: 0} satisfies YardSnapshot;
    const complete = completeSnapshot();
    const counts: Record<string, number> = {A: 0, B: 0, C: 0, D: 0, F: 0};
    for (const entry of physicalRegistry()) {
      counts[entry.blockCode] += 1;
      assert.ok(getPhysicalPosition(entry.blockCode, entry.rowCode, entry.positionNumber));
      const parsed = parseCanonicalPositionCode(entry.canonicalCode);
      assert.ok(parsed);
      const emptyChoice = validateRegisteredDestination(parsed, empty, {blockCode: entry.blockCode});
      assert.equal(emptyChoice.ok, true, `${entry.canonicalCode} empty registry`);
      if (emptyChoice.ok) {
        assert.equal(emptyChoice.level, "GROUND");
      }
      const liveChoice = validateRegisteredDestination(parsed, complete, {blockCode: entry.blockCode});
      assert.equal(liveChoice.ok, true, `${entry.canonicalCode} complete registry`);
      const lookup = occupancyLookup(complete, entry.blockCode, entry.rowCode, entry.positionNumber);
      assert.ok(lookup?.live, `${entry.canonicalCode} occupancy`);
      assert.ok(lookup.levels.length > 0);
      assert.deepEqual(destinationChoice(lookup.levels, {blockCode: entry.blockCode}), {
        ok: true,
        level: "GROUND",
      });
    }
    assert.deepEqual(counts, {A: 35, B: 54, C: 52, D: 46, F: 12});
  });

  it("audits the current map: every visible cell is registered, clickable, and a valid destination", () => {
    const audit = auditYardPositions(mvpSnapshot());
    assert.equal(audit.duplicateRegistry.length, 0);
    assert.equal(audit.obsolete.length, 0);
    assert.equal(audit.totals.physical, 199);
    assert.equal(audit.totals.capacity, 573);
    assert.equal(audit.totals.placementValid, 199);
    assert.equal(audit.rows.every((row) => row.visibleOnMap && row.inRegistry && row.clickable && row.placementValid), true);
    assert.equal(audit.rows.filter((row) => row.block === "D").length, 46);
    assert.equal(audit.missingFromSnapshot.length, 199 - 10);
    const dFirst = audit.rows.find((row) => row.positionCode === "D-P1-01");
    assert.deepEqual(dFirst, {
      block: "D",
      row: "P1",
      position: 1,
      positionCode: "D-P1-01",
      maxLevels: 3,
      visibleOnMap: true,
      inRegistry: true,
      inSnapshot: false,
      clickable: true,
      placementValid: true,
    });
    const aFirst = audit.rows.find((row) => row.positionCode === "A-P1-01");
    assert.equal(aFirst?.inSnapshot, true);
    assert.equal(obsoleteSnapshotPositions(mvpSnapshot()).length, 0);
  });

  it("rejects identities that are not on the current map", () => {
    const unknown = parseCanonicalPositionCode("Z-P9-99");
    assert.ok(unknown);
    const result = validateRegisteredDestination(unknown, mvpSnapshot());
    assert.deepEqual(result, {ok: false, reason: "unconfigured", errorCode: "SLOT_MISSING"});
  });
});
