import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {moduleDispatchEligibility} from "./eligibility";
import type {ModuleSummary} from "@/features/yard-locations/types";

function module(overrides: Partial<ModuleSummary> & Pick<ModuleSummary, "id" | "moduleNumber">): ModuleSummary {
  return {
    moduleTypeId: "t",
    moduleTypeCode: "6x3",
    moduleTypeNumber: "2031",
    lengthM: 6,
    widthM: 3,
    status: "AVAILABLE",
    rentedToProject: null,
    notes: null,
    location: null,
    airco: null,
    lastMovedAt: null,
    ...overrides,
  };
}

describe("dispatch module eligibility", () => {
  it("blocks modules already in another dossier, rented, or already in A", () => {
    const occupied = new Set(["m-busy"]);
    assert.equal(moduleDispatchEligibility(module({id: "m-busy", moduleNumber: "1"}), occupied).reason, "in_other_dossier");
    assert.equal(
      moduleDispatchEligibility(module({id: "m2", moduleNumber: "2", status: "RENTED"}), occupied).reason,
      "unavailable",
    );
    assert.equal(
      moduleDispatchEligibility(
        module({
          id: "m3",
          moduleNumber: "3",
          location: {
            slotId: "s",
            blockId: "a",
            blockCode: "A",
            rowId: "r",
            rowCode: "P04",
            positionId: "p",
            positionCode: "04",
            level: "GROUND",
          },
        }),
        occupied,
      ).reason,
      "in_dispatch_zone",
    );
    assert.equal(
      moduleDispatchEligibility(module({id: "m4", moduleNumber: "2031"}), occupied).selectable,
      true,
    );
  });

  it("keeps a module already chosen for this draft selectable", () => {
    const occupied = new Set(["m1"]);
    const result = moduleDispatchEligibility(module({id: "m1", moduleNumber: "2031"}), occupied, {
      ignoreModuleIds: new Set(["m1"]),
    });
    assert.equal(result.selectable, true);
  });
});
