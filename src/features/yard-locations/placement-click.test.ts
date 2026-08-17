import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {schellePhysicalLayout} from "../../config/yard-geometry";
import {displayBlocks} from "./display-blocks";
import {destinationChoice} from "./stacking";
import {
  REQUIRED_PLACEMENT_CELLS,
  choosePlacementDestination,
  evaluatePlacementClick,
  findDisplayedCell,
  findLivePosition,
  parseVisualPositionId,
  placementClickPayload,
} from "./resolve-position";
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
  for (const cell of schellePhysicalLayout()) {
    const block =
      byBlock.get(cell.blockCode) ??
      ({
        id: `block:${cell.blockCode}`,
        code: cell.blockCode,
        name: `Block ${cell.blockCode}`,
        sortOrder: byBlock.size,
        isActive: true,
        productionZone: cell.blockCode === "F",
        rows: [],
      } satisfies YardBlockNode);
    let row = block.rows.find((item) => item.code === cell.rowCode);
    if (!row) {
      row = {
        id: `row:${cell.blockCode}:${cell.rowCode}`,
        code: cell.rowCode,
        sortOrder: block.rows.length + 1,
        positions: [],
      };
      block.rows.push(row);
    }
    const positionId = `11111111-1111-1111-1111-${cell.blockCode}${cell.rowCode}${cell.positionCode}`.slice(0, 36);
    row.positions.push({
      id: `${cell.blockCode}-${cell.rowCode}-${cell.positionCode}`,
      code: cell.positionCode,
      sortOrder: cell.positionNumber,
      levels: emptyLevels(positionId),
    });
    byBlock.set(cell.blockCode, block);
  }
  return {blocks: [...byBlock.values()], slotCount: 0, occupiedSlotCount: 0};
}

describe("placement click runtime: SLOT_MISSING", () => {
  it("WORKING OLD A P1 position 1 has live levels and does not emit SLOT_MISSING", () => {
    const displayed = displayBlocks(mvpSnapshot());
    const blockA = displayed.find((block) => block.code === "A");
    const row = blockA?.rows.find((item) => item.code === "1" || item.code === "P1");
    const position = row?.positions[0];
    assert.ok(blockA && row && position);
    const payload = placementClickPayload({
      blockCode: blockA.code,
      rowCode: row.code,
      position,
    });
    assert.equal(payload.blockCode, "A");
    assert.equal(payload.rowCode, "P1");
    assert.equal(payload.positionNumber, 1);
    assert.equal(payload.canonicalCode, "A-P1-01");
    assert.equal(payload.registered, true);
    assert.equal(payload.positionId.startsWith("visual:"), false);
    assert.equal(payload.levelsLength, 3);
    const preResolve = evaluatePlacementClick(position, {blockCode: "A"});
    assert.equal(preResolve.ok, true);
    if (preResolve.ok) {
      assert.equal(preResolve.level, "GROUND");
    }
    assert.deepEqual(destinationChoice(position.levels, {blockCode: "A"}), {
      ok: true,
      level: "GROUND",
    });
  });

  it("NEW D P1 position 1 is a canonical registry cell D-P1-01, not SLOT_MISSING", () => {
    const displayed = displayBlocks(mvpSnapshot());
    const blockD = displayed.find((block) => block.code === "D");
    const row = blockD?.rows[0];
    const position = row?.positions[0];
    assert.ok(blockD && row && position);
    const payload = placementClickPayload({
      blockCode: blockD.code,
      rowCode: row.code,
      position,
    });
    assert.equal(payload.blockCode, "D");
    assert.equal(payload.rowCode, "P1");
    assert.equal(payload.positionNumber, 1);
    assert.equal(payload.canonicalCode, "D-P1-01");
    assert.equal(payload.positionId, "D-P1-01");
    assert.equal(payload.registered, true);
    assert.equal(payload.levelsLength, 3);
    const click = evaluatePlacementClick(position, {blockCode: "D"});
    assert.equal(click.ok, true);
    if (click.ok) {
      assert.equal(click.level, "GROUND");
    }
    assert.deepEqual(parseVisualPositionId(payload.positionId), {
      blockCode: "D",
      rowCode: "P1",
      positionNumber: 1,
      positionCode: "01",
      canonicalCode: "D-P1-01",
    });
  });

  it("after the registry exists, the same D P1 position 1 resolves like the old A cell", () => {
    const displayed = displayBlocks(completeSnapshot());
    const live = findLivePosition(completeSnapshot(), "D", "P1", 1);
    assert.ok(live);
    assert.deepEqual(destinationChoice(live.levels, {blockCode: "D"}), {ok: true, level: "GROUND"});
    const row1 = displayed.find((block) => block.code === "D")?.rows[0];
    assert.equal(row1?.positions[0]?.id.startsWith("visual:"), false);
    assert.equal(row1?.positions.at(-1)?.code, "10");
    assert.equal(row1?.positions.at(-1)?.id.startsWith("visual:"), false);
  });

  it("required placement cells are spec cells, not decorative", () => {
    const snapshot = completeSnapshot();
    for (const [blockCode, rowCode, positionNumber] of REQUIRED_PLACEMENT_CELLS) {
      const live = findLivePosition(snapshot, blockCode, rowCode, positionNumber);
      assert.ok(live, `${blockCode} ${rowCode} ${positionNumber} missing`);
      assert.deepEqual(destinationChoice(live.levels, {blockCode}), {ok: true, level: "GROUND"});
    }
  });

  it("move wizard flow: overlay click + registry resolve + first free level for required cells", () => {
    const overlay = mvpSnapshot();
    const registry = completeSnapshot();
    for (const [blockCode, rowCode, positionNumber] of REQUIRED_PLACEMENT_CELLS) {
      const displayed = findDisplayedCell(overlay, blockCode, rowCode, positionNumber);
      assert.ok(displayed, `map cell missing ${blockCode} ${rowCode} ${positionNumber}`);
      const payload = placementClickPayload({
        blockCode,
        rowCode,
        position: displayed,
      });
      const resolved = choosePlacementDestination(
        displayed,
        registry,
        blockCode,
        rowCode,
        {blockCode},
      );
      assert.equal(
        resolved.ok,
        true,
        `${blockCode} ${rowCode} ${positionNumber} payload=${JSON.stringify(payload)} result=${JSON.stringify(resolved)}`,
      );
      if (!resolved.ok) {
        continue;
      }
      assert.equal(resolved.level, "GROUND");
      assert.equal(resolved.position.id.startsWith("visual:"), false);
      assert.ok(resolved.position.levels.length > 0);
      assert.deepEqual(destinationChoice(resolved.position.levels, {blockCode}), {
        ok: true,
        level: "GROUND",
      });
    }
  });

  it("unknown identities still map to SLOT_MISSING", () => {
    const displayed = findDisplayedCell(mvpSnapshot(), "D", "P1", 1);
    assert.ok(displayed);
    const unresolved = choosePlacementDestination(
      {id: "Z-P9-99", code: "99", sortOrder: 99, levels: []},
      mvpSnapshot(),
      "Z",
      "P9",
      {blockCode: "Z"},
    );
    assert.deepEqual(unresolved, {
      ok: false,
      reason: "unconfigured",
      errorCode: "SLOT_MISSING",
    });
    const known = choosePlacementDestination(displayed, mvpSnapshot(), "D", "P1", {blockCode: "D"});
    assert.equal(known.ok, true);
  });
});
