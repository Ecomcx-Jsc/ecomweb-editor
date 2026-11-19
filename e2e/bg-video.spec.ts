// Video nền cho Section / Row / Column (ô Video nền ở mục Nền) và kính mờ (làm mờ nền sau khối) ở tab Nâng cao.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("Section: dán đường dẫn video nền → <video> nằm dưới nội dung trên khung soạn, địa chỉ lạ bị bỏ; Kính mờ đặt backdrop-filter thật", async ({ page }) => {
  const c = await open(page, "?empty=1&content=1");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "x", type: "group", attrs: {}, content: [{ id: "p1", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Nội dung" }] }] }]); });
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__ecx.store.select(["x"]));
  const insp = page.locator(".ecx-inspector");
  await insp.getByRole("tab", { name: "Kiểu dáng" }).click();
  const bg = insp.locator(".ecx-style-section", { hasText: "Nền" }).first();
  await bg.getByRole("radio", { name: "Ảnh" }).click();
  await bg.getByLabel("Video nền (mp4 / webm)").fill("javascript:alert(1)");
  await expect(c.locator('[data-ecx-block="x"] video.ecx-bg-video')).toHaveCount(0);
  await bg.getByLabel("Video nền (mp4 / webm)").fill("/uploads/hero.mp4");
  const video = c.locator('[data-ecx-block="x"] video.ecx-bg-video');
  await expect(video).toHaveCount(1);
  expect(await video.evaluate((e) => getComputedStyle(e).position + "|" + getComputedStyle(e).zIndex)).toBe("absolute|-1");
  expect(await page.evaluate(() => (window as any).__ecx.store.block("x").attrs.style.background.video)).toBe("/uploads/hero.mp4");
  await insp.getByRole("tab", { name: "Nâng cao" }).click();
  await insp.getByRole("button", { name: "Kính mờ" }).click().catch(() => {});
  await insp.getByLabel("Làm mờ nền phía sau").fill("12");
  await expect(c.locator('[data-ecx-block="x"]')).toHaveCSS("backdrop-filter", "blur(12px)");
  expect((await page.evaluate(() => (window as any).__ecx.store.block("x").attrs.style)).backdropBlur).toBe("12px");
});
