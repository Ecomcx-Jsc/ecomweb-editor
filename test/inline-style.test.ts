import assert from "node:assert/strict";
import { test } from "node:test";
import { withoutOverridden } from "../src/v2/blocks/inline-style";

test("kiểu dáng thay thế inline: bỏ đúng thuộc tính bị ghi đè, giữ phần còn lại", () => {
  const inline = { display: "inline-block", padding: "0.6em 1.2em", background: "var(--primary)", color: "#fff", borderRadius: 8, fontWeight: 600 };
  assert.deepEqual(withoutOverridden(inline, { color: { background: "#ffffff", text: "#1e3a8a" } }), { display: "inline-block", padding: "0.6em 1.2em", borderRadius: 8, fontWeight: 600 });
  assert.deepEqual(withoutOverridden(inline, { padding: { base: "lg" }, radius: "16px", fontWeight: "700" }), { display: "inline-block", background: "var(--primary)", color: "#fff" });
});

test("không có kiểu dáng (hoặc kiểu dáng không hợp lệ) thì giữ nguyên inline", () => {
  const inline = { background: "red", padding: 4 };
  assert.equal(withoutOverridden(inline, undefined), inline);
  assert.equal(withoutOverridden(inline, { color: { background: "url(javascript:x)" } }), inline);
});
