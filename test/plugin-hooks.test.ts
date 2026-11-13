import assert from "node:assert/strict";
import { test } from "node:test";
import { controlsCss, defineBlockControls } from "@ecomcx/ecomweb-content";
import { blockActionsFor, blockAssets, blockControls, blockPanelsFor, blockReadyFns, onBlockReady, registerBlockAction, registerBlockAssets, registerBlockPanel, unregisterBlockAction, unregisterBlockPanel } from "../src/shared/panel-store";

// Plugin thử dùng cả 4 chỗ cắm (ô khai CSS ở tab Kiểu dáng cho mọi khối, onBlockReady, asset theo nhu cầu, hành động khối).
const attributes = {
  acmeRotate: { type: "number" as const, min: -45, max: 45, css: { "{{WRAPPER}}": "rotate: {{VALUE}}deg" } },
  acmeGlow: { type: "color" as const, css: { "{{WRAPPER}} img": "filter: drop-shadow(0 4px 12px {{VALUE}})" } },
};

test("panel khai CSS: tab Kiểu dáng, mọi khối, CSS giống hệt website (cùng controlsCss)", () => {
  registerBlockPanel({ id: "acme-tilt/tilt", title: "Nghiêng", tab: "style", blocks: "*", attributes });
  assert.equal(blockPanelsFor("paragraph", "style").length, 1);
  assert.equal(blockPanelsFor("paragraph").length, 0);
  const attrs = { acmeRotate: 7, acmeGlow: "#123456" };
  // Website: definePlugin({ blockControls: [defineBlockControls(...)] }) — cùng khai báo
  const site = controlsCss([defineBlockControls({ id: "acme-tilt/tilt", blocks: "*", attributes })], "image", attrs);
  assert.deepEqual(controlsCss(blockControls(), "image", attrs), site);
  assert.equal(controlsCss(blockControls(), "image", { acmeRotate: 99, acmeGlow: "red;}x{" }), null);
  unregisterBlockPanel("acme-tilt/tilt");
  assert.equal(blockControls().length, 0);
});

test("panel khai CSS nguy hiểm bị từ chối lúc đăng ký", () => {
  assert.throws(() => registerBlockPanel({ id: "bad/x", title: "x", attributes: { a: { type: "color", css: { "{{WRAPPER}}": "background: url({{VALUE}})" } } } }));
  assert.equal(blockPanelsFor("image").length, 0);
});

test("hành động khối, onBlockReady, asset", () => {
  registerBlockAction({ id: "acme-tilt/reset", label: "Bỏ nghiêng", blocks: ["image"], run: () => {} });
  assert.equal(blockActionsFor(["image"]).length, 1);
  assert.equal(blockActionsFor(["image", "paragraph"]).length, 0);
  unregisterBlockAction("acme-tilt/reset");
  const off = onBlockReady("image", () => {});
  assert.equal(blockReadyFns().length, 1);
  off();
  assert.equal(blockReadyFns().length, 0);
  registerBlockAssets([{ kind: "script", src: "/extensions/acme-tilt/zoom.js", when: { blocks: ["image"] } }]);
  assert.equal(blockAssets().length, 1);
});
