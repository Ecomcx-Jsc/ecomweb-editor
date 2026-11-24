import { expect, test } from "@playwright/test";
import { open, texts } from "./helpers";

/**
 * Lỗi cũ: xoá ký tự ĐẦU của khối dưới (con trỏ ngay sau chữ đầu, bấm Backspace) làm khối nhảy lên nối vào khối trên.
 * Nguyên nhân: ProseMirror (domchange.ts "Same for backspace") gọi lại handleKeyDown giả SAU khi đã xoá chữ trong DOM — lúc đó con trỏ về 0 nên
 * atStart() đúng và mergeBackward nối nhầm. Nay lấy "ở đầu khối" theo lúc bấm phím thật.
 */
test("Backspace ngay sau ký tự đầu: xoá ký tự đó, không nối lên khối trên", async ({ page }) => {
  const c = await open(page, "?doc=empty");
  await c.locator("[data-ecx-rich]").first().click();
  await page.keyboard.type("One");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Two");
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft"); // T|wo
  await page.keyboard.press("Backspace");
  expect((await texts(page)).filter((x) => x.startsWith("paragraph:"))).toEqual(["paragraph:One", "paragraph:wo"]);
});

test("Backspace ở đầu khối (con trỏ trước chữ đầu) vẫn nối vào khối trên", async ({ page }) => {
  const c = await open(page, "?doc=empty");
  await c.locator("[data-ecx-rich]").first().click();
  await page.keyboard.type("One");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Two");
  await page.keyboard.press("Home");
  await page.keyboard.press("Backspace");
  expect((await texts(page)).filter((x) => x.startsWith("paragraph:"))).toEqual(["paragraph:OneTwo"]);
});
