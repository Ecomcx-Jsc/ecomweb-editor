import { expect, test, type Page } from "@playwright/test";
import { open, state } from "./helpers";

/**
 * 1.24 (như Elementor): ô Nền thống nhất ở tab Cài đặt của nhóm / cột / ảnh bìa, mục Kiểu dáng riêng của khối (core-controls)
 * sinh CSS thật trên khung soạn, tabs có thanh tiêu đề "Tab 1 / Tab 2", ô bảng trống vẫn thấy lưới, ảnh bìa phủ kín khối.
 * ECX_SHOTS=<thư mục> → lưu ảnh chụp bảng cài đặt + khung soạn.
 */
const insert = (page: Page, nodes: unknown[]) => page.evaluate((n) => { const s = (window as any).__ecx.store; s.insert("root", null, 0, n, { select: true }); }, nodes);
const block = async (page: Page, id: string) => {
  const find = (list: any[]): any => { for (const b of list) { if (b.id === id) return b; const x = b.content && find(b.content); if (x) return x; } };
  return find((await state(page)).docs.root.blocks);
};
const p = (id: string, text = "") => ({ id, type: "paragraph", attrs: {}, inline: text ? [{ type: "text", text }] : [] });
const shot = async (page: Page, name: string) => { if (process.env.ECX_SHOTS) await page.screenshot({ path: `${process.env.ECX_SHOTS}/${name}.png` }); };
const insp = (page: Page) => page.locator(".ecx-inspector");

test.describe("kiểu dáng khối kiểu Elementor", () => {
  test("nhóm: ô Nền ngay tab Cài đặt (Màu | Chuyển màu | Ảnh), màu nền cũ được chuyển sang style", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await insert(page, [{ id: "g1", type: "group", attrs: { background: "#fef3c7" }, content: [p("g1p", "Trong nhóm")] }]);
    await page.evaluate(() => (window as any).__ecx.store.select(["g1"]));
    const panel = insp(page).locator(".ecx-style-section", { hasText: "Nền" }).first();
    await expect(panel.getByRole("radio", { name: "Ảnh" })).toBeVisible();
    await expect(panel.getByRole("radio", { name: "Chuyển màu" })).toBeVisible();
    await expect(insp(page).locator(".ecx-chip-swatch").first()).toBeVisible();
    await shot(page, "group-background-settings");
    await panel.locator(".ecx-chip-swatch").first().click();
    const g = await block(page, "g1");
    expect(g.attrs.background).toBeUndefined();
    expect(g.attrs.style.color.background).toBeTruthy();
    expect(g.attrs.style.radius).toBe("12px"); // dáng cũ (bo góc + đệm) giữ nguyên
    expect(g.attrs.padding).toBe("medium");
    await panel.getByRole("radio", { name: "Ảnh" }).click();
    await expect(panel.getByRole("button", { name: /Chọn ảnh/ }).or(panel.getByLabel("Đường dẫn ảnh"))).toBeVisible();
    await expect(c.locator('[data-ecx-block="g1"]')).toBeVisible();
  });

  test("danh sách: mục Kiểu dáng › Danh sách đổi dấu đầu dòng / màu dấu / khoảng cách → CSS thật trên khung soạn", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await insert(page, [{ id: "l1", type: "bulletList", attrs: {}, content: [{ id: "li1", type: "listItem", attrs: {}, content: [p("lp1", "Một")] }, { id: "li2", type: "listItem", attrs: {}, content: [p("lp2", "Hai")] }] }]);
    await page.evaluate(() => (window as any).__ecx.store.select(["l1"]));
    await insp(page).getByRole("tab", { name: "Kiểu dáng" }).click();
    const sec = insp(page).locator(".ecx-style-section", { hasText: "Danh sách" }).first();
    await sec.getByLabel("Kiểu dấu đầu dòng").selectOption("square");
    expect((await block(page, "l1")).attrs.listMarker).toBe("square");
    const ul = c.locator('[data-ecx-block="l1"]');
    await expect.poll(() => ul.evaluate((n) => getComputedStyle(n).listStyleType)).toBe("square");
    await shot(page, "list-style-tab");
  });

  test("nút: thẻ Thường / Rê chuột trong mục Nút; màu nền qua biến của vỏ nút", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await insert(page, [{ id: "bs", type: "buttons", attrs: {}, content: [{ id: "b1", type: "button", attrs: { text: "Mua", variant: "primary", buttonBg: "#111111" } }] }]);
    await page.evaluate(() => (window as any).__ecx.store.select(["b1"]));
    await insp(page).getByRole("tab", { name: "Kiểu dáng" }).click();
    const sec = insp(page).locator(".ecx-style-section", { hasText: "Nút" }).first();
    await expect(sec.getByRole("tab", { name: "Rê chuột" })).toBeVisible();
    await expect.poll(() => c.locator('[data-ecx-block="b1"]').evaluate((n) => getComputedStyle(n).backgroundColor)).toBe("rgb(17, 17, 17)");
    await shot(page, "button-style-tab");
  });

  test("tabs: thanh tiêu đề Tab 1 / Tab 2, bấm đổi thẻ; ô bảng trống vẫn thấy lưới", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await insert(page, [
      { id: "t", type: "tabs", attrs: {}, content: [{ id: "t1", type: "tab", attrs: { title: "" }, content: [p("tp1", "Nội dung 1")] }, { id: "t2", type: "tab", attrs: { title: "" }, content: [p("tp2", "Nội dung 2")] }] },
      { id: "tb", type: "table", attrs: {}, content: [{ id: "r1", type: "tableRow", attrs: {}, content: [{ id: "c1", type: "tableCell", attrs: {}, content: [p("cp1")] }, { id: "c2", type: "tableCell", attrs: {}, content: [p("cp2")] }] }] },
    ]);
    const bar = c.locator('[data-ecx-block="t"] [role=tablist]');
    await expect(bar.locator("[role=tab]")).toHaveCount(2);
    await expect(bar.locator("[role=tab]").nth(1).locator("[data-placeholder]")).toHaveAttribute("data-placeholder", "Tên tab…");
    await expect(c.getByText("Nội dung 2")).toBeHidden();
    await page.evaluate(() => (window as any).__ecx.store.clearSelection()); // thanh công cụ nổi của đoạn đang chọn nằm đè thanh tab
    await bar.locator("[role=tab]").nth(1).click();
    await expect(c.getByText("Nội dung 2")).toBeVisible();
    await expect(c.getByText("Nội dung 1")).toBeHidden();
    const cell = c.locator('[data-ecx-block="c1"]');
    expect(await cell.evaluate((n) => getComputedStyle(n).outlineStyle)).toBe("dashed");
    expect((await cell.boundingBox())!.height).toBeGreaterThan(20);
    await shot(page, "tabs-table-canvas");
  });

  test("ảnh bìa: ảnh phủ kín khối dù theme đặt img { height:auto }, lớp phủ + chữ nằm trên", async ({ page }) => {
    const css = encodeURIComponent("img { height: auto; max-width: 100%; }");
    const c = await open(page, `?doc=post&css=${css}`);
    await insert(page, [{ id: "cv", type: "cover", attrs: { src: "/sample.svg", minHeight: "320px", overlay: "#000000", opacity: 50, focal: "50% 0%" }, content: [{ id: "h", type: "heading", attrs: { level: 2 }, inline: [{ type: "text", text: "Tiêu đề trên ảnh" }] }] }]);
    const cover = c.locator('[data-ecx-block="cv"]');
    const img = cover.locator(".ecx-cover-img");
    await expect(img).toBeVisible();
    const [cb, ib] = [(await cover.boundingBox())!, (await img.boundingBox())!];
    expect(Math.abs(cb.height - ib.height)).toBeLessThan(2);
    expect(Math.abs(cb.width - ib.width)).toBeLessThan(2);
    expect(await img.evaluate((n) => getComputedStyle(n).objectPosition)).toBe("50% 0%");
    await expect(cover.getByText("Tiêu đề trên ảnh")).toBeVisible();
    // Ô Nền của ảnh bìa ở tab Cài đặt: loại Ảnh đang chọn, có điểm lấy nét
    await page.evaluate(() => (window as any).__ecx.store.select(["cv"]));
    await expect(insp(page).getByRole("radio", { name: "Ảnh" })).toHaveAttribute("aria-checked", "true");
    await expect(insp(page).getByRole("radiogroup", { name: "Điểm lấy nét" })).toBeVisible();
    await shot(page, "cover-canvas");
  });
});
