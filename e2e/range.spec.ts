import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { END, HOME, clickEnd, mod, open, state, texts } from "./helpers";

/** Chọn chữ qua nhiều khối: kéo chuột / Shift+mũi tên ra ngoài khối, rồi xoá, gõ đè, chép, Enter. */
async function dragAcross(page: Page, c: FrameLocator, fromText: string, fromRatio: number, toText: string, toRatio: number) {
  const a = (await c.locator("[data-ecx-rich]", { hasText: fromText }).first().boundingBox())!;
  const b = (await c.locator("[data-ecx-rich]", { hasText: toText }).first().boundingBox())!;
  await page.mouse.move(a.x + 2 + (a.width - 4) * fromRatio, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 2 + (b.width - 4) * toRatio, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}
const textWidth = async (c: FrameLocator, text: string) => c.locator("[data-ecx-rich]", { hasText: text }).first().evaluate((el) => {
  const r = el.ownerDocument.createRange(); r.selectNodeContents(el); const box = r.getBoundingClientRect(); const own = el.getBoundingClientRect();
  return (box.right - own.left) / own.width;
});

test.describe("chọn chữ qua nhiều khối", () => {
  test("kéo chuột từ tiêu đề sang đoạn: tô dải chữ, Backspace xoá và nối phần còn lại, con trỏ ở chỗ nối", async ({ page }) => {
    const c = await open(page, "?doc=post");
    // Bấm giữa tiêu đề (≈ sau "Tiêu đề ") tới giữa "Nội dung bài viết."
    await dragAcross(page, c, "Tiêu đề bài", (await textWidth(c, "Tiêu đề bài")) * 0.75, "Nội dung bài viết.", (await textWidth(c, "Nội dung bài viết.")) * 0.5);
    const st = await state(page);
    expect(st.range).not.toBeNull();
    expect(st.range.anchor.id).toBe(st.docs.root.blocks[0].id);
    expect(st.range.head.id).toBe(st.docs.root.blocks[1].id);
    await expect(c.locator(".ecx-canvas-root.has-text-range")).toHaveCount(1);
    await page.keyboard.press("Backspace");
    const t = await texts(page);
    expect(t.length).toBe(2);
    expect(t[0]).toMatch(/^heading:Tiêu đề .*viết\.$/);
    expect(t[1]).toBe("paragraph:Đoạn thứ hai.");
    await page.keyboard.type("|");
    expect((await texts(page))[0]).toMatch(/^heading:Tiêu đề .*\|.*viết\.$/);
    await page.keyboard.press(`${mod}+z`);
    await page.keyboard.press(`${mod}+z`);
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai."]);
  });

  test("Shift+mũi tên xuống ở dòng cuối: chọn sang khối dưới; thêm Shift+↓ mở rộng; gõ chữ thay cả dải", async ({ page }) => {
    const c = await open(page, "?doc=post");
    const el = c.locator("[data-ecx-rich]", { hasText: "Tiêu đề bài" });
    await el.click();
    await el.press(HOME);
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    let st = await state(page);
    expect(st.range).toEqual({ anchor: { id: st.docs.root.blocks[0].id, offset: 5 }, head: { id: st.docs.root.blocks[1].id, offset: "Nội dung bài viết.".length } });
    await page.keyboard.press("Shift+ArrowDown");
    st = await state(page);
    expect(st.range.head).toEqual({ id: st.docs.root.blocks[2].id, offset: "Đoạn thứ hai.".length });
    await page.keyboard.type("X");
    expect(await texts(page)).toEqual(["heading:Tiêu X"]);
    await page.keyboard.type("Y");
    expect(await texts(page)).toEqual(["heading:Tiêu XY"]);
  });

  test("chép rồi dán dải chữ: khối đầu / cuối được cắt đúng phần đã chọn", async ({ page, browserName }) => {
    test.skip(browserName === "firefox", "Firefox: không đọc được dữ liệu dán giả lập");
    const c = await open(page, "?doc=post");
    const el = c.locator("[data-ecx-rich]", { hasText: "Nội dung bài viết." });
    await el.click();
    await el.press(HOME);
    for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    await page.evaluate(() => {
      const d = (document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement).contentDocument!;
      const dt = new DataTransfer();
      d.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true }));
      (window as unknown as { __copied: string }).__copied = dt.getData("text/plain");
    });
    expect(await page.evaluate(() => (window as unknown as { __copied: string }).__copied)).toBe("bài viết.\n\nĐoạn thứ hai.");
    // Esc bỏ dải, nội dung còn nguyên
    await page.keyboard.press("Escape");
    expect((await state(page)).range).toBeNull();
    expect((await texts(page)).length).toBe(3);
  });

  test("Enter thay dải bằng chỗ ngắt đoạn; mũi tên không Shift thu về một điểm", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Tiêu đề bài");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("ArrowRight");
    let st = await state(page);
    expect(st.range).toBeNull();
    expect(await texts(page)).toHaveLength(3);
    await page.keyboard.type("!");
    expect((await texts(page))[1]).toBe("paragraph:Nội dung bài viết.!");
    await clickEnd(c, "Tiêu đề bài");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Z");
    expect(await texts(page)).toEqual(["heading:Tiêu đề ", "paragraph:Z", "paragraph:Đoạn thứ hai."]);
    void END;
  });

  test("khối bị khoá không cho xoá nằm giữa: Backspace không làm gì", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await page.evaluate(() => {
      const s = (window as unknown as { __ecx: { store: { getState(): any; setAttrs(ids: string[], a: object): void } } }).__ecx.store;
      s.setAttrs([s.getState().docs.root.blocks[1].id], { lock: { remove: true } });
    });
    await clickEnd(c, "Tiêu đề bài");
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Backspace");
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai."]);
  });
});
