import { expect, test, type Page } from "@playwright/test";
import { clickEnd, open, state } from "./helpers";

/** Trải nghiệm soạn: chèn nhanh, thêm cột ngay trên khung, chọn / tải / kéo thả media, khoảng cách theo bậc, thẻ xem trước khối. */
const blocks = async (page: Page) => (await state(page)).docs.root.blocks as Array<{ type: string; attrs: Record<string, unknown>; content?: unknown[] }>;

test.describe("trải nghiệm soạn", () => {
  test("nút + : 6 khối gợi ý, gõ để tìm, “Xem tất cả” mở thư viện khối", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 3, [{ id: "g1", type: "group", attrs: {}, content: [] }]); });
    await c.locator('[data-ecx-block="g1"] .ecx-appender').first().click();
    const pop = page.locator(".ecx-inserter-popover");
    await expect(pop.locator(".ecx-quick-grid .ecx-block-tile")).toHaveCount(6);
    await pop.getByRole("searchbox").or(pop.locator("input.ecx-search")).first().fill("bang");
    await expect(pop.locator(".ecx-inserter-list [role=option]").first()).toContainText("Bảng");
    await pop.locator("input.ecx-search").fill("");
    await pop.getByRole("button", { name: "Xem tất cả" }).click();
    await expect(page.locator(".ecx-inserter-panel")).toBeVisible();
    await expect(pop).toHaveCount(0);
  });

  test("bộ cột: nút + ở mép phải thêm cột, con trỏ vào cột mới", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    await clickEnd(c, "Phải");
    await c.locator(".ecx-add-column").click();
    const cols = (await blocks(page)).find((b) => b.type === "columns")!;
    expect(cols.content).toHaveLength(3);
    await page.keyboard.type("Cột ba");
    await expect(c.locator(".ecx-column").nth(2)).toContainText("Cột ba");
  });

  test("ảnh trống: Tải lên, Thư viện, Chèn từ URL; kéo thả tệp vào khối tải lên luôn", async ({ page }) => {
    const c = await open(page, "?doc=post&media=1");
    await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 3, [{ id: "img1", type: "image", attrs: {} }]); });
    const ph = c.locator('[data-ecx-block="img1"]');
    await expect(ph.getByRole("button", { name: "Tải lên" })).toBeVisible();
    await expect(ph.getByRole("button", { name: "Thư viện" })).toBeVisible();
    await expect(ph.getByText("Kéo thả ảnh vào đây")).toBeVisible();
    await ph.locator("input[type=file]").setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) });
    await expect.poll(async () => (await blocks(page)).find((b) => b.type === "image")?.attrs.alt).toBe("banner");
    expect(await page.evaluate(() => (window as any).__ecx.uploads)).toEqual(["banner.png"]);
    // Khối ảnh thứ hai: kéo thả tệp
    await page.evaluate(() => {
      const s = (window as any).__ecx.store;
      s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "img2", type: "image", attrs: {} }]);
    });
    const ph2 = c.locator('[data-ecx-block="img2"]');
    await ph2.evaluate((el) => {
      const dt = new DataTransfer();
      dt.items.add(new File(["x"], "keo-tha.jpg", { type: "image/jpeg" }));
      el.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
      el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await expect.poll(async () => (await blocks(page)).find((b) => b.type === "image" && b.attrs.alt === "keo-tha")).toBeTruthy();
  });

  test("lề trong: thanh kéo theo bậc preset, tách 4 cạnh, giá trị tuỳ chỉnh có đơn vị", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    const insp = page.locator(".ecx-inspector");
    await insp.getByRole("tab", { name: "Kiểu dáng" }).click();
    const pad = insp.locator(".ecx-spacing").first();
    const slider = pad.locator("input[type=range]").first();
    await slider.fill("4"); // -1 = không, 0 = "0", … 4 = "lg"
    expect((await blocks(page))[1].attrs.style).toMatchObject({ padding: { base: "lg" } });
    await pad.locator(".ecx-spacing-head .ecx-tool").click();
    const rows = pad.locator(".ecx-step-row");
    await expect(rows).toHaveCount(4); // trên, phải, dưới, trái
    for (const i of [1, 3]) { // phải + trái: giá trị tuỳ chỉnh
      await rows.nth(i).getByRole("button", { name: /giá trị tuỳ chỉnh/ }).click();
      await rows.nth(i).locator(".ecx-unit-input input").fill("24");
    }
    expect((await blocks(page))[1].attrs.style).toMatchObject({ padding: { base: { top: "lg", bottom: "lg", left: "24px", right: "24px" } } });
  });

  test("thư viện khối: rê chuột lên khối hiện thẻ mô tả", async ({ page }) => {
    await open(page, "?doc=post");
    await page.locator(".ecx-topbar").getByRole("button", { name: "Thêm khối" }).click();
    await page.locator('.ecx-inserter-panel .ecx-block-tile[data-key="mediaText"]').first().hover();
    await expect(page.locator(".ecx-block-preview")).toContainText("Ảnh và chữ đặt cạnh nhau");
  });
});
