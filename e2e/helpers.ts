import { expect, type FrameLocator, type Page } from "@playwright/test";

/** Khung soạn (iframe). */
export const canvas = (page: Page): FrameLocator => page.frameLocator("iframe[data-ecx-canvas]");

/** Mở playground và chờ nội dung (kể cả header/footer lồng) hiện xong. */
export async function open(page: Page, query = "") {
  await page.goto(`/${query}`);
  const c = canvas(page);
  await expect(c.locator(".ecx-canvas-root")).toBeVisible();
  // Template mặc định có header/footer lồng: chờ tải xong
  if (!/doc=|empty|frame/.test(query)) await expect(c.locator(".ecx-template-part-header .ecx-site-title")).toBeVisible();
  return c;
}

/** Trạng thái store (JSON hoá — chỉ đọc). */
export async function state(page: Page) {
  return page.evaluate(() => JSON.parse(JSON.stringify((window as any).__ecx.store.getState())));
}

/** Chữ của các khối chữ trong tài liệu (duyệt sâu), dạng "type:chữ". */
export async function texts(page: Page, docId = "root"): Promise<string[]> {
  return page.evaluate((id) => {
    const out: string[] = [];
    const walk = (list: any[]) => list.forEach((b) => {
      if (b.inline) out.push(`${b.type}:${b.inline.map((n: any) => (n.type === "text" ? n.text : n.type === "hardBreak" ? "\n" : "")).join("")}`);
      if (b.content) walk(b.content);
    });
    walk((window as any).__ecx.store.getState().docs[id].blocks);
    return out;
  }, docId);
}

/** Cấu trúc khối (loại lồng nhau) của tài liệu. */
export async function shape(page: Page, docId = "root"): Promise<unknown> {
  return page.evaluate((id) => {
    const s = (list: any[]): unknown => list.map((b) => (b.content ? { [b.type]: s(b.content) } : b.type));
    return s((window as any).__ecx.store.getState().docs[id].blocks);
  }, docId);
}

/** Bấm vào cuối chữ của khối chữ có nội dung `text`. */
export async function clickEnd(c: FrameLocator, text: string) {
  const el = c.locator("[data-ecx-rich]", { hasText: text }).first();
  // Bấm mép phải dòng (thanh công cụ nổi của khối dưới có thể che phần giữa — như người dùng thật)
  const box = await el.boundingBox();
  await el.click({ position: { x: Math.max(2, box!.width - 4), y: box!.height / 2 } });
  await el.press(END);
  return el;
}

/** Rê chuột (thôi chế độ đang gõ → thanh công cụ hiện lại), như người dùng đưa chuột lên thanh công cụ. */
export async function showToolbar(page: Page) {
  await page.mouse.move(5, 300);
  await page.mouse.move(8, 305);
  await expect(page.locator(".ecx-toolbar")).toBeVisible();
}

export const mod = process.platform === "darwin" ? "Meta" : "Control";
/** Về đầu / cuối dòng: macOS dùng ⌘← / ⌘→ (Safari, Firefox không nhận Home/End trong ô soạn), nơi khác Home / End. */
export const HOME = process.platform === "darwin" ? "Meta+ArrowLeft" : "Home";
export const END = process.platform === "darwin" ? "Meta+ArrowRight" : "End";

/** Giả lập bộ gõ (IME) qua CDP: gõ ghép rồi xác nhận — như Telex/VNI/bàn phím điện thoại. */
export async function imeType(page: Page, steps: string[], final: string) {
  const cdp = await page.context().newCDPSession(page);
  for (const s of steps) await cdp.send("Input.imeSetComposition", { text: s, selectionStart: s.length, selectionEnd: s.length });
  await cdp.send("Input.insertText", { text: final });
  await cdp.detach();
}
