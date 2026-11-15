import assert from "node:assert/strict";
import { test } from "node:test";
import { movesToAnimate, orderMap } from "../src/v2/canvas/move-animation";

const r = (left: number, top: number) => ({ left, top }) as DOMRect;

test("thứ tự khối: id → cha:thứ tự, cả khối con", () => {
  const m = orderMap({ d: { id: "d", blocks: [{ id: "a", type: "p", attrs: {} }, { id: "c", type: "columns", attrs: {}, content: [{ id: "k", type: "column", attrs: {} }] }] } } as never);
  assert.deepEqual([...m], [["a", "d:0"], ["c", "d:1"], ["k", "c:0"]]);
});

test("đổi chỗ: khối đổi vị trí trượt từ chỗ cũ; khối mới chèn không trượt; khối không dịch không trượt", () => {
  const before = new Map([["a", "d:0"], ["b", "d:1"], ["c", "d:2"]]);
  const after = new Map([["b", "d:0"], ["a", "d:1"], ["n", "d:2"], ["c", "d:3"]]);
  const old = new Map([["a", r(0, 0)], ["b", r(0, 50)], ["c", r(0, 100)]]);
  const now = { a: r(0, 50), b: r(0, 0), n: r(0, 100), c: r(0, 100) } as Record<string, DOMRect>;
  const m = movesToAnimate(before, after, old, (id) => now[id] ?? null, () => null);
  assert.deepEqual(Object.fromEntries(m), { a: { dx: 0, dy: -50 }, b: { dx: 0, dy: 50 } });
});

test("khối con đi theo khối cha: chỉ trượt phần chênh lệch, bằng nhau thì bỏ", () => {
  const before = new Map([["p", "d:0"], ["x", "p:0"], ["y", "p:1"]]);
  const after = new Map([["p", "d:1"], ["y", "p:0"], ["x", "p:1"]]);
  const old = new Map([["p", r(0, 0)], ["x", r(0, 0)], ["y", r(0, 20)]]);
  const now = { p: r(0, 100), y: r(0, 100), x: r(0, 140) } as Record<string, DOMRect>;
  const parent = (id: string) => (id === "x" || id === "y" ? "p" : null);
  const m = movesToAnimate(before, after, old, (id) => now[id], parent);
  // p trượt 100; y: tuyệt đối -80 → so với cha +20; x: tuyệt đối -140 → so với cha -40
  assert.deepEqual(Object.fromEntries(m), { p: { dx: 0, dy: -100 }, y: { dx: 0, dy: 20 }, x: { dx: 0, dy: -40 } });
});
