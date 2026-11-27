import { isSafeUrl } from "@ecomcx/ecomweb-content";
import { chainCommands, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { redo, undo } from "prosemirror-history";
import type { Mark, MarkType, Node as PMNode, NodeType } from "prosemirror-model";
import { liftListItem, sinkListItem, wrapInList } from "prosemirror-schema-list";
import type { Command, EditorState, Transaction } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";
import { addColumnAfter, addRowAfter, deleteColumn, deleteRow, deleteTable, isInTable, mergeCells, splitCell, toggleHeaderRow } from "prosemirror-tables";
import { ALIGNS, safeColor, richSchema as S, type Align } from "./schema";

/** Phép toán của trình soạn HTML — thuần ProseMirror (không React), giao diện nối vào qua `commandMap`. */

export const markActive = (state: EditorState, type: MarkType): boolean => {
  const { from, $from, to, empty } = state.selection;
  return empty ? !!type.isInSet(state.storedMarks || $from.marks()) : state.doc.rangeHasMark(from, to, type);
};

/** Giá trị thuộc tính (vd. màu) của định dạng `type` tại con trỏ, hoặc ở đoạn chữ đầu tiên có định dạng đó trong vùng chọn (kể cả khi chọn nhiều khối bằng ⌘A). */
export function markAttrAt(state: EditorState, type: MarkType, attr: string): string | null {
  const { from, to, empty, $from } = state.selection;
  if (empty) { const m = (state.storedMarks || $from.marks()).find((x) => x.type === type); return (m?.attrs[attr] as string | undefined) ?? null; }
  let found: string | null = null;
  state.doc.nodesBetween(from, to, (n) => { if (found === null && n.isText) { const m = type.isInSet(n.marks); if (m) found = (m.attrs[attr] as string | undefined) ?? null; } });
  return found;
}

export type BlockKind = "paragraph" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote" | "code";

export function blockKind(state: EditorState): BlockKind {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === S.nodes.blockquote) return "blockquote";
  const n = $from.parent;
  if (n.type === S.nodes.heading) return `h${n.attrs.level}` as BlockKind;
  if (n.type === S.nodes.code_block) return "code";
  return "paragraph";
}

const inBlockquote = (state: EditorState) => blockKind(state) === "blockquote";
const liftOut: Command = (state, dispatch) => {
  const { $from, $to } = state.selection;
  const range = $from.blockRange($to, (n) => n.type === S.nodes.blockquote);
  if (!range) return false;
  if (dispatch) { const target = range.depth - 1; dispatch(state.tr.lift(range, target).scrollIntoView()); }
  return true;
};

export const setBlock = (kind: BlockKind): Command => {
  if (kind === "paragraph") return chainCommands(liftOut, setBlockType(S.nodes.paragraph));
  if (kind === "blockquote") return (state, dispatch) => (inBlockquote(state) ? liftOut(state, dispatch) : wrapIn(S.nodes.blockquote)(state, dispatch));
  if (kind === "code") return setBlockType(S.nodes.code_block);
  return chainCommands(liftOut, setBlockType(S.nodes.heading, { level: Number(kind.slice(1)) }));
};

export const alignOfSelection = (state: EditorState): Align | null => {
  const n = state.selection.$from.parent;
  return (ALIGNS as readonly string[]).includes(n.attrs.align) ? (n.attrs.align as Align) : null;
};

export const setAlign = (align: Align): Command => (state, dispatch) => {
  const { from, to } = state.selection;
  const current = alignOfSelection(state);
  const next = current === align && align !== "left" ? null : align === "left" ? null : align;
  const tr = state.tr;
  let changed = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type === S.nodes.paragraph || node.type === S.nodes.heading) { tr.setNodeMarkup(pos, undefined, { ...node.attrs, align: next }); changed = true; }
  });
  if (changed && dispatch) dispatch(tr.scrollIntoView());
  return changed;
};

const listActive = (state: EditorState, type: NodeType) => {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === type) return true;
  return false;
};
/** Các danh sách (chấm / số) giao với vùng chọn (không tính danh sách lồng trong danh sách đã lấy), kèm vị trí. */
const listsInSelection = (state: EditorState) => {
  const { from, to } = state.selection;
  const found: Array<{ node: PMNode; pos: number }> = [];
  state.doc.nodesBetween(from, to, (n, pos) => {
    if (n.type === S.nodes.bullet_list || n.type === S.nodes.ordered_list) { found.push({ node: n, pos }); return false; }
    return true;
  });
  if (found.length) return found;
  // Con trỏ nằm sâu trong một danh sách (vùng chọn không "giao" với nút danh sách theo nodesBetween)
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) { const n = $from.node(d); if (n.type === S.nodes.bullet_list || n.type === S.nodes.ordered_list) return [{ node: n, pos: $from.before(d) }]; }
  return found;
};
/** Bật / tắt danh sách; đang ở danh sách loại kia thì ĐỔI loại (chấm ↔ số, kể cả khi chọn nhiều danh sách bằng ⌘A) thay vì lồng thêm. */
export const toggleList = (type: NodeType): Command => (state, dispatch) => {
  const lists = listsInSelection(state);
  if (lists.length && lists.every((l) => l.node.type === type)) return liftListItem(S.nodes.list_item)(state, dispatch);
  if (lists.length) {
    if (dispatch) {
      const tr = state.tr;
      for (const l of lists) if (l.node.type !== type) tr.setNodeMarkup(l.pos, type, type === S.nodes.ordered_list ? { order: 1 } : null);
      dispatch(tr.scrollIntoView());
    }
    return true;
  }
  return wrapInList(type)(state, dispatch);
};

export const setMarkAttr = (type: MarkType, value: string | null): Command => (state, dispatch) => {
  const { from, to, empty } = state.selection;
  const color = value === null ? null : safeColor(value);
  if (value !== null && !color) return false;
  if (empty) {
    if (dispatch) dispatch(color ? state.tr.addStoredMark(type.create({ color })) : state.tr.removeStoredMark(type));
    return true;
  }
  if (dispatch) dispatch((color ? state.tr.addMark(from, to, type.create({ color })) : state.tr.removeMark(from, to, type)).scrollIntoView());
  return true;
};

/**
 * Liên kết nằm trong vùng chọn (hoặc dưới con trỏ), mở rộng ra cả đoạn liên kết liền nhau.
 * Vùng chọn trải nhiều khối (⌘A) → gộp mọi đoạn chữ mang liên kết trong vùng.
 */
export function linkAt(state: EditorState): { href: string; target: string | null; from: number; to: number } | null {
  const type = S.marks.link;
  const { $from, from, to, empty } = state.selection;
  if (empty) {
    const found = $from.marks().find((m) => m.type === type) ?? $from.nodeBefore?.marks.find((m) => m.type === type) ?? $from.nodeAfter?.marks.find((m) => m.type === type);
    if (!found) return null;
    const base = $from.start();
    let run: [number, number] | null = null;
    let best: [number, number] | null = null;
    $from.parent.forEach((child, off) => {
      const cs = base + off, ce = cs + child.nodeSize;
      if (found.isInSet(child.marks)) { run = run ? [run[0], ce] : [cs, ce]; if (run[0] <= from && run[1] >= from) best = run; }
      else run = null;
    });
    const r = best as [number, number] | null;
    return r ? { href: String(found.attrs.href), target: (found.attrs.target as string | null) ?? null, from: r[0], to: r[1] } : null;
  }
  let first: Mark | undefined;
  let s = Infinity, e = -Infinity;
  state.doc.nodesBetween(from, to, (n, pos) => {
    const m = n.isText ? type.isInSet(n.marks) : undefined;
    if (m) { first = first ?? m; s = Math.min(s, pos); e = Math.max(e, pos + n.nodeSize); }
  });
  const f = first as Mark | undefined;
  return f ? { href: String(f.attrs.href), target: (f.attrs.target as string | null) ?? null, from: s, to: e } : null;
}

export const setLink = (href: string, target: string | null): Command => (state, dispatch) => {
  if (!isSafeUrl(href)) return false;   // javascript:, data: … không bao giờ thành liên kết
  const existing = linkAt(state);
  const { from, to, empty } = state.selection;
  const range = existing ?? { from, to };
  if (!existing && empty) {
    // không chọn chữ: chèn chính địa chỉ làm chữ liên kết
    if (dispatch) { const node = S.text(href, [S.marks.link.create({ href, target })]); dispatch(state.tr.replaceSelectionWith(node, false)); }
    return true;
  }
  if (dispatch) dispatch(state.tr.removeMark(range.from, range.to, S.marks.link).addMark(range.from, range.to, S.marks.link.create({ href, target })).scrollIntoView());
  return true;
};

export const removeLink: Command = (state, dispatch) => {
  const l = linkAt(state);
  if (!l) return false;
  if (dispatch) dispatch(state.tr.removeMark(l.from, l.to, S.marks.link));
  return true;
};

export const insertImage = (src: string, alt = ""): Command => (state, dispatch) => {
  if (!isSafeUrl(src)) return false;
  if (dispatch) dispatch(state.tr.replaceSelectionWith(S.nodes.image.create({ src, alt })).scrollIntoView());
  return true;
};

/** Khối chèn xong mà nằm cuối tài liệu thì thêm một đoạn trống phía sau để còn chỗ gõ tiếp, và đặt con trỏ ở đó. */
const withTrailingParagraph = (tr: Transaction): Transaction => {
  const last = tr.doc.lastChild;
  if (last && last.type !== S.nodes.paragraph) {
    tr.insert(tr.doc.content.size, S.nodes.paragraph.create());
    tr.setSelection(TextSelection.near(tr.doc.resolve(tr.doc.content.size - 1)));
  }
  return tr;
};

/** Chèn video / âm thanh (địa chỉ từ thư viện media). Địa chỉ không an toàn bị từ chối. */
export const insertVideo = (src: string, poster?: string | null): Command => (state, dispatch) => {
  if (!isSafeUrl(src)) return false;
  if (dispatch) dispatch(withTrailingParagraph(state.tr.replaceSelectionWith(S.nodes.video.create({ src, poster: poster && isSafeUrl(poster) ? poster : null }))).scrollIntoView());
  return true;
};
export const insertAudio = (src: string): Command => (state, dispatch) => {
  if (!isSafeUrl(src)) return false;
  if (dispatch) dispatch(withTrailingParagraph(state.tr.replaceSelectionWith(S.nodes.audio.create({ src }))).scrollIntoView());
  return true;
};
/** Chèn liên kết tệp tải xuống (tên tệp làm chữ liên kết, `download`). Có chữ đang chọn thì gắn liên kết lên chữ đó. */
export const insertFile = (src: string, name: string): Command => (state, dispatch) => {
  if (!isSafeUrl(src)) return false;
  const link = S.marks.link.create({ href: src, target: null, download: true });
  if (dispatch) {
    const { from, to, empty } = state.selection;
    const tr = empty ? state.tr.replaceSelectionWith(S.text(name || src, [link]), false) : state.tr.addMark(from, to, link);
    dispatch(tr.scrollIntoView());
  }
  return true;
};

export const insertHr: Command = (state, dispatch) => {
  if (dispatch) dispatch(withTrailingParagraph(state.tr.replaceSelectionWith(S.nodes.horizontal_rule.create())).scrollIntoView());
  return true;
};

export const insertTable = (rows = 3, cols = 3): Command => (state, dispatch) => {
  const cell = () => S.nodes.table_cell.createAndFill()!;
  const row = () => S.nodes.table_row.create(null, Array.from({ length: cols }, cell));
  const table = S.nodes.table.create(null, Array.from({ length: rows }, row));
  if (dispatch) {
    const tr = state.tr.replaceSelectionWith(table);
    const start = (tr.steps[0] as unknown as { from: number }).from;   // chỗ bảng thực sự được chèn (có thể nằm ngoài đoạn đang chọn)
    withTrailingParagraph(tr);
    // con trỏ vào ô đầu tiên của bảng vừa chèn
    dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1), 1)).scrollIntoView());
  }
  return true;
};

export const clearFormat: Command = (state, dispatch) => {
  const { from, to } = state.selection;
  if (dispatch) {
    const tr = state.tr;
    for (const m of Object.values(S.marks)) tr.removeMark(from, to, m);
    state.doc.nodesBetween(from, to, (n, pos) => { if (n.type === S.nodes.heading) tr.setNodeMarkup(pos, S.nodes.paragraph, { align: n.attrs.align }); });
    dispatch(tr.scrollIntoView());
  }
  return true;
};

export interface CommandDef { run: Command; active?: (s: EditorState) => boolean; enabled?: (s: EditorState) => boolean }

const mark = (name: string): CommandDef => ({ run: toggleMark(S.marks[name]), active: (s) => markActive(s, S.marks[name]) });
const align = (a: Align): CommandDef => ({ run: setAlign(a), active: (s) => (alignOfSelection(s) ?? "left") === a });
const inTable = (s: EditorState) => isInTable(s);

/** Lệnh gọi trực tiếp từ nút thanh công cụ (không cần hộp nhập). Nút có hộp nhập (liên kết, ảnh, màu, bảng, mã HTML…) do giao diện lo. */
export const commandMap: Record<string, CommandDef> = {
  undo: { run: undo }, redo: { run: redo },
  bold: mark("strong"), italic: mark("em"), underline: mark("underline"), strike: mark("strike"), code: mark("code"), sub: mark("sub"), sup: mark("sup"),
  alignLeft: align("left"), alignCenter: align("center"), alignRight: align("right"), alignJustify: align("justify"),
  bulletList: { run: toggleList(S.nodes.bullet_list), active: (s) => listActive(s, S.nodes.bullet_list) },
  orderedList: { run: toggleList(S.nodes.ordered_list), active: (s) => listActive(s, S.nodes.ordered_list) },
  indent: { run: sinkListItem(S.nodes.list_item), enabled: (s) => sinkListItem(S.nodes.list_item)(s) },
  outdent: { run: liftListItem(S.nodes.list_item), enabled: (s) => liftListItem(S.nodes.list_item)(s) },
  quote: { run: setBlock("blockquote"), active: inBlockquote },
  codeBlock: { run: setBlock("code"), active: (s) => blockKind(s) === "code" },
  hr: { run: insertHr }, clear: { run: clearFormat }, unlink: { run: removeLink, enabled: (s) => !!linkAt(s) },
  rowAfter: { run: addRowAfter, enabled: inTable }, colAfter: { run: addColumnAfter, enabled: inTable },
  rowDelete: { run: deleteRow, enabled: inTable }, colDelete: { run: deleteColumn, enabled: inTable }, tableDelete: { run: deleteTable, enabled: inTable },
  headerRow: { run: toggleHeaderRow, enabled: inTable }, mergeCells: { run: mergeCells, enabled: (s) => mergeCells(s) }, splitCell: { run: splitCell, enabled: (s) => splitCell(s) },
};
