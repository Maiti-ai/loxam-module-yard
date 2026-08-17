import {isProductionBlock} from "@/config/yard";
import {layoutSpecForBlock, positionsCountForRow, SCHELLE_YARD} from "@/config/yard-geometry";
import {formatRowCode} from "@/lib/format";
import type {YardBlockNode, YardPositionNode, YardRowNode, YardSnapshot} from "./types";

function rowKey(code: string) {
  return formatRowCode(code).toUpperCase();
}

function positionKey(code: string) {
  const numeric = Number(code);
  return Number.isFinite(numeric) ? String(numeric) : code.trim();
}

function emptyPosition(blockCode: string, rowCode: string, index: number): YardPositionNode {
  return {
    id: `visual:${blockCode}:${rowCode}:${index + 1}`,
    code: String(index + 1).padStart(2, "0"),
    sortOrder: index + 1,
    levels: [],
  };
}

/** Plan grid from the spec, with live occupancy overlaid when the DB has matching cells. */
export function displayBlocks(snapshot: YardSnapshot): YardBlockNode[] {
  const liveByCode = new Map(
    snapshot.blocks
      .filter((block) => block.isActive)
      .map((block) => [block.code.trim().toUpperCase(), block]),
  );

  return Object.keys(SCHELLE_YARD.blocks).map((code, sortOrder) => {
    const spec = layoutSpecForBlock(code);
    const live = liveByCode.get(code);
    if (!spec) {
      return (
        live ?? {
          id: `visual:${code}`,
          code,
          name: `Block ${code}`,
          sortOrder,
          isActive: true,
          productionZone: isProductionBlock(code),
          rows: [],
        }
      );
    }

    const liveRows = new Map((live?.rows ?? []).map((row) => [rowKey(row.code), row]));
    const rows: YardRowNode[] = spec.pRows.map((pCode, rowIndex) => {
      const liveRow = liveRows.get(pCode);
      const livePositions = new Map(
        (liveRow?.positions ?? []).map((position) => [positionKey(position.code), position]),
      );
      const positions = Array.from({length: positionsCountForRow(spec, pCode)}, (_, index) => {
        return livePositions.get(String(index + 1)) ?? emptyPosition(code, pCode, index);
      });
      return {
        id: liveRow?.id ?? `visual:${code}:${pCode}`,
        code: liveRow?.code ?? pCode,
        sortOrder: rowIndex + 1,
        positions,
      };
    });

    return {
      id: live?.id ?? `visual:${code}`,
      code,
      name: live?.name ?? `Block ${code}`,
      sortOrder: live?.sortOrder ?? sortOrder,
      isActive: true,
      productionZone: isProductionBlock(code) || Boolean(live?.productionZone),
      rows,
    };
  });
}
