import { CORE_NODES, normalizeContent } from "@ecomcx/ecomweb-content";
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { clickEnd, open } from "./helpers";

/**
 * Vòng 7: dữ liệu trình soạn ghi ra phải qua được bộ chuẩn hoá của content (cùng bộ máy chủ dùng) mà KHÔNG mất thuộc tính.
 * Mỗi khối trong thư viện: chèn, đổi từng ô điều khiển một lần, lấy nội dung đã lưu (`__ecx.content()`), chuẩn hoá, so từng thuộc tính.
 * Thuộc tính bị bỏ nhưng không phải giá trị mặc định của lược đồ = trình soạn đang ghi giá trị mà máy chủ sẽ vứt (mất dữ liệu khi lưu).
 */
test.use({ actionTimeout: 3000 });
const TABS = ["Cài đặt", "Kiểu dáng", "Nâng cao"];
type N = { type?: string; attrs?: Record<string, unknown>; content?: N[] };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Thuộc tính / khoá có trong `a` mà `b` không giữ. */
function dropped(a: unknown, b: unknown, path: string, out: string[]) {
  if (a === undefined || a === null) return;
  if (Array.isArray(a)) { a.forEach((x, i) => dropped(x, Array.isArray(b) ? b[i] : undefined, `${path}[${i}]`, out)); return; }
  if (typeof a === "object") {
    for (const [k, v] of Object.entries(a as Record<string, unknown>)) {
      if (k === "id") continue;
      dropped(v, b && typeof b === "object" ? (b as Record<string, unknown>)[k] : undefined, `${path}.${k}`, out);
    }
    return;
  }
  if (b === undefined) out.push(`${path}=${JSON.stringify(a)}`);
}
function walk(inp: N, outN: N | undefined, out: string[]) {
  if (!inp || typeof inp !== "object") return;
  const spec = (CORE_NODES as Record<string, { attrs?: Record<string, { default?: unknown }> }>)[inp.type ?? ""];
  for (const [k, v] of Object.entries(inp.attrs ?? {})) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    const kept = outN?.attrs?.[k];
    if (kept === undefined) {
      if (same(spec?.attrs?.[k]?.default, v)) continue; // giá trị mặc định: chuẩn hoá bỏ là đúng
      out.push(`${inp.type}.${k}=${JSON.stringify(v).slice(0, 60)}`);
    } else if (typeof v === "object") dropped(v, kept, `${inp.type}.${k}`, out);
  }
  (inp.content ?? []).forEach((c, i) => walk(c, outN?.content?.[i], out));
}

async function tileKeys(page: Page): Promise<string[]> {
  await page.getByRole("button", { name: "Thêm khối" }).first().click();
  await page.locator(".ecx-block-tile").first().waitFor();
  return [...new Set(await page.locator(".ecx-block-tile[data-key]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key!)))];
}

test("nội dung trình soạn ghi ra qua chuẩn hoá không mất thuộc tính — mọi khối sau khi đổi các ô điều khiển", async ({ page }) => {
  test.setTimeout(1_800_000);
  const problems: string[] = [];
  await open(page, "?doc=post");
  let keys = await tileKeys(page);
  if (process.env.ECX_SWEEP_ONLY) keys = keys.filter((k) => process.env.ECX_SWEEP_ONLY!.split(",").includes(k));
  for (const key of keys) {
    try {
      const c = await open(page, "?doc=post");
      await clickEnd(c, "Đoạn thứ hai.");
      await page.getByRole("button", { name: "Thêm khối" }).first().click();
      const tile = page.locator(`.ecx-block-tile[data-key='${key}']`);
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
      await page.waitForTimeout(150);
      const insp = page.locator(".ecx-inspector");
      const check = async (what: string) => {
        const content = await page.evaluate(() => (window as any).__ecx.content());
        const norm = normalizeContent(content).doc as { blocks?: Array<{ data?: N }> };
        const out: string[] = [];
        (content.blocks ?? []).forEach((b: { data?: N }, i: number) => { if (b.data) walk(b.data, norm.blocks?.[i]?.data, out); });
        if (out.length) problems.push(`[${key}] sau "${what}": bị bỏ khi chuẩn hoá: ${[...new Set(out)].slice(0, 4).join(", ")}`);
      };
      await check("chèn");
      for (const tab of TABS) {
        const t = insp.getByRole("tab", { name: tab });
        if (!(await t.count())) continue;
        await t.click();
        for (let i = 0; i < 3; i++) {
          const heads = insp.locator(".ecx-style-section > button[aria-expanded='false'], .ecx-more-btn");
          const n = await heads.count();
          if (!n) break;
          for (let j = 0; j < n; j++) await heads.first().click({ timeout: 1200 }).catch(() => {});
        }
        const sel = "input[type=checkbox], input[type=range], select, input[type=number], input.ecx-input[type=text], input.ecx-input:not([type]), textarea, [role=radio]";
        const total = Math.min(await insp.locator(sel).count(), 60);
        for (let i = 0; i < total; i++) {
          const el = insp.locator(sel).nth(i);
          if (!(await el.count())) break;
          const tag = await el.evaluate((n) => `${n.tagName.toLowerCase()}${(n as HTMLInputElement).type ? ":" + (n as HTMLInputElement).type : ""}${n.getAttribute("role") ? ":" + n.getAttribute("role") : ""}`).catch(() => "");
          const label = ((await el.getAttribute("aria-label").catch(() => "")) || "").slice(0, 30);
          try {
            if (tag.startsWith("select")) { const opts = await el.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value)); if (opts.length > 1) await el.selectOption(opts[opts.length - 1], { timeout: 1200 }); }
            else if (tag.startsWith("input:checkbox")) await el.click({ timeout: 1200 });
            else if (tag === "input:range") await el.evaluate((n) => { const r = n as HTMLInputElement; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(r, r.max); r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); });
            else if (tag.includes("radio")) await el.click({ timeout: 1200 });
            else if (tag === "input:number") await el.fill("5", { timeout: 1200 });
            else await el.fill("abc", { timeout: 1200 });
          } catch { continue; }
          await check(`${tab} › ${tag} "${label}"`);
        }
      }
      // ECX_DUMP_BLOCKS=<thư mục>: xuất nội dung cuối của khối thành fixture hợp đồng (content / máy chủ / SDK cùng kiểm)
      if (process.env.ECX_DUMP_BLOCKS) {
        const input = await page.evaluate(() => (window as any).__ecx.content());
        writeFileSync(`${process.env.ECX_DUMP_BLOCKS}/block-${key.replace("/", "-")}.json`, JSON.stringify({ name: `block-${key.replace("/", "-")}`, note: "Khối sau khi đổi các ô điều khiển trong trình soạn: nội dung trình soạn ghi ra phải qua chuẩn hoá giống nhau ở content và máy chủ, vẽ được ở website", input }, null, 2));
      }
    } catch (e) { problems.push(`[${key}] ngoại lệ: ${(e as Error).message.split("\n")[0].slice(0, 120)}`); }
  }
  // Gom trùng: cùng khối + cùng thuộc tính chỉ báo một lần
  const uniq = [...new Map(problems.map((p) => [p.replace(/sau ".*?": /, ""), p])).values()];
  expect(uniq, "\n" + uniq.join("\n")).toEqual([]);
});
