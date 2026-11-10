import { makeBlock, type BNode } from "./model";
import type { EditorStore } from "./store";

/**
 * Thao tác bảng (table > tableRow > tableCell|tableHeader > khối). Bảng được đổi sang lưới ô có vị trí + độ gộp
 * (rowspan / colspan) để mọi thao tác giữ bảng vuông vức: thêm / xoá hàng, cột đi qua ô gộp thì nới / thu ô đó,
 * gộp ô phải / dưới, tách ô gộp.
 */
export interface TableContext { table: BNode; row: number; col: number; docId: string }

/** Bảng + hàng / vị trí ô (trong hàng) của khối đang thao tác (khối nằm trong một ô, hoặc chính bảng). */
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

// ---------------------------------------------------------------------------
// Lưới ô
// ---------------------------------------------------------------------------
interface GridCell { node: BNode; r: number; c: number; rs: number; cs: number }
interface Grid { cells: GridCell[]; rows: BNode[] }

const span = (v: unknown) => Math.max(1, Math.min(1000, Math.floor(Number(v)) || 1));
const emptyCell = (header: boolean) => makeBlock(header ? "tableHeader" : "tableCell", {}, [makeBlock("paragraph")]);
const isHeaderRow = (row: BNode | undefined) => !!row?.content?.length && row.content.every((c) => c.type === "tableHeader");

/** Đặt từng ô vào lưới (bỏ qua chỗ đã bị ô gộp phía trên chiếm). */
function toGrid(table: BNode): Grid {
  const taken = new Set<string>();
  const cells: GridCell[] = [];
  (table.content ?? []).forEach((row, r) => {
    let c = 0;
    for (const node of row.content ?? []) {
      while (taken.has(`${r}:${c}`)) c++;
      const g: GridCell = { node, r, c, rs: span(node.attrs.rowspan), cs: span(node.attrs.colspan) };
      for (let i = 0; i < g.rs; i++) for (let j = 0; j < g.cs; j++) taken.add(`${r + i}:${c + j}`);
      cells.push(g);
      c += g.cs;
    }
  });
  return { cells, rows: table.content ?? [] };
}
const gridWidth = (g: Grid) => Math.max(1, ...g.cells.map((x) => x.c + x.cs));
const gridHeight = (g: Grid) => Math.max(g.rows.length, ...g.cells.map((x) => x.r + x.rs));
const covers = (x: GridCell, r: number, c: number) => r >= x.r && r < x.r + x.rs && c >= x.c && c < x.c + x.cs;
const at = (g: Grid, r: number, c: number) => g.cells.find((x) => covers(x, r, c));

/** Lưới → bảng: chỗ trống được lấp bằng ô mới để mọi hàng đủ cột; ô gộp vượt quá bảng được cắt lại. */
function fromGrid(table: BNode, g: Grid): BNode {
  const h = gridHeight(g), w = gridWidth(g);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (!at(g, r, c)) g.cells.push({ node: emptyCell(isHeaderRow(g.rows[r])), r, c, rs: 1, cs: 1 });
  }
  const rows: BNode[] = [];
  for (let r = 0; r < h; r++) {
    const content = g.cells.filter((x) => x.r === r).sort((a, b) => a.c - b.c).map((x) => {
      const attrs = { ...x.node.attrs };
      const rs = Math.min(x.rs, h - x.r), cs = Math.min(x.cs, w - x.c);
      if (rs > 1) attrs.rowspan = rs; else delete attrs.rowspan;
      if (cs > 1) attrs.colspan = cs; else delete attrs.colspan;
      return { ...x.node, attrs };
    });
    rows.push({ ...(g.rows[r] ?? makeBlock("tableRow")), content });
  }
  return { ...table, content: rows.filter((r) => r.content!.length) };
}

/** Ô đang thao tác trong lưới. */
const current = (g: Grid, ctx: TableContext) => g.cells.find((x) => x.node === g.rows[ctx.row]?.content?.[ctx.col]) ?? g.cells[0];

function replaceTable(store: EditorStore, ctx: TableContext, next: BNode | null, focusCell?: BNode) {
  if (!next || !next.content?.length) { store.remove([ctx.table.id]); return; }
  const target = focusCell?.content?.[0];
  store.replace(ctx.table.id, [next], target?.inline ? { select: { ids: [], editing: target.id }, caret: { id: target.id, offset: 0 } } : undefined);
}

// ---------------------------------------------------------------------------
// Hàng / cột
// ---------------------------------------------------------------------------
export function addRow(store: EditorStore, ctx: TableContext, after: boolean) {
  const g = toGrid(ctx.table);
  const cur = current(g, ctx);
  const row = after ? cur.r + cur.rs : cur.r;
  for (const x of g.cells) {
    if (x.r >= row) x.r++;
    else if (x.r + x.rs > row) x.rs++; // ô gộp đi qua chỗ chèn → cao thêm một hàng
  }
  g.rows = [...g.rows.slice(0, row), makeBlock("tableRow"), ...g.rows.slice(row)];
  const next = fromGrid(ctx.table, g);
  replaceTable(store, ctx, next, at(toGrid(next), row, cur.c)?.node);
}

export function addColumn(store: EditorStore, ctx: TableContext, after: boolean) {
  const g = toGrid(ctx.table);
  const cur = current(g, ctx);
  const col = after ? cur.c + cur.cs : cur.c;
  for (const x of g.cells) {
    if (x.c >= col) x.c++;
    else if (x.c + x.cs > col) x.cs++;
  }
  const next = fromGrid(ctx.table, g);
  replaceTable(store, ctx, next, at(toGrid(next), cur.r, col)?.node);
}

export function deleteRow(store: EditorStore, ctx: TableContext) {
  const g = toGrid(ctx.table);
  const row = current(g, ctx).r;
  g.cells = g.cells.flatMap((x) => {
    if (x.r === row) return x.rs > 1 ? [{ ...x, rs: x.rs - 1 }] : []; // ô gộp bắt đầu ở hàng bị xoá: dời xuống hàng sau
    if (x.r < row && x.r + x.rs > row) return [{ ...x, rs: x.rs - 1 }];
    return [x.r > row ? { ...x, r: x.r - 1 } : x];
  });
  g.rows = g.rows.filter((_, i) => i !== row);
  if (!g.rows.length || !g.cells.length) return replaceTable(store, ctx, null);
  const next = fromGrid(ctx.table, g);
  replaceTable(store, ctx, next, at(toGrid(next), Math.min(row, next.content!.length - 1), 0)?.node);
}

export function deleteColumn(store: EditorStore, ctx: TableContext) {
  const g = toGrid(ctx.table);
  const col = current(g, ctx).c;
  g.cells = g.cells.flatMap((x) => {
    if (x.c === col) return x.cs > 1 ? [{ ...x, cs: x.cs - 1 }] : [];
    if (x.c < col && x.c + x.cs > col) return [{ ...x, cs: x.cs - 1 }];
    return [x.c > col ? { ...x, c: x.c - 1 } : x];
  });
  if (!g.cells.length) return replaceTable(store, ctx, null);
  const next = fromGrid(ctx.table, g);
  const ng = toGrid(next);
  replaceTable(store, ctx, next, at(ng, 0, Math.max(0, Math.min(col, gridWidth(ng) - 1)))?.node);
}

// ---------------------------------------------------------------------------
// Gộp / tách ô
// ---------------------------------------------------------------------------
const hasContent = (n: BNode) => (n.content ?? []).some((b) => !b.inline || b.inline.length > 0);
/** Nội dung ô bị gộp nối vào ô giữ lại (ô trống thì bỏ). */
const absorb = (keep: BNode, gone: BNode): BNode =>
  hasContent(gone) ? { ...keep, content: [...(hasContent(keep) ? keep.content ?? [] : []), ...(gone.content ?? [])] } : keep;

/** Ô kế bên phải / bên dưới gộp được (thẳng hàng, cùng chiều cao / chiều rộng). */
function neighbor(g: Grid, cur: GridCell, dir: "right" | "down"): GridCell | null {
  const n = dir === "right" ? at(g, cur.r, cur.c + cur.cs) : at(g, cur.r + cur.rs, cur.c);
  if (!n) return null;
  return dir === "right" ? (n.r === cur.r && n.rs === cur.rs ? n : null) : (n.c === cur.c && n.cs === cur.cs ? n : null);
}
export const canMerge = (ctx: TableContext, dir: "right" | "down") => { const g = toGrid(ctx.table); return !!neighbor(g, current(g, ctx), dir); };
export const canSplit = (ctx: TableContext) => { const c = current(toGrid(ctx.table), ctx); return c.rs > 1 || c.cs > 1; };

export function mergeCells(store: EditorStore, ctx: TableContext, dir: "right" | "down") {
  const g = toGrid(ctx.table);
  const cur = current(g, ctx);
  const n = neighbor(g, cur, dir);
  if (!n) return;
  const merged: GridCell = { ...cur, node: absorb(cur.node, n.node), cs: dir === "right" ? cur.cs + n.cs : cur.cs, rs: dir === "down" ? cur.rs + n.rs : cur.rs };
  g.cells = g.cells.filter((x) => x !== cur && x !== n).concat(merged);
  replaceTable(store, ctx, fromGrid(ctx.table, g), merged.node);
}

export function splitCell(store: EditorStore, ctx: TableContext) {
  const g = toGrid(ctx.table);
  const cur = current(g, ctx);
  if (cur.rs === 1 && cur.cs === 1) return;
  cur.rs = 1;
  cur.cs = 1; // chỗ trống được fromGrid lấp bằng ô mới
  replaceTable(store, ctx, fromGrid(ctx.table, g), cur.node);
}

/** Bật / tắt hàng tiêu đề (hàng đầu toàn ô tiêu đề → website vẽ <thead>). */
export function toggleHeaderRow(store: EditorStore, ctx: TableContext) {
  const [first, ...rest] = ctx.table.content!;
  const header = isHeaderRow(first);
  const flipped = { ...first, content: first.content!.map((c) => ({ ...c, type: header ? "tableCell" : "tableHeader" })) };
  replaceTable(store, ctx, { ...ctx.table, content: [flipped, ...rest] });
}
export const hasHeaderRow = (t: BNode) => isHeaderRow(t.content![0]);

/** Bảng lệch (ô gộp mà chưa bỏ ô bị che — dữ liệu cũ) → vuông vức lại. Bảng đã đúng giữ nguyên tham chiếu. */
export function normalizeTable(table: BNode): BNode {
  const g = toGrid(table);
  const h = gridHeight(g), w = gridWidth(g);
  let filled = 0;
  for (const x of g.cells) filled += x.rs * x.cs;
  return (table.content ?? []).length === h && filled === h * w ? table : fromGrid(table, g);
}

// ---------------------------------------------------------------------------
// Vùng ô (bôi đen nhiều ô: kéo chuột / Shift+bấm) — như chọn ô của WordPress / Google Docs
// ---------------------------------------------------------------------------
export interface CellRect { r0: number; c0: number; r1: number; c1: number }

/** Bảng chứa ô (khối tableCell / tableHeader) + id ô. */
export function cellTable(store: EditorStore, cellId: string): { table: BNode; docId: string } | null {
  const cell = store.locate(cellId);
  if (!cell || (cell.block.type !== "tableCell" && cell.block.type !== "tableHeader")) return null;
  const row = cell.parent && store.locate(cell.parent.id);
  return row?.parent?.type === "table" ? { table: row.parent, docId: cell.docId } : null;
}

/** Hình chữ nhật nhỏ nhất phủ hai ô, nới ra cho tới khi không cắt ngang ô gộp nào. */
export function cellRect(table: BNode, aId: string, bId: string): CellRect | null {
  const g = toGrid(table);
  const a = g.cells.find((x) => x.node.id === aId), b = g.cells.find((x) => x.node.id === bId);
  if (!a || !b) return null;
  const r: CellRect = { r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r + a.rs, b.r + b.rs) - 1, c1: Math.max(a.c + a.cs, b.c + b.cs) - 1 };
  for (let changed = true; changed;) {
    changed = false;
    for (const x of g.cells) {
      const inter = x.r <= r.r1 && x.r + x.rs - 1 >= r.r0 && x.c <= r.c1 && x.c + x.cs - 1 >= r.c0;
      if (!inter) continue;
      const n = { r0: Math.min(r.r0, x.r), c0: Math.min(r.c0, x.c), r1: Math.max(r.r1, x.r + x.rs - 1), c1: Math.max(r.c1, x.c + x.cs - 1) };
      if (n.r0 !== r.r0 || n.c0 !== r.c0 || n.r1 !== r.r1 || n.c1 !== r.c1) { Object.assign(r, n); changed = true; }
    }
  }
  return r;
}

/** Ô nằm trong vùng (theo thứ tự hàng rồi cột). */
export function cellsInRect(table: BNode, rect: CellRect): BNode[] {
  return toGrid(table).cells.filter((x) => x.r >= rect.r0 && x.r <= rect.r1 && x.c >= rect.c0 && x.c <= rect.c1)
    .sort((a, b) => a.r - b.r || a.c - b.c).map((x) => x.node);
}

/** Vùng của các ô đang chọn (cùng một bảng) — null nếu không phải. */
export function selectedCellRect(store: EditorStore, ids: string[]): { table: BNode; docId: string; rect: CellRect } | null {
  if (!ids.length) return null;
  const t = cellTable(store, ids[0]);
  if (!t || ids.some((id) => cellTable(store, id)?.table.id !== t.table.id)) return null;
  let rect: CellRect | null = null;
  for (const id of ids) {
    const r = cellRect(t.table, ids[0], id);
    if (!r) return null;
    rect = rect ? { r0: Math.min(rect.r0, r.r0), c0: Math.min(rect.c0, r.c0), r1: Math.max(rect.r1, r.r1), c1: Math.max(rect.c1, r.c1) } : r;
  }
  return { ...t, rect: rect! };
}

/** Gộp cả vùng thành một ô (ô trên-trái giữ lại, nội dung các ô khác nối vào theo thứ tự). */
export function mergeRange(store: EditorStore, table: BNode, docId: string, rect: CellRect) {
  const g = toGrid(table);
  const inside = g.cells.filter((x) => x.r >= rect.r0 && x.r <= rect.r1 && x.c >= rect.c0 && x.c <= rect.c1).sort((a, b) => a.r - b.r || a.c - b.c);
  if (inside.length < 2) return;
  const [keep, ...rest] = inside;
  const merged: GridCell = { ...keep, node: rest.reduce((n, x) => absorb(n, x.node), keep.node), rs: rect.r1 - rect.r0 + 1, cs: rect.c1 - rect.c0 + 1 };
  g.cells = g.cells.filter((x) => !inside.includes(x)).concat(merged);
  replaceTable(store, { table, row: 0, col: 0, docId }, fromGrid(table, g), merged.node);
}

/** Xoá chữ trong các ô (giữ ô, mỗi ô còn một đoạn trống). */
export function clearCells(store: EditorStore, table: BNode, ids: string[]) {
  const set = new Set(ids);
  const next = { ...table, content: (table.content ?? []).map((row) => ({ ...row, content: (row.content ?? []).map((c) => (set.has(c.id) ? { ...c, content: [makeBlock("paragraph")] } : c)) })) };
  store.replace(table.id, [next], { select: { ids: [], editing: null } });
}
