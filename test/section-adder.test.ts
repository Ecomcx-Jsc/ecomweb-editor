import assert from "node:assert/strict";
import { test } from "node:test";
import { boundaryAt } from "../src/v2/ui/section-adder";

test("nút + Thêm section: chỉ hiện gần ranh giới giữa các section cấp trên cùng", () => {
  const rects = [{ top: 100, bottom: 300 }, { top: 320, bottom: 600 }];
  assert.deepEqual(boundaryAt(rects, 95), { index: 0, y: 100 }); // trên section đầu
  assert.deepEqual(boundaryAt(rects, 312), { index: 1, y: 310 }); // giữa hai section (điểm giữa khe)
  assert.deepEqual(boundaryAt(rects, 610), { index: 2, y: 600 }); // dưới section cuối
  assert.equal(boundaryAt(rects, 200), null); // giữa thân section
  assert.equal(boundaryAt([], 10), null);
});
