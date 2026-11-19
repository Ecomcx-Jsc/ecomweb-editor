// Trang phức tạp (fixtures/page-*.json) vẽ bằng renderer website + style.css, mở trong trình duyệt thật ở 3 khổ: không tràn ngang, không lỗi,
// mọi khối con trực tiếp của trang có kích thước. ECX_SHOTS=<thư mục> chụp ảnh.
import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { loadSiteRenderer } from "./site-render";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, "../../content/fixtures");
const css = readFileSync(path.resolve(here, "../node_modules/@ecomcx/ecomweb-content/style.css"), "utf8");
const site = { name: "Test", url: "https://example.com", locale: "vi" } as never;

// Máy chủ CMS giả: mọi cuộc gọi API trả trang web mẫu (đủ cho getT / getSite của khối đếm ngược, form…)
process.env.CMS_API_URL ??= "http://cms.test"; process.env.NEXT_PUBLIC_CMS_API_URL ??= "http://cms.test";
(globalThis as any).__cmsRuntime = { themes: {}, plugins: {} };
globalThis.fetch = (async () => new Response(JSON.stringify({ name: "Test", url: "https://example.com", locale: "vi", locales: ["vi"], messages: {}, dictionary: {} }), { headers: { "content-type": "application/json" } })) as never;

for (const file of readdirSync(fixtures).filter((f) => /^page-.+\.json$/.test(f))) {
  test(`website: ${file.replace(".json", "")} — 3 khổ, không tràn ngang, không lỗi`, async ({ page }) => {
    const f = JSON.parse(readFileSync(path.join(fixtures, file), "utf8"));
    const renderContent = await loadSiteRenderer();
    const html = renderToStaticMarkup(await renderContent(f.expected, { site, resolve: { shortcode: async () => null, block: async () => null } } as never) as never);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("http://site.test/**", (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body style="margin:0"><main class="ecx-content">${html}</main></body></html>` }));
    await page.route("http://site.test/sample.svg", (r) => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#2a5aa8"/></svg>' }));
    for (const [label, w] of [["desktop", 1280], ["tablet", 820], ["mobile", 390]] as const) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("http://site.test/");
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const d = document.documentElement; const over = d.scrollWidth - d.clientWidth;
        const who = over > 1 ? [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().right > d.clientWidth + 1).slice(0, 4).map((e) => e.tagName.toLowerCase() + "." + String(e.className).split(" ")[0] + "(+" + Math.round(e.getBoundingClientRect().right - d.clientWidth) + ")") : [];
        const flat = [...document.querySelectorAll("main > .ecx-content > *, main > *")].filter((e) => !/^(STYLE|SCRIPT)$/.test(e.tagName) && e.getBoundingClientRect().height < 1).map((e) => e.className.toString().split(" ")[0]);
        return { over, who, flat };
      });
      if (process.env.ECX_SHOTS) await page.screenshot({ path: `${process.env.ECX_SHOTS}/site-${file.replace(".json", "")}-${label}.png`, fullPage: true });
      expect(r.over, `${file}@${label} tràn ngang ${r.who.join(", ")}`).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });
}
