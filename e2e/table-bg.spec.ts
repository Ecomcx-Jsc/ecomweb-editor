import { expect, test, type Page } from "@playwright/test";
import { clickEnd, open, state } from "./helpers";

const selectType = (page: Page, type: string) => page.evaluate((t) => {
  const s = (window as any).__ecx.store; let id = "";
  const w = (l: any[]) => { for (const b of l) { if (b.type === t) id = b.id; if (b.content) w(b.content); } };
  for (const d of Object.values<any>(s.getState().docs)) w(d.blocks);
  s.select([id], { editing: null });
  return id;
}, type);

test("bảng: Cài đặt có kẻ sọc, rê hàng, đường kẻ, độ thoáng, ghim hàng đầu, chú thích → class + <caption> thật", async ({ page }) => {
  const c = await open(page, "?doc=rich");
  await clickEnd(c, "a1");
  await selectType(page, "table");
  const insp = page.locator(".ecx-inspector");
  await insp.getByText("Cài đặt", { exact: true }).first().click();
  await insp.getByRole("checkbox", { name: "Kẻ sọc (hàng chẵn tô nền)" }).check();
  await insp.getByRole("checkbox", { name: "Sáng hàng khi rê chuột" }).check();
  await insp.getByRole("radio", { name: "Giữa các hàng" }).click();
  await insp.getByRole("radio", { name: "Chặt" }).click();
  await insp.getByRole("checkbox", { name: "Ghim hàng tiêu đề khi cuộn dọc" }).check();
  await insp.getByLabel("Chú thích bảng").fill("Bảng giá 2026");
  const wrap = c.locator(".ecx-table").first();
  await expect(wrap).toHaveClass(/is-striped/);
  await expect(wrap).toHaveClass(/is-hover/);
  await expect(wrap).toHaveClass(/is-lines-rows/);
  await expect(wrap).toHaveClass(/is-compact/);
  await expect(wrap).toHaveClass(/is-sticky-head/);
  await expect(wrap.locator("caption")).toHaveText("Bảng giá 2026");
  // CSS thật: kẻ sọc tô nền hàng chẵn, đường kẻ chỉ giữa các hàng
  const cell = wrap.locator("tbody tr").nth(1).locator("td").first();
  expect(await cell.evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe("0px");
  expect(await cell.evaluate((el) => getComputedStyle(el).borderTopWidth)).not.toBe("0px");
  const st = await state(page);
  const find = (l: any[]): any => { for (const b of l) { if (b.type === "table") return b; const f = b.content && find(b.content); if (f) return f; } };
  const t = find(st.docs.root.blocks);
  expect(t.attrs).toMatchObject({ striped: true, hoverRows: true, lines: "rows", density: "compact", stickyHead: true, caption: "Bảng giá 2026" });
});

test("ảnh nền: độ mờ / làm mờ / hoà trộn của ảnh vẽ bằng lớp ::before, chữ không bị mờ", async ({ page }) => {
  const c = await open(page, "?empty=1&content=1");
  await page.evaluate(() => {
    const s = (window as any).__ecx.store;
    const img = "/uploads/a.jpg";
    s.insert?.("root", null, 0, [{ id: "g1", type: "group", attrs: { style: { background: { image: { base: img }, imageOpacity: 30, imageBlur: 4, imageBlend: "multiply" }, padding: "xl" } }, content: [{ id: "p1", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Chữ rõ nét" }] }] }]);
  });
  const g = c.locator('[data-ecx-block="g1"]');
  await expect(g).toBeVisible();
  const fx = await g.evaluate((el) => { const b = getComputedStyle(el, "::before"); return { op: b.opacity, filter: b.filter, blend: b.mixBlendMode, z: b.zIndex, host: getComputedStyle(el).backgroundImage }; });
  expect(fx).toMatchObject({ op: "0.3", blend: "multiply", z: "-1", host: "none" });
  expect(fx.filter).toContain("blur(4px)");
  expect(await g.locator("p").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  // Bảng phải: ảnh nền có ô độ mờ / làm mờ / hoà trộn, kéo thanh trượt ghi vào style
  await g.click({ position: { x: 4, y: 4 } });
  const insp = page.locator(".ecx-inspector");
  await insp.getByText("Kiểu dáng", { exact: true }).first().click();
  const bgSec = insp.getByRole("button", { name: /^Nền/ }).first();
  if (await bgSec.getAttribute("aria-expanded") === "false") await bgSec.click();
  await expect(insp.getByLabel("Độ mờ của ảnh nền")).toHaveValue("30");
  await insp.getByLabel("Làm mờ ảnh nền").fill("10");
  expect((await g.evaluate((el) => getComputedStyle(el, "::before").filter))).toContain("blur(10px)");
});
