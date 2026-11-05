import assert from "node:assert/strict";
import { test } from "node:test";
import { dropAnimation, onAnimationsChange, pluginAnimations, storeAnimation } from "../src/shared/animation-store";

test("registerAnimation: nhận mã hợp lệ, sắp theo thứ tự, thông báo khi đổi, gỡ được", () => {
  let n = 0;
  const off = onAnimationsChange(() => n++);
  storeAnimation({ id: "acme-pop", label: "Pop", order: 20, css: "@keyframes ecx-in-acme-pop{}" });
  storeAnimation({ id: "acme-bounce", label: "Bounce", group: "Nảy", order: 5 });
  assert.deepEqual(pluginAnimations().map((e) => e.id), ["acme-bounce", "acme-pop"]);
  assert.equal(n, 2);
  dropAnimation("acme-pop"); dropAnimation("acme-bounce"); dropAnimation("không-có");
  assert.deepEqual(pluginAnimations(), []);
  assert.equal(n, 4); // gỡ mã không tồn tại không phát thông báo
  off();
});

test("registerAnimation: mã sai dạng hoặc trùng hiệu ứng lõi bị bỏ qua", () => {
  const warn = console.warn; console.warn = () => {};
  try {
    for (const id of ["Fade", "fade", "slide-up", "none", "x;}", "1abc", "a".repeat(41)]) storeAnimation({ id, label: id });
  } finally { console.warn = warn; }
  assert.deepEqual(pluginAnimations(), []);
});
