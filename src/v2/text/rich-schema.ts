import { linkRel } from "@ecomcx/ecomweb-content";
import type { RichMark, RichNode } from "@ecomcx/ecomweb-content";
import { Fragment, Schema, type Mark, type MarkSpec, type Node as PMNode } from "prosemirror-model";


/**
 * Schema ProseMirror cho MỘT khối chữ: chỉ có chữ + định dạng (không có khối) — mỗi khối chữ là một ProseMirror nhỏ.
 * Bộ gõ tiếng Việt (Telex/VNI, IME) do ProseMirror lo, không tự xử lý contenteditable.
 * Nút inline / định dạng lạ (plugin) được giữ nguyên qua `inlineAtom` / `unknownMark`.
 */
const linkSpec: MarkSpec = {
  attrs: { href: { default: "" }, target: { default: null }, rel: { default: null } },
  inclusive: false,
  parseDOM: [{ tag: "a[href]", getAttrs: (d) => ({ href: (d as HTMLElement).getAttribute("href"), target: (d as HTMLElement).getAttribute("target"), rel: (d as HTMLElement).getAttribute("rel") }) }],
  toDOM: (m) => ["a", { href: m.attrs.href, target: m.attrs.target, rel: linkRel(m.attrs.rel, m.attrs.target), "data-ecx-link": "" }, 0], // rel giống website
};

const simple = (tag: string, extra: string[] = []): MarkSpec => ({ parseDOM: [tag, ...extra].map((t) => ({ tag: t })), toDOM: () => [tag, 0] });

const marks: Record<string, MarkSpec> = {
  link: linkSpec,
  bold: simple("strong", ["b"]),
  italic: simple("em", ["i"]),
  underline: simple("u"),
  strike: simple("s", ["del", "strike"]),
  code: { ...simple("code"), excludes: "_" },
  footnote: { attrs: { note: { default: "" } }, inclusive: false, parseDOM: [{ tag: "span[data-ecx-footnote]", getAttrs: (d) => ({ note: (d as HTMLElement).getAttribute("data-ecx-footnote") ?? "" }) }], toDOM: (m) => ["span", { "data-ecx-footnote": String(m.attrs.note), class: "ecx-footnote-mark" }, 0] },
  kbd: { ...simple("kbd"), excludes: "_" },
  subscript: { ...simple("sub"), excludes: "superscript" },
  superscript: { ...simple("sup"), excludes: "subscript" },
  highlight: { attrs: { color: { default: null } }, parseDOM: [{ tag: "mark" }], toDOM: (m) => ["mark", m.attrs.color ? { style: `background:${m.attrs.color}` } : {}, 0] },
  textStyle: { attrs: { color: { default: null } }, parseDOM: [{ tag: "span[style]" }], toDOM: (m) => ["span", m.attrs.color ? { style: `color:${m.attrs.color}` } : {}, 0] },
  unknownMark: { attrs: { json: { default: null } }, excludes: "", toDOM: () => ["span", { "data-ecx-mark": "" }, 0] },
};
const inlineNodes = (pre: boolean) => ({
  doc: { content: "inline*", ...(pre ? { whitespace: "pre" as const } : {}) },
  text: { group: "inline" },
  hardBreak: { group: "inline", inline: true, selectable: false, parseDOM: [{ tag: "br" }], toDOM: () => ["br"] as const },
  inlineAtom: {
    group: "inline", inline: true, atom: true, attrs: { json: { default: null } },
    toDOM: (n: PMNode) => ["span", { "data-ecx-inline": (n.attrs.json as RichNode | null)?.type ?? "", contenteditable: "false", class: "ecx-inline-atom" }, `⟨${(n.attrs.json as RichNode | null)?.type ?? "?"}⟩`] as const,
  },
});

/** Chữ thường (đoạn, tiêu đề…): khoảng trắng gộp như HTML. */
export const inlineSchema = new Schema({ nodes: inlineNodes(false), marks });
/** Văn bản định dạng sẵn: giữ khoảng trắng, xuống dòng; vẫn có định dạng. */
export const preSchema = new Schema({ nodes: inlineNodes(true), marks });
/** Mã nguồn: chỉ chữ thuần, giữ mọi khoảng trắng và xuống dòng ("\n" là ký tự, không phải hardBreak). */
export const codeSchema = new Schema({ nodes: { doc: { content: "text*", code: true, whitespace: "pre" }, text: {} }, marks: {} });

export type SchemaKind = "inline" | "pre" | "code";
export const schemaOf = (kind: SchemaKind) => (kind === "code" ? codeSchema : kind === "pre" ? preSchema : inlineSchema);

const KNOWN_MARKS = new Set(Object.keys(inlineSchema.marks).filter((m) => m !== "unknownMark"));

function markFromRich(schema: Schema, m: RichMark): Mark {
  if (KNOWN_MARKS.has(m.type)) return schema.marks[m.type].create(m.attrs ?? {});
  return schema.marks.unknownMark.create({ json: m });
}
function markToRich(m: Mark): RichMark {
  if (m.type.name === "unknownMark") return m.attrs.json as RichMark;
  const attrs = Object.fromEntries(Object.entries(m.attrs).filter(([, v]) => v !== null && v !== undefined && v !== ""));
  return Object.keys(attrs).length ? { type: m.type.name, attrs } : { type: m.type.name };
}

/** Chữ của khối (RichNode[]) → tài liệu ProseMirror theo loại ô gõ (mã nguồn: bỏ định dạng, hardBreak thành "\n"). */
export function inlineToDoc(inline: RichNode[] | undefined, kind: SchemaKind = "inline"): PMNode {
  const schema = schemaOf(kind);
  const nodes: PMNode[] = [];
  const pushText = (text: string, ms: Mark[]) => { if (text) nodes.push(schema.text(text, ms)); };
  for (const n of inline ?? []) {
    if (n.type === "text") pushText(n.text ?? "", kind === "code" ? [] : (n.marks ?? []).map((m) => markFromRich(schema, m)));
    else if (n.type === "hardBreak") { if (kind === "code") pushText("\n", []); else nodes.push(schema.nodes.hardBreak.create()); }
    else if (kind !== "code") nodes.push(schema.nodes.inlineAtom.create({ json: n }));
  }
  // Mã nguồn: gộp các đoạn chữ liền nhau (schema "text*" không cho nút khác)
  return schema.nodes.doc.create(null, Fragment.fromArray(nodes));
}

/** Tài liệu ProseMirror → chữ của khối, gộp các đoạn text cùng định dạng. */
export function docToInline(doc: PMNode): RichNode[] {
  const out: RichNode[] = [];
  doc.forEach((n) => {
    if (n.isText) {
      const marks = n.marks.map(markToRich);
      const last = out[out.length - 1];
      if (last && last.type === "text" && JSON.stringify(last.marks ?? []) === JSON.stringify(marks)) last.text += n.text!;
      else out.push(marks.length ? { type: "text", text: n.text!, marks } : { type: "text", text: n.text! });
    } else if (n.type.name === "hardBreak") out.push({ type: "hardBreak" });
    else if (n.type.name === "inlineAtom") out.push(n.attrs.json as RichNode);
  });
  return out;
}

/** Vị trí ký tự (0…độ dài) ↔ vị trí ProseMirror: tài liệu chỉ có inline nên lệch đúng 0. */
export const charToPos = (doc: PMNode, offset: number) => (offset < 0 ? doc.content.size : Math.min(offset, doc.content.size));

export const sameInline = (a: RichNode[] | undefined, b: RichNode[] | undefined) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
