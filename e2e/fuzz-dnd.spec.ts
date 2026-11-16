import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers";

/**
 * Fuzz kéo thả: trang có nhiều cấp lồng nhau (nhóm, cột, danh sách, accordion, bảng…); mỗi hạt giống thực hiện nhiều lần kéo một khối
 * bằng tay nắm tới một điểm ngẫu nhiên trong khung soạn. Sau mỗi lần: cây hợp lệ (`__ecx.check()`), tập chữ không mất / không nhân đôi,
 * không lỗi JavaScript; thỉnh thoảng hoàn tác phải về đúng trạng thái trước. Tái hiện: FUZZ_SEED=<số>.
 */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000; };
}
const RUNS = Number(process.env.FUZZ_DND_RUNS ?? 8);
const BASE = Number(process.env.FUZZ_SEED ?? 1);
const T = (t: string) => [{ type: "text", text: t }];
const p = (id: string, t: string) => ({ id, type: "paragraph", attrs: {}, inline: T(t) });

const seedDoc = (page: Page) => page.evaluate(() => {
  const st = (window as any).__ecx.store;
  const P = (id: string, t: string) => ({ id, type: "paragraph", attrs: {}, inline: [{ type: "text", text: t }] });
  const old = st.getState().docs.root.blocks.map((b: { id: string }) => b.id);
  st.insert("root", null, 0, [
    { id: "h1", type: "heading", attrs: { level: 2 }, inline: [{ type: "text", text: "Tiêu đề trang" }] },
    P("a", "Đoạn A"),
    { id: "g1", type: "group", attrs: { padding: "medium", style: { color: { background: "muted/15" } } }, content: [P("g1a", "Nhóm một A"), P("g1b", "Nhóm một B"),
      { id: "g2", type: "group", attrs: { padding: "small" }, content: [P("g2a", "Nhóm hai A"), P("g2b", "Nhóm hai B")] }] },
    { id: "cols", type: "columns", attrs: {}, content: [
      { id: "c1", type: "column", attrs: {}, content: [P("c1a", "Cột một A"), P("c1b", "Cột một B")] },
      { id: "c2", type: "column", attrs: {}, content: [P("c2a", "Cột hai A"), { id: "g3", type: "group", attrs: {}, content: [P("g3a", "Nhóm ba A")] }] }] },
    { id: "bl", type: "bulletList", attrs: {}, content: [{ id: "li1", type: "listItem", attrs: {}, content: [P("li1a", "Mục một")] }, { id: "li2", type: "listItem", attrs: {}, content: [P("li2a", "Mục hai")] }] },
    { id: "acc", type: "accordion", attrs: {}, content: [{ id: "d1", type: "details", attrs: { summary: "Hỏi một" }, content: [P("d1a", "Đáp một")] }, { id: "d2", type: "details", attrs: { summary: "Hỏi hai" }, content: [P("d2a", "Đáp hai")] }] },
    P("z", "Đoạn Z cuối"),
  ], { focus: false });
  st.remove(old);
  st.select([]);
});

const snapshot = (page: Page) => page.evaluate(() => {
  const st = (window as any).__ecx.store;
  const texts: string[] = [], ids: string[] = [];
  const walk = (list: any[], depth: number) => { for (const b of list) { ids.push(b.id + ":" + depth); if (b.inline) texts.push(b.inline.map((n: any) => n.text ?? "").join("")); if (b.attrs?.summary) texts.push("S:" + b.attrs.summary); if (b.content) walk(b.content, depth + 1); } };
  walk(st.getState().docs.root.blocks, 0);
  return { texts: texts.filter((t) => t !== "").sort(), tree: JSON.stringify(st.getState().docs.root.blocks.map(function f(b: any): any { return [b.id, (b.content ?? []).map(f)]; })) , ids };
});

for (let k = 0; k < RUNS; k++) {
  const seed = BASE + k;
  test(`fuzz kéo thả — hạt giống ${seed}`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const c = await open(page, "?doc=post");
    await seedDoc(page);
    await page.waitForTimeout(200);
    const r = rng(seed);
    const log: string[] = [];
    const frame = (await page.locator("iframe[data-ecx-canvas]").boundingBox())!;
    for (let i = 0; i < 14; i++) {
      const ids: string[] = await page.evaluate(() => {
        const st = (window as any).__ecx.store; const out: string[] = [];
        const walk = (l: any[]) => { for (const b of l) { out.push(b.id); if (b.content) walk(b.content); } };
        walk(st.getState().docs.root.blocks); return out;
      });
      const id = ids[Math.floor(r() * ids.length)];
      const before = await snapshot(page);
      await page.evaluate((i0) => { const st = (window as any).__ecx.store; st.select([i0]); (document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement).contentDocument!.querySelector<HTMLElement>(".ecx-canvas-root")!.focus(); }, id);
      await page.waitForTimeout(60);
      const handle = page.locator(".ecx-drag-handle").first();
      const hb = (await handle.count()) ? await handle.boundingBox({ timeout: 3000 }).catch(() => null) : null;
      if (!hb) { log.push(`${id}:không có tay nắm`); continue; }
      const tx = frame.x + 40 + r() * (frame.width - 80), ty = frame.y + 20 + r() * (Math.min(frame.height, 780) - 40);
      log.push(`${id}→(${Math.round(tx)},${Math.round(ty)})`);
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(hb.x + 20, hb.y + 20, { steps: 3 });
      await page.mouse.move(tx, ty, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(60);
      const problems: string[] = await page.evaluate(() => (window as any).__ecx.check());
      expect(problems, `FUZZ_SEED=${seed} sau: ${log.slice(-4).join(" ")}`).toEqual([]);
      const after = await snapshot(page);
      expect(after.texts, `FUZZ_SEED=${seed}: chữ bị mất / nhân đôi sau: ${log.slice(-4).join(" ")}`).toEqual(before.texts);
      // Tập khối: chỉ được thêm đoạn trống tự sinh để giữ cây hợp lệ (mục danh sách / cột / nhóm trống); không được mất khối có chữ
      const gone = before.ids.map((x) => x.split(":")[0]).filter((x) => !after.ids.some((y) => y.split(":")[0] === x));
      expect(gone, `FUZZ_SEED=${seed}: khối biến mất sau: ${log.slice(-4).join(" ")}`).toEqual([]);
      if (r() < 0.3 && after.tree !== before.tree) {
        await page.keyboard.press("ControlOrMeta+z".replace("ControlOrMeta", process.platform === "darwin" ? "Meta" : "Control"));
        await page.waitForTimeout(60);
        expect((await snapshot(page)).tree, `FUZZ_SEED=${seed}: hoàn tác không về đúng trạng thái trước sau: ${log.slice(-4).join(" ")}`).toBe(before.tree);
      }
    }
    expect(errors, `FUZZ_SEED=${seed}: lỗi JavaScript`).toEqual([]);
  });
}
