import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {maxStackLevelsForBlock} from "../../config/yard";
import {
  positionsCountForRow,
  SCHELLE_BLOCK_SPEC,
  schellePhysicalLayout,
} from "../../config/yard-geometry";
import {blockCapacity, yardCapacity} from "./capacity";
import {displayBlocks} from "./display-blocks";
import {destinationChoice} from "./stacking";
import type {YardBlockNode, YardLevelCell, YardSnapshot} from "./types";

function emptyLevels(positionId: string): YardLevelCell[] {
  return (["GROUND", "LEVEL_1", "LEVEL_2"] as const).map((level) => ({
    slotId: `${positionId}:${level}`,
    level,
    occupant: null,
  }));
}

function snapshotFromLayout(): YardSnapshot {
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
    const positionId = `pos:${cell.blockCode}:${cell.rowCode}:${cell.positionCode}`;
    row.positions.push({
      id: positionId,
      code: cell.positionCode,
      sortOrder: cell.positionNumber,
      levels: emptyLevels(positionId),
    });
    byBlock.set(cell.blockCode, block);
  }
  const blocks = [...byBlock.values()];
  return {blocks, slotCount: 0, occupiedSlotCount: 0};
}

function mvpSnapshot(): YardSnapshot {
  function row(
    block: string,
    code: string,
    positionCount: number,
  ): YardBlockNode["rows"][number] {
    return {
      id: `mvp-row:${block}:${code}`,
      code,
      sortOrder: Number(code),
      positions: Array.from({length: positionCount}, (_, index) => {
        const positionCode = String(index + 1).padStart(2, "0");
        const id = `mvp-pos:${block}:${code}:${positionCode}`;
        return {
          id,
          code: positionCode,
          sortOrder: index + 1,
          levels: emptyLevels(id),
        };
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

describe("Schelle physical position registry", () => {
  it("lists every current visible A/B/C/D/F cell once", () => {
    const layout = schellePhysicalLayout();
    const byBlock = Object.fromEntries(
      Object.keys(SCHELLE_BLOCK_SPEC).map((code) => [
        code,
        layout.filter((cell) => cell.blockCode === code).length,
      ]),
    );
    assert.deepEqual(byBlock, {C: 52, B: 54, A: 35, D: 46, F: 12});
    assert.equal(layout.length, 199);
    assert.equal(new Set(layout.map((cell) => `${cell.blockCode}:${cell.rowCode}:${cell.positionNumber}`)).size, 199);
  });

  it("includes the first and last position of every current row", () => {
    const keys = new Set(
      schellePhysicalLayout().map((cell) => `${cell.blockCode}:${cell.rowCode}:${cell.positionNumber}`),
    );
    for (const [blockCode, spec] of Object.entries(SCHELLE_BLOCK_SPEC)) {
      for (const rowCode of spec.pRows) {
        const last = positionsCountForRow(spec, rowCode);
        assert.ok(keys.has(`${blockCode}:${rowCode}:1`), `${blockCode} ${rowCode} position 1`);
        assert.ok(keys.has(`${blockCode}:${rowCode}:${last}`), `${blockCode} ${rowCode} position ${last}`);
      }
    }
  });

  it("does not keep the early MVP two-row A/B limit in the spec", () => {
    assert.deepEqual([...SCHELLE_BLOCK_SPEC.A.pRows], ["P1", "P2", "P3", "P4", "P5", "P6", "P7"]);
    assert.deepEqual([...SCHELLE_BLOCK_SPEC.B.pRows], ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]);
    assert.equal(SCHELLE_BLOCK_SPEC.A.pRows.length > 2, true);
    assert.equal(SCHELLE_BLOCK_SPEC.B.pRows.length > 2, true);
  });

  it("maps a complete registry onto the map with real position ids, not visual placeholders", () => {
    const displayed = displayBlocks(snapshotFromLayout());
    for (const block of displayed) {
      for (const row of block.rows) {
        assert.equal(row.id.startsWith("visual:"), false, `${block.code} ${row.code} row id`);
        for (const position of row.positions) {
          assert.equal(position.id.startsWith("visual:"), false, `${block.code} ${row.code} ${position.code}`);
          assert.equal(position.levels.length, 3);
        }
      }
    }
  });

  it("shows why the MVP snapshot left later A/B rows and C/D/F unusable", () => {
    const displayed = displayBlocks(mvpSnapshot());
    const visual = displayed.flatMap((block) =>
      block.rows.flatMap((row) =>
        row.positions.filter((position) => position.id.startsWith("visual:")),
      ),
    );
    assert.ok(visual.length > 0);
    const byBlock = Object.fromEntries(
      displayed.map((block) => [
        block.code,
        block.rows.flatMap((row) => row.positions).filter((position) => position.id.startsWith("visual:")).length,
      ]),
    );
    assert.equal(byBlock.A, 35 - 6);
    assert.equal(byBlock.B, 54 - 4);
    assert.equal(byBlock.C, 52);
    assert.equal(byBlock.D, 46);
    assert.equal(byBlock.F, 12);
  });

  it("makes first and last cells of every row selectable for placement after the registry is complete", () => {
    const displayed = displayBlocks(snapshotFromLayout());
    for (const block of displayed) {
      for (const row of block.rows) {
        const first = row.positions[0];
        const last = row.positions.at(-1);
        assert.ok(first && last);
        assert.deepEqual(destinationChoice(first.levels, {blockCode: block.code}), {
          ok: true,
          level: "GROUND",
        });
        assert.deepEqual(destinationChoice(last.levels, {blockCode: block.code}), {
          ok: true,
          level: "GROUND",
        });
        assert.equal(first.id.startsWith("visual:"), false);
        assert.equal(last.id.startsWith("visual:"), false);
      }
    }
  });

  it("keeps D at 46 physical / 138 stacked and F at 12 non-stackable", () => {
    const displayed = displayBlocks(snapshotFromLayout());
    const blockD = displayed.find((block) => block.code === "D");
    const blockF = displayed.find((block) => block.code === "F");
    assert.ok(blockD && blockF);
    assert.equal(blockCapacity(blockD).physicalPositions, 46);
    assert.equal(blockCapacity(blockD).total, 138);
    assert.equal(maxStackLevelsForBlock("D"), 3);
    assert.equal(blockCapacity(blockF).physicalPositions, 12);
    assert.equal(blockCapacity(blockF).total, 12);
    assert.equal(maxStackLevelsForBlock("F"), 1);
    const yard = yardCapacity(displayed);
    assert.equal(yard.physicalPositions, 199);
    assert.equal(yard.total, 573);
  });
});
