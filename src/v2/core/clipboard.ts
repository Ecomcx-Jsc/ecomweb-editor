import { isSafeUrl, type RichMark, type RichNode } from "@ecomcx/ecomweb-content";
import { cleanPastedHtml } from "../../shared/paste";
import { blocksFromDoc, cloneBlock, docFromBlocks, fromRich, inlineLength, inlineText, makeBlock, splitInline, toRich, type BNode } from "./model";
import { flatten } from "./ops";
import type { EditorStore } from "./store";

/** Kiểu dữ liệu clipboard riêng: chép khối giữa các trình soạn giữ nguyên cấu trúc + thuộc tính. */
export const BLOCKS_MIME = "application/x-ecx-blocks";

// ---------------------------------------------------------------------------
// HTML → khối
// ---------------------------------------------------------------------------
const MARK_TAGS: Record<string, string> = { STRONG: "bold", B: "bold", EM: "italic", I: "italic", U: "underline", S: "strike", DEL: "strike", STRIKE: "strike", CODE: "code", KBD: "kbd", SUB: "subscript", SUP: "superscript", MARK: "highlight" };
const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "HR", "TABLE", "FIGURE", "IMG", "SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "ASIDE", "NAV", "DL", "DT", "DD"]);

function inlineOf(node: globalThis.Node, marks: RichMark[] = [], out: RichNode[] = []): RichNode[] {
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) {
      const text = (c.textContent ?? "").replace(/[\t\n\r ]+/g, " ");
      if (!text) return;
      const last = out[out.length - 1];
      if (last?.type === "text" && JSON.stringify(last.marks ?? []) === JSON.stringify(marks)) last.text += text;
      else out.push(marks.length ? { type: "text", text, marks: [...marks] } : { type: "text", text });
      return;
    }
    if (c.nodeType !== 1) return;
    const el = c as HTMLElement;
    if (el.tagName === "BR") { out.push({ type: "hardBreak" }); return; }
    if (el.tagName === "IMG" || BLOCK_TAGS.has(el.tagName)) { inlineOf(el, marks, out); return; }
    let next = marks;
    const m = MARK_TAGS[el.tagName];
    if (m && !next.some((x) => x.type === m)) next = [...next, { type: m }];
    if (el.tagName === "A") {
      const href = el.getAttribute("href") ?? "";
      if (href && isSafeUrl(href)) next = [...next.filter((x) => x.type !== "link"), { type: "link", attrs: { href } }];
    }
    inlineOf(el, next, out);
  });
  return out;
}

/** Bỏ khoảng trắng thừa ở hai đầu đoạn chữ. */
function trimInline(inline: RichNode[]): RichNode[] {
  const out = inline.map((n) => ({ ...n }));
  while (out[0]?.type === "hardBreak") out.shift();
  while (out[out.length - 1]?.type === "hardBreak") out.pop();
  if (out[0]?.type === "text") out[0].text = out[0].text!.replace(/^\s+/, "");
  const last = out[out.length - 1];
  if (last?.type === "text") last.text = last.text!.replace(/\s+$/, "");
  return out.filter((n) => n.type !== "text" || n.text);
}

const hasBlockChild = (el: Element) => Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName));

function blocksOf(el: Element, out: RichNode[] = []): RichNode[] {
  let pending: RichNode[] = [];
  const flush = () => {
    const t = trimInline(pending);
    if (t.length) out.push({ type: "paragraph", content: t });
    pending = [];
  };
  el.childNodes.forEach((c) => {
    if (c.nodeType === 3) { inlineOf({ childNodes: [c] } as unknown as globalThis.Node, [], pending); return; }
    if (c.nodeType !== 1) return;
    const e = c as HTMLElement;
    const tag = e.tagName;
    if (!BLOCK_TAGS.has(tag)) {
      if (tag === "BR") pending.push({ type: "hardBreak" });
      else if (!["SCRIPT", "STYLE", "META", "LINK", "TITLE", "HEAD"].includes(tag)) inlineOf({ childNodes: [e] } as unknown as globalThis.Node, [], pending);
      return;
    }
    flush();
    const node = blockOf(e);
    if (Array.isArray(node)) out.push(...node);
    else if (node) out.push(node);
  });
  flush();
  return out;
}

function blockOf(e: HTMLElement): RichNode | RichNode[] | null {
  const tag = e.tagName;
  const text = (inline: RichNode[]) => { const t = trimInline(inline); return t.length ? { content: t } : {}; };
  switch (tag) {
    case "H1": case "H2": case "H3": case "H4": case "H5": case "H6":
      return { type: "heading", attrs: { level: Number(tag[1]) }, ...text(inlineOf(e)) };
    case "P":
      return hasBlockChild(e) ? blocksOf(e) : { type: "paragraph", ...text(inlineOf(e)) };
    case "UL": case "OL": {
      const items = Array.from(e.children).filter((c) => c.tagName === "LI").map((li) => {
        const kids = blocksOf(li);
        if (!kids.length || kids[0].type !== "paragraph") kids.unshift({ type: "paragraph" });
        return { type: "listItem", content: kids };
      });
      if (!items.length) return null;
      const start = Number(e.getAttribute("start"));
      return { type: tag === "UL" ? "bulletList" : "orderedList", ...(tag === "OL" && start > 1 ? { attrs: { start } } : {}), content: items };
    }
    case "BLOCKQUOTE": {
      const kids = blocksOf(e);
      return kids.length ? { type: "blockquote", content: kids } : null;
    }
    case "PRE": {
      const code = (e.textContent ?? "").replace(/\n$/, "");
      return { type: "codeBlock", ...(code ? { content: [{ type: "text", text: code }] } : {}) };
    }
    case "HR": return { type: "horizontalRule" };
    case "IMG": {
      const src = e.getAttribute("src") ?? "";
      return src && isSafeUrl(src) ? { type: "image", attrs: { src, alt: e.getAttribute("alt") ?? undefined } } : null;
    }
    case "FIGURE": {
      const img = e.querySelector("img");
      const cap = e.querySelector("figcaption")?.textContent?.trim();
      const src = img?.getAttribute("src") ?? "";
      if (img && src && isSafeUrl(src)) return { type: "image", attrs: { src, alt: img.getAttribute("alt") ?? undefined, ...(cap ? { caption: cap } : {}) } };
      return blocksOf(e);
    }
    case "TABLE": {
      const rows = Array.from(e.querySelectorAll("tr")).filter((tr) => tr.closest("table") === e).map((tr) => ({
        type: "tableRow",
        content: Array.from(tr.children).filter((c) => c.tagName === "TD" || c.tagName === "TH").map((cell) => {
          const kids = blocksOf(cell);
          const span = (n: string) => Number(cell.getAttribute(n)) > 1 ? Number(cell.getAttribute(n)) : undefined;
          const attrs = Object.fromEntries(Object.entries({ colspan: span("colspan"), rowspan: span("rowspan") }).filter(([, v]) => v));
          return { type: cell.tagName === "TH" ? "tableHeader" : "tableCell", ...(Object.keys(attrs).length ? { attrs } : {}), content: kids.length ? kids : [{ type: "paragraph" }] };
        }),
      })).filter((r) => r.content.length);
      return rows.length ? { type: "table", content: rows } : null;
    }
    default:
      // div, section…: chỉ có chữ → đoạn văn; có khối con → đi vào trong
      return hasBlockChild(e) ? blocksOf(e) : { type: "paragraph", ...text(inlineOf(e)) };
  }
}

/** HTML (Word, Google Docs, trang web) → danh sách khối RichNode. */
export function htmlToRich(html: string): RichNode[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(cleanPastedHtml(html), "text/html");
  return blocksOf(doc.body).filter((n) => !(n.type === "paragraph" && !n.content?.length));
}

/** Chữ thuần nhiều dòng → đoạn văn (dòng trống tách đoạn; xuống dòng đơn trong đoạn = hardBreak). */
export function textToRich(text: string): RichNode[] {
  return text.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((para) => {
    const lines = para.split("\n");
    const content: RichNode[] = [];
    lines.forEach((l, i) => { if (i) content.push({ type: "hardBreak" }); if (l) content.push({ type: "text", text: l }); });
    return content.length ? { type: "paragraph", content } : { type: "paragraph" };
  }).filter((p) => p.content);
}

// ---------------------------------------------------------------------------
// Dán vào khối chữ
// ---------------------------------------------------------------------------
/** Chèn các khối tại vị trí con trỏ trong khối chữ: tách khối, chèn giữa; khối trống thì thay luôn. */
export function insertBlocksAtCaret(store: EditorStore, blockId: string, from: number, to: number, nodes: BNode[]) {
  const loc = store.locate(blockId);
  if (!loc?.block.inline || !nodes.length) return;
  const b = loc.block;
  const [before] = splitInline(b.inline!, from);
  const [, after] = splitInline(b.inline!, to);
  const parentId = loc.parent?.id ?? null;
  const lastText = [...flatten(nodes)].reverse().find((n) => n.inline);
  const caret = lastText ? { id: lastText.id, offset: inlineLength(lastText.inline) } : null;
  const replacement: BNode[] = [];
  if (inlineLength(before)) replacement.push({ ...b, inline: before });
  replacement.push(...nodes);
  if (inlineLength(after)) replacement.push(makeBlock(b.type, { ...b.attrs }, after));
  store.commit(loc.docId, replaceAt(store.getState().docs[loc.docId].blocks, parentId, loc.index, replacement), {
    select: caret ? { ids: [], editing: caret.id } : { ids: nodes.map((n) => n.id), editing: null }, caret,
  });
}

function replaceAt(blocks: BNode[], parentId: string | null, index: number, nodes: BNode[]): BNode[] {
  const swap = (list: BNode[]) => [...list.slice(0, index), ...nodes, ...list.slice(index + 1)];
  if (parentId == null) return swap(blocks);
  const walk = (list: BNode[]): BNode[] => list.map((x) => (x.id === parentId ? { ...x, content: swap(x.content!) } : x.content ? { ...x, content: walk(x.content) } : x));
  return walk(blocks);
}

export function serializeBlocks(nodes: BNode[]): { json: string; text: string; html: string } {
  const rich = nodes.map(toRich);
  const text = flatten(nodes).filter((n) => n.inline).map((n) => inlineText(n.inline)).join("\n\n");
  return { json: JSON.stringify(rich), text, html: richToHtml(rich) };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const MARK_HTML: Record<string, string> = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code", kbd: "kbd", subscript: "sub", superscript: "sup", highlight: "mark" };
/** HTML đơn giản (dán sang Word, email…). */
export function richToHtml(nodes: RichNode[]): string {
  const inl = (list: RichNode[] = []) => list.map((n) => {
    if (n.type === "hardBreak") return "<br>";
    if (n.type !== "text") return "";
    let s = esc(n.text ?? "");
    for (const m of n.marks ?? []) {
      if (m.type === "link" && typeof m.attrs?.href === "string" && isSafeUrl(m.attrs.href)) s = `<a href="${esc(m.attrs.href)}">${s}</a>`;
      else if (MARK_HTML[m.type]) s = `<${MARK_HTML[m.type]}>${s}</${MARK_HTML[m.type]}>`;
    }
    return s;
  }).join("");
  const blk = (n: RichNode): string => {
    const kids = () => (n.content ?? []).map(blk).join("");
    switch (n.type) {
      case "paragraph": return `<p>${inl(n.content)}</p>`;
      case "heading": return `<h${Number(n.attrs?.level) || 2}>${inl(n.content)}</h${Number(n.attrs?.level) || 2}>`;
      case "bulletList": case "taskList": return `<ul>${kids()}</ul>`;
      case "orderedList": return `<ol>${kids()}</ol>`;
      case "listItem": case "taskItem": return `<li>${kids()}</li>`;
      case "blockquote": return `<blockquote>${kids()}</blockquote>`;
      case "codeBlock": case "preformatted": return `<pre>${esc((n.content ?? []).map((c) => c.text ?? "").join(""))}</pre>`;
      case "horizontalRule": return "<hr>";
      case "image": return typeof n.attrs?.src === "string" && isSafeUrl(n.attrs.src) ? `<img src="${esc(n.attrs.src)}" alt="${esc(String(n.attrs.alt ?? ""))}">` : "";
      case "table": return `<table>${kids()}</table>`;
      case "tableRow": return `<tr>${kids()}</tr>`;
      case "tableCell": return `<td>${kids()}</td>`;
      case "tableHeader": return `<th>${kids()}</th>`;
      default: return n.content?.length ? (n.content.every((c) => c.type === "text" || c.type === "hardBreak") ? `<p>${inl(n.content)}</p>` : `<div>${kids()}</div>`) : "";
    }
  };
  return nodes.map(blk).join("");
}

/** Đọc khối từ clipboard (dán khi đang chọn khối, không gõ chữ). */
export function blocksFromClipboard(data: DataTransfer): BNode[] {
  const json = data.getData(BLOCKS_MIME);
  if (json) {
    try { return (JSON.parse(json) as RichNode[]).map(fromRich); } catch { /* bỏ qua */ }
  }
  const html = data.getData("text/html");
  if (html) { const r = htmlToRich(html); if (r.length) return r.map(fromRich); }
  const text = data.getData("text/plain");
  return text ? textToRich(text).map(fromRich) : [];
}

export const cloneAll = (nodes: BNode[]) => nodes.map(cloneBlock);
export { blocksFromDoc, docFromBlocks };
