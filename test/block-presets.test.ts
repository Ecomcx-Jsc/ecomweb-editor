import assert from "node:assert/strict";
import { test } from "node:test";
import { applyStyle, pickStyle, sameStyle, styleKeys, withDefaults } from "../src/v2/core/block-presets";

const controls = [{ id: "core/x", blocks: ["iconBox"], attributes: { iconBoxTitleColor: { type: "color" as const } } }, { id: "p/y", blocks: ["image"], attributes: { z: { type: "number" as const } } }];

test("thuộc tính kiểu: chung + ô kiểu của đúng loại khối; nội dung không vào kiểu", () => {
  const keys = styleKeys("iconBox", controls);
  assert.deepEqual(keys, ["style", "parts", "blockStyle", "iconBoxTitleColor"]);
  const attrs = { title: "Chữ", icon: "star", style: { shadow: "md" }, iconBoxTitleColor: "primary", parts: undefined };
  assert.deepEqual(pickStyle(attrs, keys), { style: { shadow: "md" }, iconBoxTitleColor: "primary" });
});

test("áp kiểu: đặt đúng các khoá kiểu (khoá không có trong kiểu → bỏ), không đụng nội dung", () => {
  const keys = ["style", "parts", "blockStyle"];
  assert.deepEqual(applyStyle(keys, { style: { radius: "8px" } }), { style: { radius: "8px" }, parts: undefined, blockStyle: undefined });
  assert.equal(sameStyle({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } }), true);
});

test("mặc định khi chèn: chỉ thêm thuộc tính chưa có", () => {
  const n = withDefaults({ id: "1", type: "iconBox", attrs: { style: { shadow: "sm" } } }, { iconBox: { default: { style: { shadow: "lg" }, blockStyle: "card" } } });
  assert.deepEqual(n.attrs, { style: { shadow: "sm" }, blockStyle: "card" });
  assert.equal(withDefaults({ id: "2", type: "image", attrs: {} }, null).attrs.style, undefined);
});
