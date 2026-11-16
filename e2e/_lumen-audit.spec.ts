import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { canvas } from "./helpers";

// Kiểm thử thủ công (không chạy trong CI): nạp template của cửa hàng Lumen trên 8096 vào trình soạn, bấm từng khối, ghi lại khối nào không chọn được / bảng cài đặt có gì.
test.use({ actionTimeout: 4000 });
const OUT = process.env.AUDIT_OUT!;
async function tpl(kind: string, name: string) {
  const login = await (await fetch("http://localhost:8096/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: process.env.ADM_USER, password: process.env.ADM_PASS }) })).json();
  return (await (await fetch(`http://localhost:8096/api/admin/templates/${kind}/${name}`, { headers: { authorization: `Bearer ${login.accessToken}` } })).json()).content;
}
const DOCS: Array<[string, string, string]> = [["part", "header", "header"], ["template", "front-page", "home"], ["template", "archive-product", "shop"], ["part", "footer", "footer"]];
for (const [kind, name, label] of DOCS) {
  test(`audit ${label}`, async ({ page }) => {
    test.setTimeout(240_000);
    const doc = await tpl(kind, name);
    await page.addInitScript((d) => { (window as any).__INJECT_DOC__ = d; }, doc);
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto("/");
    const c = canvas(page);
    await expect(c.locator(".ecx-canvas-root")).toBeVisible();
    await page.waitForTimeout(1500);
    const frame = await page.locator("iframe[data-ecx-canvas]").boundingBox();
    const ids: Array<{ id: string; type: string }> = await page.evaluate(() => {
      const st = (window as any).__ecx.store; const out: any[] = [];
      const walk = (l: any[]) => l.forEach((b) => { out.push({ id: b.id, type: b.type }); if (b.content) walk(b.content); });
      walk(st.getState().docs.root.blocks); return out;
    });
    const rows: any[] = [];
    for (const { id, type } of ids) {
      const loc = c.locator(`[data-ecx-block="${id}"]`).first();
      if (!(await loc.count())) { rows.push({ type, id, result: "not-in-dom" }); continue; }
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const box = await loc.boundingBox();
      if (!box || box.width < 2 || box.height < 2) { rows.push({ type, id, result: "no-box", box }); continue; }
      // bấm vào góc trên-trái trong khối (tránh con) rồi đọc vùng chọn
      const x = Math.min(box.x + box.width - 3, box.x + 4), y = Math.min(box.y + box.height - 3, box.y + 4);
      await page.mouse.click(x, y).catch(() => {});
      await page.waitForTimeout(120);
      const info = await page.evaluate((bid) => {
        const st = (window as any).__ecx.store; const s = st.getState().selection;
        const cur = s.ids.length ? s.ids : s.editing ? [s.editing] : [];
        const sel = cur[0]; const loc = sel ? st.locate(sel) : null;
        return { selected: sel ?? null, selType: loc?.block?.type ?? null, within: !!sel && (sel === bid || (loc?.ancestors ?? []).includes(bid)), isSelf: sel === bid, inspector: document.querySelectorAll(".ecx-inspector input, .ecx-inspector select, .ecx-inspector textarea, .ecx-inspector button[role=radio], .ecx-inspector [role=switch]").length };
      }, id);
      rows.push({ type, id, w: Math.round(box.width), h: Math.round(box.height), ...info });
    }
    writeFileSync(`${OUT}/audit-${label}.json`, JSON.stringify(rows, null, 1));
  });
}
