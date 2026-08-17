"use server";

import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import type {ActionResult} from "@/lib/errors";
import {getYardSnapshot} from "./queries";
import {findLivePosition, isSpecPhysicalCell} from "./resolve-position";
import type {YardPositionNode} from "./types";

export async function resolvePhysicalPositionAction(
  blockCode: string,
  rowCode: string,
  positionNumber: number,
): Promise<ActionResult<{position: YardPositionNode}>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {ok: false, code: "UNAUTHENTICATED"};
  }
  if (!roleCan(profile.role, "moveModules")) {
    return {ok: false, code: "FORBIDDEN"};
  }
  if (!Number.isInteger(positionNumber) || !isSpecPhysicalCell(blockCode, rowCode, positionNumber)) {
    return {ok: false, code: "SLOT_MISSING"};
  }

  const snapshot = await getYardSnapshot();
  const position = findLivePosition(snapshot, blockCode, rowCode, positionNumber);
  if (!position) {
    return {ok: false, code: "SLOT_MISSING"};
  }

  return {ok: true, position};
}
