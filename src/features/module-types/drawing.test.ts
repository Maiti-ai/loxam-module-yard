import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {moduleTypeDrawingUrl, normalizeTypeCode} from "./drawing";

describe("module type drawings", () => {
  it("maps a type_code to the matching public PNG", () => {
    assert.equal(moduleTypeDrawingUrl("60146"), "/module-types/60146.png");
    assert.equal(moduleTypeDrawingUrl(" 60179 "), "/module-types/60179.png");
  });

  it("returns null when there is no type_code", () => {
    assert.equal(normalizeTypeCode(null), null);
    assert.equal(normalizeTypeCode("   "), null);
    assert.equal(moduleTypeDrawingUrl(null), null);
    assert.equal(moduleTypeDrawingUrl(""), null);
  });

  it("rejects unsafe type codes so the page can skip the image", () => {
    assert.equal(moduleTypeDrawingUrl("../secret"), null);
    assert.equal(moduleTypeDrawingUrl("60146/../../x"), null);
  });
});
