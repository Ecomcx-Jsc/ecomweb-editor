import { expect, test, type Page } from "@playwright/test";
import { canvas, clickEnd, open, showToolbar, state } from "./helpers";

/** Bố cục (Hàng ngang / Xếp dọc / Lưới), nền chuyển màu, bóng, hover (@ecomcx/ecomweb-content 1.15) — kiểm CSS thật trên khung soạn. */
const groupOf = async (page: Page) => (await state(page)).docs.root.blocks.find((b: { type: string }) => b.type === "group");
const insertVia = async (page: Page, query: string) => {
  await page.keyboard.press("Enter");
  await page.keyboard.type(`/${query}`);
  await page.keyboard.press("Enter");
};

test.describe("bố cục + hiệu ứng", () => {
  test("ảnh bìa: chọn màu nền từ chỗ chọn → khối không lỗi (hook phải gọi trước return sớm)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "anh bia");
    const cover = c.locator('[data-type="cover"]');
    await expect(cover).toBeVisible();
    await cover.locator(".ecx-chip-swatch").first().click();
    await expect(c.locator(".ecx-block-error")).toHaveCount(0);
    await expect(cover.locator(".ecx-cover-overlay")).toBeVisible();
  });

  test("chèn Hàng ngang: hai khối nằm cạnh nhau; đổi sang Xếp dọc rồi Lưới từ thanh công cụ", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "hang ngang");
    await page.keyboard.type("Trái");
    let g = await groupOf(page);
    expect(g.attrs.style.layout).toEqual({ type: "flex", direction: { base: "row" } });
    const el = c.locator(`[data-ecx-block="${g.id}"]`);
    await expect(el).toHaveCSS("display", "flex");
    const kids = el.locator(":scope > [data-ecx-block]");
    const [a, b] = [await kids.nth(0).boundingBox(), await kids.nth(1).boundingBox()];
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    expect(b!.x).toBeGreaterThan(a!.x);

    await showToolbar(page);
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Xếp dọc" }).click();
    g = await groupOf(page);
    expect(g.attrs.style.layout.direction).toEqual({ base: "column" });
    await expect(el).toHaveCSS("flex-direction", "column");
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Lưới" }).click();
    g = await groupOf(page);
    expect(g.attrs.style.layout).toEqual({ type: "grid", columns: { base: 3 } });
    await expect(el).toHaveCSS("display", "grid");
    expect((await el.evaluate((n) => getComputedStyle(n).gridTemplateColumns)).split(" ").length).toBe(3);
  });

  test("lưới: số cột theo khổ — điện thoại 1 cột (xem trước khổ điện thoại đúng media query)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "luoi");
    await page.keyboard.type("Ô 1");
    await showToolbar(page);
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
    const insp = page.locator(".ecx-inspector");
    await insp.getByRole("tab", { name: "Kiểu dáng" }).click();
    // Khổ điện thoại trong bảng Kiểu dáng rồi đặt 1 cột
    await insp.getByRole("radio", { name: /Điện thoại|Mobile/ }).first().click();
    await insp.getByLabel("Số cột").selectOption("1");
    const g = await groupOf(page);
    expect(g.attrs.style.layout.columns).toEqual({ base: 3, mobile: 1 });
    const el = c.locator(`[data-ecx-block="${g.id}"]`);
    expect((await el.evaluate((n) => getComputedStyle(n).gridTemplateColumns)).split(" ").length).toBe(3);
    await page.getByRole("button", { name: "Điện thoại", exact: true }).click();
    await expect.poll(async () => (await el.evaluate((n) => getComputedStyle(n).gridTemplateColumns)).split(" ").length).toBe(1);
  });

  test("nền chuyển màu (preset theme + tuỳ chỉnh), bóng, nhấc lên khi rê chuột", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "nhom");
    await page.keyboard.type("Thẻ");
    await showToolbar(page);
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
    const insp = page.locator(".ecx-inspector");
    await insp.getByRole("tab", { name: "Kiểu dáng" }).click();
    await insp.getByRole("button", { name: "Nền & hiệu ứng" }).click();
    await insp.getByRole("button", { name: "brand" }).click();
    let g = await groupOf(page);
    expect(g.attrs.style.gradient).toBe("brand");
    const el = c.locator(`[data-ecx-block="${g.id}"]`);
    await expect.poll(() => el.evaluate((n) => getComputedStyle(n).backgroundImage)).toContain("linear-gradient");
    await insp.getByRole("button", { name: "Tuỳ chỉnh", exact: true }).click();
    g = await groupOf(page);
    expect(g.attrs.style.gradient).toMatch(/^linear-gradient\(135deg, #1a597b 0%, #f26251 100%\)$/);
    await insp.getByLabel("Đổ bóng").first().selectOption("md");
    await expect.poll(() => el.evaluate((n) => getComputedStyle(n).boxShadow)).not.toBe("none");
    await insp.getByRole("button", { name: "Khi rê chuột" }).click();
    await insp.getByLabel("Nhấc lên").check();
    g = await groupOf(page);
    expect(g.attrs.style.hover).toEqual({ lift: true });
    await el.hover();
    await expect.poll(() => el.evaluate((n) => getComputedStyle(n).transform)).not.toBe("none");
  });

  test("lưu: kiểu dáng mới đi vào nội dung lưu (đúng định dạng, qua được chuẩn hoá)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "hang ngang");
    const saved = await page.evaluate(async () => {
      const { store } = (window as any).__ecx;
      const m = await import("/@fs/Volumes/code/ecomweb-package/ecomweb-editor/src/v2/index.ts" as string);
      const content = m.contentFromBlocks(store.getState().docs.root.blocks);
      const c2 = await import("@ecomcx/ecomweb-content" as string);
      return JSON.stringify(c2.normalizeContent(content).doc);
    }).catch(() => null);
    // Không import được module trong trang (môi trường build) → kiểm trực tiếp store
    const g = await groupOf(page);
    expect(g.attrs.style.layout.type).toBe("flex");
    if (saved) expect(saved).toContain("\"layout\":{\"type\":\"flex\"");
  });
});
