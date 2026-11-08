import { createRoot } from "react-dom/client";
import contentCss from "@ecomcx/ecomweb-content/style.css?url";
import "../src/v2/editor.css";
import { BlockEditor, EditorStore, blocksFromContent, contentFromBlocks, fixTree, flatten, inlineText, registerAnimation, registerBlock, registerBlockPanel, type EditorHost } from "../src/v2";
import { defineBlock } from "@ecomcx/ecomweb-content";
import { registerBindingSource } from "../src/v2/ui/bindings";

/**
 * Playground: trình soạn template "Trang chủ" có header/footer là phần dùng chung (tài liệu lồng), dữ liệu thật cho khối động.
 * `?doc=post` → soạn bài viết thường; `?empty=1` → tài liệu trống; `?lang=en` → tiếng Anh.
 * Test E2E đọc/ghi qua window.__ecx (store, các lần lưu).
 */
const params = new URLSearchParams(location.search);
const p = (text: string) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : undefined });
const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });

const parts: Record<string, unknown> = {
  header: { type: "doc", content: [{ type: "group", attrs: { padding: "small" }, content: [{ type: "siteTitle" }, { type: "navigation", attrs: { location: "primary" } }] }] },
  footer: { type: "doc", content: [p("Chân trang © ECOMCX"), { type: "copyright" }] },
};

const template = {
  type: "doc",
  content: [
    { type: "templatePart", attrs: { slug: "header", tagName: "header" } },
    h(1, "Chào mừng tới website"),
    p("Đây là đoạn văn đầu tiên."),
    { type: "bulletList", content: [{ type: "listItem", content: [p("Mục một")] }, { type: "listItem", content: [p("Mục hai")] }] },
    { type: "columns", content: [{ type: "column", content: [p("Cột trái")] }, { type: "column", content: [p("Cột phải")] }] },
    { type: "templatePart", attrs: { slug: "footer", tagName: "footer" } },
  ],
};
const post = { type: "doc", content: [h(2, "Tiêu đề bài"), p("Nội dung bài viết."), p("Đoạn thứ hai.")] };
const cell = (t: string, header = false) => ({ type: header ? "tableHeader" : "tableCell", content: [p(t)] });
const rich = {
  type: "doc",
  content: [
    p("Mở đầu"),
    { type: "table", content: [{ type: "tableRow", content: [cell("A", true), cell("B", true)] }, { type: "tableRow", content: [cell("a1"), cell("b1")] }] },
    { type: "columns", content: [{ type: "column", attrs: { width: 50 }, content: [p("Trái")] }, { type: "column", attrs: { width: 50 }, content: [p("Phải")] }] },
    { type: "image", attrs: { src: `${location.origin}/sample.svg`, alt: "Ảnh mẫu", width: 400, height: 200 } },
    { type: "buttons", content: [{ type: "button", attrs: { text: "Nút 1", variant: "primary" } }] },
    p("Kết"),
  ],
};
// Khung template quanh trang (?frame=1): header + nội dung trang + footer
const frameTemplate = { type: "doc", content: [{ type: "templatePart", attrs: { slug: "header", tagName: "header" } }, { type: "postTitle" }, { type: "postContent" }, { type: "templatePart", attrs: { slug: "footer", tagName: "footer" } }] };

// Khối của plugin viết cho bản 1.x (?plugin=1): defineBlock + registerBlock + panel
if (params.get("plugin")) {
  registerBlock(defineBlock({ name: "acme/notice", title: "Thông báo Acme", keywords: "thong bao acme notice", content: "blocks", attributes: { level: { type: "string", enum: ["info", "warn"], default: "info", label: "Mức" } } }), {
    edit: ({ attrs, children }) => <div className={`acme-notice is-${attrs.level}`} style={{ border: "2px solid orange", padding: 8 }}><b>ACME {String(attrs.level)}</b>{children}</div>,
  });
  registerBindingSource({ name: "acme/product", label: "Sản phẩm Acme", fields: [{ value: "price", label: "Giá" }, { value: "stock", label: "Tồn kho" }], preview: async (args) => { await new Promise((r) => setTimeout(r, 20)); return args.field === "price" ? "199.000 ₫" : "12 cái"; } });
  registerBlockPanel({ id: "acme/seo", title: "Acme SEO", blocks: ["heading"], component: ({ attrs, setAttrs }) => <label>noindex <input type="checkbox" checked={!!attrs.acmeNoindex} onChange={(e) => setAttrs({ acmeNoindex: e.target.checked || undefined })} /></label> });
}

const saves: Array<{ kind: string; ref: unknown; content: unknown }> = [];
const queries: unknown[] = [];
const uploads: string[] = [];
const POSTS = [
  { title: "Khai trương cửa hàng", date: "30/10/2026", terms: ["tin-tuc"] },
  { title: "Bộ sưu tập mùa đông", date: "28/10/2026", terms: ["san-pham"] },
  { title: "Giảm giá cuối tuần", date: "25/10/2026", terms: ["tin-tuc"] },
  { title: "Hướng dẫn chọn size", date: "20/10/2026", terms: ["huong-dan"] },
];
const host: EditorHost = {
  canvasStyles: [contentCss, { css: "body { font-family: Georgia, serif; color: #222; } .ecx-site-title { font-weight: 700; } .ecx-navigation-menu { display: flex; gap: 1rem; list-style: none; padding: 0; margin: 0; } .ecx-group { display: flex; justify-content: space-between; align-items: center; }" }, ...(params.get("css") ? [{ css: params.get("css")! }] : [])],
  // ?contentClass=…: class của vùng soạn như website đặt (vd ecx-template), ?css=…: CSS của theme — kiểm CSS theme thắng mặc định của trình soạn
  ...(params.get("contentClass") ? { canvasContentClass: params.get("contentClass")! } : {}),
  presets: { colors: { primary: "#1a597b", accent: "#f26251", muted: "#757575" }, gradients: { brand: "linear-gradient(135deg, #1a597b, #f26251)" }, shadows: { soft: "0 2px 8px rgb(0 0 0 / .12)" } },
  dynamic: {
    site: { title: "ECOMCX Demo", tagline: "Website mẫu" },
    menus: { primary: [{ title: "Trang chủ" }, { title: "Giới thiệu" }, { title: "Liên hệ" }] },
    post: { title: "Bài viết mẫu", date: "01/11/2026", author: "Admin", excerpt: "Tóm tắt bài viết mẫu." },
  },
  // ?media=1: thư viện media giả lập (chọn / tải lên trả về ảnh mẫu)
  ...(params.get("media") ? { media: {
    async pick() { return [{ id: 7, url: `${location.origin}/sample.svg`, alt: "Ảnh thư viện", fileName: "sample.svg", mimeType: "image/svg+xml", width: 400, height: 200, webpUrl: `${location.origin}/sample.svg?f=webp`, sizes: { medium: { url: `${location.origin}/sample.svg?w=200`, width: 200, height: 100, webpUrl: `${location.origin}/sample.svg?w=200&f=webp` } } }]; },
    async upload(files: File[]) { uploads.push(...files.map((f) => f.name)); return files.map((f, i) => ({ id: 100 + i, url: `${location.origin}/sample.svg`, alt: f.name.replace(/\.[^.]+$/, ""), fileName: f.name, mimeType: f.type, width: 400, height: 200 })); },
  } } : {}),
  choices(kind, args) {
    switch (kind) {
      case "menuLocation": return [{ value: "primary", label: "Menu chính" }, { value: "footer", label: "Chân trang — chưa gán menu" }];
      case "postType": return [{ value: "post", label: "Bài viết" }, { value: "page", label: "Trang" }];
      case "taxonomy": return [{ value: "category", label: "Chuyên mục" }, { value: "post_tag", label: "Thẻ" }];
      case "term": return args?.taxonomy === "category" ? [{ value: "tin-tuc", label: "Tin tức" }, { value: "san-pham", label: "Sản phẩm" }, { value: "huong-dan", label: "Hướng dẫn" }] : [{ value: "noi-bat", label: "Nổi bật" }];
      case "templatePart": return [{ value: "header", label: "Đầu trang (header)" }, { value: "footer", label: "Chân trang (footer)" }];
      default: return [];
    }
  },
  async queryPosts(q) {
    await new Promise((r) => setTimeout(r, 20));
    queries.push(q);
    let list = POSTS.filter((x) => !q.category || x.terms.includes(q.category));
    if (q.orderBy === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title, "vi") * (q.order === "asc" ? 1 : -1));
    return list.slice(0, q.perPage);
  },
  documents: {
    async load(ref) {
      await new Promise((r) => setTimeout(r, 30));
      if (ref.kind === "part" && parts[String(ref.ref)]) return { title: String(ref.ref), content: parts[String(ref.ref)] };
      return null;
    },
    async save(ref, _blocks, content) {
      await new Promise((r) => setTimeout(r, 30));
      if (params.get("failSave") === "part") throw new Error("Lưu phần dùng chung thất bại");
      saves.push({ kind: ref.kind, ref: ref.ref, content });
    },
  },
};

// Tài liệu lớn (đo hiệu năng): ?blocks=2000 → đoạn văn, tiêu đề, danh sách, nhóm xen kẽ
const big = Number(params.get("blocks") ?? 0);
const bigDoc = big ? { type: "doc", content: Array.from({ length: big }, (_, i) =>
  i % 50 === 0 ? h(2, `Mục ${i / 50 + 1}`)
  : i % 25 === 0 ? { type: "bulletList", content: [{ type: "listItem", content: [p(`Ý ${i}.1`)] }, { type: "listItem", content: [p(`Ý ${i}.2`)] }] }
  : i % 30 === 0 ? { type: "group", content: [p(`Nhóm ${i}`), p("Chữ trong nhóm")] }
  : p(`Đoạn ${i}: Tiếng Việt có dấu để đo tốc độ gõ và vẽ lại khi tài liệu rất dài.`)) } : null;
const doc = params.get("doc");
// ?doc=loop: template có "Danh sách bài" (bài lấy qua host.queryPosts)
const loop = { type: "doc", content: [h(1, "Tin tức"), { type: "query", attrs: { inherit: false, perPage: 3 }, content: [{ type: "postTemplate", attrs: { layout: "list" }, content: [{ type: "postTitle", attrs: { level: 2 } }, { type: "postDate" }, p("Đọc thêm")] }, { type: "pagination" }] }] };
// Test parity: nội dung nạp từ ngoài (window.__INJECT_DOC__) để so với website
const injected = (window as unknown as { __INJECT_DOC__?: unknown }).__INJECT_DOC__;
const initial = injected ?? bigDoc ?? (params.get("empty") ? null : doc === "post" || params.get("frame") ? post : doc === "rich" ? rich : doc === "loop" ? loop : template);
const store = new EditorStore({ kind: injected || doc === "post" || doc === "rich" || params.get("frame") ? "post" : "template", title: "Trang chủ", blocks: blocksFromContent(initial) });
const frame = params.get("frame") ? { content: frameTemplate, title: "Trang đơn" } : undefined;
let changes = 0;
/** Kiểm tra bất biến (test fuzz): cây hợp lệ, định danh không trùng, chữ trên màn hình khớp dữ liệu từng khối. */
function check(): string[] {
  const errors: string[] = [];
  const frame = document.querySelector<HTMLIFrameElement>("iframe[data-ecx-canvas]")?.contentDocument;
  for (const d of Object.values(store.getState().docs)) {
    if (fixTree(d.blocks) !== d.blocks) errors.push(`${d.id}: cây không hợp lệ`);
    const all = flatten(d.blocks);
    if (new Set(all.map((b) => b.id)).size !== all.length) errors.push(`${d.id}: trùng định danh`);
    for (const b of all) {
      if (!b.inline || !frame) continue;
      const el = frame.querySelector<HTMLElement>(`[data-ecx-block="${b.id}"][data-ecx-rich], [data-ecx-block="${b.id}"] > [data-ecx-rich]:not([data-ecx-field])`);
      if (!el) continue;
      const dom = (el.innerText ?? "").replace(/\u00a0/g, " ").replace(/\n$/, "");
      const data = inlineText(b.inline);
      if (dom !== data) errors.push(`${b.type} ${b.id}: màn hình "${dom}" ≠ dữ liệu "${data}"`);
    }
  }
  return errors;
}
(window as unknown as { __ecx: unknown }).__ecx = { content: () => contentFromBlocks(store.getState().docs.root.blocks), store, saves, queries, uploads, registerAnimation, check, get changes() { return changes; } };

createRoot(document.getElementById("root")!).render(
  <BlockEditor store={store} host={host} lang={params.get("lang") === "en" ? "en" : "vi"} dynamicBlocks frame={frame}
    onChange={() => { changes++; }}
    onSave={async (content) => { await new Promise((r) => setTimeout(r, 30)); saves.push({ kind: "root", ref: null, content }); }}
    header={<strong style={{ padding: "0 8px" }}>Trang chủ</strong>} />,
);
