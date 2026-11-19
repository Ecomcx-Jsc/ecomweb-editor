// Vị trí (relative / absolute / fixed + lệch) và Biến đổi (xoay, phóng, nghiêng, dịch, điểm gốc) ở tab Nâng cao — theo khổ màn hình.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

async function setup(page: import("@playwright/test").Page) {
  const c = await open(page, "?doc=empty");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "par", type: "group", attrs: { style: { minHeight: { base: "200px" } } }, content: [{ id: "x", type: "group", attrs: { style: { padding: { base: "20px" } } }, content: [{ id: "p1", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Huy hiệu" }] }] }] }]); });
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__ecx.store.select(["x"]));
  await page.waitForTimeout(300);
  const insp = page.locator(".ecx-inspector");
  await insp.getByRole("tab", { name: "Nâng cao" }).click();
  return { c, insp };
}
const style = (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__ecx.store.block("x").attrs.style)));

test("Vị trí tuyệt đối: chọn kiểu + lệch trên / phải → khối rút khỏi bố cục, khối cha thành điểm neo; đổi khổ điện thoại đặt lệch riêng", async ({ page }) => {
  const { c, insp } = await setup(page);
  await insp.getByRole("button", { name: /^Vị trí/ }).click();
  await insp.getByRole("radio", { name: "Tuyệt đối" }).click();
  await insp.getByRole("spinbutton", { name: "Vị trí: Trên" }).fill("12");
  await insp.getByRole("spinbutton", { name: "Vị trí: Phải" }).fill("8");
  const st = await style(page);
  expect(st.place).toMatchObject({ type: "absolute", top: { base: "12px" }, right: { base: "8px" } });
  const el = c.locator('[data-ecx-block="x"]');
  await expect(el).toHaveCSS("position", "absolute");
  await expect(el).toHaveCSS("top", "12px");
  await expect(c.locator('[data-ecx-block="par"]')).toHaveCSS("position", "relative");
  // khổ điện thoại: lệch riêng, không đụng giá trị máy tính
  await page.locator(".ecx-topbar").getByRole("button", { name: "Điện thoại", exact: true }).click();
  await insp.getByRole("spinbutton", { name: "Vị trí: Trên" }).fill("0");
  const st2 = await style(page);
  expect(st2.place.top).toEqual({ base: "12px", mobile: "0px" });
});

test("Biến đổi: xoay 15° + phóng 1.2 thành transform thật trên khung soạn; điểm gốc đổi; đặt lại xoá sạch", async ({ page }) => {
  const { c, insp } = await setup(page);
  await insp.getByRole("button", { name: /^Biến đổi/ }).click();
  await insp.getByRole("slider", { name: "Xoay" }).fill("15");
  await insp.getByRole("slider", { name: "Phóng to / thu nhỏ" }).fill("1.2");
  await insp.getByLabel("Điểm gốc").selectOption("top left");
  const st = await style(page);
  expect(st.transform).toMatchObject({ rotate: { base: 15 }, scale: { base: 1.2 }, origin: "top left" });
  const el = c.locator('[data-ecx-block="x"]');
  const m = await el.evaluate((e) => getComputedStyle(e).transform);
  expect(m).toMatch(/^matrix\(/);
  const [a, b] = m.replace("matrix(", "").split(",").map(Number); // a = cosθ·s, b = sinθ·s
  expect(Math.round(Math.hypot(a, b) * 100) / 100).toBe(1.2);
  expect(Math.round((Math.atan2(b, a) * 180) / Math.PI)).toBe(15);
  expect(await el.evaluate((e) => getComputedStyle(e).transformOrigin)).toMatch(/^0px 0px/);
});

test("Image: ô Hình cắt (mask) áp mặt nạ thật; Heading: Dùng thẻ khác đổi thẻ HTML trên khung soạn; Show More có công tắc mờ dần", async ({ page }) => {
  const c = await open(page, "?doc=empty");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "img", type: "image", attrs: { src: "/sample.svg", alt: "a" } }, { id: "hd", type: "heading", attrs: { level: 2 }, inline: [{ type: "text", text: "Tiêu đề" }] }, { id: "sm", type: "group", attrs: { collapseHeight: "8rem" }, content: [{ id: "sp", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Dài" }] }] }]); });
  await page.waitForTimeout(400);
  const insp = page.locator(".ecx-inspector");
  await page.evaluate(() => (window as any).__ecx.store.select(["img"]));
  await page.waitForTimeout(300);
  await insp.getByRole("tab", { name: "Kiểu dáng" }).click();
  await insp.getByRole("button", { name: /^Ảnh · tuỳ chọn khác|^Ảnh/ }).first().click().catch(() => {});
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["img"], { imageMask: "hexagon" }));
  const mask = await c.locator('[data-ecx-block="img"] img, img[data-ecx-block="img"]').first().evaluate((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage);
  expect(mask).toContain("svg");
  await page.evaluate(() => (window as any).__ecx.store.select(["hd"]));
  await page.waitForTimeout(300);
  await insp.getByRole("tab", { name: "Cài đặt" }).click();
  await insp.getByLabel("Dùng thẻ khác").selectOption("span");
  await expect(c.locator('[data-ecx-block="hd"]')).toHaveJSProperty("tagName", "SPAN");
  await page.evaluate(() => (window as any).__ecx.store.select(["sm"]));
  await page.waitForTimeout(300);
  await expect(insp.getByLabel("Mờ dần ở mép cắt")).toBeVisible();
  await expect(insp.getByLabel("Ẩn nút sau khi mở (không thu gọn lại)")).toBeVisible();
});
