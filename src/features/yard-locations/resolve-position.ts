import {schellePhysicalLayout} from "../../config/yard-geometry";
import {formatPositionCode, formatRowCode} from "../../lib/format";
import {displayBlocks} from "./display-blocks";
import {destinationChoice, type StackRuleOptions} from "./stacking";
import type {YardPositionNode, YardSnapshot} from "./types";

/** Cells the live placement flow must resolve without SLOT_MISSING. */
export const REQUIRED_PLACEMENT_CELLS = [
  ["A", "P1", 1],
  ["A", "P3", 1],
  ["B", "P1", 1],
  ["B", "P3", 1],
  ["C", "P1", 1],
  ["C", "P4", 13],
  ["D", "P1", 1],
  ["D", "P1", 10],
  ["D", "P2", 1],
  ["D", "P2", 10],
  ["D", "P3", 1],
  ["D", "P3", 10],
  ["D", "P4", 1],
  ["D", "P4", 10],
  ["D", "P5", 1],
  ["D", "P5", 6],
  ["F", "P1", 1],
  ["F", "P3", 4],
] as const;

export function isVisualPositionId(id: string) {
  return id.startsWith("visual:");
}

export function parseVisualPositionId(id: string) {
  const match = id.match(/^visual:([A-Z]):(P?\d+):(\d+)$/i);
  if (!match) {
    return null;
  }
  return {
    blockCode: match[1].toUpperCase(),
    rowCode: formatRowCode(match[2]),
    positionNumber: Number(match[3]),
  };
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function needsRegistryResolve(position: YardPositionNode) {
  return position.levels.length === 0 || isVisualPositionId(position.id);
}

export function isSpecPhysicalCell(blockCode: string, rowCode: string, positionNumber: number) {
  const row = formatRowCode(rowCode);
  const block = blockCode.trim().toUpperCase();
  return schellePhysicalLayout().some(
    (cell) =>
      cell.blockCode === block && cell.rowCode === row && cell.positionNumber === positionNumber,
  );
}

export function findLivePosition(
  snapshot: YardSnapshot,
  blockCode: string,
  rowCode: string,
  positionNumber: number,
) {
  const block = snapshot.blocks.find(
    (item) => item.code.trim().toUpperCase() === blockCode.trim().toUpperCase(),
  );
  if (!block) {
    return null;
  }
  const row = block.rows.find((item) => formatRowCode(item.code) === formatRowCode(rowCode));
  if (!row) {
    return null;
  }
  return (
    row.positions.find((item) => Number(item.code) === positionNumber && item.levels.length > 0) ??
    null
  );
}

export function placementClickPayload(input: {
  blockCode: string;
  rowCode: string;
  position: YardPositionNode;
}) {
  return {
    blockCode: input.blockCode.trim().toUpperCase(),
    rowCode: formatRowCode(input.rowCode),
    positionCode: formatPositionCode(input.position.code),
    positionNumber: Number(input.position.code),
    positionId: input.position.id,
    levelsLength: input.position.levels.length,
    needsRegistry: needsRegistryResolve(input.position),
  };
}

export function displayedCellIdentity(
  blockCode: string,
  rowCode: string,
  position: YardPositionNode,
) {
  return (
    parseVisualPositionId(position.id) ?? {
      blockCode: blockCode.trim().toUpperCase(),
      rowCode: formatRowCode(rowCode),
      positionNumber: Number(position.code),
    }
  );
}

export function findDisplayedCell(
  snapshot: YardSnapshot,
  blockCode: string,
  rowCode: string,
  positionNumber: number,
) {
  const block = displayBlocks(snapshot).find(
    (item) => item.code.trim().toUpperCase() === blockCode.trim().toUpperCase(),
  );
  const row = block?.rows.find((item) => formatRowCode(item.code) === formatRowCode(rowCode));
  return row?.positions.find((item) => Number(item.code) === positionNumber) ?? null;
}

/**
 * Pre-resolve wizard mapping: empty `levels` (including `visual:` overlay
 * cells) is what currently surfaces as "Deze plaats bestaat niet."
 */
export function evaluatePlacementClick(
  position: YardPositionNode,
  options?: StackRuleOptions,
) {
  if (needsRegistryResolve(position)) {
    return {ok: false as const, reason: "unconfigured" as const, errorCode: "SLOT_MISSING" as const};
  }
  return evaluateLiveDestination(position, options);
}

function evaluateLiveDestination(position: YardPositionNode, options?: StackRuleOptions) {
  const choice = destinationChoice(position.levels, options);
  if (!choice.ok) {
    return choice.reason === "full"
      ? {ok: false as const, reason: "full" as const, position}
      : {ok: false as const, reason: "unconfigured" as const, errorCode: "SLOT_MISSING" as const};
  }
  return {...choice, position};
}

/**
 * Shared placement decision after the physical registry is available.
 * Overlay `visual:` cells are mapped onto live `yard_positions` + `yard_slots`.
 */
export function choosePlacementDestination(
  displayed: YardPositionNode,
  registry: YardSnapshot,
  blockCode: string,
  rowCode: string,
  options?: StackRuleOptions,
) {
  const identity = displayedCellIdentity(blockCode, rowCode, displayed);
  if (!isSpecPhysicalCell(identity.blockCode, identity.rowCode, identity.positionNumber)) {
    return {ok: false as const, reason: "unconfigured" as const, errorCode: "SLOT_MISSING" as const};
  }
  const live = needsRegistryResolve(displayed)
    ? findLivePosition(registry, identity.blockCode, identity.rowCode, identity.positionNumber)
    : displayed;
  if (!live) {
    return {ok: false as const, reason: "unconfigured" as const, errorCode: "SLOT_MISSING" as const};
  }
  return evaluateLiveDestination(live, {
    ...options,
    blockCode: identity.blockCode,
  });
}
