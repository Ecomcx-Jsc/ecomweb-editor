import { expect, test } from "@playwright/test";
import { canvas, open } from "./helpers";
test("nhãn khối chứa: rê chuột hiện nhãn, bấm nhãn chọn đúng khối chứa lồng sâu nhất", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => (window as any).__ecx.store.insert("root", null, 3, [{ id: "q9", type: "query", attrs: { inherit: false, postType: "post", perPage: 3 }, content: [{ id: "pt9", type: "postTemplate", attrs: { layout: "grid", columns: 3 }, content: [{ id: "tt9", type: "postTitle", attrs: {} }] }] }]));
  await page.waitForTimeout(800);
  const q = c.locator('[data-ecx-block="q9"]');
  await q.hover({ position: { x: 20, y: 6 } });
  const b = await q.boundingBox();
  await page.mouse.click(b!.x + 12, b!.y + 8);
  const sel = await page.evaluate(() => { const st = (window as any).__ecx.store; const s = st.getState().selection; return st.locate(s.ids[0] ?? s.editing)?.block?.id; });
  expect(sel).toBe("pt9"); // nhãn của khối chứa lồng sâu nhất; lên cấp cha bằng nút "Chọn khối cha"
});
