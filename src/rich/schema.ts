import { isSafeUrl } from "@ecomcx/ecomweb-content";
import { Schema, type MarkSpec, type NodeSpec } from "prosemirror-model";
import { tableNodes } from "prosemirror-tables";

/**
 * Lược đồ ProseMirror của trình soạn HTML (`RichTextEditor`): chỉ những thẻ / thuộc tính dưới đây còn lại sau khi
 * dán hoặc nạp HTML — mọi thứ khác (script, style, iframe, on*, javascript:) bị bỏ. Không lưu lớp CSS hay thuộc tính
 * tuỳ ý: định dạng là thẻ ngữ nghĩa + `text-align` + màu chữ / màu nền.
 */
export const ALIGNS = ["left", "center", "right", "justify"] as const;
export type Align = (typeof ALIGNS)[number];

const alignOf = (dom: HTMLElement): { align: Align | null } => {
  const a = dom.style.textAlign as Align;
  return { align: (ALIGNS as readonly string[]).includes(a) ? a : null };
};
const alignAttr = (align: Align | null) => (align ? { style: `text-align:${align}` } : {});
// Chỉ nhận màu viết dạng #hex / rgb() / hsl() / tên màu: không cho url() hay biểu thức chèn vào style
export const safeColor = (c: unknown): string | null => (typeof c === "string" && /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%/]+\)|[a-z]{3,20})$/i.test(c.trim()) ? c.trim() : null);

const nodes: Record<string, NodeSpec> = {
  doc: { content: "block+" },
  paragraph: { content: "inline*", group: "block", attrs: { align: { default: null } }, parseDOM: [{ tag: "p", getAttrs: (d) => alignOf(d as HTMLElement) }], toDOM: (n) => ["p", alignAttr(n.attrs.align), 0] },
  heading: {
    content: "inline*", group: "block", defining: true, attrs: { level: { default: 2 }, align: { default: null } },
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, getAttrs: (d: HTMLElement | string) => ({ level, ...alignOf(d as HTMLElement) }) })),
    toDOM: (n) => [`h${n.attrs.level}`, alignAttr(n.attrs.align), 0],
  },
  blockquote: { content: "block+", group: "block", defining: true, parseDOM: [{ tag: "blockquote" }], toDOM: () => ["blockquote", 0] },
  horizontal_rule: { group: "block", parseDOM: [{ tag: "hr" }], toDOM: () => ["hr"] },
  code_block: { content: "text*", marks: "", group: "block", code: true, defining: true, parseDOM: [{ tag: "pre", preserveWhitespace: "full" }], toDOM: () => ["pre", ["code", 0]] },
  bullet_list: { content: "list_item+", group: "block", parseDOM: [{ tag: "ul" }], toDOM: () => ["ul", 0] },
  ordered_list: { content: "list_item+", group: "block", attrs: { order: { default: 1 } }, parseDOM: [{ tag: "ol", getAttrs: (d) => ({ order: Number((d as HTMLElement).getAttribute("start")) || 1 }) }], toDOM: (n) => (n.attrs.order === 1 ? ["ol", 0] : ["ol", { start: n.attrs.order }, 0]) },
  list_item: { content: "paragraph block*", defining: true, parseDOM: [{ tag: "li" }], toDOM: () => ["li", 0] },
  text: { group: "inline" },
  image: {
    inline: true, group: "inline", draggable: true, attrs: { src: {}, alt: { default: "" }, title: { default: null } },
    parseDOM: [{ tag: "img[src]", getAttrs: (d) => { const el = d as HTMLElement; const src = el.getAttribute("src") ?? ""; return isSafeUrl(src) ? { src, alt: el.getAttribute("alt") ?? "", title: el.getAttribute("title") } : false; } }],
    toDOM: (n) => ["img", { src: n.attrs.src, alt: n.attrs.alt, ...(n.attrs.title ? { title: n.attrs.title } : {}) }],
  },
  video: {
    group: "block", atom: true, draggable: true, attrs: { src: {}, poster: { default: null } },
    parseDOM: [{ tag: "video[src]", getAttrs: (d) => { const el = d as HTMLElement; const src = el.getAttribute("src") ?? ""; const poster = el.getAttribute("poster"); return isSafeUrl(src) ? { src, poster: poster && isSafeUrl(poster) ? poster : null } : false; } }],
    toDOM: (n) => ["video", { src: n.attrs.src, controls: "", preload: "metadata", ...(n.attrs.poster ? { poster: n.attrs.poster } : {}) }],
  },
  audio: {
    group: "block", atom: true, draggable: true, attrs: { src: {} },
    parseDOM: [{ tag: "audio[src]", getAttrs: (d) => { const src = (d as HTMLElement).getAttribute("src") ?? ""; return isSafeUrl(src) ? { src } : false; } }],
    toDOM: (n) => ["audio", { src: n.attrs.src, controls: "", preload: "metadata" }],
  },
  hard_break: { inline: true, group: "inline", selectable: false, parseDOM: [{ tag: "br" }], toDOM: () => ["br"] },
  ...tableNodes({ tableGroup: "block", cellContent: "block+", cellAttributes: {} }),
};

const simple = (tag: string, extra: string[] = []): MarkSpec => ({ parseDOM: [tag, ...extra].map((t) => ({ tag: t })), toDOM: () => [tag, 0] });
const marks: Record<string, MarkSpec> = {
  link: {
    // `download`: liên kết tệp đính kèm (PDF, zip…) — trình duyệt tải về thay vì mở
    attrs: { href: {}, target: { default: null }, download: { default: false } }, inclusive: false,
    parseDOM: [{ tag: "a[href]", getAttrs: (d) => { const el = d as HTMLElement; const href = el.getAttribute("href") ?? ""; return isSafeUrl(href) ? { href, target: el.getAttribute("target") === "_blank" ? "_blank" : null, download: el.hasAttribute("download") } : false; } }],
    toDOM: (m) => ["a", { href: m.attrs.href, ...(m.attrs.download ? { download: "" } : {}), ...(m.attrs.target ? { target: "_blank", rel: "noopener noreferrer" } : {}) }, 0],
  },
  strong: simple("strong", ["b"]),
  em: simple("em", ["i"]),
  underline: simple("u"),
  strike: simple("s", ["del", "strike"]),
  code: { ...simple("code"), excludes: "_" },
  sub: { ...simple("sub"), excludes: "sup" },
  sup: { ...simple("sup"), excludes: "sub" },
  textColor: { attrs: { color: {} }, parseDOM: [{ tag: "span[style]", getAttrs: (d) => { const c = safeColor((d as HTMLElement).style.color); return c ? { color: c } : false; } }], toDOM: (m) => ["span", { style: `color:${m.attrs.color}` }, 0] },
  highlight: { attrs: { color: { default: "#fff3a3" } }, parseDOM: [{ tag: "mark", getAttrs: (d) => ({ color: safeColor((d as HTMLElement).style.backgroundColor) ?? "#fff3a3" }) }], toDOM: (m) => ["mark", { style: `background-color:${m.attrs.color}` }, 0] },
};

export const richSchema = new Schema({ nodes, marks });
