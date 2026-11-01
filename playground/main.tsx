import { createRoot } from "react-dom/client";
import contentCss from "@ecomcx/ecomweb-content/style.css?url";
import "../src/editor.css";
import "../src/v2/editor.css";
import { BlockEditor, EditorStore, blocksFromContent, type EditorHost } from "../src/v2";
import { defineBlock } from "@ecomcx/ecomweb-content";
import { registerBlock } from "../src/blocks";
import { registerBlockPanel } from "../src/panels";

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
  registerBlockPanel({ id: "acme/seo", title: "Acme SEO", blocks: ["heading"], component: ({ attrs, setAttrs }) => <label>noindex <input type="checkbox" checked={!!attrs.acmeNoindex} onChange={(e) => setAttrs({ acmeNoindex: e.target.checked || undefined })} /></label> });
}

const saves: Array<{ kind: string; ref: unknown; content: unknown }> = [];
const host: EditorHost = {
  canvasStyles: [contentCss, { css: "body { font-family: Georgia, serif; color: #222; } .ecx-site-title { font-weight: 700; } .ecx-navigation-menu { display: flex; gap: 1rem; list-style: none; padding: 0; margin: 0; } .ecx-group { display: flex; justify-content: space-between; align-items: center; }" }],
  presets: { colors: { primary: "#3858e9", muted: "#757575" } },
  dynamic: {
    site: { title: "ECOMCX Demo", tagline: "Website mẫu" },
    menus: { primary: [{ title: "Trang chủ" }, { title: "Giới thiệu" }, { title: "Liên hệ" }] },
    post: { title: "Bài viết mẫu", date: "01/11/2026", author: "Admin", excerpt: "Tóm tắt bài viết mẫu." },
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

const doc = params.get("doc");
const initial = params.get("empty") ? null : doc === "post" || params.get("frame") ? post : doc === "rich" ? rich : template;
const store = new EditorStore({ kind: doc === "post" || doc === "rich" || params.get("frame") ? "post" : "template", title: "Trang chủ", blocks: blocksFromContent(initial) });
const frame = params.get("frame") ? { content: frameTemplate, title: "Trang đơn" } : undefined;
let changes = 0;
(window as unknown as { __ecx: unknown }).__ecx = { store, saves, get changes() { return changes; } };

createRoot(document.getElementById("root")!).render(
  <BlockEditor store={store} host={host} lang={params.get("lang") === "en" ? "en" : "vi"} dynamicBlocks frame={frame}
    onChange={() => { changes++; }}
    onSave={async (content) => { await new Promise((r) => setTimeout(r, 30)); saves.push({ kind: "root", ref: null, content }); }}
    header={<strong style={{ padding: "0 8px" }}>Trang chủ</strong>} />,
);
