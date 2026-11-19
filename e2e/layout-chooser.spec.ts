// Bố cục chọn sẵn: chèn từ bảng chèn → ô chọn thẻ có hình thu nhỏ thế chỗ khối; chọn / bỏ qua; đổi lại ở bảng phải.
import { expect, test } from "@playwright/test";
import { canvas, open } from "./helpers";

const CASES: Array<[key: string, type: string, pick: string, expected: Record<string, unknown>]> = [
  ["tabs", "tabs", "Dọc", { orientation: "vertical" }],
  ["accordion", "accordion", "2 cột", { columns: 2 }],
  ["iconList", "iconList", "Ngang", { layout: "inline" }],
  ["testimonial", "testimonial", "Bong bóng", { variant: "bubble" }],
  ["carousel", "carousel", "2 slide", { slidesPerView: 2 }],
];

async function insert(page: import("@playwright/test").Page, key: string) {
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  await page.locator(`.ecx-inserter-popover [data-key="${key}"], .ecx-inserter-panel [data-key="${key}"]`).first().click();
  await page.waitForTimeout(200); // con trỏ tự vào ô chữ đầu của khối vừa chèn (đợi xong rồi mới chọn khối)
}
const blockOf = (page: import("@playwright/test").Page, type: string) => page.evaluate((t) => {
  const find = (list: any[]): any => { for (const b of list) { if (b.type === t) return b; const r = b.content && find(b.content); if (r) return r; } };
  return JSON.parse(JSON.stringify(find((window as any).__ecx.store.getState().docs.root.blocks) ?? null));
}, type);

for (const [key, type, pick, expected] of CASES) {
  test(`${type}: chèn xong hiện ô chọn bố cục; chọn "${pick}" áp thuộc tính, ô chọn biến mất`, async ({ page }) => {
    const c = await open(page, "?doc=post");
    await insert(page, key);
    const chooser = c.locator(".ecx-variation-chooser");
    await expect(chooser).toBeVisible();
    await expect(chooser.locator(".ecx-variation")).not.toHaveCount(0);
    await expect(chooser.locator(".ecx-vthumb").first()).toBeVisible();
    await chooser.getByRole("radio", { name: pick }).click();
    await expect(chooser).toHaveCount(0);
    expect((await blockOf(page, type)).attrs).toMatchObject(expected);
    // không rò cờ chờ chọn vào nội dung lưu
    expect(JSON.stringify(await blockOf(page, type))).not.toContain("pick");
    // bảng phải: thẻ đang dùng được đánh dấu, đổi sang thẻ khác được
    const id = (await blockOf(page, type)).id;
    await page.evaluate((i) => (window as any).__ecx.store.select([i]), id);
    const grid = page.locator(".ecx-inspector .ecx-variations");
    await expect(grid.getByRole("radio", { name: pick })).toHaveAttribute("aria-checked", "true");
  });
  test(`${type}: "Bỏ qua" giữ bố cục mặc định`, async ({ page }) => {
    const c = await open(page, "?doc=post");
    await insert(page, key);
    await c.locator(".ecx-variation-skip").click();
    await expect(c.locator(".ecx-variation-chooser")).toHaveCount(0);
    expect(await blockOf(page, type)).not.toBeNull();
  });
}

test("ảnh chụp ô chọn bố cục (kiểm bằng mắt)", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await insert(page, "tabs");
  await expect(c.locator(".ecx-variation-chooser")).toBeVisible();
  await page.screenshot({ path: "../plans/report-v2/after/chooser-tabs.png" });
  await c.locator(".ecx-variation-skip").click();
  await page.screenshot({ path: "../plans/report-v2/after/tabs-inspector.png" });
});

test("Carousel: có 3 slide mẫu thật; thêm slide, xoá slide, đếm \"n / tổng\"", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await insert(page, "carousel");
  await c.locator(".ecx-variation-skip").click();
  const nav = c.locator(".ecx-carousel-nav");
  await expect(nav.locator(".ecx-carousel-count")).toContainText("1 / 3");
  expect((await blockOf(page, "carousel")).content.map((g: any) => g.content[0].type)).toEqual(["heading", "heading", "heading"]);
  await c.locator('[data-type="carousel"] [data-type="heading"]').first().click();
  await nav.getByRole("button", { name: "Thêm slide" }).click();
  await expect(nav.locator(".ecx-carousel-count")).toContainText("/ 4");
  await nav.getByRole("button", { name: "Xoá slide này" }).click();
  await expect(nav.locator(".ecx-carousel-count")).toContainText("/ 3");
});

// Khối nhỏ: không bật ô chọn khi chèn, nhưng bảng phải có lưới bố cục
const INSPECTOR_ONLY: Array<[key: string, type: string, pick: string, expected: Record<string, unknown>]> = [
  ["iconBox", "iconBox", "Icon phải", { position: "right" }],
  ["progressBar", "progressBar", "Chữ phía dưới", { textPosition: "below" }],
];
for (const [key, type, pick, expected] of INSPECTOR_ONLY) {
  test(`${type}: chèn không bật ô chọn; lưới bố cục ở bảng phải đổi "${pick}"`, async ({ page }) => {
    const c = await open(page, "?doc=post");
    await insert(page, key);
    await expect(c.locator(".ecx-variation-chooser")).toHaveCount(0);
    const id = (await blockOf(page, type)).id;
    await page.evaluate((i) => (window as any).__ecx.store.select([i]), id);
    await page.locator(".ecx-inspector .ecx-variations").getByRole("radio", { name: pick }).click();
    expect((await blockOf(page, type)).attrs).toMatchObject(expected);
    await expect(page.locator(".ecx-inspector .ecx-variations").getByRole("radio", { name: pick })).toHaveAttribute("aria-checked", "true");
  });
}

test("ô chọn bố cục dùng được bằng bàn phím: thẻ đầu có focus, mũi tên đổi thẻ, Enter chọn, Esc bỏ qua", async ({ page , browserName }) => {
  test.fixme(browserName === "firefox", 'Firefox của Playwright: phím mũi tên / Esc không tới phần tử trong iframe sau focus() — chưa kiểm bằng Firefox thật');
  const c = await open(page, "?doc=post");
  await insert(page, "tabs");
  const radios = c.locator(".ecx-variation-chooser").getByRole("radio");
  await expect(radios.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(radios.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(radios.last()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(c.locator(".ecx-variation-chooser")).toHaveCount(0);
  expect((await blockOf(page, "tabs")).attrs).toMatchObject({ orientation: "vertical" });
});

test("ô chọn bố cục: Esc bỏ qua", async ({ page , browserName }) => {
  test.fixme(browserName === "firefox", 'Firefox của Playwright: phím Esc không tới phần tử trong iframe sau focus() — chưa kiểm bằng Firefox thật');
  const c = await open(page, "?doc=post");
  await insert(page, "accordion");
  await expect(c.locator(".ecx-variation-chooser")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(c.locator(".ecx-variation-chooser")).toHaveCount(0);
});

test("Tabs: bảng phải liệt kê từng tab — sửa tiêu đề, icon, phụ đề ngay ở khối cha", async ({ page }) => {
  await open(page, "?doc=empty");
  await page.evaluate(() => { const st = (window as any).__ecx.store; st.insert("root", null, 0, [{ id: "tt1", type: "tabs", attrs: {}, content: [{ id: "ta", type: "tab", attrs: { title: "Một" }, content: [{ id: "tp", type: "paragraph", attrs: {}, inline: [{ text: "x" }] }] }, { id: "tb", type: "tab", attrs: { title: "Hai" }, content: [{ id: "tq", type: "paragraph", attrs: {}, inline: [{ text: "y" }] }] }] }]); });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__ecx.store.select(["tt1"]));
  const rows = page.locator(".ecx-inspector [data-tab-row]");
  await expect(rows).toHaveCount(2);
  await rows.nth(1).getByLabel("Tiêu đề tab 2").fill("Giá");
  await rows.nth(1).getByLabel("Phụ đề 2").fill("từ 99k");
  await rows.nth(1).getByRole("button", { name: "Icon 2" }).click();
  await rows.nth(1).locator(".ecx-icon-pop [role=option]").nth(1).click();
  const attrs = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__ecx.store.block("tb").attrs)));
  expect(attrs.title).toBe("Giá"); expect(attrs.subtitle).toBe("từ 99k"); expect(attrs.icon).toBeTruthy();
});

test("Icon trên thanh công cụ: Icon Box đổi icon, Icon List đổi icon của mục đang chọn", async ({ page }) => {
  await open(page, "?doc=empty");
  await page.evaluate(() => { const st = (window as any).__ecx.store; st.insert("root", null, 0, [{ id: "ib1", type: "iconBox", attrs: { icon: "star", title: "A" } }, { id: "il1", type: "iconList", attrs: { items: [{ text: "Một" }, { text: "Hai" }] } }]); });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__ecx.store.select(["ib1"]));
  await page.locator('.ecx-toolbar button[aria-label="Chọn icon"]').click();
  await page.locator(".ecx-tool-icon-pop .ecx-icon-cell").nth(5).click();
  const icon = await page.evaluate(() => (window as any).__ecx.store.block("ib1").attrs.icon);
  expect(icon).not.toBe("star");
  await page.evaluate(() => (window as any).__ecx.store.select(["il1"]));
  const c = page.locator("iframe[data-ecx-canvas]").contentFrame();
  await c.locator('[data-ecx-block="il1"] li input').nth(1).focus();
  await page.locator('.ecx-toolbar button[aria-label="Chọn icon"]').click();
  await page.locator(".ecx-tool-icon-pop .ecx-icon-cell").nth(4).click();
  const items = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__ecx.store.block("il1").attrs.items)));
  expect(items[1].icon).toBeTruthy(); expect(items[0].icon).toBeUndefined();
});

test("kéo độ rộng nội dung Nhóm: có khung vùng nội dung theo số px, nội dung canh giữa vẫn thấy được độ rộng đổi", async ({ page }) => {
  const c = await open(page, "?doc=empty");
  await page.evaluate(() => { const st = (window as any).__ecx.store; st.insert("root", null, 0, [{ id: "g1", type: "group", attrs: { style: { layout: { type: "flex", justify: "center" } } }, content: [{ id: "k1", type: "paragraph", attrs: { textAlign: "center" }, inline: [{ type: "text", text: "LUMEN" }] }] }]); });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__ecx.store.select(["g1"]));
  const h = c.locator('[data-ecx-block="g1"] [data-ecx-zone="content-width-right"]');
  const hb = (await h.boundingBox())!;
  await page.mouse.move(hb.x + 5, hb.y + 20); await page.mouse.down(); await page.mouse.move(hb.x - 200, hb.y + 20, { steps: 6 });
  const guide = c.locator('[data-ecx-block="g1"] .ecx-cw-guide');
  await expect(guide).toHaveClass(/is-dragging/);
  const gw = (await guide.boundingBox())!.width;
  const tip = parseInt((await c.locator(".ecx-cw-tip").first().textContent())!, 10);
  expect(Math.abs(gw - tip)).toBeLessThan(3);
  await page.mouse.up();
});

test("Đếm ngược: bảng phải chọn ngày giờ bằng lịch + múi giờ (không còn ô chữ gõ tay)", async ({ page }) => {
  await open(page, "?doc=empty");
  await page.evaluate(() => { const st = (window as any).__ecx.store; st.insert("root", null, 0, [{ id: "cd1", type: "countdown", attrs: { target: "2026-12-01T10:00" } }]); });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__ecx.store.select(["cd1"]));
  const f = page.locator('.ecx-inspector .ecx-countdown-fields');
  await expect(f.locator('input[type="datetime-local"]')).toBeVisible();
  await f.locator('input[type="datetime-local"]').fill("2027-01-05T08:30");
  await f.locator("select").selectOption("Asia/Ho_Chi_Minh");
  const a = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__ecx.store.block("cd1").attrs)));
  expect(a.timezone).toBe("Asia/Ho_Chi_Minh");
  expect(String(a.target)).toContain("2027-01-05T08:30");
});

test("Icon Box: tab Kiểu dáng có phần riêng cho nút Xem thêm", async ({ page }) => {
  await open(page, "?doc=empty");
  await page.evaluate(() => { const st = (window as any).__ecx.store; st.insert("root", null, 0, [{ id: "ib1", type: "iconBox", attrs: { icon: "star", title: "A", text: "B", href: "https://example.com", linkMode: "button" } }]); });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__ecx.store.select(["ib1"]));
  await page.locator(".ecx-inspector").getByRole("tab", { name: "Kiểu dáng" }).click();
  await expect(page.locator(".ecx-inspector .ecx-style-section-title", { hasText: "Nút Xem thêm" })).toBeVisible();
});

test("thanh công cụ của khối nằm bên phải khung soạn không tràn ra đè bảng phải", async ({ page }) => {
  await open(page, "?doc=post");
  await page.getByRole("button", { name: "Thêm khối" }).first().click();
  await page.locator(".ecx-block-tile[data-key='iconBox']").click();
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({ t: document.querySelector(".ecx-toolbar")!.getBoundingClientRect().right, f: document.querySelector("iframe[data-ecx-canvas]")!.getBoundingClientRect().right }));
  expect(r.t).toBeLessThanOrEqual(r.f);
});

test("Carousel: thêm, nhân đôi, đổi chỗ, xoá slide ở thanh công cụ; hoàn tác; track cuộn tới slide mới", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await insert(page, "carousel");
  await c.locator(".ecx-variation-skip").click();
  const slides = async () => (await blockOf(page, "carousel")).content.map((g: any) => g.content[0].inline?.[0]?.text ?? "");
  expect(await slides()).toHaveLength(3);
  await c.getByRole("button", { name: "Thêm slide" }).click();
  expect(await slides()).toHaveLength(4);
  // slide mới ở cuối và nằm trong khung nhìn (track cuộn tới)
  await expect.poll(async () => c.locator('.ecx-carousel-track > [data-type="group"]').last().evaluate((e) => { const t = e.closest(".ecx-carousel-track")!.getBoundingClientRect(), r = e.getBoundingClientRect(); return r.right <= t.right + 2 && r.left >= t.left - 2; })).toBe(true);
  await c.getByRole("button", { name: "Nhân đôi slide" }).click();
  expect(await slides()).toHaveLength(5);
  await c.getByRole("button", { name: "Xoá slide này" }).click();
  expect(await slides()).toHaveLength(4);
  await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+z`);
  expect(await slides()).toHaveLength(5);
});

test("Carousel: bảng phải có đủ tuỳ chỉnh slider (số slide theo khổ, nút, chấm, tự chuyển, vòng lặp, khoảng cách); giây chỉ hiện khi bật tự chuyển", async ({ page }) => {
  await open(page, "?doc=empty");
  await page.evaluate(() => { const st = (window as any).__ecx.store; st.insert("root", null, 0, [{ id: "cr", type: "carousel", attrs: { slidesPerView: 3 }, content: [1, 2, 3, 4].map((i) => ({ id: "s" + i, type: "group", attrs: {}, content: [{ id: "p" + i, type: "paragraph", attrs: {}, inline: [{ type: "text", text: "S" + i }] }] })) }]); });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__ecx.store.select(["cr"]));
  const ins = page.locator(".ecx-inspector");
  for (const label of ["Slide thấy cùng lúc (tablet)", "Slide thấy cùng lúc (điện thoại)", "Nút trước / sau hai bên", "Chấm chỉ vị trí bên dưới", "Tự chuyển slide", "Khoảng cách giữa các slide"]) await expect(ins.getByText(label, { exact: true })).toBeVisible();
  await expect(ins.getByText("Giây giữa hai lần chuyển")).toHaveCount(0);
  await ins.getByRole("checkbox", { name: "Tự chuyển slide" }).check();
  await expect(ins.getByText("Giây giữa hai lần chuyển")).toBeVisible();
  expect((await blockOf(page, "carousel")).attrs.autoplay).toBe(true);
});

test("Cột có nội dung: cao đúng như website (không độn chỗ thả), nút + cuối cột hiện khi rê chuột, bấm mở bảng chèn vào đúng cột; nhãn khối không che chữ", async ({ page }) => {
  const c = await open(page, "");
  const col = c.locator("[data-type=column]").first();
  await col.scrollIntoViewIfNeeded();
  const b = (await col.boundingBox())!;
  // Khung soạn khớp website: cột có nội dung không bị độn min-height; chỗ thả nằm ở nút + cuối cột (hiện khi rê chuột)
  expect(b.height).toBeLessThan(90);
  const tail = col.locator(".ecx-tail-appender");
  await expect(tail).toHaveCount(1);
  expect(await tail.evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height - 14);
  await expect.poll(() => tail.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  await tail.click();
  await expect(page.locator(".ecx-inserter-popover, .ecx-inserter-panel").first()).toBeVisible();
  await page.locator(".ecx-block-tile[data-key='heading'], .ecx-inserter-popover [data-key='heading']").first().click();
  const kids = await page.evaluate(() => { const w = (l: any[]): any => { for (const b of l) { if (b.type === "column") return b; const r = b.content && w(b.content); if (r) return r; } }; return w((window as any).__ecx.store.getState().docs.root.blocks).content.map((k: any) => k.type); });
  expect(kids).toEqual(["paragraph", "heading"]);
});

test("Cột: 'Thứ tự trên điện thoại' đưa cột lên đầu / xuống cuối khi xếp chồng (khổ điện thoại) và lưu thành style.order.mobile", async ({ page }) => {
  const c = await open(page, "?doc=empty&content=1");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "ro", type: "columns", attrs: {}, content: [
    { id: "co1", type: "column", attrs: {}, content: [{ id: "pa", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Chữ" }] }] },
    { id: "co2", type: "column", attrs: {}, content: [{ id: "pb", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Ảnh" }] }] }] }]); });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Điện thoại/i }).first().click(); // khổ điện thoại: hai cột xếp chồng
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as any).__ecx.store.select(["co2"]));
  await page.waitForTimeout(300);
  const insp = page.locator(".ecx-inspector");
  const top = (id: string) => c.locator(`[data-ecx-block="${id}"]`).evaluate((e) => Math.round(e.getBoundingClientRect().top));
  expect(await top("co1")).toBeLessThan(await top("co2")); // mặc định: chữ trên, ảnh dưới
  if (!(await insp.getByRole("radio", { name: "Lên đầu" }).isVisible())) await insp.getByRole("button", { name: "Thứ tự trên điện thoại" }).click();
  await insp.getByRole("radio", { name: "Lên đầu" }).click();
  await page.waitForTimeout(300);
  expect(await top("co2")).toBeLessThan(await top("co1")); // cột ảnh lên đầu
  expect((await page.evaluate(() => (window as any).__ecx.store.block("co2").attrs.style)).order).toEqual({ mobile: -1 });
  await insp.getByRole("radio", { name: "Giữ nguyên" }).click();
  await page.waitForTimeout(300);
  expect(await top("co1")).toBeLessThan(await top("co2"));
  expect(JSON.stringify(await page.evaluate(() => (window as any).__ecx.store.block("co2").attrs.style ?? {}))).not.toContain("order");
});
