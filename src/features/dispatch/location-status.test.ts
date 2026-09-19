import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  dispatchFlowKindFromLocation,
  dispatchTargetLabel,
  isReturnArrivalsRow,
  productionStatusFromLocation,
} from "./location-status";

describe("dispatch location-derived production status", () => {
  it("maps actual yard location to overview status without Productie klaar", () => {
    assert.equal(productionStatusFromLocation("C"), "TO_PRODUCTION");
    assert.equal(productionStatusFromLocation("F"), "IN_PRODUCTION");
    assert.equal(productionStatusFromLocation("A"), "IN_DISPATCH_ZONE");
    assert.equal(productionStatusFromLocation("F", "PLACED"), "IN_DISPATCH_ZONE");
    assert.equal(productionStatusFromLocation(null), "TO_PRODUCTION");
    assert.equal(productionStatusFromLocation(null, "SHIPPED"), null);
    assert.equal(productionStatusFromLocation("D", "RETURNED"), null);
  });

  it("formats the reserved A target without falling back to another level", () => {
    assert.equal(
      dispatchTargetLabel({
        blockCode: "A",
        rowCode: "P04",
        positionCode: "04",
        level: "LEVEL_1",
      }),
      "A-P4-04 Niveau 1",
    );
  });

  it("routes dossier modules through F placement, ship, and on-rent return", () => {
    assert.equal(dispatchFlowKindFromLocation("C"), "to_production");
    assert.equal(dispatchFlowKindFromLocation("F"), "ready_for_dispatch");
    assert.equal(dispatchFlowKindFromLocation("A"), "ready_to_ship");
    assert.equal(dispatchFlowKindFromLocation("A", "PLACED"), "ready_to_ship");
    assert.equal(dispatchFlowKindFromLocation(null, "SHIPPED"), "on_rent");
    assert.equal(dispatchFlowKindFromLocation("D", "RETURNED"), "returned");
  });

  it("recognizes only D P3/P4 as Retour/Arrivées", () => {
    assert.equal(isReturnArrivalsRow("D", "P3"), true);
    assert.equal(isReturnArrivalsRow("D", "P4"), true);
    assert.equal(isReturnArrivalsRow("D", "P1"), false);
    assert.equal(isReturnArrivalsRow("D", "P5"), false);
    assert.equal(isReturnArrivalsRow("A", "P3"), false);
  });
});
