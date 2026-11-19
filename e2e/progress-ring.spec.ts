// Thanh tiến độ: đổi dạng sang tròn / bán nguyệt — vòng SVG thật, số giữa vòng, ô vị trí chữ chỉ hiện ở dạng thanh.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("thanh tiến độ: chọn Tròn / Bán nguyệt vẽ vòng đúng phần trăm, số giữa vòng, lưu đúng thuộc tính", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  await page.locator(".ecx-inserter-panel .ecx-search").first().fill("progressBar");
  await page.locator('.ecx-inserter-panel [data-key="progressBar"]').first().click();
  await page.waitForTimeout(600);
  const id = await page.evaluate(() => { const s = (window as any).__ecx.store; const f = (l: any[]): any => { for (const b of l) { if (b.type === "progressBar") return b; const r = b.content && f(b.content); if (r) return r; } }; const b = f(s.getState().docs.root.blocks); s.select([b.id]); return b.id; });
  const insp = page.locator(".ecx-inspector");
  await expect(c.locator(".ecx-progress-track")).toHaveCount(1);
  await insp.getByRole("radio", { name: "Tròn", exact: true }).click();
  await expect(c.locator(".ecx-progress-track")).toHaveCount(0);
  const bar = c.locator(".ecx-progress-ring-bar");
  await expect(bar).toHaveAttribute("stroke-dasharray", "80 100"); // mẫu 80%
  await expect(c.locator(".ecx-progress-ring .ecx-progress-value")).toHaveText("80%");
  await page.evaluate((i) => (window as any).__ecx.store.setAttrs([i], { value: 35 }), id);
  await expect(bar).toHaveAttribute("stroke-dasharray", "35 100");
  const box = await c.locator(".ecx-progress-ring").boundingBox();
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(6); // vòng tròn đầy: rộng = cao
  await insp.getByRole("radio", { name: "Bán nguyệt", exact: true }).click();
  await expect(c.locator(".ecx-progress-ring svg")).toHaveAttribute("viewBox", "0 0 100 55");
  const b2 = await c.locator(".ecx-progress-ring").boundingBox();
  expect(b2!.height).toBeLessThan(b2!.width * 0.65); // nửa vòng thấp hơn nửa bề ngang
  expect((await page.evaluate(() => JSON.stringify((window as any).__ecx.store.getState().docs.root.blocks))).includes('"shape":"half"')).toBe(true);
  await expect(c.locator(".ecx-block-error")).toHaveCount(0);
});
