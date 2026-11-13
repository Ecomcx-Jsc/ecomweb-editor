import { expect, test } from "@playwright/test";
import { canvas, clickEnd, open, state } from "./helpers";

/** Hồi quy cho các lỗi trong báo cáo kiểm thử khách hàng (scratch/customer/report). */
const insp = (page: import("@playwright/test").Page) => page.locator(".ecx-inspector");
const blockOf = async (page: import("@playwright/test").Page, type: string) => {
  const s = await state(page);
  const find = (list: any[]): any => { for (const b of list) { if (b.type === type) return b; const r = b.content && find(b.content); if (r) return r; } };
  return find(s.docs.root.blocks);
};

test.describe("báo cáo khách hàng: sửa lỗi trình soạn", () => {
  test("Esc đóng bảng khối (thư viện khối cột trái)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    await expect(page.locator(".ecx-inserter-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".ecx-inserter-panel")).toHaveCount(0);
  });

  test("'Đặt lại' ở khổ điện thoại chỉ xoá giá trị khổ điện thoại, giữ khổ khác", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await insp(page).getByRole("tab", { name: "Kiểu dáng" }).click();
    const typo = insp(page).locator(".ecx-style-section").first();
    await typo.getByRole("radio", { name: "lg" }).click();
    await insp(page).getByRole("radio", { name: /Điện thoại|Mobile/ }).first().click();
    await typo.getByRole("radio", { name: "sm" }).click();
    expect((await blockOf(page, "paragraph")).attrs.style.fontSize).toEqual({ base: "lg", mobile: "sm" });
    await typo.getByRole("button", { name: "Đặt lại" }).first().click();
    expect((await blockOf(page, "paragraph")).attrs.style.fontSize).toEqual({ base: "lg" });
  });

  test("nút thu gọn/mở rộng nhánh trong Cây khối có nhãn theo ngôn ngữ", async ({ page }) => {
    await open(page, "?doc=nested");
    await page.getByRole("button", { name: "Cây khối" }).click();
    const labels = await page.locator("button.ecx-twisty").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(["Thu gọn", "Mở rộng"]).toContain(l);
  });

  test("Cây khối: một tabstop; Delete và ⌘Z hoạt động khi focus ở cây", async ({ page }) => {
    await open(page, "?doc=post");
    await page.getByRole("button", { name: "Cây khối" }).click();
    const rows = page.locator(".ecx-listview .ecx-list-row");
    await expect(rows.first()).toBeVisible();
    // đúng một hàng tab được
    expect(await rows.evaluateAll((els) => els.filter((e) => (e as HTMLElement).tabIndex >= 0).length)).toBe(1);
    const n0 = (await state(page)).docs.root.blocks.length;
    await rows.nth(1).click();
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press("Delete");
    expect((await state(page)).docs.root.blocks.length).toBe(n0 - 1);
    // sau khi xoá, focus có thể rơi ra body; chọn lại một hàng trong cây rồi hoàn tác
    await page.locator(".ecx-listview .ecx-list-row").first().focus();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    expect((await state(page)).docs.root.blocks.length).toBe(n0);
  });

  test("thư viện khối: chèn liên tiếp Đoạn văn rồi Tiêu đề được đủ 2 khối", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    const n0 = (await state(page)).docs.root.blocks.length;
    await page.locator(".ecx-block-tile[data-key='paragraph']").first().click();
    await page.locator(".ecx-block-tile[data-key='heading']").first().click();
    expect((await state(page)).docs.root.blocks.length).toBe(n0 + 2);
  });

  test("thư viện khối: lưới khối không nhảy sau lần chèn đầu (mục 'Đã dùng nhiều' không đổi giữa chừng)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    const tile = page.locator(".ecx-inserter-panel .ecx-block-grid .ecx-block-tile[data-key='image']").last();
    const y0 = (await tile.boundingBox())!.y;
    await page.locator(".ecx-block-tile[data-key='paragraph']").first().click();
    const y1 = (await tile.boundingBox())!.y;
    expect(Math.abs(y1 - y0)).toBeLessThan(2);
  });

  test("Khoảng đệm: bỏ liên kết thì có đủ 4 cạnh, đặt riêng được một cạnh", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await insp(page).getByRole("tab", { name: "Kiểu dáng" }).click();
    const closed = insp(page).locator(".ecx-style-section-toggle[aria-expanded='false']");
    for (let i = 0; i < 8 && (await closed.count()); i++) await closed.first().click();
    const sp = insp(page).locator(".ecx-spacing").first();
    await sp.getByRole("button", { name: /Chỉnh từng cạnh/ }).click();
    await expect(sp.locator("input[type=range]")).toHaveCount(4);
    await sp.locator("input[type=range]").nth(2).fill("2"); // cạnh dưới
    const pad = (await blockOf(page, "paragraph")).attrs.style.padding;
    expect(Object.keys(pad.base)).toEqual(["bottom"]);
  });

  test("khổ Máy tính: chỗ hẹp thì thu nhỏ vừa khung, không vẽ hẹp (CSS tablet không áp lên desktop)", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await open(page, "?doc=post");
    await page.waitForTimeout(500); // khung đổi bề rộng có hiệu ứng .25s
    const m = await page.evaluate(() => { const f = document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement; return { inner: f.contentWindow!.innerWidth, shown: Math.round(f.getBoundingClientRect().width) }; });
    expect(m.inner).toBeGreaterThanOrEqual(1025); // DESKTOP_MIN_WIDTH: > 1024 (CSS tablet của website), thấp nhất có thể để ít phải thu nhỏ
    expect(m.shown).toBeLessThanOrEqual(900); // vẫn nằm gọn trong trang
  });

  test("khổ Máy tính: đủ chỗ thì vẽ đúng bề rộng khung, không thu nhỏ", async ({ page }) => {
    await open(page, "?doc=post");
    const m = await page.evaluate(() => { const f = document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement; return { inner: f.contentWindow!.innerWidth, shown: Math.round(f.getBoundingClientRect().width), transform: getComputedStyle(f).transform }; });
    expect(m.inner).toBe(m.shown);
    expect(m.transform).toBe("none");
  });

  test("thư viện khối: khối có luật vị trí ('Tổng số bài' chỉ trong Query) không hiện khi chèn ở cấp gốc", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    await expect(page.locator(".ecx-inserter-panel .ecx-block-tile[data-key='paragraph']").first()).toBeVisible();
    await expect(page.locator(".ecx-inserter-panel .ecx-block-tile[data-key='queryTotal']")).toHaveCount(0);
  });

  test("giao diện tiếng Anh: tên các khối của theme/layout không còn tiếng Việt", async ({ page }) => {
    const c = await open(page, "?doc=post&lang=en");
    await clickEnd(c, "Nội dung bài viết."); // nội dung mẫu tiếng Việt, chỉ kiểm giao diện
    await page.getByRole("button", { name: "Add block" }).first().click();
    const names = await page.locator(".ecx-inserter-panel .ecx-block-tile").evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.trim().split("\n")[0]));
    expect(names.length).toBeGreaterThan(20);
    const vi = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
    expect(names.filter((n) => vi.test(n))).toEqual([]);
  });

  test("đổi ảnh bằng 'Chọn ảnh': kích thước khai báo theo ảnh mới, giữ alt đã có", async ({ page }) => {
    const c = await open(page, "?doc=post&media=1");
    await page.evaluate(() => (window as any).__ecx.store.insert("root", null, 3, [{ id: "img9", type: "image", attrs: { src: "/old.png", alt: "ALT-CU", width: 1200, height: 800, mediaId: 1 } }]));
    await c.locator('[data-ecx-block="img9"]').click({ position: { x: 5, y: 5 } });
    await page.locator(".ecx-inspector").getByRole("button", { name: /Chọn ảnh/ }).first().click();
    const attrs = await page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.find((b: any) => b.id === "img9").attrs);
    expect(attrs).toMatchObject({ width: 400, height: 200, mediaId: 7, alt: "ALT-CU" }); // media giả lập trả 400×200
  });

  test("ô cỡ chữ tuỳ chỉnh: ô số + đơn vị + thanh kéo; xoá số thì bỏ giá trị", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await insp(page).getByRole("tab", { name: "Kiểu dáng" }).click();
    const input = insp(page).getByLabel(/^Cỡ chữ: tuỳ chỉnh$/).first();
    await expect(input).toHaveAttribute("type", "number"); // ô số: không gõ được chữ rác
    await input.fill("18");
    expect((await blockOf(page, "paragraph")).attrs.style.fontSize).toEqual({ base: "18px" });
    await insp(page).getByLabel(/^Cỡ chữ: tuỳ chỉnh: đơn vị$/).first().selectOption("rem");
    expect((await blockOf(page, "paragraph")).attrs.style.fontSize).toEqual({ base: "18rem" });
    await input.fill("");
    expect((await blockOf(page, "paragraph")).attrs.style?.fontSize).toBeUndefined();
  });

  test("ô màu: chọn màu preset thì ô màu hiện đúng màu đó (không hiện như 'chưa đặt')", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await insp(page).getByRole("tab", { name: "Kiểu dáng" }).click();
    const color = insp(page).locator(".ecx-style-section", { hasText: "Màu" }).first();
    await color.getByRole("button", { name: "Chữ: accent" }).click();
    const sw = color.locator("label", { has: page.locator("input[aria-label='Chữ']") }).first();
    await expect(sw).not.toHaveAttribute("data-empty", "");
    expect(await sw.evaluate((e) => (e as HTMLElement).style.background)).toContain("242, 98, 81"); // #f26251
  });

  test("chọn ảnh từ thư viện: ghi srcset + WebP để điện thoại không tải ảnh gốc", async ({ page }) => {
    const c = await open(page, "?doc=post&media=1");
    await page.evaluate(() => (window as any).__ecx.store.insert("root", null, 3, [{ id: "img8", type: "image", attrs: {} }]));
    await c.locator('[data-ecx-block="img8"]').getByRole("button", { name: "Thư viện" }).click();
    await expect.poll(async () => page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.find((b: any) => b.id === "img8").attrs.srcset)).toContain("200w");
    const a = await page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.find((b: any) => b.id === "img8").attrs);
    expect(a.srcset).toMatch(/sample\.svg\?w=200 200w, .*sample\.svg 400w/);
    expect(a.webpSrcset).toContain("200w");
  });

  test("gallery: sửa mô tả (alt), đổi thứ tự, xoá và thêm ảnh trong bảng cài đặt", async ({ page }) => {
    const c = await open(page, "?doc=post&media=1");
    const imgs = [1, 2, 3].map((n) => ({ src: `http://localhost:5199/sample.svg?i=${n}`, alt: "", id: n }));
    await page.evaluate((images) => (window as any).__ecx.store.insert("root", null, 3, [{ id: "gal1", type: "gallery", attrs: { images } }]), imgs);
    await c.locator('[data-ecx-block="gal1"]').click({ position: { x: 5, y: 5 } });
    const ed = page.locator(".ecx-gallery-editor");
    await expect(ed.locator("[data-gallery-row]")).toHaveCount(3);
    const get = () => page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.find((b: any) => b.id === "gal1").attrs.images as Array<{ src: string; alt?: string }>);
    await ed.getByLabel("Mô tả ảnh 2").fill("Ảnh thứ hai");
    expect((await get())[1].alt).toBe("Ảnh thứ hai");
    await ed.locator("[data-gallery-row='1']").getByRole("button", { name: "Lên" }).click();
    expect((await get()).map((i) => i.alt)).toEqual(["Ảnh thứ hai", "", ""]);
    await ed.locator("[data-gallery-row='2']").getByRole("button", { name: "Xoá ảnh" }).click();
    expect((await get()).length).toBe(2);
    await ed.getByRole("button", { name: "Thêm ảnh" }).click();
    await expect.poll(async () => (await get()).length).toBe(3);
  });

  test("Cây khối: kéo tay nắm một hàng thả lên hàng khác thì đổi thứ tự khối", async ({ page }) => {
    await open(page, "?doc=post");
    await page.getByRole("button", { name: "Cây khối" }).click();
    const rows = page.locator(".ecx-listview .ecx-list-row");
    const before = (await state(page)).docs.root.blocks.map((b: any) => b.id);
    const handle = rows.nth(0).locator(".ecx-list-drag");
    const from = (await handle.boundingBox())!, to = (await rows.nth(2).boundingBox())!;
    await page.mouse.move(from.x + 4, from.y + 4); await page.mouse.down();
    await page.mouse.move(to.x + 40, to.y + to.height * 0.8, { steps: 12 });
    await expect(page.locator(".ecx-drop-indicator, .ecx-drop-line, [class*=drop]").first()).toBeVisible();
    await page.mouse.up();
    const after = (await state(page)).docs.root.blocks.map((b: any) => b.id);
    expect(after).not.toEqual(before);
    expect(after[2]).toBe(before[0]); // khối đầu được thả xuống sau khối thứ ba
    expect([...after].sort()).toEqual([...before].sort());
  });
  test("CSS theme giới hạn bề rộng phần con của template thì header/footer và khối lồng trên canvas cũng theo (như website)", async ({ page }) => {
    // Website: :where(html[data-theme]) .ecx-template > * { max-width: 300px } → header/footer, bộ cột rộng 300px. Mặc định của trình soạn không được đè.
    const css = encodeURIComponent(":where(html) .ecx-template > * { box-sizing: border-box; max-width: 300px; margin-inline: auto; }");
    const c = await open(page, `?contentClass=ecx-template&css=${css}`);
    await expect(c.locator(".ecx-template-part").first()).toBeVisible();
    const widths = await c.locator("body").evaluate(() => [...document.querySelectorAll(".ecx-canvas-root > *")].map((e) => [e.classList.contains("ecx-template-part") ? "ecx-template-part" : (e as HTMLElement).dataset.type ?? e.tagName, Math.round(e.getBoundingClientRect().width)] as [string, number]));
    const parts = widths.filter(([k]) => k === "ecx-template-part");
    expect(parts.length).toBe(2);
    for (const [k, w] of widths) expect(w, `${k} rộng ${w}px`).toBeLessThanOrEqual(300);
  });
  test("Breadcrumb trên canvas như website: chuyên mục thật của bài mẫu, không có thì bỏ (không hiện chữ giữ chỗ 'Chuyên mục')", async ({ page }) => {
    const doc = { version: 1, blocks: [{ id: "main", type: "richtext", data: { type: "doc", content: [{ type: "breadcrumbs" }] } }] };
    await page.addInitScript((d) => { (window as unknown as { __INJECT_DOC__: unknown }).__INJECT_DOC__ = d; }, doc);
    const text = async (q: string) => { const c = await open(page, q); const nav = c.locator(".ecx-breadcrumbs"); await expect(nav).toBeVisible(); return (await nav.innerText()).replace(/\s*›\s*/g, " › ").replace(/\s+/g, " ").trim(); };
    expect(await text("?doc=inject&postCategory=Tin%20t%E1%BB%A9c")).toBe("Trang chủ › Tin tức › Bài viết mẫu");
    expect(await text("?doc=inject&postCategory=")).toBe("Trang chủ › Bài viết mẫu"); // trang / bài không có chuyên mục
  });
});
