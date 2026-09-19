import {maxStackLevelsForBlock} from "../../config/yard";
import {schellePhysicalLayout, SCHELLE_YARD} from "../../config/yard-geometry";
import {formatRowCode} from "../../lib/format";
import {destinationChoice, stackLevelsForHeight, type StackRuleOptions} from "./stacking";
import type {YardLevelCell, YardPositionNode, YardSnapshot} from "./types";

/** Canonical operational id: BLOCK-ROW-PP, e.g. D-P1-04. */
export type CanonicalPositionCode = string;

export type PhysicalPosition = {
  canonicalCode: CanonicalPositionCode;
  blockCode: string;
  rowCode: string;
  positionNumber: number;
  positionCode: string;
  maxLevels: number;
  active: boolean;
};

export type PositionIdentity = {
  blockCode: string;
  rowCode: string;
  positionNumber: number;
  positionCode: string;
  canonicalCode: CanonicalPositionCode;
};

export type PositionAuditRow = {
  block: string;
  row: string;
  position: number;
  positionCode: CanonicalPositionCode;
  maxLevels: number;
  visibleOnMap: boolean;
  inRegistry: boolean;
  inSnapshot: boolean;
  clickable: boolean;
  placementValid: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let registryCache: PhysicalPosition[] | null = null;
let registryByCode: Map<string, PhysicalPosition> | null = null;

export function formatCanonicalPositionCode(
  blockCode: string,
  rowCode: string,
  positionNumber: number,
): CanonicalPositionCode {
  const block = blockCode.trim().toUpperCase();
  const row = formatRowCode(rowCode);
  const number = Number(positionNumber);
  return `${block}-${row}-${String(number).padStart(2, "0")}`;
}

/**
 * Accepts the stable form and the variants the UI/DB historically mix:
 * D-P1-01, D-P1-1, D:P1:1, visual:D:P1:1, D-1-01, d/p1/01.
 */
export function parseCanonicalPositionCode(value: string): PositionIdentity | null {
  const trimmed = value.trim().replace(/^visual:/i, "");
  const match = trimmed.match(/^([A-Za-z])[:\-/.]?P?(\d+)[:\-/.](\d+)$/i);
  if (!match) {
    return null;
  }
  const blockCode = match[1].toUpperCase();
  const rowCode = formatRowCode(match[2]);
  const positionNumber = Number(match[3]);
  if (!Number.isInteger(positionNumber) || positionNumber < 1) {
    return null;
  }
  return {
    blockCode,
    rowCode,
    positionNumber,
    positionCode: String(positionNumber).padStart(2, "0"),
    canonicalCode: formatCanonicalPositionCode(blockCode, rowCode, positionNumber),
  };
}

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

export function physicalRegistry(): PhysicalPosition[] {
  if (registryCache) {
    return registryCache;
  }
  registryCache = schellePhysicalLayout().map((cell) => {
    const maxLevels = maxStackLevelsForBlock(cell.blockCode);
    return {
      canonicalCode: formatCanonicalPositionCode(cell.blockCode, cell.rowCode, cell.positionNumber),
      blockCode: cell.blockCode,
      rowCode: cell.rowCode,
      positionNumber: cell.positionNumber,
      positionCode: cell.positionCode,
      maxLevels,
      active: true,
    };
  });
  return registryCache;
}

function indexByCode() {
  if (!registryByCode) {
    registryByCode = new Map(physicalRegistry().map((entry) => [entry.canonicalCode, entry]));
  }
  return registryByCode;
}

export function getPhysicalPosition(
  blockCode: string,
  rowCode: string,
  positionNumber: number,
): PhysicalPosition | null {
  return (
    indexByCode().get(formatCanonicalPositionCode(blockCode, rowCode, positionNumber)) ?? null
  );
}

export function getPhysicalPositionByCode(value: string): PhysicalPosition | null {
  const parsed = parseCanonicalPositionCode(value);
  if (!parsed) {
    return null;
  }
  return indexByCode().get(parsed.canonicalCode) ?? null;
}

export function isRegisteredPhysicalPosition(
  blockCode: string,
  rowCode: string,
  positionNumber: number,
) {
  return getPhysicalPosition(blockCode, rowCode, positionNumber) != null;
}

export function visibleMapBlockCodes() {
  return Object.keys(SCHELLE_YARD.blocks);
}

export function registryVacancy(entry: PhysicalPosition): YardLevelCell[] {
  return stackLevelsForHeight(entry.maxLevels).map((level) => ({
    slotId: `${entry.canonicalCode}:${level}`,
    level,
    occupant: null,
  }));
}

export function registeredPositionNode(
  entry: PhysicalPosition,
  live?: YardPositionNode | null,
): YardPositionNode {
  const liveReady = live && live.levels.length > 0 ? live : null;
  return {
    id: liveReady?.id ?? entry.canonicalCode,
    code: liveReady?.code ?? entry.positionCode,
    sortOrder: liveReady?.sortOrder ?? entry.positionNumber,
    canonicalCode: entry.canonicalCode,
    maxLevels: entry.maxLevels,
    levels: liveReady?.levels ?? registryVacancy(entry),
    reservation: liveReady?.reservation,
  };
}

export function hasLivePlacementSlots(position: YardPositionNode) {
  return isUuid(position.id) && position.levels.length > 0 && position.levels.every((cell) => isUuid(cell.slotId));
}

export function identityFromClick(input: {
  blockCode: string;
  rowCode: string;
  position: Pick<YardPositionNode, "id" | "code" | "canonicalCode">;
}): PositionIdentity | null {
  if (input.position.canonicalCode) {
    return parseCanonicalPositionCode(input.position.canonicalCode);
  }
  return (
    parseCanonicalPositionCode(input.position.id) ??
    parseCanonicalPositionCode(
      formatCanonicalPositionCode(input.blockCode, input.rowCode, Number(input.position.code)),
    )
  );
}

export function clickPayloadMatchesRegistry(input: {
  blockCode: string;
  rowCode: string;
  position: Pick<YardPositionNode, "id" | "code" | "canonicalCode">;
}) {
  const identity = identityFromClick(input);
  if (!identity) {
    return false;
  }
  const entry = getPhysicalPosition(identity.blockCode, identity.rowCode, identity.positionNumber);
  if (!entry) {
    return false;
  }
  return (
    identity.canonicalCode === entry.canonicalCode &&
    identity.blockCode === input.blockCode.trim().toUpperCase() &&
    identity.rowCode === formatRowCode(input.rowCode) &&
    identity.positionNumber === Number(input.position.code)
  );
}

export function occupancyLookup(
  snapshot: YardSnapshot,
  blockCode: string,
  rowCode: string,
  positionNumber: number,
) {
  const entry = getPhysicalPosition(blockCode, rowCode, positionNumber);
  if (!entry) {
    return null;
  }
  const block = snapshot.blocks.find(
    (item) => item.code.trim().toUpperCase() === entry.blockCode,
  );
  const row = block?.rows.find((item) => formatRowCode(item.code) === entry.rowCode);
  const live = row?.positions.find(
    (item) => Number(item.code) === entry.positionNumber && item.levels.length > 0,
  );
  return {
    entry,
    live: live ?? null,
    levels: live?.levels ?? registryVacancy(entry),
  };
}

export function validateRegisteredDestination(
  identity: PositionIdentity,
  snapshot: YardSnapshot,
  options?: StackRuleOptions,
) {
  const lookup = occupancyLookup(snapshot, identity.blockCode, identity.rowCode, identity.positionNumber);
  if (!lookup) {
    return {ok: false as const, reason: "unconfigured" as const, errorCode: "SLOT_MISSING" as const};
  }
  const choice = destinationChoice(lookup.levels, {
    ...options,
    blockCode: lookup.entry.blockCode,
    maxStackLevels: lookup.entry.maxLevels,
  });
  if (!choice.ok) {
    return choice.reason === "full"
      ? {ok: false as const, reason: "full" as const, entry: lookup.entry}
      : {ok: false as const, reason: "unconfigured" as const, errorCode: "SLOT_MISSING" as const};
  }
  return {
    ...choice,
    entry: lookup.entry,
    live: lookup.live,
    position: registeredPositionNode(lookup.entry, lookup.live),
  };
}

function snapshotIdentitySet(snapshot: YardSnapshot) {
  const keys = new Set<string>();
  const extras: PositionIdentity[] = [];
  for (const block of snapshot.blocks) {
    for (const row of block.rows) {
      for (const position of row.positions) {
        const identity =
          parseCanonicalPositionCode(
            formatCanonicalPositionCode(block.code, row.code, Number(position.code)),
          ) ?? null;
        if (!identity) {
          continue;
        }
        const key = identity.canonicalCode;
        if (keys.has(key)) {
          extras.push(identity);
        }
        keys.add(key);
      }
    }
  }
  return {keys, extras};
}

export function obsoleteSnapshotPositions(snapshot: YardSnapshot) {
  const registry = indexByCode();
  const obsolete: PositionIdentity[] = [];
  for (const block of snapshot.blocks) {
    for (const row of block.rows) {
      for (const position of row.positions) {
        const identity = parseCanonicalPositionCode(
          formatCanonicalPositionCode(block.code, row.code, Number(position.code)),
        );
        if (!identity) {
          obsolete.push({
            blockCode: block.code,
            rowCode: formatRowCode(row.code),
            positionNumber: Number(position.code) || 0,
            positionCode: position.code,
            canonicalCode: `${block.code}-${row.code}-${position.code}`,
          });
          continue;
        }
        if (!registry.has(identity.canonicalCode)) {
          obsolete.push(identity);
        }
      }
    }
  }
  return obsolete;
}

export function auditYardPositions(snapshot: YardSnapshot) {
  const displayed = new Set<string>();
  const {keys: snapshotKeys, extras: duplicateSnapshot} = snapshotIdentitySet(snapshot);
  const registry = physicalRegistry();
  const duplicateRegistry = registry
    .map((entry) => entry.canonicalCode)
    .filter((code, index, list) => list.indexOf(code) !== index);

  const rows: PositionAuditRow[] = registry.map((entry) => {
    displayed.add(entry.canonicalCode);
    const inSnapshot = snapshotKeys.has(entry.canonicalCode);
    const placement = validateRegisteredDestination(entry, snapshot);
    return {
      block: entry.blockCode,
      row: entry.rowCode,
      position: entry.positionNumber,
      positionCode: entry.canonicalCode,
      maxLevels: entry.maxLevels,
      visibleOnMap: true,
      inRegistry: true,
      inSnapshot,
      clickable: true,
      placementValid: placement.ok === true || placement.reason === "full",
    };
  });

  const missingFromSnapshot = rows.filter((row) => !row.inSnapshot);
  const obsolete = obsoleteSnapshotPositions(snapshot);

  return {
    rows,
    duplicateRegistry,
    duplicateSnapshot,
    obsolete,
    missingFromSnapshot,
    totals: {
      physical: registry.length,
      capacity: registry.reduce((sum, entry) => sum + entry.maxLevels, 0),
      visible: displayed.size,
      registry: registry.length,
      inSnapshot: rows.filter((row) => row.inSnapshot).length,
      placementValid: rows.filter((row) => row.placementValid).length,
    },
  };
}

export function registryCapacityByBlock() {
  const byBlock = new Map<string, {physical: number; capacity: number; maxLevels: number}>();
  for (const entry of physicalRegistry()) {
    const current = byBlock.get(entry.blockCode) ?? {
      physical: 0,
      capacity: 0,
      maxLevels: entry.maxLevels,
    };
    current.physical += 1;
    current.capacity += entry.maxLevels;
    byBlock.set(entry.blockCode, current);
  }
  return byBlock;
}
