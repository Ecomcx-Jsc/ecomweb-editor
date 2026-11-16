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

  test("bảng chèn nhanh đóng khi chọn khối khác (bấm vào khối hay chọn qua danh sách khối)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 3, [{ id: "g1", type: "group", attrs: {}, content: [] }, { id: "g2", type: "group", attrs: {}, content: [] }]); });
    const pop = page.locator(".ecx-inserter-popover");
    await c.locator('[data-ecx-block="g1"] .ecx-appender').first().click();
    await expect(pop).toBeVisible();
    // Nút "+ Thêm khối" của khối kia chặn mousedown: vẫn phải đóng bảng cũ rồi mở bảng mới
    await c.locator('[data-ecx-block="g2"] .ecx-appender').first().click();
    await expect(pop).toHaveCount(1);
    await page.evaluate(() => (window as any).__ecx.store.select(["g1"]));
    await expect(pop).toHaveCount(0);
  });

  test("carousel: hiện từng trang slide cạnh nhau, thanh chuyển slide, chọn khối trong slide ẩn thì nhảy tới", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await page.evaluate(() => {
      const g = (i: number) => ({ id: "s" + i, type: "group", attrs: {}, content: [{ id: "p" + i, type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Slide " + i }] }] });
      (window as any).__ecx.store.insert("root", null, 3, [{ id: "cr", type: "carousel", attrs: { slidesPerView: 2 }, content: [1, 2, 3].map(g) }]);
    });
    const car = c.locator('[data-ecx-block="cr"]');
    await expect(c.locator('[data-ecx-block="s1"]')).toBeVisible();
    await expect(c.locator('[data-ecx-block="s2"]')).toBeVisible();
    await expect(c.locator('[data-ecx-block="s3"]')).toBeHidden();
    const [b1, b2] = [await c.locator('[data-ecx-block="s1"]').boundingBox(), await c.locator('[data-ecx-block="s2"]').boundingBox()];
    expect(Math.abs(b1!.y - b2!.y)).toBeLessThan(2); // cạnh nhau, không chồng dọc
    await car.locator(".ecx-carousel-nav").getByRole("button", { name: "Slide sau" }).click();
    await expect(c.locator('[data-ecx-block="s1"]')).toBeHidden();
    await expect(c.locator('[data-ecx-block="s3"]')).toBeVisible();
    await page.evaluate(() => (window as any).__ecx.store.select(["p3"]));
    await expect(c.locator('[data-ecx-block="s3"]')).toBeVisible();
    await page.evaluate(() => (window as any).__ecx.store.select(["p1"]));
    await expect(c.locator('[data-ecx-block="s1"]')).toBeVisible();
    await expect(c.locator('[data-ecx-block="s3"]')).toBeHidden();
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
    await insp.getByRole("tab", { name: "Nâng cao" }).click(); // khoảng cách: lớp chung của mọi khối (như Advanced của Elementor)
    const L = "Khoảng đệm (padding)";
    await insp.getByRole("button", { name: `${L} trên: –` }).click(); // ô 4 cạnh: đang liên kết thì đặt cả 4
    await insp.locator(".ecx-box4-pop").getByRole("radio", { name: "LG" }).click();
    expect((await blocks(page))[1].attrs.style).toMatchObject({ padding: { base: "lg" } });
    await insp.getByRole("button", { name: `${L}: Chỉnh từng cạnh` }).click();
    for (const side of ["phải", "trái"]) { // giá trị tuỳ chỉnh có đơn vị
      await insp.getByRole("button", { name: `${L} ${side}: LG` }).click();
      await insp.getByRole("spinbutton", { name: `${L}: Giá trị tuỳ chỉnh` }).fill("24");
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
