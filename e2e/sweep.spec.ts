import { expect, test, type Page } from "@playwright/test";
import { clickEnd, mod, open, state } from "./helpers";

/**
 * Quét toàn bộ: mỗi khối trong thư viện được chèn thật (bấm ô khối) trên một trang mới, rồi mở 3 tab bảng bên phải.
 * Gom MỌI lỗi vào một danh sách (không dừng ở lỗi đầu): lỗi console / pageerror, khối báo lỗi, bảng phải tràn ngang, hoàn tác không gỡ sạch.
 * ECX_SWEEP_ONLY=a,b chỉ chạy các khối đó (chạy lại sau khi sửa).
 */
const TABS = ["Cài đặt", "Kiểu dáng", "Nâng cao"];
test.use({ actionTimeout: 6000 });

async function tileKeys(page: Page): Promise<string[]> {
  await page.getByRole("button", { name: "Thêm khối" }).first().click();
  await page.locator(".ecx-block-tile").first().waitFor();
  return [...new Set(await page.locator(".ecx-block-tile[data-key]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key!)))];
}

test("quét mọi khối trong thư viện: chèn, mở 3 tab bảng phải, hoàn tác — gom hết lỗi", async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  let current = "";
  page.on("pageerror", (e) => errors.push(`[${current}] pageerror: ${e.message.split("\n")[0]}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|net::ERR/.test(m.text())) errors.push(`[${current}] console.error: ${m.text().slice(0, 160)}`); });
  await open(page, "?doc=post");
  let keys = await tileKeys(page);
  expect(keys.length).toBeGreaterThan(20);
  if (process.env.ECX_SWEEP_ONLY) keys = keys.filter((k) => process.env.ECX_SWEEP_ONLY!.split(",").includes(k));
  for (const key of keys) {
    current = key;
    try {
      const c = await open(page, "?doc=post");
      await clickEnd(c, "Đoạn thứ hai.");
      const ids = async () => JSON.stringify((await state(page)).docs.root.blocks.map((b: { id: string }) => b.id));
      const before = await ids();
      await page.getByRole("button", { name: "Thêm khối" }).first().click();
      const tile = page.locator(`.ecx-block-tile[data-key='${key}']`);
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
      await page.waitForTimeout(150);
      if (await c.locator(".ecx-block-error").count()) errors.push(`[${key}] khối báo lỗi (.ecx-block-error)`);
      const insp = page.locator(".ecx-inspector");
      for (const tab of TABS) {
        const t = insp.getByRole("tab", { name: tab });
        if (!(await t.count())) continue;
        await t.click();
        await page.waitForTimeout(60);
        // Phần tử nào vượt mép phải của bảng (bỏ phần tử ẩn / nằm trong vùng cuộn riêng)
        const bad = await insp.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return [...el.querySelectorAll("*")].filter((n) => { const b = n.getBoundingClientRect(), cs = getComputedStyle(n); return b.width > 0 && b.right > r.right + 1 && cs.opacity !== "0" && cs.visibility !== "hidden" && !n.closest(".ecx-card-tip, .ecx-color-pop, .ecx-icon-pop, [role=listbox], [role=dialog]"); })
            .slice(0, 3).map((n) => `${n.tagName.toLowerCase()}.${String((n as HTMLElement).className).split(" ")[0]}(+${Math.round(n.getBoundingClientRect().right - r.right)}px)`);
        });
        if (bad.length) errors.push(`[${key}] bảng phải tab "${tab}" tràn: ${bad.join(", ")}`);
      }
      await page.keyboard.press(`${mod}+z`); // ngay sau khi chèn, như người dùng (không bấm Esc trước)
      await page.waitForTimeout(80);
      const after = await ids();
      if (after !== before) errors.push(`[${key}] hoàn tác một lần không về trạng thái trước khi chèn`);
    } catch (e) {
      errors.push(`[${key}] ngoại lệ: ${(e as Error).message.split("\n")[0].slice(0, 140)}`);
    }
  }
  expect(errors, "\n" + errors.join("\n")).toEqual([]);
});
