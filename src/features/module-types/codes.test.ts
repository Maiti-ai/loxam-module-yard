import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {asTypeCode, isCompactModuleType, staticTypeDrawingUrl} from "./codes";

describe("maritime container type codes", () => {
  it("keeps 6x3 and 3x3 and accepts 2.5x3 and 2.5x6", () => {
    assert.equal(asTypeCode("6x3"), "6x3");
    assert.equal(asTypeCode("3x3"), "3x3");
    assert.equal(asTypeCode("2.5x3"), "2.5x3");
    assert.equal(asTypeCode("2.5x6"), "2.5x6");
  });

  it("does not coerce a maritime type to 6x3", () => {
    assert.notEqual(asTypeCode("2.5x3"), "6x3");
    assert.notEqual(asTypeCode("2.5x6"), "3x3");
  });

  it("treats 2.5x3 as compact and 2.5x6 as long", () => {
    assert.equal(isCompactModuleType("2.5x3"), true);
    assert.equal(isCompactModuleType("3x3"), true);
    assert.equal(isCompactModuleType("2.5x6"), false);
    assert.equal(isCompactModuleType("6x3"), false);
  });

  it("exposes static drawings for the maritime types only", () => {
    assert.equal(staticTypeDrawingUrl("2.5x3"), "/type-drawings/2.5x3.png");
    assert.equal(staticTypeDrawingUrl("2.5x6"), "/type-drawings/2.5x6.png");
    assert.equal(staticTypeDrawingUrl("6x3"), null);
    assert.equal(staticTypeDrawingUrl("3x3"), null);
  });
});
