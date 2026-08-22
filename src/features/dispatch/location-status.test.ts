import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {dispatchFlowKindFromLocation, productionStatusFromLocation} from "./location-status";

describe("dispatch location-derived production status", () => {
  it("maps actual yard location to overview status without Productie klaar", () => {
    assert.equal(productionStatusFromLocation("C"), "TO_PRODUCTION");
    assert.equal(productionStatusFromLocation("F"), "IN_PRODUCTION");
    assert.equal(productionStatusFromLocation("A"), "IN_DISPATCH_ZONE");
    assert.equal(productionStatusFromLocation("F", "PLACED"), "IN_DISPATCH_ZONE");
    assert.equal(productionStatusFromLocation(null), "TO_PRODUCTION");
  });

  it("sends a dossier module in F straight to the reserved A slot", () => {
    assert.equal(dispatchFlowKindFromLocation("C"), "to_production");
    assert.equal(dispatchFlowKindFromLocation("F"), "ready_for_dispatch");
    assert.equal(dispatchFlowKindFromLocation("A"), "none");
    assert.equal(dispatchFlowKindFromLocation("F", "PLACED"), "none");
  });
});
