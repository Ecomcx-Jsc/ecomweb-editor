// Lời chứng thực nhiều mục: 3 thẻ mẫu xếp lưới, đổi số cột / dạng slider, thêm thẻ, ô theo điều kiện.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

async function insert(page: import("@playwright/test").Page, key: string) {
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  await page.locator(".ecx-inserter-panel .ecx-search, .ecx-inserter-popover .ecx-search").first().fill(key.split("/").pop()!);
  await page.locator(`.ecx-inserter-popover [data-key="${key}"], .ecx-inserter-panel [data-key="${key}"]`).first().click();
  await page.waitForTimeout(600);
}
const blockOf = (page: import("@playwright/test").Page, type: string) => page.evaluate((t) => {
  const find = (list: any[]): any => { for (const b of list) { if (b.type === t) return b; const r = b.content && find(b.content); if (r) return r; } };
  return JSON.parse(JSON.stringify(find((window as any).__ecx.store.getState().docs.root.blocks) ?? null));
}, type);
const select = async (page: import("@playwright/test").Page, type: string) => { const id = (await blockOf(page, type)).id; await page.evaluate((i) => (window as any).__ecx.store.select([i]), id); };

test("lời chứng thực: chèn ra 3 thẻ, xếp 3 cột ngang hàng, thẻ lẻ cũ không còn trong bảng chèn", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  const keys = await page.locator(".ecx-inserter-panel [data-key]").evaluateAll((els) => els.map((e) => e.getAttribute("data-key")));
  expect(keys).toContain("testimonials"); expect(keys).toContain("testimonials/slider"); expect(keys).not.toContain("testimonial");
  await page.keyboard.press("Escape");
  await insert(page, "testimonials");
  const b = await blockOf(page, "testimonials");
  expect(b.content).toHaveLength(3);
  expect(b.content.map((x: any) => x.attrs.name)).toEqual(["Nguyễn Minh Anh", "Trần Quốc Hưng", "Lê Thu Hà"]);
  const cards = c.locator(".ecx-testimonials > .ecx-testimonial, .ecx-testimonials > [data-ecx-block]");
  await expect(cards).toHaveCount(3);
  const ys = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(ys).size).toBe(1); // cùng một hàng
});

test("lời chứng thực: đổi số cột đổi lưới; dạng slider hiện thêm ô nút / chấm / tự chuyển; thêm thẻ mới", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "testimonials");
  await page.waitForTimeout(400);
  await select(page, "testimonials");
  const insp = page.locator(".ecx-inspector");
  await expect(insp.getByText("Nút trước / sau")).toHaveCount(0); // chỉ có ở dạng slider
  await page.evaluate((i) => (window as any).__ecx.store.setAttrs([i], { columns: 2 }), (await blockOf(page, "testimonials")).id);
  const ys = await c.locator(".ecx-testimonials > [data-ecx-block]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(ys).size).toBe(2); // 2 cột → 3 thẻ thành 2 hàng
  await insp.getByRole("radio", { name: "Slider", exact: true }).click();
  for (const t of ["Nút trước / sau", "Chấm chỉ vị trí", "Tự chuyển"]) await expect(insp.getByText(t).first()).toBeVisible();
  await expect(insp.getByText("Giây giữa hai lần chuyển")).toHaveCount(0); // chỉ khi bật tự chuyển
  await insp.getByRole("checkbox", { name: "Tự chuyển", exact: true }).check();
  await expect(insp.getByText("Giây giữa hai lần chuyển")).toBeVisible();
  expect((await blockOf(page, "testimonials")).attrs).toMatchObject({ layout: "carousel", autoplay: true, columns: 2 });
  await c.getByRole("button", { name: "Thêm đánh giá" }).click();
  expect((await blockOf(page, "testimonials")).content).toHaveLength(4);
  await expect(c.locator(".ecx-block-error")).toHaveCount(0);
});

test("lời chứng thực dạng slider từ bảng chèn: có layout carousel, 3 thẻ; điện thoại thành 1 cột", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "testimonials/slider");
  const b = await blockOf(page, "testimonials");
  expect(b.attrs).toMatchObject({ layout: "carousel", columns: 1, autoplay: true });
  expect(b.content).toHaveLength(3);
  await expect(c.locator(".ecx-testimonials")).toHaveAttribute("data-layout", "carousel");
});
