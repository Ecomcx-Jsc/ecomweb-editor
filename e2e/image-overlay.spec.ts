// Ảnh phủ chữ: chèn có mẫu, chữ gõ được, ô cài đặt hiện theo điều kiện, lớp màu + tỉ lệ + hiệu ứng áp thật, rê chuột đổi lớp màu.
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

test("ảnh phủ chữ: có trong bảng chèn khi soạn bài, mẫu có tiêu đề + phụ đề, khung tỉ lệ 4/3", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "imageOverlay");
  const b = await blockOf(page, "imageOverlay");
  expect(b.attrs).toMatchObject({ title: "Bộ sưu tập mới", subtitle: "Xem ngay", overlayColor: "primary", ratio: "4/3" });
  const root = c.locator(".ecx-image-overlay").first();
  await expect(root).toHaveClass(/has-ratio/);
  // chưa có ảnh: khung soạn để ô chọn ảnh + chữ nối nhau (không ép tỉ lệ); có ảnh rồi thì đúng 4/3
  const id = (await blockOf(page, "imageOverlay")).id;
  await page.evaluate((i) => (window as any).__ecx.store.setAttrs([i], { src: `${location.origin}/sample.svg` }), id);
  await page.waitForTimeout(400);
  const box = await root.boundingBox();
  expect(Math.abs(box!.width / box!.height - 4 / 3)).toBeLessThan(0.06);
  await expect(root.locator(".ecx-image-overlay-title")).toContainText("Bộ sưu tập mới");
  await expect(root.locator(".ecx-image-overlay-link")).toHaveCount(0); // đang soạn: không có liên kết phủ chặn việc gõ
});

test("ảnh phủ chữ: gõ đè chữ mẫu; ô cài đặt hiện theo điều kiện; đổi hiệu ứng, tỉ lệ, căn chữ áp vào khối", async ({ page, browserName }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "imageOverlay");
  // vừa chèn xong, chữ mẫu của tiêu đề đã được chọn sẵn: gõ là thay
  // Firefox của Playwright không nhận phím gõ ngay sau khi chèn trong khung iframe (giống các ca sample-defaults) — các trình duyệt còn lại kiểm gõ thật
  if (browserName !== "firefox") {
    await page.keyboard.type("Mùa hè");
    expect((await blockOf(page, "imageOverlay")).attrs.title).toBe("Mùa hè");
  }
  const id = (await blockOf(page, "imageOverlay")).id;
  await page.evaluate((i) => (window as any).__ecx.store.select([i]), id);
  const insp = page.locator(".ecx-inspector");
  await expect(insp.getByText("Khoảng viền khung")).toBeVisible();
  await expect(insp.getByText("Mở liên kết")).toHaveCount(0); // chưa có liên kết thì chưa hỏi mở tab nào
  await insp.getByLabel("Khung viền trắng khi rê").click();
  await expect(insp.getByText("Khoảng viền khung")).toHaveCount(0);
  await insp.getByRole("radio", { name: "Đen trắng" }).click();
  await insp.getByRole("radio", { name: "16/9" }).click();
  await insp.getByRole("radio", { name: "Dưới" }).click();
  const a = (await blockOf(page, "imageOverlay")).attrs;
  expect(a).toMatchObject({ frame: false, imageEffect: "grayscale", ratio: "16/9", vAlign: "bottom" });
  await expect(c.locator(".ecx-image-overlay").first()).toHaveClass(/is-fx-grayscale.*is-v-bottom|is-v-bottom.*is-fx-grayscale/);
  await expect(c.locator(".ecx-image-overlay").first()).not.toHaveClass(/has-frame/);
});

test("ảnh phủ chữ: lớp màu đổi độ đậm khi rê chuột (website) — kiểm bằng CSS thật", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "imageOverlay");
  const id = (await blockOf(page, "imageOverlay")).id;
  await page.evaluate((i) => (window as any).__ecx.store.setAttrs([i], { overlayOpacity: 80, restOpacity: 0 }), id);
  const root = c.locator(".ecx-image-overlay").first();
  const op = () => root.locator(".ecx-image-overlay-tint").evaluate((e) => getComputedStyle(e).opacity);
  expect(Number(await op())).toBeGreaterThanOrEqual(0.2); // khung soạn để lớp màu mờ nhẹ cho thấy khối
  await root.hover();
  await expect.poll(async () => Number(await op())).toBeCloseTo(0.8, 1);
});
