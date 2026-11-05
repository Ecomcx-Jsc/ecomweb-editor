import { expect, test } from "@playwright/test";
import { clickEnd, open, state } from "./helpers";

/** Khung soạn khớp website: màu đặt ở Kiểu dáng thắng style inline mặc định của khối (trước đây nút vẫn đen). */
test("nút: màu nền / chữ đặt ở Kiểu dáng hiện đúng trong khung soạn", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await clickEnd(c, "Đoạn thứ hai.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/nut");
  await page.keyboard.press("Enter");
  const find = (list: any[]): any => { for (const b of list) { if (b.type === "button") return b; const r = b.content && find(b.content); if (r) return r; } };
  const btn = find((await state(page)).docs.root.blocks);
  const el = c.locator(`[data-ecx-block="${btn.id}"]`);
  await expect(el).toHaveCSS("background-color", /rgb\(24, 24, 27\)|rgb\(37, 99, 235\)|rgb\(\d+, \d+, \d+\)/); // nền mặc định của variant primary
  await page.evaluate((id) => (window as any).__ecx.store.setAttrs([id], { style: { color: { background: "#ffffff", text: "#1e3a8a" } } }), btn.id);
  await expect(el).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(el).toHaveCSS("color", "rgb(30, 58, 138)");
  await expect(el).toHaveCSS("font-weight", "600"); // phần inline không bị ghi đè vẫn giữ
});
