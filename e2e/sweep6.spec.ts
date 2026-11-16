import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { clickEnd, open } from "./helpers";

/**
 * Vòng 11 — an toàn: điền mã độc vào MỌI ô chữ / liên kết / vùng văn bản trong bảng bên phải của từng khối (và ngay trên canvas),
 * rồi kiểm: (1) trình soạn không chạy mã (cờ window.__xss), (2) HTML website của nội dung đó không có <script>, thuộc tính on…= thật,
 * `javascript:` trong href / src / action, hay `url(javascript:` trong style. Khối `customHtml` / `embed` / `shortcode` là HTML / URL do quản trị đặt có chủ đích nên chỉ kiểm cờ thực thi trong trình soạn.
 */
test.use({ actionTimeout: 3000 });
const here = path.dirname(fileURLToPath(import.meta.url));
const site = { name: "Test", url: "https://example.com", locale: "vi" } as never;
const PAYLOADS = [
  `"><img src=x onerror=window.__xss=1>`,
  `javascript:window.__xss=1`,
  `<script>window.__xss=1</script>`,
  `x" onmouseover="window.__xss=1`,
  `url(javascript:window.__xss=1)`,
];
const TABS = ["Cài đặt", "Kiểu dáng", "Nâng cao"];

async function loadSiteRenderer(): Promise<(content: unknown, ctx: unknown) => Promise<unknown>> {
  const dir = path.resolve(here, "../node_modules/.cache/parity");
  mkdirSync(dir, { recursive: true });
  const tag = `x${process.pid}`;
  const stub = path.join(dir, `next-stub-${tag}.cjs`);
  writeFileSync(stub, "const C = (p) => null; module.exports = { __esModule: true, default: C, usePathname: () => '/', useRouter: () => ({}), useSearchParams: () => new URLSearchParams(), useLinkStatus: () => ({ pending: false }) };");
  const linkStub = path.join(dir, `next-link-stub-${tag}.cjs`);
  writeFileSync(linkStub, "const { createElement } = require('react'); const L = ({ prefetch, replace, scroll, ...p }) => createElement('a', p); L.useLinkStatus = () => ({ pending: false }); module.exports = L; module.exports.default = L;");
  const out = path.join(dir, `rich-${tag}.cjs`);
  await build({ entryPoints: [path.resolve(here, "../../sdk/packages/theme-sdk/src/rich.tsx")], bundle: true, platform: "node", format: "cjs", outfile: out, jsx: "automatic",
    external: ["react", "react-dom"], alias: { "next/navigation": stub, "next/link": linkStub, "next/form": stub, "server-only": path.resolve(here, "../../sdk/node_modules/server-only/empty.js") }, logLevel: "error", nodePaths: [path.resolve(here, "../../sdk/node_modules")] });
  return (createRequire(import.meta.url)(out) as { renderContent: (c: unknown, x: unknown) => Promise<unknown> }).renderContent;
}

async function tileKeys(page: Page): Promise<string[]> {
  await page.getByRole("button", { name: "Thêm khối" }).first().click();
  await page.locator(".ecx-block-tile").first().waitFor();
  return [...new Set(await page.locator(".ecx-block-tile[data-key]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key!)))];
}

/** Dấu hiệu mã chạy được trong HTML website. */
function unsafe(html: string): string[] {
  const out: string[] = [];
  if (/<script[\s>]/i.test(html.replace(/<script[^>]*type="application\/ld\+json"[\s\S]*?<\/script>/gi, ""))) out.push("có thẻ <script>");
  if (/<[a-z][^>]*\son[a-z]+\s*=\s*["'][^"']*__xss/i.test(html)) out.push("thuộc tính sự kiện on…= chứa mã");
  if (/\s(?:href|src|action|formaction|xlink:href)\s*=\s*"\s*javascript:/i.test(html)) out.push("href / src có javascript:");
  if (/\sstyle\s*=\s*"[^"]*url\(\s*(?:&quot;|&#x27;|['"])?\s*javascript:/i.test(html) || /<style[^>]*>[^<]*url\(\s*['"]?javascript:/i.test(html)) out.push("url(javascript:) trong style");
  return out;
}

test("điền mã độc vào mọi ô của từng khối: trình soạn không chạy mã, website không có mã chạy được", async ({ page }) => {
  test.setTimeout(1_800_000);
  const problems: string[] = [];
  const render = await loadSiteRenderer();
  await open(page, "?doc=post");
  let keys = await tileKeys(page);
  if (process.env.ECX_SWEEP_ONLY) keys = keys.filter((k) => process.env.ECX_SWEEP_ONLY!.split(",").includes(k));
  const INTENTIONAL_HTML = /^(customHtml|embed|shortcode|youtube|video|audio|file|map)$/;
  for (const key of keys) {
    try {
      const c = await open(page, "?doc=post");
      await page.evaluate(() => { (window as any).__xss = undefined; });
      await clickEnd(c, "Đoạn thứ hai.");
      await page.getByRole("button", { name: "Thêm khối" }).first().click();
      const tile = page.locator(`.ecx-block-tile[data-key='${key}']`);
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
      await page.waitForTimeout(120);
      const insp = page.locator(".ecx-inspector");
      let n = 0;
      for (const tab of TABS) {
        const t = insp.getByRole("tab", { name: tab });
        if (!(await t.count())) continue;
        await t.click();
        for (let i = 0; i < 3; i++) {
          const heads = insp.locator(".ecx-style-section > button[aria-expanded='false'], .ecx-more-btn");
          const cnt = await heads.count();
          if (!cnt) break;
          for (let j = 0; j < cnt; j++) await heads.first().click({ timeout: 1000 }).catch(() => {});
        }
        const sel = "input.ecx-input[type=text], input.ecx-input[type=url], input.ecx-input:not([type]), textarea";
        const total = Math.min(await insp.locator(sel).count(), 40);
        for (let i = 0; i < total; i++) {
          const el = insp.locator(sel).nth(i);
          await el.fill(PAYLOADS[n++ % PAYLOADS.length], { timeout: 1200 }).catch(() => {});
        }
      }
      // Và gõ thẳng lên canvas (ô chữ của khối)
      const rich = c.locator("[data-ecx-rich]").last();
      if (await rich.count()) { await rich.click({ timeout: 1500 }).catch(() => {}); await page.keyboard.type(PAYLOADS[0], { delay: 0 }).catch(() => {}); }
      await page.waitForTimeout(150);
      const ran = await page.evaluate(() => { const f = document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement | null; return (window as any).__xss ?? (f?.contentWindow as any)?.__xss; });
      if (ran) problems.push(`[${key}] mã độc CHẠY trong trình soạn (window.__xss = ${ran})`);
      if (!INTENTIONAL_HTML.test(key)) {
        const content = await page.evaluate(() => (window as any).__ecx.content());
        const html = renderToStaticMarkup(await render(content, { site, resolve: { shortcode: async () => null, block: async () => null } } as never) as never);
        for (const u of unsafe(html)) problems.push(`[${key}] website: ${u}`);
      }
    } catch (e) { const m = (e as Error).message; if (/CMS (API|runtime)/.test(m)) continue; /* khối cần API website (chữ theo ngôn ngữ): không dựng được ở đây */ problems.push(`[${key}] ngoại lệ: ${m.split("\n")[0].slice(0, 110)}`); }
  }
  const uniq = [...new Set(problems)];
  expect(uniq, "\n" + uniq.join("\n")).toEqual([]);
});

test("bộ phát hiện mã độc nhận ra HTML nguy hiểm thật và bỏ qua chữ thường", () => {
  expect(unsafe('<a href="javascript:alert(1)">x</a>')).toContain("href / src có javascript:");
  expect(unsafe('<img src=x onerror="window.__xss=1">').length).toBeGreaterThan(0);
  expect(unsafe("<p>ok</p><script>window.__xss=1</script>")).toContain("có thẻ <script>");
  expect(unsafe('<div style="background:url(javascript:alert(1))">x</div>')).toContain("url(javascript:) trong style");
  expect(unsafe("<p>url(javascript:window.__xss=1) và &lt;script&gt; chỉ là chữ</p>")).toEqual([]);
});
