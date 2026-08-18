import {isProductionBlock} from "@/config/yard";
import {SCHELLE_YARD} from "@/config/yard-geometry";
import {formatRowCode} from "@/lib/format";
import {
  getPhysicalPosition,
  physicalRegistry,
  registeredPositionNode,
} from "./physical-registry";
import type {YardBlockNode, YardRowNode, YardSnapshot} from "./types";

function rowKey(code: string) {
  return formatRowCode(code).toUpperCase();
}

function positionKey(code: string) {
  const numeric = Number(code);
  return Number.isFinite(numeric) ? String(numeric) : code.trim();
}

/** Plan grid from the canonical registry, with live occupancy overlaid. */
export function displayBlocks(snapshot: YardSnapshot): YardBlockNode[] {
  const liveByCode = new Map(
    snapshot.blocks
      .filter((block) => block.isActive)
      .map((block) => [block.code.trim().toUpperCase(), block]),
  );

  const entriesByBlock = new Map<string, ReturnType<typeof physicalRegistry>>();
  for (const entry of physicalRegistry()) {
    const list = entriesByBlock.get(entry.blockCode) ?? [];
    list.push(entry);
    entriesByBlock.set(entry.blockCode, list);
  }

  return Object.keys(SCHELLE_YARD.blocks).map((code, sortOrder) => {
    const live = liveByCode.get(code);
    const entries = entriesByBlock.get(code) ?? [];
    if (entries.length === 0) {
      return (
        live ?? {
          id: `registry:${code}`,
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
    const rowCodes = [...new Set(entries.map((entry) => entry.rowCode))];
    const rows: YardRowNode[] = rowCodes.map((pCode, rowIndex) => {
      const liveRow = liveRows.get(pCode);
      const livePositions = new Map(
        (liveRow?.positions ?? []).map((position) => [positionKey(position.code), position]),
      );
      const rowEntries = entries.filter((entry) => entry.rowCode === pCode);
      const positions = rowEntries.map((entry) => {
        const livePosition = livePositions.get(String(entry.positionNumber)) ?? null;
        return registeredPositionNode(entry, livePosition);
      });
      return {
        id: liveRow?.id ?? `${code}-${pCode}`,
        code: liveRow?.code ?? pCode,
        sortOrder: rowIndex + 1,
        positions,
      };
    });

    return {
      id: live?.id ?? `registry:${code}`,
      code,
      name: live?.name ?? `Block ${code}`,
      sortOrder: live?.sortOrder ?? sortOrder,
      isActive: true,
      productionZone: isProductionBlock(code) || Boolean(live?.productionZone),
      rows,
    };
  });
}

export function registryEntryForNode(
  blockCode: string,
  rowCode: string,
  positionCode: string,
) {
  return getPhysicalPosition(blockCode, rowCode, Number(positionCode));
}
