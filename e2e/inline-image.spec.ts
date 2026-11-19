import { expect, test } from "@playwright/test";
import { open, state } from "./helpers";

/** Ảnh trong dòng chữ (content 1.30 `inlineImage`): hiện thật trong khung soạn, chèn từ "Định dạng khác", chỉnh rộng / bo góc / căn dọc / mô tả, xoá. */
const PNG = "/sample.svg"; // playground phục vụ sẵn; URL data: không qua isSafeUrl

const inlineOf = (page: import("@playwright/test").Page) => page.evaluate(() => {
  const w = (l: any[]): any[] => l.flatMap((b) => [...(b.inline ?? []), ...(b.content ? w(b.content) : [])]);
  return w((window as any).__ecx.store.getState().docs.root.blocks).filter((n) => n.type === "inlineImage");
});

test.describe("ảnh trong dòng chữ", () => {
  test("nội dung có inlineImage hiện thành <img> cùng class / style với website", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await page.evaluate((src) => {
      const s = (window as any).__ecx.store;
      s.insert("root", null, 0, [{ id: "hh", type: "heading", attrs: { level: 2 }, inline: [{ type: "text", text: "Chào " }, { type: "inlineImage", attrs: { src, alt: "Logo", width: "1.4em", radius: "50%", valign: "top" } }, { type: "text", text: " bạn" }] }]);
    }, PNG);
    const img = c.locator('[data-ecx-block="hh"] img.ecx-inline-image');
    await expect(img).toHaveCount(1);
    const css = await img.evaluate((e) => ({ w: e.style.width, r: e.style.borderRadius, v: e.style.verticalAlign, alt: e.getAttribute("alt") }));
    expect(css).toEqual({ w: "1.4em", r: "50%", v: "top", alt: "Logo" });
    // lưu lại nguyên vẹn
    expect((await inlineOf(page))[0].attrs.width).toBe("1.4em");
  });

  test("chọn ảnh → thanh chỉnh hiện; đổi rộng, bo góc, căn dọc, mô tả; xoá ảnh", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await page.evaluate((src) => {
      (window as any).__ecx.store.insert("root", null, 0, [{ id: "hh", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Trước " }, { type: "inlineImage", attrs: { src, height: "1.2em" } }, { type: "text", text: " sau" }] }]);
    }, PNG);
    await c.locator('[data-ecx-block="hh"] img.ecx-inline-image').click();
    const tools = page.locator(".ecx-inline-image-tools");
    await expect(tools).toBeVisible();
    await tools.locator("input").first().fill("2em"); await tools.locator("input").first().blur();
    await expect.poll(async () => (await inlineOf(page))[0]?.attrs.width).toBe("2em");
    await tools.locator("select").nth(0).selectOption("50%");
    await expect.poll(async () => (await inlineOf(page))[0]?.attrs.radius).toBe("50%");
    await tools.locator("select").nth(1).selectOption("top");
    await expect.poll(async () => (await inlineOf(page))[0]?.attrs.valign).toBe("top");
    await tools.locator("input").nth(1).fill("Biểu trưng"); await tools.locator("input").nth(1).blur();
    await expect.poll(async () => (await inlineOf(page))[0]?.attrs.alt).toBe("Biểu trưng");
    // giá trị sai dạng không được ghi (rộng "100vw" bị bỏ, giữ giá trị cũ không có → bỏ thuộc tính)
    await tools.locator("input").first().fill("100vw"); await tools.locator("input").first().blur();
    await expect.poll(async () => (await inlineOf(page))[0]?.attrs.width).toBeUndefined();
    await tools.getByRole("button", { name: /Xoá ảnh|Remove image/ }).click();
    await expect.poll(async () => (await inlineOf(page)).length).toBe(0);
  });

  test("chèn từ menu Định dạng khác (thư viện media): ảnh vào đúng chỗ con trỏ", async ({ page }) => {
    const c = await open(page, "?doc=post&media=1");
    const p = c.locator("[data-ecx-rich]", { hasText: "Nội dung bài viết." }).first();
    await p.click();
    await page.keyboard.press("Meta+ArrowLeft");
    await page.getByRole("button", { name: /Định dạng khác|More formats/ }).click();
    await page.getByRole("menuitem", { name: /Ảnh trong dòng chữ|Inline image/ }).or(page.getByText(/Ảnh trong dòng chữ|Inline image/)).first().click();
    await expect.poll(async () => (await inlineOf(page)).length).toBe(1);
    expect((await inlineOf(page))[0].attrs.height).toBe("1.2em");
    await expect(c.locator("img.ecx-inline-image")).toHaveCount(1);
    expect((await state(page)).docs.root.blocks.length).toBeGreaterThan(0);
  });
});

test("chép / dán: ảnh trong dòng chữ đi theo đoạn qua clipboard giữa hai trình soạn", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "quyền clipboard-read/write chỉ có ở Chromium");
  const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const a = await ctx.newPage(); const ca = await open(a, "?doc=post");
  await a.evaluate((src) => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "hh", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Có ảnh " }, { type: "inlineImage", attrs: { src, alt: "L", width: "1.5em" } }, { type: "text", text: " giữa chữ" }] }]); }, PNG);
  await ca.locator('[data-ecx-block="hh"]').click(); await a.keyboard.press("Meta+a"); await a.keyboard.press("Meta+c");
  const b = await ctx.newPage(); const cb = await open(b, "?doc=post");
  await cb.locator("[data-ecx-rich]", { hasText: "Đoạn thứ hai." }).first().click(); await b.keyboard.press("Meta+v");
  await expect.poll(async () => (await inlineOf(b)).length).toBe(1);
  expect((await inlineOf(b))[0].attrs).toMatchObject({ alt: "L", width: "1.5em" });
});
