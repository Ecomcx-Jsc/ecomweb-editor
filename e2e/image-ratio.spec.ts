// Ảnh: tỉ lệ khung cắt ảnh vừa khung; chọn "Theo ảnh" trả lại như cũ; lưu đúng thuộc tính.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("ảnh: chọn tỉ lệ khung áp lên ảnh (cắt vừa), 'Theo ảnh' bỏ lại; ô nằm ở tab Cài đặt", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  const id = await page.evaluate(() => {
    const s = (window as any).__ecx.store;
    const id = "img1";
    s.insert("root", null, s.getState().docs.root.blocks.length, [{ id, type: "image", attrs: { src: `${location.origin}/sample.svg`, alt: "Mẫu" } }]);
    s.select([id]);
    return id;
  });
  await page.waitForTimeout(500);
  const insp = page.locator(".ecx-inspector");
  await expect(insp.getByText("Tỉ lệ khung")).toBeVisible();
  const img = c.locator('[data-ecx-block="img1"] img').first();
  const ratio = async () => { const b = await img.boundingBox(); return b!.width / b!.height; };
  await insp.getByRole("radio", { name: "16/9", exact: true }).click();
  await expect(img).toHaveClass(/has-ratio/);
  expect(Math.abs((await ratio()) - 16 / 9)).toBeLessThan(0.05);
  await insp.getByRole("radio", { name: "1/1", exact: true }).click();
  expect(Math.abs((await ratio()) - 1)).toBeLessThan(0.05);
  await insp.getByRole("radio", { name: "Theo ảnh", exact: true }).click();
  await expect(img).not.toHaveClass(/has-ratio/);
  await page.evaluate((i) => (window as any).__ecx.store.setAttrs([i], { ratio: "3/4" }), id);
  expect((await page.evaluate(() => JSON.stringify((window as any).__ecx.store.getState().docs.root.blocks))).includes('"ratio":"3/4"')).toBe(true);
  expect(Math.abs((await ratio()) - 3 / 4)).toBeLessThan(0.05);
  await expect(c.locator(".ecx-block-error")).toHaveCount(0);
});
