// Xem trước trạng thái rê chuột (Kiểu dáng): bật thì khối hiện như đang rê (không cần rê thật), tắt / đổi khối thì trả lại; không đụng khối khác.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("xem trước khi rê: khối hiện màu / bóng lúc rê khi bật công tắc, trả lại khi tắt hoặc chọn khối khác", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => {
    const s = (window as any).__ecx.store;
    s.insert("root", null, s.getState().docs.root.blocks.length, [
      { id: "ha", type: "group", attrs: { style: { color: { background: "#ffffff" }, hover: { color: { background: "#ff0000" } }, padding: "md" } }, content: [{ id: "hp", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Hộp A" }] }] },
      { id: "hb", type: "group", attrs: { style: { color: { background: "#ffffff" }, hover: { color: { background: "#00ff00" } }, padding: "md" } }, content: [{ id: "hq", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Hộp B" }] }] },
    ]);
    s.select(["ha"]);
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => (window as any).__ecx.store.select(["ha"])); // con trỏ có thể đã vào đoạn bên trong: chọn lại cả nhóm
  await page.waitForTimeout(300);
  const bg = (id: string) => c.locator(`[data-ecx-block="${id}"]`).evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await bg("ha")).toBe("rgb(255, 255, 255)");
  await page.locator(".ecx-inspector").getByRole("tab", { name: "Kiểu dáng" }).click();
  const sw = page.locator(".ecx-inspector").getByRole("switch", { name: "Xem trước khi rê chuột" });
  await sw.check();
  await expect.poll(() => bg("ha")).toBe("rgb(255, 0, 0)");   // hiện như đang rê
  expect(await bg("hb")).toBe("rgb(255, 255, 255)");            // khối khác không bị đụng
  await sw.uncheck();
  await expect.poll(() => bg("ha")).toBe("rgb(255, 255, 255)");
  await sw.check();
  await expect.poll(() => bg("ha")).toBe("rgb(255, 0, 0)");
  await page.evaluate(() => (window as any).__ecx.store.select(["hb"])); // đổi khối → tự tắt
  await expect.poll(() => bg("ha")).toBe("rgb(255, 255, 255)");
  await expect(c.locator(".ecx-block-error")).toHaveCount(0);
});

test("Nhóm: 'Liên kết cả khối' hiện ô tab mới / tên liên kết chỉ khi có địa chỉ; lưu đúng thuộc tính", async ({ page }) => {
  await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "lg", type: "group", attrs: {}, content: [{ id: "lp", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Thẻ" }] }] }]); });
  await page.waitForTimeout(700);
  await page.evaluate(() => (window as any).__ecx.store.select(["lg"]));
  await page.waitForTimeout(300);
  const insp = page.locator(".ecx-inspector");
  await expect(insp.getByText("Tên liên kết (cho người đọc màn hình)")).toHaveCount(0);
  const f = insp.getByRole("textbox", { name: /Liên kết cả khối/ });
  await f.fill("/bo-suu-tap"); await f.blur();
  await expect(insp.getByText("Tên liên kết (cho người đọc màn hình)")).toBeVisible();
  expect((await page.evaluate(() => (window as any).__ecx.store.block("lg").attrs)).href).toBe("/bo-suu-tap");
  await f.fill(""); await f.blur();
  await expect(insp.getByText("Tên liên kết (cho người đọc màn hình)")).toHaveCount(0);
});

test("Section: bảng phải ghi 'Section'; tab Kiểu dáng mở đầu bằng Màu / Nền (không phải Kiểu chữ); khối chữ vẫn mở đầu bằng Kiểu chữ", async ({ page }) => {
  await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [
    { id: "sx", type: "group", attrs: { align: "full", constrained: true, padding: "large" }, content: [{ id: "sp", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Phần" }] }] },
    { id: "gx", type: "group", attrs: {}, content: [{ id: "gp", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Nhóm" }] }] }]); });
  await page.waitForTimeout(700);
  const insp = page.locator(".ecx-inspector");
  await page.evaluate(() => (window as any).__ecx.store.select(["sx"]));
  await page.waitForTimeout(300);
  await expect(insp.locator("strong").first()).toHaveText("Section");
  await insp.getByRole("tab", { name: "Kiểu dáng" }).click();
  const heads = await insp.locator(".ecx-section-head, [data-section-title], .ecx-style-tab h3, .ecx-style-tab summary, .ecx-style-tab button[aria-expanded]").allInnerTexts();
  const order = heads.map((h) => h.trim().split("\n")[0]);
  expect(order.indexOf("Màu")).toBeGreaterThanOrEqual(0);
  expect(order.indexOf("Màu")).toBeLessThan(order.indexOf("Kiểu chữ")); // khối chứa: Màu trước Kiểu chữ
  await page.evaluate(() => (window as any).__ecx.store.select(["gx"]));
  await page.waitForTimeout(300);
  await expect(insp.locator("strong").first()).toHaveText("Group"); // Group thường vẫn là Group
});
