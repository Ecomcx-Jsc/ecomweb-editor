import { expect, test, type Page } from "@playwright/test";
import { canvas, clickEnd, mod, open, shape, showToolbar, state, texts } from "./helpers";

const tool = (page: Page, label: string) => page.locator(".ecx-toolbar").getByRole("button", { name: label, exact: false });
const blockOf = async (page: Page, type: string) => (await state(page)).docs.root.blocks.find((b: { type: string }) => b.type === type);

test.describe("mẫu + khối plugin", () => {
  test("thư viện mẫu: chèn mẫu lõi 'Ba tính năng' (tiêu đề + 3 cột)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    await page.locator(".ecx-inserter-panel").getByRole("tab", { name: "Mẫu" }).click();
    await page.locator(".ecx-pattern-card", { hasText: "Ba tính năng" }).click();
    const sh = (await shape(page)) as unknown[];
    expect(sh.length).toBeGreaterThan(3);
    expect(JSON.stringify(sh.slice(3))).toContain("columns");
    await expect(c.locator(".ecx-columns")).toBeVisible();
  });

  test("khối plugin viết cho 1.x (defineBlock + registerBlock): chèn bằng /, gõ bên trong, đổi thuộc tính ở form tự sinh", async ({ page }) => {
    const c = await open(page, "?doc=post&plugin=1");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/acme");
    await expect(page.locator(".ecx-inserter-popover").getByRole("option").first()).toContainText("Thông báo Acme");
    await page.keyboard.press("Enter");
    await expect(c.locator(".acme-notice")).toContainText("ACME info");
    await page.keyboard.type("bên trong plugin");
    const block = await blockOf(page, "acme/notice");
    expect(block.attrs.level).toBe("info");
    expect(block.content[0].inline[0].text).toBe("bên trong plugin");
    await showToolbar(page);
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
    await page.locator(".ecx-inspector").getByLabel("Mức").selectOption("warn");
    expect((await blockOf(page, "acme/notice")).attrs.level).toBe("warn");
    await expect(c.locator(".acme-notice.is-warn")).toBeVisible();
  });

  test("panel plugin (registerBlockPanel) hiện cho tiêu đề và lưu thuộc tính thêm", async ({ page }) => {
    const c = await open(page, "?doc=post&plugin=1");
    await clickEnd(c, "Tiêu đề bài");
    await page.locator(".ecx-inspector").getByText("Acme SEO").isVisible();
    await page.locator(".ecx-inspector").getByLabel("noindex").check();
    expect((await state(page)).docs.root.blocks[0].attrs.acmeNoindex).toBe(true);
  });
});

test.describe("bảng, cột, ảnh, nút", () => {
  test("công cụ bảng: thêm hàng, thêm cột, tắt hàng tiêu đề, xoá cột", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    await clickEnd(c, "a1");
    const run = async (item: string) => { await tool(page, "Bảng").click(); await page.getByRole("menuitem", { name: item }).click(); };
    await run("Thêm hàng phía dưới");
    let table = await blockOf(page, "table");
    expect(table.content.length).toBe(3);
    // Con trỏ vào ô mới: gõ được ngay
    await page.keyboard.type("mới");
    table = await blockOf(page, "table");
    expect(table.content[2].content[0].content[0].inline[0].text).toBe("mới");
    await showToolbar(page);
    await run("Thêm cột bên phải");
    table = await blockOf(page, "table");
    expect(table.content.map((r: { content: unknown[] }) => r.content.length)).toEqual([3, 3, 3]);
    expect(table.content[0].content[1].type).toBe("tableHeader");
    await run("Hàng tiêu đề");
    table = await blockOf(page, "table");
    expect(table.content[0].content.every((c: { type: string }) => c.type === "tableCell")).toBe(true);
    await run("Xoá cột");
    table = await blockOf(page, "table");
    expect(table.content.map((r: { content: unknown[] }) => r.content.length)).toEqual([2, 2, 2]);
    await expect(c.locator("table tr")).toHaveCount(3);
  });

  test("gộp ô bên dưới rồi tách lại: bảng luôn đủ ô, ô số rowspan / colspan không còn trong bảng cài đặt", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    await clickEnd(c, "A");
    const run = async (item: string) => { await showToolbar(page); await tool(page, "Bảng").click(); await page.getByRole("menuitem", { name: item }).click(); };
    await run("Gộp với ô bên dưới");
    let table = await blockOf(page, "table");
    expect(table.content.map((r: { content: unknown[] }) => r.content.length)).toEqual([2, 1]);
    expect(table.content[0].content[0].attrs.rowspan).toBe(2);
    await expect(c.locator("table tr").nth(0).locator("th").first()).toHaveAttribute("rowspan", "2");
    await expect(page.locator(".ecx-inspector").getByLabel(/rowspan|colspan/i)).toHaveCount(0);
    await run("Tách ô");
    table = await blockOf(page, "table");
    expect(table.content.map((r: { content: unknown[] }) => r.content.length)).toEqual([2, 2]);
    expect(table.content[0].content[0].attrs.rowspan).toBeUndefined();
  });

  test("kéo tay nắm giữa hai cột đổi tỉ lệ; một lần ⌘Z trả về 50/50", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    await clickEnd(c, "Trái");
    const handle = c.locator("[data-ecx-col-handle='0']");
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();
    const cols = await c.locator(".ecx-columns").boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 10);
    await page.mouse.down();
    await page.mouse.move(cols!.x + cols!.width * 0.3, box!.y + 10, { steps: 6 });
    await page.mouse.move(cols!.x + cols!.width * 0.25, box!.y + 10, { steps: 6 });
    await page.mouse.up();
    let columns = await blockOf(page, "columns");
    const [w1, w2] = columns.content.map((c: { attrs: { width: number } }) => c.attrs.width);
    expect(w1).toBeLessThan(35);
    expect(w1 + w2).toBe(100);
    await page.keyboard.press(`${mod}+z`);
    columns = await blockOf(page, "columns");
    expect(columns.content.map((c: { attrs: { width: number } }) => c.attrs.width)).toEqual([50, 50]);
  });

  test("thêm / bớt cột từ thanh công cụ (chia đều độ rộng)", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    await clickEnd(c, "Phải");
    await tool(page, "Thêm cột").click();
    let columns = await blockOf(page, "columns");
    expect(columns.content.map((c: { attrs: { width: number } }) => c.attrs.width)).toEqual([33, 33, 33]);
    await tool(page, "Bớt cột").click();
    columns = await blockOf(page, "columns");
    expect(columns.content.length).toBe(2);
  });

  test("ảnh: bấm chọn, kéo tay nắm thu nhỏ giữ tỉ lệ", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    await c.locator("figure.ecx-image img").click();
    const handle = c.locator(".ecx-image-handle");
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();
    await page.mouse.move(box!.x + 7, box!.y + 7);
    await page.mouse.down();
    await page.mouse.move(box!.x - 200, box!.y, { steps: 8 });
    await page.mouse.up();
    const img = await blockOf(page, "image");
    expect(img.attrs.width).toBeGreaterThan(150);
    expect(img.attrs.width).toBeLessThan(260);
    expect(Math.abs(img.attrs.height - img.attrs.width / 2)).toBeLessThanOrEqual(1);
  });

  test("nhóm nút: thêm nút, gõ chữ trên nút", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    await clickEnd(c, "Nút 1");
    await tool(page, "Thêm nút").click();
    const buttons = await blockOf(page, "buttons");
    expect(buttons.content.length).toBe(2);
    await clickEnd(c, "Nút 1");
    await page.keyboard.type("!");
    expect((await blockOf(page, "buttons")).content[0].attrs.text).toBe("Nút 1!");
  });
});

test.describe("sửa trang trong template + bàn phím", () => {
  test("template hiện quanh trang nhưng khoá; nội dung trang sửa được; tắt hiện template", async ({ page }) => {
    await page.goto("/?frame=1");
    const c = canvas(page);
    await expect(c.locator(".ecx-template-part-header .ecx-site-title")).toBeVisible();
    await expect(c.locator(".ecx-post-title")).toHaveText("Bài viết mẫu");
    // Bấm vào header (template, khoá): không chọn được
    await c.locator(".ecx-site-title").click({ force: true });
    expect((await state(page)).selection.ids).toEqual([]);
    await clickEnd(c, "Nội dung bài viết.");
    await page.keyboard.type(" sửa trong template");
    expect(await texts(page)).toContain("paragraph:Nội dung bài viết. sửa trong template");
    expect(await texts(page, "part:header")).toEqual([]);
    await page.getByLabel("Hiện template").uncheck();
    await expect(c.locator(".ecx-template-part-header")).toHaveCount(0);
    await expect(c.locator("p", { hasText: "sửa trong template" })).toBeVisible();
  });

  test("Alt+F10 lên thanh công cụ, ← → đi giữa các nút, Esc về lại chữ", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Alt+F10");
    await expect(page.locator(".ecx-toolbar button:focus")).toHaveCount(1);
    const first = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    await page.keyboard.press("ArrowRight");
    const second = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    expect(second).not.toBe(first);
    await page.keyboard.press("Escape");
    await page.keyboard.type("?");
    expect((await texts(page))[2]).toBe("paragraph:Đoạn thứ hai.?");
  });
});
