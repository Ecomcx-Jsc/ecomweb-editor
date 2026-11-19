// Khoảng trống / Đường kẻ: bật "kèm đường kẻ" vẽ đường kẻ ở giữa; ô chỉ hiện khi bật; đổi kiểu nét, độ dài, căn, màu áp thật.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("khoảng trống: gộp đường kẻ — chỉ hiện ô đường kẻ khi bật, đường kẻ vẽ đúng kiểu / độ dày / độ dài / căn", async ({ page }) => {
  const c = await open(page, "?doc=post&content=1");
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  const keys = await page.locator(".ecx-inserter-panel [data-key]").evaluateAll((els) => els.map((e) => e.getAttribute("data-key")));
  expect(keys).toContain("spacer"); expect(keys).not.toContain("horizontalRule"); // Đường kẻ đã gộp vào Khoảng trống
  await page.locator(".ecx-inserter-panel .ecx-search").first().fill("spacer");
  await page.locator('.ecx-inserter-panel [data-key="spacer"]').first().click();
  await page.waitForTimeout(500);
  const id = await page.evaluate(() => { const s = (window as any).__ecx.store; const f = (l: any[]): any => { for (const b of l) { if (b.type === "spacer") return b; const r = b.content && f(b.content); if (r) return r; } }; const b = f(s.getState().docs.root.blocks); s.select([b.id]); return b.id; });
  const insp = page.locator(".ecx-inspector");
  await expect(insp.getByText("Kiểu nét")).toHaveCount(0);
  await insp.getByRole("checkbox", { name: "Kèm đường kẻ ở giữa" }).check();
  for (const t of ["Kiểu nét", "Độ dày", "Độ dài đường kẻ", "Màu đường kẻ"]) await expect(insp.getByText(t).first()).toBeVisible();
  await expect(insp.getByText("Căn đường kẻ")).toHaveCount(0); // đường kẻ dài hết khổ thì không cần căn
  const sp = c.locator(".ecx-spacer").first();
  await expect(sp).toHaveClass(/has-line/);
  const line = () => sp.evaluate((e) => { const cs = getComputedStyle(e, "::before"); return [cs.borderTopStyle, cs.borderTopWidth, Math.round(parseFloat(cs.width)), Math.round(e.getBoundingClientRect().width)]; });
  let [st, w, len, full] = await line(); expect([st, w]).toEqual(["solid", "1px"]); expect(len).toBeGreaterThanOrEqual(full - 2);
  await insp.getByRole("radio", { name: "Gạch", exact: true }).click();
  await page.evaluate((i) => (window as any).__ecx.store.setAttrs([i], { lineWeight: 4, lineWidth: 50 }), id);
  await expect(insp.getByText("Căn đường kẻ")).toBeVisible();
  await insp.getByRole("radio", { name: "Phải", exact: true }).click();
  [st, w, len, full] = await line();
  expect([st, w]).toEqual(["dashed", "4px"]); expect(Math.abs(len - full / 2)).toBeLessThan(3);
  const right = await sp.evaluate((e) => { const b = e.getBoundingClientRect(); return Math.round(b.right); });
  expect(right).toBeGreaterThan(0);
  expect((await page.evaluate(() => JSON.stringify((window as any).__ecx.store.getState().docs.root.blocks))).includes('"lineAlign":"right"')).toBe(true);
  await expect(c.locator(".ecx-block-error")).toHaveCount(0);
});
