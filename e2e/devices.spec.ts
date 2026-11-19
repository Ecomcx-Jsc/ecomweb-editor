import { expect, test } from "@playwright/test";
import { canvas, open, state } from "./helpers";

/**
 * Ma trận thiết bị: điện thoại (Safari / Chrome), máy tính bảng (Safari / Chrome), laptop nhỏ, Full HD, màn rộng.
 * Vỏ trình soạn phải dùng được ở mọi khổ: trang không tràn ngang, các nút chính (thêm khối, hoàn tác, lưu) nằm trong màn hình,
 * gõ chữ + chèn khối + mở bảng cài đặt được, bảng bên không đè hết canvas, bố cục trang vẫn đúng.
 */
const vp = (page: import("@playwright/test").Page) => page.viewportSize()!;

test("vỏ trình soạn: không tràn ngang, nút chính trong màn hình, canvas còn chỗ dùng", async ({ page }) => {
  await open(page, "?doc=post");
  await page.waitForTimeout(350); // bảng bên trượt vào mất ~200ms
  const { width } = vp(page);
  const info = await page.evaluate(() => {
    const out = (sel: string) => { const e = document.querySelector(sel) as HTMLElement | null; if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right) }; };
    const frame = document.querySelector("iframe[data-ecx-canvas]") as HTMLElement | null;
    return { sw: document.documentElement.scrollWidth, add: out(".ecx-tool-primary"), save: out(".ecx-save"), frame: frame ? Math.round(frame.getBoundingClientRect().width) : 0 };
  });
  expect(info.sw, "trang tràn ngang").toBeLessThanOrEqual(width + 1);
  expect(info.add, "nút Thêm khối").not.toBeNull();
  expect(info.add!.l).toBeGreaterThanOrEqual(0);
  expect(info.add!.r).toBeLessThanOrEqual(width);
  expect(info.save, "nút Lưu").not.toBeNull();
  expect(info.save!.r, "nút Lưu bị đẩy ra ngoài màn hình").toBeLessThanOrEqual(width + 1);
  // Canvas còn ít nhất 60% bề rộng màn hình (bảng bên không đè hết)
  expect(info.frame).toBeGreaterThan(width * 0.6);
});

test("gõ chữ, chèn khối từ thanh chèn, mở bảng cài đặt ở mọi khổ", async ({ page , browserName }) => {
  test.fixme(browserName === "webkit" || browserName === "firefox", 'Firefox / WebKit của Playwright: phím gõ không vào ô ProseMirror trong iframe; WebKit còn tính sai toạ độ bấm khi iframe khung soạn bị thu phóng (không có mousedown nào tới iframe) — cũng hỏng trên bản gốc');
  const c = await open(page, "?doc=post");
  const { width } = vp(page);
  const touch = !!test.info().project.use.hasTouch;
  const target = c.locator("p", { hasText: "Đoạn thứ hai." });
  if (touch) await target.tap(); else await target.click();
  await page.waitForTimeout(200); // WebKit: chờ ô chữ nhận focus sau cú bấm (người thật không gõ cùng mili giây)
  await page.keyboard.press("End");
  await page.keyboard.type(" Thêm chữ");
  expect((await state(page)).docs.root.blocks[2].inline.map((n: { text?: string }) => n.text).join("")).toContain("Thêm chữ");
  // Thanh chèn
  await page.getByRole("button", { name: "Thêm khối" }).first().click();
  await page.locator(".ecx-block-tile[data-key='spacer']").click();
  expect((await state(page)).docs.root.blocks.some((b: { type: string }) => b.type === "spacer")).toBe(true);
  // Bảng cài đặt: mở được và nằm trong màn hình
  const first = c.locator("p", { hasText: "Nội dung bài viết." });
  if (touch) await first.tap(); else await first.click();
  const settings = page.getByRole("button", { name: "Cài đặt", exact: true });
  const open0 = await page.locator(".ecx-inspector").count();
  if (!open0) await settings.click();
  await expect(page.locator(".ecx-inspector")).toBeVisible();
  await page.waitForTimeout(350); // bảng trượt vào mất ~200ms: đo khi đã đứng yên
  const box = (await page.locator(".ecx-right").boundingBox())!;
  expect(box.x + box.width, "bảng cài đặt tràn ra ngoài màn hình").toBeLessThanOrEqual(width + 1);
  expect(box.width).toBeLessThanOrEqual(width);
});

test("bố cục trang không tràn ngang ở khổ này: hero, cột, bảng giá, lưới", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => {
    const st = (window as any).__ecx.store;
    const P = (id: string, t: string) => ({ id, type: "paragraph", attrs: {}, inline: [{ type: "text", text: t }] });
    const col = (id: string, kids: unknown[]) => ({ id, type: "column", attrs: {}, content: kids });
    const old = st.getState().docs.root.blocks.map((b: { id: string }) => b.id);
    st.insert("root", null, 0, [
      { id: "h", type: "group", attrs: { padding: "large", align: "full", style: { color: { background: "primary/15" } } }, content: [{ id: "h1", type: "heading", attrs: { level: 1, textAlign: "center" }, inline: [{ type: "text", text: "Xây website nhanh hơn" }] }, P("hp", "Mô tả dài dài dài để xuống dòng trên màn hẹp, thử xem có tràn hay không.")] },
      { id: "cols", type: "columns", attrs: {}, content: [col("c1", [P("a", "Cột một")]), col("c2", [P("b", "Cột hai")]), col("c3", [P("c", "Cột ba")])] },
      { id: "g", type: "group", attrs: { style: { layout: { type: "grid", columns: { base: 4, tablet: 2, mobile: 1 } }, gap: { base: "md" } } }, content: [P("g1", "Ô một"), P("g2", "Ô hai"), P("g3", "Ô ba"), P("g4", "Ô bốn")] },
      { id: "t", type: "table", attrs: {}, content: [{ id: "r1", type: "tableRow", attrs: {}, content: ["Gói", "Giá", "Hỗ trợ"].map((x, i) => ({ id: `th${i}`, type: "tableHeader", attrs: {}, content: [P(`tp${i}`, x)] })) }] },
    ], { focus: false });
    st.remove(old);
    st.select([]);
  });
  await page.waitForTimeout(300);
  // Bề rộng khung soạn hiện tại (đúng khổ thiết bị); bảng rộng được phép cuộn trong chính nó nhưng trang thì không tràn
  const over = await c.locator("body").evaluate((b) => { const d = b.ownerDocument.scrollingElement!; return d.scrollWidth - d.clientWidth; });
  expect(over, `canvas tràn ngang ${over}px`).toBeLessThanOrEqual(1);
});
