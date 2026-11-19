// Dựng trang như người dùng thật (chỉ qua bảng chèn): khối chèn liên tiếp nằm cùng cấp, không lồng vào nhau; Slider căn giữa như khối khác; Image Overlay trống đọc được.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

async function insert(page: import("@playwright/test").Page, key: string, query: string) {
  const search = page.locator(".ecx-inserter-panel .ecx-search, .ecx-inserter-popover .ecx-search").first();
  if (!(await search.isVisible().catch(() => false))) await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  await search.fill(query);
  await page.locator(`.ecx-inserter-popover [data-key="${key}"], .ecx-inserter-panel [data-key="${key}"]`).first().click();
  await page.waitForTimeout(900); // người dùng thật mất hơn thế mới chèn khối kế tiếp
}
const tops = (page: import("@playwright/test").Page) => page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.map((b: any) => b.type));

test("chèn liên tiếp từ bảng chèn: Slider, Đánh giá, Countdown, Popup, Accordion, Gallery, Tabs nằm cùng cấp theo thứ tự (không lồng vào nhau)", async ({ page }) => {
  await open(page, "?doc=empty&content=1");
  const before = (await tops(page)).length;
  const steps: Array<[string, string, string]> = [["carousel/hero", "hero", "carousel"], ["testimonials", "danh gia", "testimonials"], ["countdown", "countdown", "countdown"], ["popup", "popup", "popup"], ["accordion", "accordion", "accordion"], ["gallery", "gallery", "gallery"], ["tabs", "tabs", "tabs"]];
  for (const [key, q] of steps) {
    await insert(page, key, q);
    const skip = page.frameLocator("iframe[data-ecx-canvas]").locator(".ecx-variation-skip").first();
    if (await skip.count()) { await skip.click(); await page.waitForTimeout(900); }
  }
  const t = await tops(page);
  expect(t.slice(before)).toEqual(steps.map((s) => s[2]));
});

test("chèn tiếp sau khi người dùng bấm sang chỗ khác: khối mới theo chỗ vừa bấm (không bị kéo về khối vừa chèn)", async ({ page }) => {
  await open(page, "?doc=empty&content=1");
  await insert(page, "popup", "popup");
  const before = (await tops(page)).length;
  // bấm vào đoạn văn đầu tiên của trang (chỗ khác) rồi chèn
  const firstPara = await page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.find((b: any) => b.type === "paragraph").id);
  await page.evaluate((i) => (window as any).__ecx.store.select([i]), firstPara);
  await page.waitForTimeout(200);
  await insert(page, "countdown", "countdown");
  const t = await tops(page);
  expect(t.length).toBe(before + 1);
  expect(t.indexOf("countdown")).toBeLessThan(t.indexOf("popup")); // chèn ngay sau đoạn văn đã chọn, trước Popup
});

test("Slider nằm giữa cột như các khối khác (lề trái / phải tự động), không dính trái", async ({ page }) => {
  const c = await open(page, "?doc=empty&content=1");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "a1", type: "carousel", attrs: {}, content: [{ id: "g1", type: "group", attrs: {}, content: [{ id: "pp", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "x" }] }] }] }, { id: "a3", type: "accordion", attrs: {}, content: [{ id: "d1", type: "details", attrs: { summary: "S" }, content: [{ id: "pr", type: "paragraph", attrs: {} }] }] }]); });
  await page.waitForTimeout(600);
  const left = (id: string) => c.locator(`[data-ecx-block="${id}"]`).evaluate((e) => Math.round(e.getBoundingClientRect().left));
  expect(Math.abs((await left("a1")) - (await left("a3")))).toBeLessThan(3);
});

test("Image Overlay chưa có ảnh: ô chọn ảnh và chữ không chồng lên nhau", async ({ page }) => {
  const c = await open(page, "?doc=empty&content=1");
  await insert(page, "imageOverlay", "overlay");
  const o = c.locator(".ecx-image-overlay").first();
  const pos = await o.locator(".ecx-image-overlay-body").evaluate((e) => getComputedStyle(e).position);
  expect(pos).toBe("static");
  const ph = await o.locator(".ecx-image-overlay-media").boundingBox(), title = await o.locator(".ecx-image-overlay-title").boundingBox();
  expect(title!.y).toBeGreaterThanOrEqual(ph!.y + ph!.height - 2); // chữ nằm dưới ô chọn ảnh
});
