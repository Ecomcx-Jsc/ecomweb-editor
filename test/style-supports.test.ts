import assert from "node:assert/strict";
import { test } from "node:test";
import { styleGroups } from "../src/v2/ui/style-supports";

test("tab Kiểu dáng chỉ hiện nhóm khối hỗ trợ: ảnh nền cho khối chứa, khối lõi có bộ riêng, plugin tự khai", () => {
  const container = { name: "group", kind: "container" } as never;
  const text = { name: "paragraph", kind: "text" } as never;
  assert.ok(styleGroups("group", container).has("background"));
  assert.ok(!styleGroups("paragraph", text).has("background"));
  assert.ok(styleGroups("paragraph", text).has("typography"));
  assert.deepEqual([...styleGroups("spacer")], ["spacing", "visibility"]);
  assert.ok(!styleGroups("image").has("typography"));
  const plugin = { name: "acme-card", kind: "atom", supports: { style: ["color", "nonsense", "border"] } } as never;
  assert.deepEqual([...styleGroups("acme-card", plugin)], ["color", "border"]);
});
