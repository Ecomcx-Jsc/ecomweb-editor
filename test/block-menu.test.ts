import assert from "node:assert/strict";
import { test } from "node:test";
import { copyStyle, hasCopiedStyle, menuPosition, pastedStyle } from "../src/v2/ui/block-menu";

test("chép / dán kiểu dáng: chỉ attrs.style, bản sao độc lập", () => {
  assert.equal(hasCopiedStyle(), false);
  assert.equal(pastedStyle(), null);
  const attrs = { content: "x", align: "full", style: { color: { text: "primary" }, spacing: { padding: "2rem" } } };
  copyStyle(attrs);
  attrs.style.color.text = "accent"; // sửa khối nguồn sau khi chép không đổi bản đã chép
  const a = pastedStyle()!;
  assert.deepEqual(a, { style: { color: { text: "primary" }, spacing: { padding: "2rem" } } });
  a.style!.color = {}; // dán hai lần không dùng chung đối tượng
  assert.deepEqual(pastedStyle()!.style!.color, { text: "primary" });
  copyStyle({ content: "y" });
  assert.equal(hasCopiedStyle(), true);
  assert.deepEqual(pastedStyle(), { style: undefined }); // nguồn không có kiểu dáng → dán = bỏ kiểu dáng
});

test("vị trí menu chuột phải: lật khi sát mép, không ra ngoài khung nhìn", () => {
  assert.deepEqual(menuPosition(100, 100, 200, 300, 1000, 800), { left: 100, top: 100 });
  assert.deepEqual(menuPosition(900, 700, 200, 300, 1000, 800), { left: 700, top: 400 });
  assert.deepEqual(menuPosition(50, 50, 200, 900, 1000, 800), { left: 50, top: 8 });
});
