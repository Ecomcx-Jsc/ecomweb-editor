import assert from "node:assert/strict";
import { test } from "node:test";
import { convertUnit } from "../src/v2/ui/unit-controls";

test("đổi đơn vị px ↔ rem/em giữ cỡ thật, đơn vị theo khung chứa giữ số", () => {
  assert.equal(convertUnit("22", "px", "rem"), "1.375");
  assert.equal(convertUnit("1.5", "rem", "px"), "24");
  assert.equal(convertUnit("2", "em", "rem"), "2");
  assert.equal(convertUnit("50", "%", "px"), "50");
  assert.equal(convertUnit("10", "px", "vw"), "10");
  assert.equal(convertUnit("", "px", "rem"), "");
});
