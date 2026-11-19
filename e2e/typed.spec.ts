// Tiêu đề có chữ gõ: ô ở bảng cài đặt, xem trước từ đầu tiên trên khung soạn, ô tốc độ / dừng / lặp chỉ hiện khi có từ.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("tiêu đề: nhập nhóm từ chữ gõ → khung soạn hiện từ đầu tiên sau tiêu đề; ô tốc độ chỉ hiện khi có từ; xoá thì mất", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "ty", type: "heading", attrs: { level: 2 }, inline: [{ type: "text", text: "Chúng tôi làm" }] }]); s.select(["ty"]); });
  await page.waitForTimeout(400);
  const insp = page.locator(".ecx-inspector");
  await expect(insp.getByText("Tốc độ gõ")).toHaveCount(0);
  const f = insp.getByRole("textbox", { name: /Chữ gõ ở cuối tiêu đề/ });
  await f.fill("website | ứng dụng | thương hiệu"); await f.blur();
  await expect(insp.getByText("Tốc độ gõ")).toBeVisible();
  const h = c.locator('[data-ecx-block="ty"]');
  await expect(h).toHaveAttribute("data-ecx-typed", "website");
  expect(await h.evaluate((e) => getComputedStyle(e, "::after").content)).toMatch(/website|attr\(data-ecx-typed\)/); // Firefox trả dạng chưa thay attr()
  expect(await page.evaluate(() => (window as any).__ecx.store.block("ty").inline.map((n: any) => n.text).join(""))).toBe("Chúng tôi làm"); // chữ gõ không chen vào nội dung tiêu đề
  await f.fill(""); await f.blur();
  await expect(h).not.toHaveAttribute("data-ecx-typed", /.+/);
});
