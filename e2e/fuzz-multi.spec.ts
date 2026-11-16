import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers";

/**
 * Fuzz nhiều khối: trang có nhiều cấp lồng nhau (nhóm, cột, danh sách, accordion, bảng…); mỗi hạt giống thực hiện nhiều lần kéo một khối
 * chọn một tập khối cùng cấp ngẫu nhiên rồi nhân đôi / xoá / lên / xuống / chép-dán / cắt-dán. Sau mỗi bước: cây hợp lệ, không lỗi JavaScript.
 * Cuối chuỗi: hoàn tác hết phải về đúng trạng thái đầu, làm lại hết phải ra đúng trạng thái cuối. Tái hiện: FUZZ_SEED=<số>.
 */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000; };
}
const RUNS = Number(process.env.FUZZ_MULTI_RUNS ?? 8);
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


const OPS = ["dup", "del", "up", "down", "copypaste", "cutpaste"] as const;
const mod = process.platform === "darwin" ? "Meta" : "Control";
for (let k = 0; k < RUNS; k++) {
  const seed = BASE + k;
  test(`fuzz nhiều khối — hạt giống ${seed}`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, "?doc=post");
    await seedDoc(page);
    await page.waitForTimeout(200);
    const r = rng(seed);
    const log: string[] = [];
    const start = (await snapshot(page)).tree;
    let steps = 0;
    for (let i = 0; i < 12; i++) {
      // Tập khối cùng cha ngẫu nhiên (1–3 khối liền nhau)
      const pick: string[] = await page.evaluate((rv) => {
        const st = (window as any).__ecx.store; const lists: any[][] = [];
        const walk = (l: any[]) => { if (l.length) lists.push(l); for (const b of l) if (b.content) walk(b.content); };
        walk(st.getState().docs.root.blocks);
        const l = lists[Math.floor(rv[0] * lists.length)]; const a = Math.floor(rv[1] * l.length); const n = 1 + Math.floor(rv[2] * Math.min(3, l.length - a));
        return l.slice(a, a + n).map((b: any) => b.id);
      }, [r(), r(), r()]);
      const op = OPS[Math.floor(r() * OPS.length)];
      log.push(`${op}(${pick.join(",")})`);
      await page.evaluate((ids) => { const st = (window as any).__ecx.store; st.select(ids); (document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement).contentDocument!.querySelector<HTMLElement>(".ecx-canvas-root")!.focus(); }, pick);
      await page.waitForTimeout(40);
      const treeBefore = (await snapshot(page)).tree;
      if (op === "dup") await page.keyboard.press(`${mod}+Shift+d`);
      else if (op === "del") await page.keyboard.press("Delete");
      else if (op === "up") await page.keyboard.press("Alt+Shift+ArrowUp");
      else if (op === "down") await page.keyboard.press("Alt+Shift+ArrowDown");
      else { await page.keyboard.press(`${mod}+${op === "copypaste" ? "c" : "x"}`); await page.keyboard.press(`${mod}+v`); }
      await page.waitForTimeout(60);
      const problems: string[] = await page.evaluate(() => (window as any).__ecx.check());
      expect(problems, `FUZZ_SEED=${seed} sau: ${log.slice(-4).join(" ")}`).toEqual([]);
      if ((await snapshot(page)).tree !== treeBefore) steps++;
    }
    const end = (await snapshot(page)).tree;
    // Hoàn tác từng bước: phải đi qua ĐÚNG trạng thái đầu (không bỏ sót bước, không nhảy quá)
    const reach = async (key: string, target: string) => {
      for (let i = 0; i < steps * 3 + 6; i++) {
        if ((await snapshot(page)).tree === target) return true;
        await page.keyboard.press(`${mod}+${key}`);
        await page.waitForTimeout(40);
      }
      return (await snapshot(page)).tree === target;
    };
    expect(await reach("z", start), `FUZZ_SEED=${seed}: hoàn tác từng bước không đi qua trạng thái đầu. Chuỗi: ${log.join(" ")}`).toBe(true);
    expect(await reach("Shift+z", end), `FUZZ_SEED=${seed}: làm lại từng bước không đi qua trạng thái cuối. Chuỗi: ${log.join(" ")}`).toBe(true);
    expect(errors, `FUZZ_SEED=${seed}: lỗi JavaScript`).toEqual([]);
  });
}
