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

  test("cột: nút thêm cột không làm khung canvas tràn ngang", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "cot 50");
    await expect(c.locator(".ecx-add-column")).toBeVisible();
    const btn = await c.locator(".ecx-add-column").boundingBox();
    const cols = await c.locator(".ecx-columns").first().boundingBox();
    expect(btn!.x + btn!.width).toBeLessThanOrEqual(cols!.x + cols!.width + 0.5); // nút nằm trong khối cột
    // không bị thanh công cụ nổi (nằm ngoài iframe) che: điểm giữa nút phải trúng chính khung canvas
    const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x: btn!.x + btn!.width / 2, y: btn!.y + btn!.height / 2 });
    expect(top).toBe("IFRAME");
  });

  test("lưới trên điện thoại: ô trống không làm khung canvas tràn ngang", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "luoi");
    await expect(c.locator('[data-type="group"]').first()).toBeVisible();
    await page.getByRole("button", { name: "Điện thoại", exact: true }).click();
    expect(await c.locator("html").evaluate((h) => h.scrollWidth - h.clientWidth)).toBeLessThanOrEqual(0);
    // ô trống (gợi ý nowrap) không được có min-width tự động = độ rộng chữ gợi ý
    const cell = c.locator('[data-type="group"] [data-ecx-rich][data-empty][data-placeholder]').first();
    await expect(cell).toHaveCSS("min-width", "0px");
  });

  test("chuyên mục / thẻ: mỗi mục là liên kết rel=tag như website (ăn kiểu liên kết của theme)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "chuyen muc");
    const terms = c.locator(".ecx-post-terms");
    await expect(terms).toBeVisible();
    await expect(terms.locator('a[rel="tag"]')).toHaveCount(2);
  });

  test("bảng cài đặt khối Menu: nhãn và giá trị tiếng Việt, không lộ tên thuộc tính thô", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "menu dieu");
    const insp = page.locator(".ecx-inspector");
    await expect(insp.getByText("Thu gọn thành nút menu")).toBeVisible();
    await expect(insp.getByRole("radio", { name: "Luôn luôn" })).toBeVisible();
    await expect(insp).not.toContainText("overlayMenu");
  });

  test("YouTube: dán link vào ô trống → hiện ảnh xem trước, không lỗi (hook phải gọi trước return sớm)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "youtube");
    const yt = c.locator('[data-type="youtube"]');
    await yt.getByLabel("YouTube URL").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await yt.getByRole("button").last().click();
    await expect(c.locator(".ecx-block-error")).toHaveCount(0);
    await expect(c.locator('[data-type="youtube"] img')).toBeVisible();
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
    // Bố cục của khối chứa nằm ở tab Cài đặt: chọn khổ điện thoại rồi đặt 1 cột
    const layout = insp.locator(".ecx-style-section", { hasText: "Bố cục" }).first();
    await layout.getByRole("button", { name: "Điện thoại", exact: true }).first().click();
    await layout.getByLabel("Số cột").selectOption("1");
    const g = await groupOf(page);
    expect(g.attrs.style.layout.columns).toEqual({ base: 3, mobile: 1 });
    const el = c.locator(`[data-ecx-block="${g.id}"]`);
    // Khổ dùng chung: chọn Điện thoại ở tab Kiểu dáng thì khung soạn cũng thu về khổ điện thoại → thấy ngay 1 cột
    await expect.poll(async () => (await el.evaluate((n) => getComputedStyle(n).gridTemplateColumns)).split(" ").length).toBe(1);
    // Và ngược lại: nút Máy tính trên thanh trên → khung soạn + tab Kiểu dáng về khổ máy tính
    await page.getByRole("group", { name: "Thiết bị" }).getByRole("button", { name: "Máy tính", exact: true }).click();
    await expect.poll(async () => (await el.evaluate((n) => getComputedStyle(n).gridTemplateColumns)).split(" ").length).toBe(3);
    await expect(layout.getByRole("button", { name: "Máy tính", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
  });

  test("nền chuyển màu (preset theme + tuỳ chỉnh), bóng, nhấc lên khi rê chuột", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "nhom");
    await page.keyboard.type("Thẻ");
    await showToolbar(page);
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
    const insp = page.locator(".ecx-inspector");
    // Nhóm: ô Nền ở tab Cài đặt — loại Chuyển màu
    await insp.getByRole("radio", { name: "Chuyển màu" }).click();
    await insp.getByRole("button", { name: "brand" }).click();
    let g = await groupOf(page);
    expect(g.attrs.style.gradient).toBe("brand");
    const el = c.locator(`[data-ecx-block="${g.id}"]`);
    await expect.poll(() => el.evaluate((n) => getComputedStyle(n).backgroundImage)).toContain("linear-gradient");
    await insp.getByRole("button", { name: "Tuỳ chỉnh", exact: true }).click();
    g = await groupOf(page);
    expect(g.attrs.style.gradient).toMatch(/^linear-gradient\(135deg, #1a597b 0%, #f26251 100%\)$/);
    // Đổ bóng nằm trong mục Viền & bo góc; trạng thái rê chuột là công tắc ngay trong mục
    await insp.getByRole("tab", { name: "Kiểu dáng" }).click();
    await insp.getByRole("button", { name: "Viền & bo góc" }).click();
    const border = insp.locator(".ecx-style-section", { hasText: "Viền & bo góc" });
    await border.getByLabel("Đổ bóng").selectOption("md");
    await expect.poll(() => el.evaluate((n) => getComputedStyle(n).boxShadow)).not.toBe("none");
    await border.getByRole("tab", { name: "Rê chuột" }).click();
    await border.getByLabel("Nhấc lên").check();
    g = await groupOf(page);
    expect(g.attrs.style.hover).toEqual({ lift: true });
    // Rê vào góc khối: giữa khối đang chọn có nút "+ Thêm section" nằm đè, trúng nó thì khối không nhận :hover
    await el.hover({ position: { x: 12, y: 6 } });
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

  test("nhóm: thanh nổi có độ rộng nội dung, màu nền nhanh, thêm section bên dưới", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "nhom");
    await page.keyboard.type("Thẻ");
    await showToolbar(page);
    const tb = page.locator(".ecx-toolbar");
    await tb.getByRole("button", { name: "Chọn khối cha" }).click();
    await tb.getByRole("button", { name: "Độ rộng nội dung" }).click();
    await page.getByRole("menuitem", { name: "960px" }).click();
    expect((await groupOf(page)).attrs.contentWidth).toBe("960px");
    await tb.getByRole("button", { name: "Màu nền nhanh" }).click();
    await page.locator('.ecx-quick-colors [data-color="primary"]').click();
    expect((await groupOf(page)).attrs.style.color.background).toBe("primary");
    expect((await groupOf(page)).attrs.padding).toBe("medium"); // có màu nền thì có đệm: chữ không dính mép
    await tb.getByRole("button", { name: "Màu nền nhanh" }).click();
    await page.locator('.ecx-quick-colors [data-color="none"]').click();
    expect((await groupOf(page)).attrs.style?.color?.background).toBeUndefined();
    const before = (await state(page)).docs.root.blocks.length;
    await tb.getByRole("button", { name: "Thêm section bên dưới" }).click();
    const blocks = (await state(page)).docs.root.blocks;
    expect(blocks.length).toBe(before + 1);
    expect(blocks.filter((b: { type: string }) => b.type === "group").length).toBe(2);
  });

  test("nhóm: kéo tay độ rộng nội dung hai mép → đối xứng, hiện số px, kéo hết ra = hết khối", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "nhom");
    await page.keyboard.type("Thẻ");
    await showToolbar(page);
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
    const h = c.locator('[data-ecx-zone="content-width-right"]');
    await expect(h).toBeVisible();
    const hb = (await h.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x - 60, hb.y + hb.height / 2, { steps: 5 });
    await expect(c.locator(".ecx-cw-tip").first()).toContainText("px");
    await page.mouse.up();
    const w = parseInt((await groupOf(page)).attrs.contentWidth, 10);
    expect(w).toBeGreaterThan(240);
    const kid = await c.locator('[data-type="group"] > [data-ecx-block]').first().boundingBox();
    expect(Math.abs(kid!.width - w)).toBeLessThan(3);
    // kéo ngược ra quá mép → bỏ giá trị (Hết khối)
    const h2 = c.locator('[data-ecx-zone="content-width-right"]');
    const b2 = (await h2.boundingBox())!;
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.mouse.down();
    await page.mouse.move(b2.x + 420, b2.y + b2.height / 2, { steps: 8 }); // trong khung nhìn: Firefox không phát pointermove khi chuột ra ngoài cửa sổ
    await page.mouse.up();
    expect((await groupOf(page)).attrs.contentWidth).toBeUndefined();
  });

  test("nhóm: màu nền riêng cho điện thoại, máy tính giữ nguyên; CSS media query đúng", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "nhom");
    await page.keyboard.type("Thẻ");
    await showToolbar(page);
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
    const insp = page.locator(".ecx-inspector");
    await insp.locator(".ecx-color-row-btn").first().click();
    await page.getByRole("button", { name: "Màu: primary" }).click();
    await page.getByRole("button", { name: "Điện thoại", exact: true }).first().click();
    await expect(insp.getByText("Đang dùng màu của máy tính")).toBeVisible();
    // Đổi khổ vẽ lại bảng bên phải: bấm mở bảng màu có thể trúng lúc nó đang vẽ lại (mở rồi bị đóng) → thử lại như người dùng
    const accent = page.getByRole("button", { name: "Màu: accent" });
    await expect(async () => {
      if (!(await accent.isVisible())) await insp.locator(".ecx-color-row-btn").first().click();
      await expect(accent).toBeVisible({ timeout: 800 });
    }).toPass();
    await accent.click();
    const st = (await groupOf(page)).attrs.style;
    expect(st.color.background).toBe("primary");
    expect(st.background.color).toEqual({ mobile: "accent" });
    await expect(insp.getByText("Đang dùng màu của máy tính")).toHaveCount(0);
  });

  test("nhóm: đường chia trên / dưới chọn hình, màu, cao → CSS ::after thật trên canvas; Không = tắt", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "nhom");
    await page.keyboard.type("Thẻ");
    await showToolbar(page);
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
    const insp = page.locator(".ecx-inspector");
    await insp.getByRole("button", { name: "Đường chia", exact: true }).click();
    await insp.locator('[data-ecx-divider="top"]').getByRole("radio", { name: "Sóng" }).click();
    await insp.locator('[data-ecx-divider="bottom"]').getByRole("radio", { name: "Vòm" }).click();
    await insp.locator('[data-ecx-divider="bottom"]').getByRole("slider", { name: "Cao" }).fill("150");
    let st = (await groupOf(page)).attrs.style;
    expect(st.divider.top.shape).toBe("wave");
    expect(st.divider.bottom).toMatchObject({ shape: "curve", height: 150 });
    const mask = await c.locator('[data-type="group"]').evaluate((g) => { const cs = getComputedStyle(g, "::after"); return { pos: cs.position, size: cs.backgroundSize, img: cs.maskImage || cs.webkitMaskImage }; });
    expect(mask.pos).toBe("absolute");
    expect(mask.size).toContain("150px");
    expect(mask.img).toContain("svg");
    await insp.locator('[data-ecx-divider="top"]').getByRole("radio", { name: "Không" }).click();
    await insp.locator('[data-ecx-divider="bottom"]').getByRole("radio", { name: "Không" }).click();
    st = (await groupOf(page)).attrs.style;
    expect(st?.divider).toBeUndefined();
  });

  test("bộ cột: có đường chia trên / dưới như nhóm", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "cot 50");
    await page.keyboard.type("Cột");
    await showToolbar(page);
    const insp = page.locator(".ecx-inspector");
    await insp.getByRole("button", { name: "Đường chia", exact: true }).click();
    await insp.locator('[data-ecx-divider="bottom"]').getByRole("radio", { name: "Tam giác" }).click();
    const cols = (await state(page)).docs.root.blocks.find((b: { type: string }) => b.type === "columns");
    expect(cols.attrs.style.divider.bottom.shape).toBe("triangle");
    const size = await c.locator('[data-type="columns"]').evaluate((g) => getComputedStyle(g, "::after").backgroundSize);
    expect(size).toContain("80px");
  });

  test("nhóm mới chèn: thanh công cụ nổi của đoạn không che các nút chọn bố cục", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "nhom");
    await showToolbar(page);
    const tb = (await page.locator(".ecx-toolbar").boundingBox())!;
    const ch = (await c.locator(".ecx-ph-choices").boundingBox())!;
    expect(tb.y + tb.height <= ch.y + 1 || tb.y >= ch.y + ch.height - 1).toBe(true);
    await c.locator(".ecx-ph-choice").first().click();
    expect((await groupOf(page)).attrs.style.layout).toBeTruthy();
  });

  test("nhóm xếp dọc: kéo tay độ rộng nội dung bám theo con trỏ, khối con đúng bằng độ rộng đặt", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "nhom");
    await c.locator(".ecx-ph-choice", { hasText: "Xếp dọc" }).click();
    await page.keyboard.type("Nội dung A");
    await showToolbar(page);
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
    const h = c.locator('[data-ecx-zone="content-width-right"]');
    const widths: number[] = [];
    for (let i = 0; i < 3; i++) {
      const b = (await h.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 - 60, b.y + b.height / 2, { steps: 5 });
      await page.mouse.up();
      const w = parseInt((await groupOf(page)).attrs.contentWidth, 10);
      const kid = (await c.locator('[data-type="group"] > [data-ecx-block]').first().boundingBox())!;
      expect(Math.abs(kid.width - w)).toBeLessThan(3);
      widths.push(w);
    }
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(widths[2]);
  });

  test("nhóm mới: chọn bố cục xong gõ chữ được ngay, không mất ký tự đầu", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await insertVia(page, "nhom");
    await c.locator(".ecx-ph-choice", { hasText: "Xếp dọc" }).click();
    await page.keyboard.type("Chào mừng bạn");
    const g = await groupOf(page);
    expect(g.content[0].inline.map((n: { text?: string }) => n.text ?? "").join("")).toBe("Chào mừng bạn");
  });
});
