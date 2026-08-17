import {formatPositionCode, formatRowCode} from "../../lib/format";
import {displayBlocks} from "./display-blocks";
import {
  formatCanonicalPositionCode,
  getPhysicalPosition,
  hasLivePlacementSlots,
  identityFromClick,
  isRegisteredPhysicalPosition,
  occupancyLookup,
  parseCanonicalPositionCode,
  validateRegisteredDestination,
} from "./physical-registry";
import {destinationChoice, type StackRuleOptions} from "./stacking";
import type {YardPositionNode, YardSnapshot} from "./types";

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

export {formatCanonicalPositionCode, parseCanonicalPositionCode, isRegisteredPhysicalPosition};

export function isVisualPositionId(id: string) {
  return id.startsWith("visual:");
}

export function parseVisualPositionId(id: string) {
  return parseCanonicalPositionCode(id);
}

export {isUuid} from "./physical-registry";

export function needsRegistryResolve(position: YardPositionNode) {
  return !hasLivePlacementSlots(position);
}

export function isSpecPhysicalCell(blockCode: string, rowCode: string, positionNumber: number) {
  return isRegisteredPhysicalPosition(blockCode, rowCode, positionNumber);
}

export function findLivePosition(
  snapshot: YardSnapshot,
  blockCode: string,
  rowCode: string,
  positionNumber: number,
) {
  return occupancyLookup(snapshot, blockCode, rowCode, positionNumber)?.live ?? null;
}

export function placementClickPayload(input: {
  blockCode: string;
  rowCode: string;
  position: YardPositionNode;
}) {
  const identity = identityFromClick(input);
  return {
    blockCode: input.blockCode.trim().toUpperCase(),
    rowCode: formatRowCode(input.rowCode),
    positionCode: formatPositionCode(input.position.code),
    positionNumber: Number(input.position.code),
    positionId: input.position.id,
    canonicalCode: identity?.canonicalCode ?? input.position.canonicalCode ?? null,
    levelsLength: input.position.levels.length,
    needsRegistry: needsRegistryResolve(input.position),
    registered: Boolean(identity && getPhysicalPosition(identity.blockCode, identity.rowCode, identity.positionNumber)),
  };
}

export function displayedCellIdentity(
  blockCode: string,
  rowCode: string,
  position: YardPositionNode,
) {
  return (
    identityFromClick({blockCode, rowCode, position}) ?? {
      blockCode: blockCode.trim().toUpperCase(),
      rowCode: formatRowCode(rowCode),
      positionNumber: Number(position.code),
      positionCode: String(Number(position.code)).padStart(2, "0"),
      canonicalCode: formatCanonicalPositionCode(blockCode, rowCode, Number(position.code)),
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
 * Existence is the canonical registry, not "does this overlay node have DB slots".
 * SLOT_MISSING is only for identities that are not on the current yard map.
 */
export function evaluatePlacementClick(
  position: YardPositionNode,
  options?: StackRuleOptions,
) {
  const identity = identityFromClick({
    blockCode: options?.blockCode ?? "",
    rowCode: "",
    position,
  });
  const registered =
    identity != null &&
    isRegisteredPhysicalPosition(identity.blockCode, identity.rowCode, identity.positionNumber);
  if (!registered && position.levels.length === 0) {
    return {ok: false as const, reason: "unconfigured" as const, errorCode: "SLOT_MISSING" as const};
  }
  const choice = destinationChoice(position.levels, {
    ...options,
    blockCode: identity?.blockCode ?? options?.blockCode,
    maxStackLevels: identity
      ? getPhysicalPosition(identity.blockCode, identity.rowCode, identity.positionNumber)?.maxLevels
      : options?.maxStackLevels,
  });
  if (!choice.ok) {
    return choice.reason === "full"
      ? {ok: false as const, reason: "full" as const, position}
      : {ok: false as const, reason: "unconfigured" as const, errorCode: "SLOT_MISSING" as const};
  }
  return {...choice, position};
}

export function choosePlacementDestination(
  displayed: YardPositionNode,
  registry: YardSnapshot,
  blockCode: string,
  rowCode: string,
  options?: StackRuleOptions,
) {
  const identity = displayedCellIdentity(blockCode, rowCode, displayed);
  return validateRegisteredDestination(identity, registry, options);
}
