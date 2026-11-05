import type { RichMark, RichNode } from "@ecomcx/ecomweb-content";

/**
 * Mô hình của trình soạn v2: cây khối (không phải một tài liệu văn bản liền như ProseMirror).
 * - Khối "text" (đoạn, tiêu đề, mã…): `inline` là chữ có định dạng — mỗi khối một ProseMirror nhỏ để gõ.
 * - Khối "container" (nhóm, cột, danh sách, ô bảng…): `content` là các khối con.
 * - Khối "atom" (ảnh, đường kẻ, khối động…): chỉ có thuộc tính; `raw` giữ nguyên nội dung con không hiểu được.
 * Đọc/ghi đúng định dạng lưu trữ RichNode của @ecomcx/ecomweb-content → website, máy chủ không đổi gì.
 */
export type BlockKind = "text" | "container" | "atom";

export interface BNode {
  /** Định danh trong phiên soạn (không lưu xuống dữ liệu). */
  id: string;
  type: string;
  attrs: Record<string, unknown>;
  /** Khối con (container). */
  content?: BNode[];
  /** Chữ có định dạng (text): text, hardBreak, nút inline khác — đúng dạng RichNode. */
  inline?: RichNode[];
  /** Nội dung con giữ nguyên (atom có content mà trình soạn không sửa). */
  raw?: RichNode[];
}

let seq = 0;
const prefix = Math.random().toString(36).slice(2, 6);
export const newId = () => `b${prefix}${(++seq).toString(36)}`;

/** Các loại khối của lõi theo cách chứa nội dung. Khối lạ (plugin) suy từ nội dung. */
const CORE_KINDS: Record<string, BlockKind> = {
  paragraph: "text", heading: "text", codeBlock: "text", preformatted: "text",
  bulletList: "container", orderedList: "container", listItem: "container", taskList: "container", taskItem: "container",
  blockquote: "container", columns: "container", column: "container", group: "container", callout: "container",
  buttons: "container", cover: "container", mediaText: "container", pullquote: "text", details: "container", accordion: "container",
  table: "container", tableRow: "container", tableCell: "container", tableHeader: "container",
  query: "container", postTemplate: "container", queryEmpty: "container", stack: "container",
  horizontalRule: "atom", image: "atom", gallery: "atom", video: "atom", audio: "atom", file: "atom", youtube: "atom",
  button: "atom", embed: "atom", spacer: "atom", customHtml: "atom", socialLinks: "atom", tableOfContents: "atom", countdown: "atom", rating: "atom",
};
const kindOverrides = new Map<string, BlockKind>();
export function setBlockKind(type: string, kind: BlockKind) { kindOverrides.set(type, kind); }

const INLINE_TYPES = new Set(["text", "hardBreak"]);
const inlineOverrides = new Set<string>();
/** Đăng ký loại nút inline (plugin): luôn nằm trong chữ, không thành khối. */
export function setInlineType(type: string) { inlineOverrides.add(type); }
export const isInlineType = (type: string) => INLINE_TYPES.has(type) || inlineOverrides.has(type);

export function kindOf(type: string, sample?: RichNode): BlockKind {
  const k = kindOverrides.get(type) ?? CORE_KINDS[type];
  if (k) return k;
  if (!sample?.content?.length) return "atom";
  if (sample.content.every((c) => isInlineType(c.type))) return "text";
  if (sample.content.every((c) => !isInlineType(c.type))) return "container";
  return "atom";
}

const clean = (attrs: Record<string, unknown> | undefined) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs ?? {})) if (v !== null && v !== undefined) out[k] = v;
  return out;
};

/** RichNode (một khối) → BNode. */
export function fromRich(node: RichNode): BNode {
  const kind = kindOf(node.type, node);
  const b: BNode = { id: newId(), type: node.type, attrs: clean(node.attrs) };
  if (kind === "text") b.inline = (node.content ?? []).map(cloneRich);
  else if (kind === "container") b.content = (node.content ?? []).filter((c) => !isInlineType(c.type)).map(fromRich);
  else if (node.content?.length) b.raw = node.content.map(cloneRich);
  return b;
}

/** BNode → RichNode (đúng định dạng lưu). */
export function toRich(b: BNode): RichNode {
  const n: RichNode = { type: b.type };
  const attrs = clean(b.attrs);
  if (Object.keys(attrs).length) n.attrs = attrs;
  const kids = b.inline ? b.inline.map(cloneRich) : b.content ? b.content.map(toRich) : b.raw ? b.raw.map(cloneRich) : undefined;
  if (kids?.length) n.content = kids;
  return n;
}

/** Cây `doc` của định dạng lưu → danh sách khối cấp cao nhất. */
export function blocksFromDoc(doc: RichNode | null | undefined): BNode[] {
  const list = (doc?.content ?? []).filter((c) => !isInlineType(c.type)).map(fromRich);
  return list;
}
export function docFromBlocks(blocks: BNode[]): RichNode {
  return { type: "doc", content: blocks.map(toRich) };
}

export function cloneRich(n: RichNode): RichNode {
  const c: RichNode = { type: n.type };
  if (n.attrs) c.attrs = { ...n.attrs };
  if (n.text !== undefined) c.text = n.text;
  if (n.marks) c.marks = n.marks.map((m: RichMark) => (m.attrs ? { type: m.type, attrs: { ...m.attrs } } : { type: m.type }));
  if (n.content) c.content = n.content.map(cloneRich);
  return c;
}

/** Sao chép sâu kèm định danh mới (nhân bản, dán). */
export function cloneBlock(b: BNode): BNode {
  const c: BNode = { id: newId(), type: b.type, attrs: structuredClone(b.attrs) };
  if (b.content) c.content = b.content.map(cloneBlock);
  if (b.inline) c.inline = b.inline.map(cloneRich);
  if (b.raw) c.raw = b.raw.map(cloneRich);
  return c;
}

/** Tạo khối mới đúng loại. */
export function makeBlock(type: string, attrs: Record<string, unknown> = {}, children?: BNode[] | RichNode[] | string): BNode {
  const kind = kindOf(type);
  const b: BNode = { id: newId(), type, attrs: clean(attrs) };
  if (kind === "text") b.inline = typeof children === "string" ? (children ? [{ type: "text", text: children }] : []) : ((children as RichNode[]) ?? []);
  else if (kind === "container") b.content = (children as BNode[]) ?? [];
  return b;
}

/** Độ dài chữ (hardBreak và nút inline khác tính 1) — dùng cho vị trí con trỏ. */
export function inlineLength(inline: RichNode[] | undefined): number {
  let n = 0;
  for (const c of inline ?? []) n += c.type === "text" ? (c.text ?? "").length : 1;
  return n;
}
export const inlineText = (inline: RichNode[] | undefined) => (inline ?? []).map((c) => (c.type === "text" ? c.text ?? "" : c.type === "hardBreak" ? "\n" : "")).join("");

/** Cắt chữ tại vị trí `at` → [trước, sau], giữ định dạng. */
export function splitInline(inline: RichNode[], at: number): [RichNode[], RichNode[]] {
  const before: RichNode[] = [];
  const after: RichNode[] = [];
  let pos = 0;
  for (const c of inline) {
    const len = c.type === "text" ? (c.text ?? "").length : 1;
    if (pos + len <= at) before.push(cloneRich(c));
    else if (pos >= at) after.push(cloneRich(c));
    else {
      const k = at - pos;
      before.push({ ...cloneRich(c), text: c.text!.slice(0, k) });
      after.push({ ...cloneRich(c), text: c.text!.slice(k) });
    }
    pos += len;
  }
  return [before, after];
}

const sameMarks = (a?: RichMark[], b?: RichMark[]) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
/** Nối hai đoạn chữ, gộp text cùng định dạng ở chỗ nối. */
export function joinInline(a: RichNode[], b: RichNode[]): RichNode[] {
  const out = a.map(cloneRich);
  for (const c of b) {
    const last = out[out.length - 1];
    if (last && last.type === "text" && c.type === "text" && sameMarks(last.marks, c.marks)) last.text = (last.text ?? "") + (c.text ?? "");
    else out.push(cloneRich(c));
  }
  return out;
}
