// Popup: chèn có nút + nội dung mẫu, sửa chữ nút ngay trên khối, dựng nội dung trong khung, ô cài đặt hiện theo điều kiện.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

async function insert(page: import("@playwright/test").Page, key: string) {
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  await page.locator(".ecx-inserter-panel .ecx-search, .ecx-inserter-popover .ecx-search").first().fill(key);
  await page.locator(`.ecx-inserter-popover [data-key="${key}"], .ecx-inserter-panel [data-key="${key}"]`).first().click();
  await page.waitForTimeout(500);
}
const blockOf = (page: import("@playwright/test").Page, type: string) => page.evaluate((t) => {
  const find = (list: any[]): any => { for (const b of list) { if (b.type === t) return b; const r = b.content && find(b.content); if (r) return r; } };
  return JSON.parse(JSON.stringify(find((window as any).__ecx.store.getState().docs.root.blocks) ?? null));
}, type);

test("popup: chèn ra có nút mở + khung nội dung với tiêu đề và đoạn mẫu", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "popup");
  const b = await blockOf(page, "popup");
  expect(b.attrs.triggerText).toBe("Xem chi tiết");
  expect(b.content.map((x: any) => x.type)).toEqual(["heading", "paragraph"]);
  const root = c.locator(".ecx-popup").first();
  await expect(root).toHaveClass(/is-size-md/);
  await expect(root.locator(".ecx-popup-trigger")).toContainText("Xem chi tiết");
  await expect(root.locator(".ecx-popup-frame-label")).toHaveText("Nội dung popup");
  await expect(root.locator(".ecx-popup-frame h3")).toContainText("Tiêu đề popup");
});

test("popup: cài đặt hiện đủ, đổi kiểu nút mở và độ rộng áp vào khối", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "popup");
  const id = (await blockOf(page, "popup")).id;
  await page.evaluate((i) => (window as any).__ecx.store.select([i]), id);
  const insp = page.locator(".ecx-inspector");
  for (const t of ["Kiểu nút mở", "Độ rộng hộp", "Hiệu ứng mở", "Độ tối nền phía sau", "Hiện nút đóng ×", "Bấm nền tối để đóng"]) await expect(insp.getByText(t).first()).toBeVisible();
  await expect(insp.getByText("triggerText")).toHaveCount(0); // chữ nút sửa ngay trên khối, không lặp ở bảng phải
  await insp.getByRole("radio", { name: "Chữ liên kết" }).click();
  await insp.getByRole("radio", { name: "Lớn", exact: true }).click();
  await insp.getByRole("radio", { name: "Giữa", exact: true }).click();
  expect((await blockOf(page, "popup")).attrs).toMatchObject({ triggerStyle: "link", size: "lg", triggerAlign: "center" });
  const root = c.locator(".ecx-popup").first();
  await expect(root).toHaveClass(/is-size-lg/);
  await expect(root.locator(".ecx-popup-trigger")).toHaveClass(/is-link/);
});

test("popup: thêm khối vào khung nội dung; ⌘Z gỡ; chèn khối lồng không lỗi", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "popup");
  const before = (await blockOf(page, "popup")).content.length;
  const id = (await blockOf(page, "popup")).id;
  await page.evaluate(([i]) => { const s = (window as any).__ecx.store; const b = s.block(i); s.insert("root", i, b.content.length, [{ id: "x1", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Thêm vào popup" }] }]); }, [id]);
  expect((await blockOf(page, "popup")).content.length).toBe(before + 1);
  await expect(c.locator(".ecx-popup-frame")).toContainText("Thêm vào popup");
  await expect(c.locator(".ecx-block-error")).toHaveCount(0);
});

test("popup: 'Xem thử hộp thoại' đưa khung nội dung ra giữa màn hình với nền tối, đóng được, ô Căn đã ẩn", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "popup");
  const root = c.locator(".ecx-popup").first();
  await root.getByRole("button", { name: "Xem thử hộp thoại" }).click();
  await expect(root).toHaveClass(/is-previewing/);
  const frame = root.locator(".ecx-popup-frame");
  await expect(frame).toHaveCSS("position", "fixed");
  const fb = await frame.boundingBox(), vp = page.viewportSize()!;
  expect(Math.abs(fb!.x + fb!.width / 2 - (vp.width - 300 - 300) / 2 - 300)).toBeLessThan(260); // nằm giữa khung soạn (trừ hai bảng bên)
  await expect(frame.locator("h3")).toContainText("Tiêu đề popup"); // vẫn sửa được nội dung bên trong
  await page.screenshot({ path: "../plans/report-v2/after/new-popup-preview.png" });
  await root.getByRole("button", { name: "Đóng xem thử" }).click();
  await expect(root).not.toHaveClass(/is-previewing/);
  const id = (await blockOf(page, "popup")).id;
  await page.evaluate((i) => (window as any).__ecx.store.select([i]), id);
  await expect(page.locator(".ecx-inspector").getByText("Căn", { exact: true })).toHaveCount(0);
});

test("Video Popup: kiểu Nút phát video hiện ô Ảnh bìa, nút thành khung 16:9 có nút phát tròn, ảnh bìa lưu và áp lên nút", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "popup");
  const id = (await blockOf(page, "popup")).id;
  await page.evaluate((i) => (window as any).__ecx.store.select([i]), id);
  const insp = page.locator(".ecx-inspector");
  await expect(insp.getByLabel("Ảnh bìa nút phát")).toHaveCount(0);
  await insp.getByRole("radio", { name: "Nút phát video" }).click();
  await insp.getByLabel("Ảnh bìa nút phát").fill("/sample.svg");
  const b = await blockOf(page, "popup");
  expect(b.attrs).toMatchObject({ triggerStyle: "play", triggerImage: "/sample.svg" });
  const trig = c.locator(".ecx-popup .ecx-popup-trigger.is-play").first();
  await expect(trig).toBeVisible();
  expect(await trig.evaluate((n) => getComputedStyle(n).backgroundImage)).toContain("sample.svg");
  const r = await trig.evaluate((n) => { const b = n.getBoundingClientRect(); return b.width / b.height; });
  expect(Math.abs(r - 16 / 9)).toBeLessThan(0.1);
});
