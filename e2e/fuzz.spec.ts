import { expect, test } from "@playwright/test";
import { END, HOME, clickEnd, mod, open } from "./helpers";

/**
 * Fuzz trên trình duyệt thật: chuỗi phím ngẫu nhiên (có hạt giống, tái hiện bằng FUZZ_SEED) trong trình soạn — gõ tiếng Việt,
 * Enter, Backspace, Delete, mũi tên, Tab, gõ tắt, hoàn tác / làm lại. Sau mỗi nhịp: không lỗi JavaScript, cây hợp lệ,
 * chữ trên màn hình khớp dữ liệu từng khối (không mất / thừa chữ).
 */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000; };
}
const WORDS = ["xin", "chào", "Việt", "Nam", "đẹp", "ắ", "ợ", "ữ", "a", " ", "1. ", "- ", "## ", "> "];
const KEYS = ["Enter", "Backspace", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Shift+Enter", "Tab", "Shift+Tab", HOME, END];

const RUNS = Number(process.env.FUZZ_E2E_RUNS ?? 6);
const BASE = Number(process.env.FUZZ_SEED ?? 1);
for (let k = 0; k < RUNS; k++) {
  const seed = BASE + k;
  test(`fuzz bàn phím — hạt giống ${seed}`, async ({ page }) => {
    // 120 phím + kiểm tra focus mỗi phím: chạy song song nhiều trình duyệt cần quá 30 giây mặc định
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const c = await open(page, k % 2 ? "" : "?doc=post");
    await clickEnd(c, k % 2 ? "Đây là đoạn văn đầu tiên." : "Nội dung bài viết.");
    const r = rng(seed);
    const log: string[] = [];
    // Trang không được điều hướng đi (mất bài đang sửa)
    let navigatedAfter: string | null = null;
    page.on("framenavigated", (f) => { if (f === page.mainFrame() && navigatedAfter === null) navigatedAfter = `${log.slice(-6).join(" ")} → ${f.url()}`; });
    const where = () => page.evaluate(() => { const a = document.activeElement as HTMLElement | null; const f = (a as HTMLIFrameElement | null)?.contentDocument?.activeElement as HTMLElement | null; return `${a?.tagName}${f ? ">" + f.tagName + (f.getAttribute("data-ecx-rich") !== null ? "[rich]" : "") : ""}`; }).catch(() => "?");
    const refocus = () => page.evaluate(() => {
      const s = (window as any).__ecx.store;
      const walk = (list: any[]): any => { for (const b of list) { if (b.inline) return b; const x = b.content && walk(b.content); if (x) return x; } };
      const t = walk(s.getState().docs[s.getState().rootId].blocks);
      if (t) s.focusText(t.id, -1);
    });
    for (let i = 0; i < 120; i++) {
      // Tab ra khỏi khung soạn (đúng hành vi trợ năng) → đưa về khung soạn: fuzz chỉ đo trình soạn, không đo ô nhập khác của trang
      if (await page.evaluate(() => document.activeElement?.tagName !== "IFRAME")) await refocus();
      const x = r();
      if (x < 0.45) { const w = WORDS[Math.floor(r() * WORDS.length)]; await page.keyboard.type(w); log.push(`"${w}"`); }
      else if (x < 0.9) { const key = KEYS[Math.floor(r() * KEYS.length)]; const w0 = process.env.FUZZ_TRACE ? `@${await where()}` : ""; await page.keyboard.press(key); log.push(key + w0); }
      else if (x < 0.95) { await page.keyboard.press(`${mod}+z`); log.push("undo"); }
      else { await page.keyboard.press(`${mod}+Shift+z`); log.push("redo"); }
      // Mất focus (vd chọn cả khối bằng Esc, khối nguyên): quay lại gõ ở một ô chữ bất kỳ
      if (navigatedAfter !== null) throw new Error(`FUZZ_SEED=${seed}: trang bị điều hướng đi sau: ${navigatedAfter} (focus: ${await page.evaluate(() => document.activeElement?.tagName).catch(() => "?")})`);
      if (i % 15 === 14) {
        const problems = await page.evaluate(() => (window as any).__ecx.check());
        expect(problems, `FUZZ_SEED=${seed} sau: ${log.slice(-10).join(" ")}`).toEqual([]);
        const focused = await page.evaluate(() => !!document.querySelector("iframe")?.contentDocument?.activeElement?.closest("[data-ecx-rich]"));
        // Đưa con trỏ về cuối khối chữ đầu tiên qua store (bấm chuột có thể trúng thanh công cụ nổi)
        if (!focused) await refocus();
      }
    }
    expect(errors, `FUZZ_SEED=${seed}: lỗi JavaScript`).toEqual([]);
    expect(await page.evaluate(() => (window as any).__ecx.check()), `FUZZ_SEED=${seed} cuối chuỗi: ${log.slice(-12).join(" ")}`).toEqual([]);
  });
}
