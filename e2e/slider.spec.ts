// Slider (Carousel nâng cấp): ảnh bìa mờ dần, chiều cao theo tỉ lệ / tối thiểu, ô hiện theo điều kiện, kiểu nút + chấm.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

async function insert(page: import("@playwright/test").Page, key: string) {
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  await page.locator(".ecx-inserter-panel .ecx-search, .ecx-inserter-popover .ecx-search").first().fill(key.split("/").pop()!); // tìm cho ô nằm ngay trên đầu danh sách
  await page.locator(`.ecx-inserter-popover [data-key="${key}"], .ecx-inserter-panel [data-key="${key}"]`).first().click();
  await page.waitForTimeout(250);
}
const blockOf = (page: import("@playwright/test").Page, type: string) => page.evaluate((t) => {
  const find = (list: any[]): any => { for (const b of list) { if (b.type === t) return b; const r = b.content && find(b.content); if (r) return r; } };
  return JSON.parse(JSON.stringify(find((window as any).__ecx.store.getState().docs.root.blocks) ?? null));
}, type);

test("Slider ảnh bìa: 3 slide có nền màu, mờ dần + tự chạy, nút và chấm sáng", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "carousel/hero");
  const b = await blockOf(page, "carousel");
  expect(b.attrs).toMatchObject({ effect: "fade", heightMode: "min", autoplay: true, arrowStyle: "light", dotStyle: "light" });
  expect(b.content).toHaveLength(3);
  expect(b.content.every((g: any) => g.attrs.background && g.attrs.textColor === "#ffffff")).toBe(true);
  const root = c.locator(".ecx-carousel").first();
  await expect(root).toHaveAttribute("data-height", "min");
  // khung soạn luôn trượt để sửa được mọi slide (không ẩn slide nào)
  await expect(root).toHaveAttribute("data-effect", "slide");
  const h = await c.locator(".ecx-carousel-track > *").first().evaluate((e) => e.getBoundingClientRect().height);
  expect(h).toBeGreaterThanOrEqual(24 * 16 - 2); // 26rem tối thiểu
});

test("Slider: chiều cao theo tỉ lệ khung; ô tỉ lệ chỉ hiện khi chọn 'Theo tỉ lệ'; mờ dần ẩn ô số slide", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "carousel");
  await c.locator(".ecx-variation-skip").click();
  await page.waitForTimeout(500); // lần lấy nét tự động vào chữ đầu phải xong rồi mới chọn khối
  const id = (await blockOf(page, "carousel")).id;
  await page.evaluate((i) => (window as any).__ecx.store.select([i]), id);
  const insp = page.locator(".ecx-inspector");
  await expect(insp.getByText("Tỉ lệ khung")).toHaveCount(0);
  await insp.getByRole("radio", { name: "Theo tỉ lệ" }).click();
  await expect(insp.getByText("Tỉ lệ khung")).toBeVisible();
  await insp.getByRole("radio", { name: "4/3" }).click();
  const box = await c.locator(".ecx-carousel-track > *").first().boundingBox();
  expect(Math.abs(box!.width / box!.height - 4 / 3)).toBeLessThan(0.05);
  await expect(insp.getByText("Slide thấy cùng lúc (máy tính)")).toBeVisible();
  await insp.getByRole("radio", { name: "Mờ dần" }).click();
  await expect(insp.getByText("Slide thấy cùng lúc (máy tính)")).toHaveCount(0);
  expect((await blockOf(page, "carousel")).attrs).toMatchObject({ effect: "fade", heightMode: "ratio", ratio: "4/3" });
  // kiểu nút / chấm đổi data-* thật
  await insp.getByRole("radio", { name: "Chỉ mũi tên" }).click();
  await expect(c.locator(".ecx-carousel").first()).toHaveAttribute("data-arrows", "plain");
});

test("gallery dạng slider: ô nút / chấm / tự chuyển chỉ hiện khi chọn Slider; khung soạn vẫn xếp lưới để thấy mọi ảnh", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "gallery");
  const id = (await blockOf(page, "gallery")).id;
  await page.evaluate((i) => (window as any).__ecx.store.setAttrs([i], { images: [1, 2, 3, 4].map((n) => ({ src: `${location.origin}/sample.svg?n=${n}`, alt: `Ảnh ${n}` })) }), id);
  await page.evaluate((i) => (window as any).__ecx.store.select([i]), id);
  const insp = page.locator(".ecx-inspector");
  await expect(insp.getByText("Tự chuyển slide")).toHaveCount(0);
  await insp.getByRole("radio", { name: "Slider", exact: true }).click();
  await expect(insp.getByText("Tự chuyển slide")).toBeVisible();
  await expect(insp.getByText("Giây giữa hai lần chuyển")).toHaveCount(0);
  await insp.getByRole("checkbox", { name: "Tự chuyển slide" }).check();
  await expect(insp.getByText("Giây giữa hai lần chuyển")).toBeVisible();
  expect((await blockOf(page, "gallery")).attrs).toMatchObject({ layout: "slider", autoplay: true });
  await expect(c.locator(".ecx-gallery-item")).toHaveCount(4);
});
