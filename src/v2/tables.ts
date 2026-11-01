import { makeBlock, type BNode } from "./model";
import type { EditorStore } from "./store";

/**
 * Thao tác bảng (table > tableRow > tableCell|tableHeader > khối). Ô gộp (colspan) tính theo vị trí ô trong hàng —
 * đủ cho bảng thường; bảng gộp ô phức tạp vẫn giữ nguyên dữ liệu.
 */
export interface TableContext { table: BNode; row: number; col: number; docId: string }

/** Bảng + hàng/cột của khối đang thao tác (khối nằm trong một ô, hoặc chính bảng). */
export function tableContext(store: EditorStore, blockId: string): TableContext | null {
  const loc = store.locate(blockId);
  if (!loc) return null;
  if (loc.block.type === "table") return { table: loc.block, row: loc.block.content!.length - 1, col: Math.max(0, (loc.block.content![0]?.content?.length ?? 1) - 1), docId: loc.docId };
  const chain = [...loc.ancestors, blockId];
  for (let i = chain.length - 1; i >= 0; i--) {
    const cell = store.locate(chain[i]);
    if (!cell || (cell.block.type !== "tableCell" && cell.block.type !== "tableHeader")) continue;
    const row = store.locate(cell.parent!.id)!;
    return { table: row.parent!, row: row.index, col: cell.index, docId: loc.docId };
  }
  return null;
}

const cell = (header = false) => makeBlock(header ? "tableHeader" : "tableCell", {}, [makeBlock("paragraph")]);
const isHeaderRow = (row: BNode) => !!row.content?.length && row.content.every((c) => c.type === "tableHeader");
const width = (t: BNode) => Math.max(1, ...t.content!.map((r) => r.content?.length ?? 0));

function replaceTable(store: EditorStore, ctx: TableContext, next: BNode | null, focus?: { row: number; col: number }) {
  if (!next) { store.remove([ctx.table.id]); return; }
  const target = focus ? next.content?.[focus.row]?.content?.[focus.col]?.content?.[0] : undefined;
  store.replace(ctx.table.id, [next], target?.inline ? { select: { ids: [], editing: target.id }, caret: { id: target.id, offset: 0 } } : undefined);
}

export function addRow(store: EditorStore, ctx: TableContext, after: boolean) {
  const at = ctx.row + (after ? 1 : 0);
  const row = makeBlock("tableRow", {}, Array.from({ length: width(ctx.table) }, () => cell(false)));
  const rows = [...ctx.table.content!];
  rows.splice(at, 0, row);
  replaceTable(store, ctx, { ...ctx.table, content: rows }, { row: at, col: Math.min(ctx.col, width(ctx.table) - 1) });
}

export function addColumn(store: EditorStore, ctx: TableContext, after: boolean) {
  const at = ctx.col + (after ? 1 : 0);
  const rows = ctx.table.content!.map((r) => {
    const cells = [...(r.content ?? [])];
    cells.splice(Math.min(at, cells.length), 0, cell(isHeaderRow(r)));
    return { ...r, content: cells };
  });
  replaceTable(store, ctx, { ...ctx.table, content: rows }, { row: ctx.row, col: at });
}

export function deleteRow(store: EditorStore, ctx: TableContext) {
  const rows = ctx.table.content!.filter((_, i) => i !== ctx.row);
  replaceTable(store, ctx, rows.length ? { ...ctx.table, content: rows } : null, rows.length ? { row: Math.min(ctx.row, rows.length - 1), col: ctx.col } : undefined);
}

export function deleteColumn(store: EditorStore, ctx: TableContext) {
  const rows = ctx.table.content!.map((r) => ({ ...r, content: (r.content ?? []).filter((_, i) => i !== ctx.col) })).filter((r) => r.content.length);
  replaceTable(store, ctx, rows.length ? { ...ctx.table, content: rows } : null, rows.length ? { row: ctx.row, col: Math.max(0, Math.min(ctx.col, rows[0].content.length - 1)) } : undefined);
}

/** Bật / tắt hàng tiêu đề (hàng đầu toàn ô tiêu đề → website vẽ <thead>). */
export function toggleHeaderRow(store: EditorStore, ctx: TableContext) {
  const [first, ...rest] = ctx.table.content!;
  const header = isHeaderRow(first);
  const flipped = { ...first, content: first.content!.map((c) => ({ ...c, type: header ? "tableCell" : "tableHeader" })) };
  replaceTable(store, ctx, { ...ctx.table, content: [flipped, ...rest] }, { row: ctx.row, col: ctx.col });
}
export const hasHeaderRow = (t: BNode) => isHeaderRow(t.content![0]);
