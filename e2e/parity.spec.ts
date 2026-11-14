import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { canvas } from "./helpers";

/**
 * Parity canvas ↔ website: cùng một tài liệu vẽ bằng canvas (trình soạn) và bằng renderer của theme-sdk (website),
 * so từng phần tử: thẻ, class, style, thuộc tính chính. Khối đã dùng vỏ chung (@ecomcx/ecomweb-content › blockShell) phải khớp 100%.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, "../../content/fixtures");
const site = { name: "Test", url: "https://example.com", locale: "vi" } as never;
// Không đưa vào: bindings-lock — nội dung gắn dữ liệu phụ thuộc nguồn dữ liệu (canvas xem trước bằng dữ liệu mẫu của host, website bằng dữ liệu thật) nên không so từng chữ.
const FILES = ["basic-blocks", "layout-blocks", "all-core-nodes", "block-extras", "block-styles", "style-layout-effects", "style-motion", "attr-coercion", "block-controls"];

/** Renderer của website (theme-sdk/rich.tsx) gói thành CommonJS để chạy trong Node; `next/navigation` (chỉ dùng ở trình duyệt) thay bằng khung rỗng. */
async function loadSiteRenderer(): Promise<(content: unknown, ctx: unknown) => Promise<unknown>> {
  const dir = path.resolve(here, "../node_modules/.cache/parity");
  mkdirSync(dir, { recursive: true });
  const stub = path.join(dir, "next-stub.cjs");
  writeFileSync(stub, "const C = (p) => null; module.exports = { __esModule: true, default: C, usePathname: () => '/', useRouter: () => ({}), useSearchParams: () => new URLSearchParams(), useLinkStatus: () => ({ pending: false }) };");
  // next/link: vẽ <a> như Next.js; esbuild nạp CJS kiểu Node (default = module.exports) nên xuất chính component (theme-sdk dùng Link cho link nội bộ trong nội dung, nút, ảnh)
  const linkStub = path.join(dir, "next-link-stub.cjs");
  writeFileSync(linkStub, "const { createElement } = require('react'); const L = ({ prefetch, replace, scroll, ...p }) => createElement('a', p); L.useLinkStatus = () => ({ pending: false }); module.exports = L;");
  const out = path.join(dir, "rich.cjs");
  await build({ entryPoints: [path.resolve(here, "../../sdk/packages/theme-sdk/src/rich.tsx")], bundle: true, platform: "node", format: "cjs", outfile: out, jsx: "automatic",
    external: ["react", "react-dom"], alias: { "next/navigation": stub, "next/link": linkStub, "next/form": stub }, logLevel: "error", nodePaths: [path.resolve(here, "../../sdk/node_modules")] });
  return (createRequire(import.meta.url)(out) as { renderContent: (c: unknown, x: unknown) => Promise<unknown> }).renderContent;
}

/** Chạy trong trình duyệt: cây thu gọn của một vùng DOM (bỏ phần chỉ có ở trình soạn). */
// Khoảng trống đã biết (chưa khớp): bảng — website tách thead/tbody/tfoot và bọc ảnh trong picture + source WebP, canvas để mọi hàng trong một tbody (so phẳng các hàng); html — canvas xem trước trong iframe;
// Class chuyển động ecx-in* (hiện dần khi cuộn) chỉ có ở website — canvas không chạy hiệu ứng cuộn; ecx-bound đánh dấu dữ liệu gắn trong canvas.
// Khối media rỗng: canvas hiện ô chọn (placeholder), website vẽ khung rỗng → bỏ cả hai.
// tableOfContents — canvas luôn hiện khung mục lục, website bỏ khi bài không có tiêu đề H2+.
const SNAPSHOT = `(root) => {
  const EDITOR_CLASS = /^(ecx-in$|ecx-in-|ecx-bound$|ecx-block|ecx-sel|is-selected|is-active|is-empty|ProseMirror|ecx-rich|has-|ecx-canvas|ecx-appender)/;
  const SKIP = (el) => (el.classList.contains('ecx-gallery') && !el.children.length) || el.matches('.ecx-placeholder-block, .ecx-media-placeholder, style, source, br.ProseMirror-trailingBreak, .is-unknown, [data-type="tableOfContents"], [data-ecx-ui], .ecx-appender, .ecx-add-column, .ecx-col-handle, [contenteditable="false"][data-ecx-handle]');
  const KEEP = ['href', 'src', 'alt', 'id', 'role', 'aria-hidden', 'target', 'rel', 'type', 'colspan', 'rowspan', 'start'];
  const walk = (el) => {
    const style = {};
    for (let i = 0; i < el.style.length; i++) { const k = el.style[i]; if (!k.startsWith('--ecx-ph') && !(k === 'position' && el.classList.contains('ecx-image')) && !(el.tagName === 'IMG' && el.closest('.ecx-image'))) style[k] = el.style.getPropertyValue(k); }
    const attrs = {};
    for (const k of KEEP) if (el.hasAttribute(k) && !(k === 'role' && el.getAttribute('role') === 'textbox')) attrs[k] = el.getAttribute(k);
    // id tiêu đề: website tự sinh neo từ chữ, canvas không cần (chỉ so ở website)
    if (/^h[1-6]$/i.test(el.tagName)) delete attrs.id;
    // Nút và liên kết mạng xã hội trong trình soạn không mang href / target / rel (không cho điều hướng khi bấm)
    if (el.classList.contains('ecx-button') || [...el.classList].some((c) => c.startsWith('ecx-social-'))) { delete attrs.href; delete attrs.target; delete attrs.rel; }
    const kids = [];
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { const t = n.textContent.replace(/\\s+/g, ' ').trim(); if (t) kids.push(t); }
      else if (n.nodeType === 1 && !SKIP(n) && !(n.hasAttribute('data-ecx-field') && !n.textContent.trim())) { const node = walk(n); if (['THEAD', 'TBODY', 'TFOOT', 'PICTURE'].includes(n.tagName)) { kids.push(...node.kids); continue; } if (n.tagName === 'SPAN' && n.hasAttribute('data-ecx-field')) kids.push(...node.kids); else kids.push(node); }
    }
    // Ruột khác có chủ đích: canvas không tải nội dung bên thứ ba (embed, HTML tuỳ ý chạy trong iframe riêng) và dùng chữ thay biểu tượng cho liên kết mạng xã hội → chỉ so vỏ ngoài.
    if (['ecx-embed', 'ecx-html', 'ecx-social', 'ecx-gallery', 'ecx-video', 'ecx-audio', 'ecx-file', 'ecx-youtube'].some((c) => el.classList.contains(c))) kids.length = 0;
    // Thứ tự lồng của dấu định dạng (s/u/em…) không quan trọng về hiển thị → chuỗi dấu thuần coi như một tập
    const MARKS = ['strong', 'em', 'u', 's', 'code', 'sub', 'sup', 'mark', 'kbd'];
    const tagName = el.tagName.toLowerCase();
    if (MARKS.includes(tagName) && !el.className && !el.getAttribute('style')) {
      const only = kids.length === 1 && typeof kids[0] === 'object' ? kids[0] : null;
      const marks = [tagName, ...(only && only.marks ? only.marks : [])];
      const inner = only && only.marks ? only.kids : kids;
      return { tag: 'marks:' + [...marks].sort().join('+'), class: '', style: {}, attrs, kids: inner, marks };
    }
    // Ảnh không chú thích: website in ảnh trần (hoặc bọc div khi có kiểu dáng), canvas luôn bọc figure để gõ chú thích / kéo cỡ → coi là cùng một "khung ảnh"
    // Website gắn class kiểu dáng thẳng lên <img> trần → quy về cùng "khung ảnh" như canvas (figure bọc img)
    if (el.tagName === 'IMG' && [...el.classList].some((c) => c.startsWith('ecx-s-'))) return { tag: 'image-frame', class: [...el.classList].filter((c) => !EDITOR_CLASS.test(c)).sort().join(' '), style: {}, attrs: {}, kids: [{ tag: 'img', class: '', style: {}, attrs, kids: [] }] };
    const bareImage = kids.length === 1 && typeof kids[0] === 'object' && kids[0].tag === 'img' && ['div', 'figure'].includes(el.tagName.toLowerCase());
    if (bareImage) return { tag: 'image-frame', class: [...el.classList].filter((c) => !EDITOR_CLASS.test(c) && !/^(ecx|cms)-image$/.test(c)).sort().join(' '), style: {}, attrs, kids };
    return { tag: el.tagName.toLowerCase(), class: [...el.classList].filter((c) => !EDITOR_CLASS.test(c)).sort().join(' '), style, attrs, kids };
  };
  // <img> trần ở cấp cao nhất (ảnh không chú thích / không căn) = khung ảnh
  return [...root.children].filter((el) => !SKIP(el)).map((el) => { const n = walk(el); return el.tagName === 'IMG' && n.tag === 'img' ? { tag: 'image-frame', class: '', style: {}, attrs: {}, kids: [n] } : n; });
}`;

// Ô sửa tại chỗ của trường (nút, tiêu đề callout…) là <span data-ecx-field> chỉ có ở trình soạn → coi như trong suốt.
type Node = { tag: string; class: string; style: object; attrs: object; kids: unknown[] };
/** Mọi chỗ lệch (không dừng ở chỗ đầu tiên): mỗi phần tử lệch báo một dòng rồi bỏ qua con của nó. */
const diffs = (a: unknown, b: unknown, at = "root", out: string[] = []): string[] => {
  if (typeof a === "string" || typeof b === "string") { if (a !== b) out.push(`${at}: chữ canvas ${JSON.stringify(a)} ≠ website ${JSON.stringify(b)}`); return out; }
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] === undefined || b[i] === undefined) out.push(`${at}[${i}]: ${a[i] === undefined ? "canvas thiếu" : "website thiếu"} ${JSON.stringify(a[i] ?? b[i]).slice(0, 140)}`);
      else diffs(a[i], b[i], `${at}[${i}]`, out);
    }
    return out;
  }
  const x = a as Node, y = b as Node, here = `${at}<${x.tag}>`;
  if (x.tag !== y.tag) out.push(`${here}: thẻ canvas <${x.tag}> ≠ website <${y.tag}>`);
  else if (x.class !== y.class) out.push(`${here}: class canvas "${x.class}" ≠ website "${y.class}"`);
  else if (JSON.stringify(x.style) !== JSON.stringify(y.style)) out.push(`${here}: style canvas ${JSON.stringify(x.style)} ≠ website ${JSON.stringify(y.style)}`);
  else if (JSON.stringify(x.attrs) !== JSON.stringify(y.attrs)) out.push(`${here}: thuộc tính canvas ${JSON.stringify(x.attrs)} ≠ website ${JSON.stringify(y.attrs)}`);
  else diffs(x.kids, y.kids, here, out);
  return out;
};

async function snapshotOf(page: Page, html: string) {
  return page.evaluate(([markup, fn]) => { const box = document.createElement("div"); box.innerHTML = markup; return (0, eval)(fn)(box); }, [html, SNAPSHOT] as const);
}

for (const name of FILES) {
  test(`parity canvas ↔ website: ${name}`, async ({ page }) => {
    const renderContent = await loadSiteRenderer();
    const f = JSON.parse(readFileSync(path.join(fixtures, `${name}.json`), "utf8"));
    await page.addInitScript((doc) => { (window as unknown as { __INJECT_DOC__: unknown }).__INJECT_DOC__ = doc; }, f.expected);
    await page.goto("/");
    const c = canvas(page);
    await expect(c.locator(".ecx-canvas-root")).toBeVisible();
    await page.waitForTimeout(600);
    // Website vẽ đúng thứ trình soạn sẽ LƯU (cấu trúc đã chuẩn hoá: vd nút lẻ được bọc trong khối "buttons")
    const saved = await page.evaluate(() => (window as unknown as { __ecx: { content(): unknown } }).__ecx.content());
    const siteHtml = renderToStaticMarkup(await renderContent(saved, { site, resolve: { shortcode: async () => null, block: async () => null } } as never) as never);
    const canvasTree = await c.locator(".ecx-canvas-root").evaluate((root, fn) => (0, eval)(fn)(root), SNAPSHOT);
    const siteTree = await snapshotOf(page, siteHtml);
    if (process.env.PARITY_DEBUG) console.log("SITE", siteHtml.slice(0, 700), "\nCANVAS", await c.locator(".ecx-canvas-root").evaluate((r) => r.outerHTML.slice(0, 1500)));
    const d = diffs(canvasTree, siteTree);
    expect(d, d.join("\n")).toEqual([]);
  });
}
