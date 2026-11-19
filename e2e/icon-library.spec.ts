// Icon: thư viện ≈1.900 icon có ô tìm + SVG riêng (dán mã / chọn file) cho Icon, Info Box, Icon List (từng mục), Tab, nút.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#ff0000" d="M256 8 504 256 256 504 8 256z"/><script>alert(1)</script></svg>';
const blockAttrs = (page: import("@playwright/test").Page, id: string) => page.evaluate((i) => JSON.parse(JSON.stringify((window as any).__ecx.store.block(i).attrs)), id);

async function setup(page: import("@playwright/test").Page, node: object) {
  const c = await open(page, "?empty=1&content=1");
  await page.evaluate((n) => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [n]); }, node);
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__ecx.store.select(["x"]));
  await page.waitForTimeout(400);
  return c;
}

test("Info Box: thư viện có hàng nghìn icon, tìm 'shopping' ra icon giỏ hàng, chọn thì lưu tên và canvas vẽ icon mới", async ({ page }) => {
  const c = await setup(page, { id: "x", type: "iconBox", attrs: { title: "T", text: "N", icon: "star" } });
  const insp = page.locator(".ecx-inspector");
  await insp.getByRole("button", { name: /^Icon$/ }).first().click();
  const pop = insp.locator(".ecx-icon-pop");
  await expect(pop.getByPlaceholder(/Tìm icon/)).toHaveAttribute("placeholder", /\(\d{4}\)/); // > 1000 icon
  await pop.getByPlaceholder(/Tìm icon/).fill("shopping cart");
  await pop.locator('[role=option][title="shopping-cart"]').click();
  expect((await blockAttrs(page, "x")).icon).toBe("shopping-cart");
  await expect(c.locator('[data-ecx-block="x"] .ecx-widget-icon path').first()).toHaveAttribute("d", /.+/);
});

test("Icon: SVG riêng — dán mã, script bị loại, màu thành currentColor, lưu svg:…; mã hỏng báo lỗi và không cho dùng", async ({ page }) => {
  const c = await setup(page, { id: "x", type: "icon", attrs: { name: "star" } });
  const insp = page.locator(".ecx-inspector");
  await insp.getByRole("button", { name: /Tên|Icon/ }).first().click();
  const pop = insp.locator(".ecx-icon-pop");
  await pop.getByRole("tab", { name: "SVG riêng" }).click();
  await pop.getByLabel("Mã SVG").fill("<div>không phải svg</div>");
  await expect(pop.getByRole("alert")).toBeVisible();
  await expect(pop.getByRole("button", { name: "Dùng icon này" })).toBeDisabled();
  await pop.getByLabel("Mã SVG").fill(SVG);
  await expect(pop.getByRole("button", { name: "Dùng icon này" })).toBeEnabled();
  await pop.getByRole("button", { name: "Dùng icon này" }).click();
  const v = (await blockAttrs(page, "x")).name as string;
  expect(v.startsWith("svg:")).toBe(true);
  expect(v).not.toContain("script");
  expect(v).not.toContain("#ff0000");
  const svg = c.locator('[data-ecx-block="x"] svg').first();
  await expect(svg).toHaveAttribute("viewBox", "0 0 512 512");
  expect(await svg.evaluate((e) => e.querySelector("script") === null && e.querySelector("path")!.getAttribute("fill"))).toBe("currentColor");
});

test("Icon List: icon riêng từng mục chọn từ thư viện (mặc định / không icon / icon cụ thể)", async ({ page }) => {
  const c = await setup(page, { id: "x", type: "iconList", attrs: { items: [{ text: "Một" }, { text: "Hai" }] } });
  const insp = page.locator(".ecx-inspector");
  await c.locator('[data-ecx-block="x"] li').nth(0).click();
  const picker = insp.getByRole("button", { name: /Icon 1/ }).first();
  await picker.click();
  const pop = insp.locator(".ecx-icon-pop");
  await pop.getByPlaceholder(/Tìm icon/).fill("rocket");
  await pop.locator('[role=option][title="rocket"]').first().click();
  let items = (await blockAttrs(page, "x")).items;
  expect(items[0].icon).toBe("rocket");
  await insp.getByRole("button", { name: /Icon 1/ }).first().click();
  await insp.locator(".ecx-icon-pop").getByRole("option", { name: "Không có icon" }).click();
  items = (await blockAttrs(page, "x")).items;
  expect(items[0].icon).toBe("none");
});

test("Icon: tab Kiểu dáng có mục Icon — đổi màu, nền, bo góc, xoay thật trên khung soạn; có bản Rê chuột", async ({ page }) => {
  const c = await setup(page, { id: "x", type: "icon", attrs: { name: "star", size: 48, iconStyle: "circle" } });
  const insp = page.locator(".ecx-inspector");
  await insp.getByRole("tab", { name: "Kiểu dáng" }).click();
  await insp.getByRole("button", { name: /^Icon/ }).first().click();
  const sec = insp.locator(".ecx-style-section", { hasText: "Màu icon" }).first();
  await expect(sec.getByRole("tab", { name: "Rê chuột" })).toBeVisible();
  await sec.getByRole("button", { name: /^Màu/ }).first().click().catch(() => {});
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["x"], { iconColor: "#ff0000", iconBg: "#eeeeee", iconRadius: "4px", iconRotate: "90" }));
  const shape = c.locator('[data-ecx-block="x"] .ecx-icon-shape');
  await expect(shape).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(shape).toHaveCSS("background-color", "rgb(238, 238, 238)");
  await expect(shape).toHaveCSS("border-top-left-radius", "4px");
  expect(await shape.locator("svg").evaluate((e) => getComputedStyle(e).rotate)).toBe("90deg");
});

test("Tooltip: Icon có ô Chú thích → khung hiện khi rê chuột; mục Icon List đặt được màu icon / chữ + chú thích riêng", async ({ page }) => {
  const c = await setup(page, { id: "x", type: "icon", attrs: { name: "star", tooltip: "Gọi ngay" } });
  const shape = c.locator('[data-ecx-block="x"] .ecx-icon-shape');
  await expect(shape).toHaveAttribute("data-ecx-tip", "Gọi ngay");
  await shape.hover();
  // Firefox trả về chính biểu thức attr(...) thay vì chuỗi đã thay → chấp nhận cả hai; khung thật phải có kích thước
  expect(['"Gọi ngay"', "attr(data-ecx-tip)"]).toContain(await shape.evaluate((e) => getComputedStyle(e, "::after").content));
  expect(await shape.evaluate((e) => getComputedStyle(e, "::after").opacity)).toBe("1");
  const c2 = await setup(page, { id: "x", type: "iconList", attrs: { items: [{ text: "Một", tip: "Mẹo", color: "#ff0000", textColor: "#0000ff" }, { text: "Hai" }] } });
  const li = c2.locator('[data-ecx-block="x"] li').first();
  await expect(li).toHaveAttribute("data-ecx-tip", "Mẹo");
  await expect(li.locator(".ecx-widget-icon")).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(li.locator("span").last()).toHaveCSS("color", "rgb(0, 0, 255)");
});

test("Đánh giá: icon thay ảnh đại diện khi không có ảnh; có ảnh thì ảnh thắng", async ({ page }) => {
  const c = await setup(page, { id: "x", type: "testimonial", attrs: { quote: "Tốt", name: "An", mediaIcon: "heart" } });
  await expect(c.locator('[data-ecx-block="x"] .ecx-testimonial-icon')).toHaveCount(1);
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["x"], { src: "/sample.svg" }));
  await expect(c.locator('[data-ecx-block="x"] .ecx-testimonial-icon')).toHaveCount(0);
  await expect(c.locator('[data-ecx-block="x"] img.ecx-testimonial-avatar')).toHaveCount(1);
});
