import { embedInfo, type RichNode } from "@ecomcx/ecomweb-content";
import type { EditorView } from "prosemirror-view";
import type { EditorContextValue } from "../context";
import { isUrl } from "../../shared/paste";
import { BLOCKS_MIME, htmlToRich, insertBlocksAtCaret, textToRich } from "../core/clipboard";
import { fromRich, inlineLength, makeBlock } from "../core/model";

/** Dán vào ô gõ: chữ có định dạng ở lại trong khối, nhiều khối thì tách khối tại con trỏ (lõi phân tích ở core/clipboard). */
export function pasteIntoBlock(ctx: EditorContextValue, blockId: string, view: EditorView, event: ClipboardEvent): boolean {
  const data = event.clipboardData;
  if (!data) return false;
  const { store, registry } = ctx;
  const block = store.block(blockId);
  if (!block) return false;
  const type = registry.get(block.type);
  const { from, to } = view.state.selection;

  const json = data.getData(BLOCKS_MIME);
  if (json) {
    try {
      const nodes = (JSON.parse(json) as RichNode[]).map(fromRich);
      if (nodes.length) { insertBlocksAtCaret(store, blockId, from, to, nodes); return true; }
    } catch { /* clipboard hỏng: dán như chữ */ }
  }
  const text = data.getData("text/plain");
  // Khối mã: chỉ dán chữ thuần
  if (type?.multiline || type?.plain) {
    if (!text) return false;
    view.dispatch(view.state.tr.insertText(text));
    return true;
  }
  // Dán đường dẫn lên chữ đang bôi đen → liên kết
  if (text && isUrl(text) && from !== to) {
    view.dispatch(view.state.tr.addMark(from, to, view.state.schema.marks.link.create({ href: text.trim() })));
    return true;
  }
  // Đường dẫn trong đoạn trống → khối nhúng / ảnh
  if (text && isUrl(text) && block.type === "paragraph" && !inlineLength(block.inline)) {
    const url = text.trim();
    const node = /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(url) ? makeBlock("image", { src: url }) : embedInfo(url) ? makeBlock("embed", { url }) : null;
    if (node) { store.replace(blockId, [node], { select: { ids: [node.id], editing: null }, caret: null }); return true; }
  }
  const html = data.getData("text/html");
  if (html) {
    const rich = htmlToRich(html);
    // Một đoạn văn: để ProseMirror dán chữ có định dạng tại chỗ
    if (rich.length > 1 || (rich.length === 1 && rich[0].type !== "paragraph")) {
      insertBlocksAtCaret(store, blockId, from, to, rich.map(fromRich));
      return true;
    }
    if (rich.length === 1) {
      const doc = view.state.schema.nodeFromJSON({ type: "doc", content: (rich[0].content ?? []).map((n) => toPm(view, n)) });
      view.dispatch(view.state.tr.replaceWith(from, to, doc.content));
      return true;
    }
  }
  if (text && /\n/.test(text)) {
    const rich = textToRich(text);
    if (rich.length > 1) { insertBlocksAtCaret(store, blockId, from, to, rich.map(fromRich)); return true; }
  }
  return false;
}

/** RichNode inline → JSON của inlineSchema (định dạng lạ bỏ qua khi dán). */
function toPm(view: EditorView, n: RichNode): Record<string, unknown> {
  if (n.type === "text") {
    const marks = (n.marks ?? []).filter((m) => view.state.schema.marks[m.type] && m.type !== "unknownMark");
    return marks.length ? { type: "text", text: n.text, marks } : { type: "text", text: n.text };
  }
  return n.type === "hardBreak" ? { type: "hardBreak" } : { type: "inlineAtom", attrs: { json: n } };
}

// ---------------------------------------------------------------------------
// Chép / cắt / dán khối đang chọn
// ---------------------------------------------------------------------------
