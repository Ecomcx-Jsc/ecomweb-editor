// Đếm ngược: kiểu đếm (ngày cố định / mỗi người xem), hành động khi hết giờ, lặp lại, nút tạm dừng — ô hiện theo điều kiện và áp vào khối.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

async function insert(page: import("@playwright/test").Page, key: string) {
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  await page.locator(".ecx-inserter-panel .ecx-search, .ecx-inserter-popover .ecx-search").first().fill(key);
  await page.locator(`.ecx-inserter-popover [data-key="${key}"], .ecx-inserter-panel [data-key="${key}"]`).first().click();
  await page.waitForTimeout(600);
}
const blockOf = (page: import("@playwright/test").Page, type: string) => page.evaluate((t) => {
  const find = (list: any[]): any => { for (const b of list) { if (b.type === t) return b; const r = b.content && find(b.content); if (r) return r; } };
  return JSON.parse(JSON.stringify(find((window as any).__ecx.store.getState().docs.root.blocks) ?? null));
}, type);
async function prep(page: import("@playwright/test").Page) {
  const c = await open(page, "?doc=post&content=1");
  await insert(page, "countdown");
  await page.waitForTimeout(400);
  const id = (await blockOf(page, "countdown")).id;
  await page.evaluate((i) => (window as any).__ecx.store.select([i]), id);
  return { c, id, insp: page.locator(".ecx-inspector") };
}

test("đếm ngược: chọn 'Mỗi người xem một lần' đổi ô ngày giờ thành giờ + phút; đồng hồ chạy ngay từ đủ thời lượng", async ({ page }) => {
  const { c, id, insp } = await prep(page);
  await expect(insp.getByText("Múi giờ")).toBeVisible();
  await insp.getByRole("radio", { name: "Mỗi người xem một lần" }).click();
  await expect(insp.getByText("Múi giờ")).toHaveCount(0);
  await expect(insp.getByText("Giờ", { exact: true })).toBeVisible();
  expect((await blockOf(page, "countdown")).attrs).toMatchObject({ mode: "evergreen", evergreenHours: 24 });
  await page.evaluate((i) => (window as any).__ecx.store.setAttrs([i], { evergreenHours: 2, evergreenMinutes: 30 }), id);
  await expect(c.locator(".ecx-countdown-h strong").first()).toHaveText("02");
  await expect(c.locator(".ecx-countdown-m strong").first()).toHaveText(/^(29|30)$/); // vừa đếm vài giây
  await expect(insp.getByText("Đếm lại từ đầu sau")).toBeVisible();
  await expect(insp.getByText("Lặp lại", { exact: true })).toHaveCount(0); // lặp lại chỉ có ở ngày cố định
});

test("đếm ngược: 'Khi hết giờ' — ô địa chỉ chỉ hiện khi chọn chuyển trang, chữ thay thế chỉ khi chọn hiện chữ; lặp lại + nút tạm dừng", async ({ page }) => {
  const { c, id, insp } = await prep(page);
  await expect(insp.getByText("Chuyển tới trang")).toHaveCount(0);
  await insp.getByRole("combobox", { name: "Khi hết giờ", exact: true }).selectOption("redirect");
  await expect(insp.getByText("Chuyển tới trang")).toBeVisible();
  await expect(insp.getByText("Chữ khi hết giờ")).toHaveCount(0);
  await insp.getByRole("combobox", { name: "Khi hết giờ", exact: true }).selectOption("message");
  await expect(insp.getByText("Chữ khi hết giờ")).toBeVisible();
  await expect(insp.getByText("Chuyển tới trang")).toHaveCount(0);
  await insp.getByRole("radio", { name: "Mỗi ngày" }).click();
  expect((await blockOf(page, "countdown")).attrs).toMatchObject({ expireAction: "message", repeat: "daily" });
  await expect(c.locator(".ecx-countdown-pause")).toHaveCount(0);
  await insp.getByRole("checkbox", { name: "Nút tạm dừng cho người xem" }).check();
  await expect(c.locator(".ecx-countdown-pause")).toHaveCount(1);
  // đã quá hạn mà lặp hằng ngày → không hiện 0 mà đếm tới ngày kế
  await page.evaluate((i) => (window as any).__ecx.store.setAttrs([i], { target: new Date(Date.now() - 3600_000).toISOString() }), id);
  await expect(c.locator(".ecx-countdown-h strong").first()).toHaveText("23");
  await expect(c.locator(".ecx-block-error")).toHaveCount(0);
});
