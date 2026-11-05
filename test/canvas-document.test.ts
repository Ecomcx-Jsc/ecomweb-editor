import assert from "node:assert/strict";
import { test } from "node:test";
import { attrOps } from "../src/v2/canvas/document-attrs";

test("giữ data-theme, class, lang của html và body", () => {
  const ops = attrOps({ html: { "data-theme": "ecomcx-theme ecomcx-parent", lang: "vi", class: "dark" }, body: { class: "home blog" } });
  assert.deepEqual(ops, [
    { target: "html", name: "data-theme", value: "ecomcx-theme ecomcx-parent" },
    { target: "html", name: "lang", value: "vi" },
    { target: "html", name: "class", value: "dark" },
    { target: "body", name: "class", value: "home blog" },
  ]);
});

test("bỏ thuộc tính nguy hiểm: style, on*, src, href", () => {
  const ops = attrOps({ html: { style: "display:none", onload: "alert(1)", src: "x", href: "y", "data-ok": "1" }, body: { onclick: "x()" } });
  assert.deepEqual(ops, [{ target: "html", name: "data-ok", value: "1" }]);
});

test("bỏ giá trị có ký tự phá thuộc tính", () => {
  assert.deepEqual(attrOps({ html: { "data-a": 'x" onload="y', "data-b": "x<y", "data-c": "an toàn" } }), [{ target: "html", name: "data-c", value: "an toàn" }]);
});

test("không có spec → không thao tác", () => {
  assert.deepEqual(attrOps(undefined), []);
  assert.deepEqual(attrOps({}), []);
});
