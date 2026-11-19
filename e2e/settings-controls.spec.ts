import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers";

const T = (text: string) => [{ type: "text", text }];
const p = (id: string, text: string) => ({ id, type: "paragraph", attrs: {}, inline: T(text) });
const put = async (page: Page, node: unknown) => {
  await page.evaluate((n) => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [n]); }, node);
  await page.waitForTimeout(400); // khối vừa chèn tự đặt con trỏ vào đoạn đầu → chọn lại khối sau đó
  await page.evaluate(() => (window as any).__ecx.store.select(["x"], { editing: null }));
};

test("tab Cài đặt có ô bố cục riêng của khối: danh sách chia cột / kiểu dấu, nhóm nút — sửa là thấy trên canvas", async ({ page }) => {
  const c = await open(page, "?empty=1&content=1");
  const insp = page.locator(".ecx-inspector");
  await put(page, { id: "x", type: "bulletList", attrs: {}, content: ["Một", "Hai", "Ba", "Bốn"].map((t, i) => ({ id: `li${i}`, type: "listItem", attrs: {}, content: [p(`lp${i}`, t)] })) });
  await insp.getByText("Cài đặt", { exact: true }).first().click();
  await expect(insp.getByText("Bố cục danh sách")).toBeVisible();
  const sec = insp.getByRole("button", { name: /Bố cục danh sách/ }).first();
  if (await sec.getAttribute("aria-expanded") === "false") await sec.click();
  await insp.getByLabel("Chia cột", { exact: true }).selectOption("2");
  const ul = c.locator('[data-ecx-block="x"]');
  await expect.poll(() => ul.evaluate((el) => getComputedStyle(el).columnCount)).toBe("2");
  // tab Kiểu dáng không lặp lại ô đã chuyển sang Cài đặt
  await insp.getByText("Kiểu dáng", { exact: true }).first().click();
  await expect(insp.getByLabel("Chia cột", { exact: true })).toHaveCount(0);

  await page.evaluate(() => (window as any).__ecx.store.remove(["x"]));
  await put(page, { id: "x", type: "buttons", attrs: {}, content: [{ id: "b1", type: "button", attrs: { text: "A" } }, { id: "b2", type: "button", attrs: { text: "B" } }] });
  await insp.getByText("Cài đặt", { exact: true }).first().click();
  await insp.getByLabel("Hướng xếp", { exact: true }).selectOption("column"); // ô ở mục "Bố cục nhóm nút" (select), khác ô "Hướng xếp nút" ở trên
  await expect.poll(() => c.locator('[data-ecx-block="x"]').evaluate((el) => getComputedStyle(el).flexDirection)).toBe("column");
});
