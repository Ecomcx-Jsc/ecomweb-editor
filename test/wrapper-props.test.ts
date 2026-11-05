import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_WRAPPER_DEPTH, parseStyle, wrapperNodes } from "../src/v2/canvas/wrapper-props";

test("chuỗi bao: class → className, style → object (giữ biến CSS), id, data-*", () => {
  const n = wrapperNodes([
    { tag: "div", attrs: { class: "site", style: "--primary:#0ea5e9;font-size:14px" } },
    { tag: "main", attrs: { id: "pNewsDetail", "data-x": "1" } },
  ]);
  assert.deepEqual(n, [
    { tag: "div", props: { className: "site", style: { "--primary": "#0ea5e9", fontSize: "14px" } } },
    { tag: "main", props: { id: "pNewsDetail", "data-x": "1" } },
  ]);
});

test("thẻ lạ → div; thuộc tính nguy hiểm bị bỏ", () => {
  const [n] = wrapperNodes([{ tag: "script", attrs: { class: "a", onclick: "x()", href: "/x", style: "background:url(http://x/y)" } }]);
  assert.deepEqual(n, { tag: "div", props: { className: "a" } });
});

test("giới hạn độ sâu; không có chuỗi → rỗng", () => {
  assert.equal(wrapperNodes(Array.from({ length: 40 }, () => ({ tag: "div" }))).length, MAX_WRAPPER_DEPTH);
  assert.deepEqual(wrapperNodes(undefined), []);
});

test("parseStyle từ chối khai báo nguy hiểm hoặc sai", () => {
  assert.equal(parseStyle("color:red;background:url(x)"), null);
  assert.equal(parseStyle("nonsense"), null);
  assert.deepEqual(parseStyle("margin-top:2px"), { marginTop: "2px" });
});
