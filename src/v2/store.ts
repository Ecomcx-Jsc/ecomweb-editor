import type { RichNode } from "@ecomcx/ecomweb-content";
import { cloneBlock, inlineLength, joinInline, kindOf, makeBlock, splitInline, type BNode } from "./model";
import { findBlock, flatten, insertBlocks, mapBlock, moveBlocks, removeBlocks, setAttrs, sibling, topLevelOrdered, type Location } from "./ops";
import { canContain, fixTree } from "./structure";

/**
 * Store của trình soạn: nhiều tài liệu cùng lúc (bài/template đang mở + header, footer, mẫu đồng bộ lồng bên trong),
 * một lịch sử hoàn tác chung xuyên tài liệu, vùng chọn khối, yêu cầu đặt con trỏ cho khối chữ.
 * Không phụ thuộc React — React đọc qua useSyncExternalStore (hooks.ts).
 */
export type EditingMode = "default" | "contentOnly" | "disabled";

export interface DocRecord {
  id: string;
  /** Loại tài liệu của ứng dụng: post, template, part, pattern… */
  kind: string;
  /** Tham chiếu của ứng dụng (slug phần dùng chung, id mẫu…). */
  ref?: unknown;
  title?: string;
  blocks: BNode[];
  /** Bản đã lưu — `blocks !== saved` là có thay đổi chưa lưu. */
  saved: BNode[];
  status: "loading" | "ready" | "error";
  error?: string;
  mode: EditingMode;
}

/** Yêu cầu đặt con trỏ: khối chữ đọc rồi xoá (consumeCaret). */
export interface Caret {
  id: string;
  /** Vị trí ký tự; -1 = cuối. `to` có = chọn đoạn [offset, to]. */
  offset: number;
  to?: number;
}

export interface Selection {
  /** Các khối đang chọn (chọn khối, không phải chọn chữ). Rỗng = không chọn. */
  ids: string[];
  /** Khối đang gõ chữ (chọn ngầm) — thanh công cụ, bảng cài đặt dùng khối này khi ids rỗng. */
  editing: string | null;
}

export interface EditorState {
  docs: Record<string, DocRecord>;
  rootId: string;
  /** Chế độ tập trung: tài liệu đang sửa riêng (đỉnh ngăn xếp), rỗng = tài liệu gốc. */
  focus: string[];
  selection: Selection;
  caret: Caret | null;
  /** Tăng mỗi lần thay đổi nội dung (để UI biết cần đo lại vị trí). */
  revision: number;
}

interface Change { docId: string; before: BNode[]; after: BNode[] }
interface HistoryEntry {
  changes: Change[];
  selBefore: Selection;
  selAfter: Selection;
  caretBefore: Caret | null;
  caretAfter: Caret | null;
  key?: string;
  time: number;
}

export interface CommitOptions {
  /** Gộp với lần sửa trước cùng khoá trong 1 giây (gõ chữ liên tục = một lần hoàn tác). */
  merge?: string;
  /** Không ghi lịch sử (nạp tài liệu, đồng bộ từ ngoài). */
  history?: false;
  select?: Partial<Selection>;
  caret?: Caret | null;
}

const MERGE_MS = 1000;
const HISTORY_LIMIT = 300;
const emptySel: Selection = { ids: [], editing: null };

export class EditorStore {
  private state: EditorState;
  private listeners = new Set<() => void>();
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private batchDepth = 0;
  private pending: HistoryEntry | null = null;

  constructor(root: { id?: string; kind?: string; ref?: unknown; title?: string; blocks: BNode[] }) {
    const id = root.id ?? "root";
    const blocks = fixTree(root.blocks);
    this.state = {
      docs: { [id]: { id, kind: root.kind ?? "post", ref: root.ref, title: root.title, blocks, saved: blocks, status: "ready", mode: "default" } },
      rootId: id,
      focus: [],
      selection: emptySel,
      caret: null,
      revision: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Đọc / theo dõi
  // -------------------------------------------------------------------------
  getState = (): EditorState => this.state;
  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  private emit() { this.listeners.forEach((l) => l()); }
  private set(next: Partial<EditorState>) { this.state = { ...this.state, ...next }; this.emit(); }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  doc(id: string): DocRecord | undefined { return this.state.docs[id]; }
  /** Tài liệu đang hiện trên khung soạn (chế độ tập trung hoặc gốc). */
  get activeDocId() { return this.state.focus[this.state.focus.length - 1] ?? this.state.rootId; }

  /** Tìm khối trong mọi tài liệu. */
  locate(id: string): (Location & { docId: string }) | null {
    for (const d of Object.values(this.state.docs)) {
      const loc = findBlock(d.blocks, id);
      if (loc) return { ...loc, docId: d.id };
    }
    return null;
  }
  block(id: string): BNode | null { return this.locate(id)?.block ?? null; }

  /** Khối đang thao tác: chọn khối hoặc khối đang gõ chữ. */
  get currentIds(): string[] {
    const s = this.state.selection;
    return s.ids.length ? s.ids : s.editing ? [s.editing] : [];
  }

  isDirty(docId?: string) {
    const docs = docId ? [this.state.docs[docId]].filter(Boolean) : Object.values(this.state.docs);
    return docs.some((d) => d.blocks !== d.saved);
  }
  dirtyDocs(): DocRecord[] { return Object.values(this.state.docs).filter((d) => d.blocks !== d.saved); }

  /** Khối có sửa được không (theo chế độ của tài liệu chứa nó). */
  modeOf(blockId: string): EditingMode {
    const loc = this.locate(blockId);
    return loc ? this.state.docs[loc.docId].mode : "disabled";
  }

  // -------------------------------------------------------------------------
  // Tài liệu lồng nhau
  // -------------------------------------------------------------------------
  /** Thêm / thay tài liệu (vd ứng dụng vừa tải xong header). Không ghi lịch sử. */
  putDoc(doc: Partial<DocRecord> & { id: string; kind: string }) {
    const prev = this.state.docs[doc.id];
    const blocks = doc.blocks ? fixTree(doc.blocks) : prev?.blocks ?? [];
    const rec: DocRecord = {
      id: doc.id, kind: doc.kind, ref: doc.ref ?? prev?.ref, title: doc.title ?? prev?.title,
      blocks, saved: doc.blocks ? blocks : prev?.saved ?? blocks,
      status: doc.status ?? "ready", error: doc.error, mode: doc.mode ?? prev?.mode ?? "default",
    };
    this.set({ docs: { ...this.state.docs, [doc.id]: rec }, revision: this.state.revision + 1 });
  }
  setDocMode(docId: string, mode: EditingMode) {
    const d = this.state.docs[docId];
    if (d && d.mode !== mode) this.set({ docs: { ...this.state.docs, [docId]: { ...d, mode } } });
  }
  /** Đánh dấu đã lưu (sau khi ứng dụng lưu xong). `blocks` = bản đã gửi đi — sửa tiếp trong lúc lưu vẫn tính là chưa lưu. */
  markSaved(docId: string, blocks?: BNode[]) {
    const d = this.state.docs[docId];
    if (d) this.set({ docs: { ...this.state.docs, [docId]: { ...d, saved: blocks ?? d.blocks } } });
  }

  enterFocus(docId: string) {
    if (!this.state.docs[docId] || this.activeDocId === docId) return;
    this.set({ focus: [...this.state.focus, docId], selection: emptySel, caret: null });
  }
  exitFocus() {
    if (this.state.focus.length) this.set({ focus: this.state.focus.slice(0, -1), selection: emptySel, caret: null });
  }

  // -------------------------------------------------------------------------
  // Ghi thay đổi + lịch sử
  // -------------------------------------------------------------------------
  /** Gom nhiều thao tác thành một lần hoàn tác. */
  batch<T>(fn: () => T): T {
    this.batchDepth++;
    try { return fn(); } finally {
      if (--this.batchDepth === 0 && this.pending) { this.pushHistory(this.pending); this.pending = null; }
    }
  }

  /** Thay toàn bộ khối của một tài liệu. */
  commit(docId: string, blocks: BNode[], opts: CommitOptions = {}) {
    const d = this.state.docs[docId];
    if (!d || d.mode === "disabled") return;
    const fixed = fixTree(blocks);
    const selection = opts.select ? { ...this.state.selection, ...opts.select } : this.state.selection;
    const caret = opts.caret !== undefined ? opts.caret : this.state.caret;
    if (fixed === d.blocks) {
      if (selection !== this.state.selection || caret !== this.state.caret) this.set({ selection, caret });
      return;
    }
    if (opts.history !== false) {
      const entry: HistoryEntry = {
        changes: [{ docId, before: d.blocks, after: fixed }], selBefore: this.state.selection, selAfter: selection,
        caretBefore: this.caretFor(this.state.selection), caretAfter: caret, key: opts.merge, time: Date.now(),
      };
      if (this.batchDepth) {
        if (!this.pending) this.pending = entry;
        else this.mergeInto(this.pending, entry);
      } else this.pushHistory(entry);
    }
    this.set({ docs: { ...this.state.docs, [docId]: { ...d, blocks: fixed } }, selection, caret, revision: this.state.revision + 1 });
  }

  private caretFor(sel: Selection): Caret | null {
    return sel.editing ? (this.lastCaret?.id === sel.editing ? this.lastCaret : { id: sel.editing, offset: -1 }) : null;
  }
  /** Vị trí con trỏ gần nhất do khối chữ báo lên (để hoàn tác trả con trỏ về đúng chỗ). */
  private lastCaret: Caret | null = null;
  reportCaret(c: Caret | null) { this.lastCaret = c; }

  private mergeInto(into: HistoryEntry, e: HistoryEntry) {
    for (const c of e.changes) {
      const same = into.changes.find((x) => x.docId === c.docId);
      if (same) same.after = c.after;
      else into.changes.push(c);
    }
    into.selAfter = e.selAfter;
    into.caretAfter = e.caretAfter;
    into.time = e.time;
  }

  private pushHistory(e: HistoryEntry) {
    const last = this.undoStack[this.undoStack.length - 1];
    if (e.key && last && last.key === e.key && e.time - last.time < MERGE_MS) this.mergeInto(last, e);
    else {
      this.undoStack.push(e);
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    }
    this.redoStack = [];
  }

  /** Ngắt gộp: lần sửa sau thành một bước hoàn tác mới (vd sau khi di chuyển con trỏ). */
  breakMerge() { const last = this.undoStack[this.undoStack.length - 1]; if (last) last.key = undefined; }

  undo() { this.travel(this.undoStack, this.redoStack, "before"); }
  redo() { this.travel(this.redoStack, this.undoStack, "after"); }
  private travel(from: HistoryEntry[], to: HistoryEntry[], side: "before" | "after") {
    const e = from.pop();
    if (!e) return;
    to.push(e);
    const docs = { ...this.state.docs };
    for (const c of e.changes) if (docs[c.docId]) docs[c.docId] = { ...docs[c.docId], blocks: side === "before" ? c.before : c.after };
    this.state = {
      ...this.state, docs,
      selection: side === "before" ? e.selBefore : e.selAfter,
      caret: side === "before" ? e.caretBefore : e.caretAfter,
      revision: this.state.revision + 1,
    };
    this.emit();
  }

  // -------------------------------------------------------------------------
  // Vùng chọn + con trỏ
  // -------------------------------------------------------------------------
  select(ids: string[], opts: { editing?: string | null } = {}) {
    const selection: Selection = { ids, editing: opts.editing !== undefined ? opts.editing : ids.length ? null : this.state.selection.editing };
    if (sameSel(selection, this.state.selection)) return;
    this.set({ selection });
  }
  /** Khối chữ báo đang được gõ (focus). */
  setEditing(id: string | null) {
    const s = this.state.selection;
    if (s.editing === id && !s.ids.length) return;
    this.set({ selection: { ids: [], editing: id } });
  }
  clearSelection() { if (this.state.selection.ids.length || this.state.selection.editing) this.set({ selection: emptySel }); }
  /** Shift+bấm: chọn dải khối cùng cha từ khối đang chọn tới `id`. */
  selectRange(id: string) {
    const anchor = this.currentIds[0];
    if (!anchor) return this.select([id]);
    const a = this.locate(anchor), b = this.locate(id);
    if (!a || !b || a.docId !== b.docId) return this.select([id]);
    // Đưa về cùng cấp: leo lên tổ tiên chung
    const pa = [...a.ancestors, a.block.id], pb = [...b.ancestors, b.block.id];
    let i = 0;
    while (i < pa.length && i < pb.length && pa[i] === pb[i]) i++;
    if (i >= pa.length || i >= pb.length) return this.select([pa[Math.min(i, pa.length) - 1] ?? id]);
    const ia = this.locate(pa[i])!, ib = this.locate(pb[i])!;
    const list = ia.parent ? ia.parent.content! : this.state.docs[a.docId].blocks;
    const [lo, hi] = ia.index <= ib.index ? [ia.index, ib.index] : [ib.index, ia.index];
    this.select(list.slice(lo, hi + 1).map((x) => x.id));
  }
  focusText(id: string, offset = -1, to?: number) { this.set({ caret: { id, offset, to }, selection: { ids: [], editing: id } }); }
  consumeCaret(id: string): Caret | null {
    const c = this.state.caret;
    if (!c || c.id !== id) return null;
    this.state = { ...this.state, caret: null };
    return c;
  }

  // -------------------------------------------------------------------------
  // Thao tác khối
  // -------------------------------------------------------------------------
  private edit(blockId: string, fn: (blocks: BNode[], loc: Location) => BNode[] | null, opts: CommitOptions = {}) {
    const loc = this.locate(blockId);
    if (!loc || this.state.docs[loc.docId].mode === "disabled") return false;
    const next = fn(this.state.docs[loc.docId].blocks, loc);
    if (!next) return false;
    this.commit(loc.docId, next, opts);
    return true;
  }

  setInline(id: string, inline: RichNode[], caret?: Caret) {
    if (caret) this.lastCaret = caret;
    this.edit(id, (blocks) => mapBlock(blocks, id, (b) => ({ ...b, inline })), { merge: `text:${id}` });
  }

  setAttrs(ids: string[], attrs: Record<string, unknown>) {
    this.batch(() => { for (const id of ids) this.edit(id, (blocks) => setAttrs(blocks, id, attrs), { merge: `attrs:${id}:${Object.keys(attrs).join(",")}` }); });
  }

  /** Đổi loại khối (đoạn ↔ tiêu đề…), giữ nội dung. */
  setType(ids: string[], type: string, attrs: Record<string, unknown> = {}) {
    this.batch(() => {
      for (const id of ids) this.edit(id, (blocks) => mapBlock(blocks, id, (b) => ({ ...b, type, attrs: { ...keepCommon(b.attrs), ...attrs } })));
    });
  }

  replace(id: string, nodes: BNode[], opts: CommitOptions = {}) {
    return this.edit(id, (blocks) => mapBlock(blocks, id, () => nodes), opts);
  }

  insert(docId: string, parentId: string | null, index: number, nodes: BNode[], opts: { select?: boolean; focus?: boolean } = {}) {
    const d = this.state.docs[docId];
    if (!d || d.mode === "disabled" || !nodes.length) return;
    const first = nodes[0];
    const focusId = opts.focus !== false ? firstText(first) : null;
    this.commit(docId, insertBlocks(d.blocks, parentId, index, nodes), {
      select: focusId ? { ids: [], editing: focusId } : opts.select !== false ? { ids: nodes.map((n) => n.id), editing: null } : undefined,
      caret: focusId ? { id: focusId, offset: 0 } : null,
    });
  }

  /** Chèn sau khối `afterId` (cùng cha); khối rỗng là đoạn văn trống thì thay luôn đoạn đó. */
  insertAfter(afterId: string, nodes: BNode[], opts: { replaceEmpty?: boolean; select?: boolean; focus?: boolean } = {}) {
    const loc = this.locate(afterId);
    if (!loc) return;
    const target = loc.block;
    if (opts.replaceEmpty !== false && target.type === "paragraph" && !inlineLength(target.inline) && canContain(loc.parent?.type ?? null, nodes[0].type)) {
      const focusId = opts.focus !== false ? firstText(nodes[0]) : null;
      this.commit(loc.docId, mapBlock(this.state.docs[loc.docId].blocks, afterId, () => nodes), {
        select: focusId ? { ids: [], editing: focusId } : { ids: nodes.map((n) => n.id), editing: null },
        caret: focusId ? { id: focusId, offset: 0 } : null,
      });
      return;
    }
    // Khối không đặt được ở cấp này (vd chèn nhóm sau một listItem): leo lên tới cấp đặt được
    let at: Location & { docId: string } = loc;
    while (at.parent && !canContain(at.parent.type, nodes[0].type)) {
      const up = this.locate(at.parent.id);
      if (!up) break;
      at = up;
    }
    this.insert(loc.docId, at.parent?.id ?? null, at.index + 1, nodes, opts);
  }

  remove(ids: string[], opts: { focusNeighbor?: boolean } = {}) {
    if (!ids.length) return;
    const loc = this.locate(ids[0]);
    if (!loc) return;
    const doc = this.state.docs[loc.docId];
    if (doc.mode === "disabled") return;
    const ordered = topLevelOrdered(doc.blocks, ids);
    // Sau khi xoá: con trỏ về cuối khối chữ ngay trước (hoặc đầu khối sau)
    const order = flatten(doc.blocks).filter((b) => b.inline && !ordered.some((id) => id === b.id || this.locate(b.id)?.ancestors.includes(id)));
    const firstIdx = flatten(doc.blocks).findIndex((b) => b.id === ordered[0]);
    const all = flatten(doc.blocks);
    const before = order.filter((b) => all.indexOf(b) < firstIdx).pop();
    const after = order.find((b) => all.indexOf(b) > firstIdx);
    const target = before ?? after;
    const next = removeBlocks(doc.blocks, ordered);
    this.commit(loc.docId, next, opts.focusNeighbor !== false && target
      ? { select: { ids: [], editing: target.id }, caret: { id: target.id, offset: before ? -1 : 0 } }
      : { select: emptySel, caret: null });
  }

  duplicate(ids: string[]) {
    const loc = this.locate(ids[0]);
    if (!loc) return;
    const doc = this.state.docs[loc.docId];
    const ordered = topLevelOrdered(doc.blocks, ids);
    const last = this.locate(ordered[ordered.length - 1])!;
    const copies = ordered.map((id) => cloneBlock(this.locate(id)!.block));
    this.commit(loc.docId, insertBlocks(doc.blocks, last.parent?.id ?? null, last.index + 1, copies), { select: { ids: copies.map((c) => c.id), editing: null }, caret: null });
  }

  /** Lên / xuống một bậc trong cùng cha. */
  moveBy(ids: string[], dir: -1 | 1) {
    const loc = this.locate(ids[0]);
    if (!loc) return false;
    const doc = this.state.docs[loc.docId];
    const ordered = topLevelOrdered(doc.blocks, ids);
    const locs = ordered.map((id) => this.locate(id)!);
    const parentId = locs[0].parent?.id ?? null;
    if (locs.some((l) => (l.parent?.id ?? null) !== parentId)) return false;
    const list = locs[0].parent ? locs[0].parent.content! : doc.blocks;
    const lo = Math.min(...locs.map((l) => l.index)), hi = Math.max(...locs.map((l) => l.index));
    if ((dir < 0 && lo === 0) || (dir > 0 && hi === list.length - 1)) return false;
    const next = moveBlocks(doc.blocks, ordered, parentId, dir < 0 ? lo - 1 : hi + 2);
    this.commit(loc.docId, next, { caret: this.state.selection.editing ? this.lastCaret : null });
    return true;
  }

  /** Kéo thả: di chuyển tới (parentId, index) — có thể sang tài liệu khác. */
  moveTo(ids: string[], docId: string, parentId: string | null, index: number) {
    const src = this.locate(ids[0]);
    if (!src) return;
    const target = this.state.docs[docId];
    if (!target || target.mode === "disabled") return;
    if (src.docId === docId) {
      this.commit(docId, moveBlocks(target.blocks, ids, parentId, index), { select: { ids: topLevelOrdered(target.blocks, ids), editing: null }, caret: null });
      return;
    }
    const srcDoc = this.state.docs[src.docId];
    const ordered = topLevelOrdered(srcDoc.blocks, ids);
    const nodes = ordered.map((id) => this.locate(id)!.block);
    this.batch(() => {
      this.commit(src.docId, removeBlocks(srcDoc.blocks, ordered));
      this.commit(docId, insertBlocks(this.state.docs[docId].blocks, parentId, index, nodes), { select: { ids: ordered, editing: null }, caret: null });
    });
  }

  /** Bọc các khối vào một khối chứa (nhóm, cột…). */
  wrap(ids: string[], type: string, attrs: Record<string, unknown> = {}) {
    const loc = this.locate(ids[0]);
    if (!loc) return;
    const doc = this.state.docs[loc.docId];
    const ordered = topLevelOrdered(doc.blocks, ids);
    const first = this.locate(ordered[0])!;
    const nodes = ordered.map((id) => this.locate(id)!.block);
    const wrapper = makeBlock(type, attrs, nodes);
    const next = insertBlocks(removeBlocks(doc.blocks, ordered), first.parent?.id ?? null, first.index, [wrapper]);
    this.commit(loc.docId, next, { select: { ids: [wrapper.id], editing: null }, caret: null });
  }

  /** Bỏ vỏ: đưa con ra thay chỗ khối chứa. */
  unwrap(id: string) {
    this.edit(id, (blocks, loc) => (loc.block.content ? mapBlock(blocks, id, (b) => b.content ?? []) : null), {
      select: { ids: this.block(id)?.content?.map((c) => c.id) ?? [], editing: null }, caret: null,
    });
  }

  // -------------------------------------------------------------------------
  // Gõ chữ: Enter, Backspace, Delete
  // -------------------------------------------------------------------------
  /** Enter trong khối chữ tại vị trí `offset`. */
  splitText(id: string, offset: number, selectionEnd = offset) {
    const loc = this.locate(id);
    if (!loc || !loc.block.inline) return;
    const b = loc.block;
    const docId = loc.docId;
    let inline = b.inline!;
    if (selectionEnd > offset) inline = joinInline(splitInline(inline, offset)[0], splitInline(inline, selectionEnd)[1]);
    const len = inlineLength(inline);
    const item = loc.parent && (loc.parent.type === "listItem" || loc.parent.type === "taskItem") && loc.index === 0 ? this.locate(loc.parent.id) : null;

    if (item) {
      // Mục danh sách trống: thụt ra (lồng) hoặc thoát khỏi danh sách
      if (!len && item.block.content!.length === 1) return this.outdentItem(item.block.id, true);
      const [before, after] = splitInline(inline, offset);
      const para = makeBlock("paragraph", {}, after);
      const newItem = makeBlock(item.block.type, item.block.type === "taskItem" ? { checked: false } : {}, [para]);
      const blocks = this.state.docs[docId].blocks;
      let next = mapBlock(blocks, id, (x) => ({ ...x, inline: before }));
      next = insertBlocks(next, item.parent!.id, item.index + 1, [newItem]);
      this.commit(docId, next, { select: { ids: [], editing: para.id }, caret: { id: para.id, offset: 0 } });
      return;
    }

    // Đoạn trống trong khối chứa (trích dẫn, nhóm) ở cuối: Enter lần nữa thì thoát ra ngoài khối chứa
    if (!len && loc.parent && ESCAPE_CONTAINERS.has(loc.parent.type) && loc.index === loc.parent.content!.length - 1 && loc.index > 0) {
      const parent = this.locate(loc.parent.id)!;
      const blocks = removeBlocks(this.state.docs[docId].blocks, [id]);
      const p = makeBlock("paragraph");
      this.commit(docId, insertBlocks(blocks, parent.parent?.id ?? null, parent.index + 1, [p]), { select: { ids: [], editing: p.id }, caret: { id: p.id, offset: 0 } });
      return;
    }

    const [before, after] = splitInline(inline, offset);
    const atEnd = !inlineLength(after);
    const nextType = atEnd ? SPLIT_AS[b.type] ?? "paragraph" : b.type;
    const nextAttrs = nextType === b.type ? keepOnSplit(b.attrs) : {};
    const created = makeBlock(nextType, nextAttrs, after);
    let blocks = mapBlock(this.state.docs[docId].blocks, id, (x) => ({ ...x, inline: before }));
    blocks = insertBlocks(blocks, loc.parent?.id ?? null, loc.index + 1, [created]);
    this.commit(docId, blocks, { select: { ids: [], editing: created.id }, caret: { id: created.id, offset: 0 } });
  }

  /** Backspace ở đầu khối chữ. */
  mergeBackward(id: string) {
    const loc = this.locate(id);
    if (!loc || !loc.block.inline) return;
    const docId = loc.docId;
    const blocks = this.state.docs[docId].blocks;
    const b = loc.block;

    // Đầu mục danh sách: nối vào mục trước, hoặc (mục đầu) thụt ra
    if (loc.parent && (loc.parent.type === "listItem" || loc.parent.type === "taskItem") && loc.index === 0) {
      const item = this.locate(loc.parent.id)!;
      const prevItem = item.index > 0 ? item.parent!.content![item.index - 1] : null;
      if (!prevItem) return this.outdentItem(item.block.id, true);
      const target = lastText(prevItem);
      if (!target) return;
      const at = inlineLength(target.inline);
      let next = mapBlock(blocks, target.id, (t) => ({ ...t, inline: joinInline(t.inline ?? [], b.inline!) }));
      const rest = item.block.content!.slice(1);
      next = removeBlocks(next, [item.block.id]);
      if (rest.length) next = mapBlock(next, prevItem.id, (pi) => ({ ...pi, content: [...pi.content!, ...rest] }));
      this.commit(docId, next, { select: { ids: [], editing: target.id }, caret: { id: target.id, offset: at } });
      return;
    }

    // Khối chữ khác đoạn văn, trống → đổi thành đoạn văn trước (tiêu đề trống + Backspace = đoạn văn)
    if (b.type !== "paragraph" && !inlineLength(b.inline)) {
      this.commit(docId, mapBlock(blocks, id, (x) => ({ ...x, type: "paragraph", attrs: keepCommon(x.attrs) })), { caret: { id, offset: 0 } });
      return;
    }

    const prev = sibling(blocks, id, -1);
    if (!prev) {
      // Đầu khối chứa: trống và khối chứa còn khối khác → xoá; không thì đưa ra khỏi trích dẫn
      if (loc.parent && !inlineLength(b.inline) && loc.parent.content!.length > 1) return this.remove([id]);
      if (loc.parent && ESCAPE_CONTAINERS.has(loc.parent.type)) {
        const parent = this.locate(loc.parent.id)!;
        let next = removeBlocks(blocks, [id]);
        next = insertBlocks(next, parent.parent?.id ?? null, parent.index, [b]);
        this.commit(docId, next, { caret: { id, offset: 0 } });
      }
      return;
    }
    const target = kindOf(prev.type) === "text" ? prev : prev.content ? lastText(prev) : null;
    if (target && target.inline) {
      const at = inlineLength(target.inline);
      let next = mapBlock(blocks, target.id, (t) => ({ ...t, inline: joinInline(t.inline!, b.inline!) }));
      next = removeBlocks(next, [id]);
      this.commit(docId, next, { select: { ids: [], editing: target.id }, caret: { id: target.id, offset: at } });
      return;
    }
    // Trước là khối nguyên (ảnh…): khối hiện tại trống → xoá; rồi chọn khối nguyên đó
    if (!inlineLength(b.inline)) this.commit(docId, removeBlocks(blocks, [id]), { select: { ids: [prev.id], editing: null }, caret: null });
    else this.select([prev.id], { editing: null });
  }

  /** Delete ở cuối khối chữ. */
  mergeForward(id: string) {
    const loc = this.locate(id);
    if (!loc || !loc.block.inline) return;
    const docId = loc.docId;
    const blocks = this.state.docs[docId].blocks;
    const b = loc.block;
    const order = flatten(blocks);
    const i = order.findIndex((x) => x.id === id);
    // Khối kế tiếp theo thứ tự tài liệu không nằm trong khối hiện tại
    const next = order.slice(i + 1).find((x) => !this.locate(x.id)?.ancestors.includes(id));
    if (!next) return;
    const target = next.inline ? next : firstTextDeep(next);
    if (target) {
      const at = inlineLength(b.inline);
      let res = mapBlock(blocks, id, (x) => ({ ...x, inline: joinInline(x.inline!, target.inline!) }));
      res = removeBlocks(res, [target.id]);
      this.commit(docId, res, { caret: { id, offset: at } });
      return;
    }
    if (!inlineLength(b.inline)) this.remove([id], { focusNeighbor: false });
    this.select([next.id], { editing: null });
  }

  /** Tab trong danh sách: lồng mục vào mục trước. */
  indentItem(itemId: string) {
    const loc = this.locate(itemId);
    if (!loc || !loc.parent || loc.index === 0) return false;
    const prev = loc.parent.content![loc.index - 1];
    const listType = loc.parent.type;
    const caret = this.lastCaret;
    let blocks = removeBlocks(this.state.docs[loc.docId].blocks, [itemId]);
    blocks = mapBlock(blocks, prev.id, (pi) => {
      const kids = pi.content ?? [];
      const last = kids[kids.length - 1];
      if (last && (last.type === "bulletList" || last.type === "orderedList" || last.type === "taskList")) {
        return { ...pi, content: [...kids.slice(0, -1), { ...last, content: [...last.content!, loc.block] }] };
      }
      return { ...pi, content: [...kids, makeBlock(listType, {}, [loc.block])] };
    });
    this.commit(loc.docId, blocks, { caret });
    return true;
  }

  /** Shift+Tab (hoặc Enter ở mục trống): đưa mục ra một cấp; ở cấp ngoài cùng thì thành đoạn văn. */
  outdentItem(itemId: string, toParagraph = false) {
    const loc = this.locate(itemId);
    if (!loc || !loc.parent) return false;
    const list = this.locate(loc.parent.id)!;
    const outerItem = list.parent && (list.parent.type === "listItem" || list.parent.type === "taskItem") ? this.locate(list.parent.id) : null;
    const docId = loc.docId;
    const caret = this.lastCaret?.id === loc.block.content?.[0]?.id ? this.lastCaret : { id: loc.block.content![0].id, offset: 0 };
    let blocks = this.state.docs[docId].blocks;
    // Các mục sau mục này trong cùng danh sách đi theo (thành danh sách con của nó / danh sách mới)
    const siblingsAfter = list.block.content!.slice(loc.index + 1);
    blocks = mapBlock(blocks, list.block.id, (l) => ({ ...l, content: l.content!.slice(0, loc.index) }));
    if (outerItem) {
      const moved: BNode = siblingsAfter.length ? { ...loc.block, content: [...loc.block.content!, { ...makeBlock(list.block.type, list.block.attrs, siblingsAfter) }] } : loc.block;
      blocks = insertBlocks(blocks, outerItem.parent!.id, outerItem.index + 1, [moved]);
    } else if (toParagraph) {
      const tail = siblingsAfter.length ? [makeBlock(list.block.type, list.block.attrs, siblingsAfter)] : [];
      blocks = insertBlocks(blocks, list.parent?.id ?? null, list.index + 1, [...loc.block.content!, ...tail]);
    } else return false;
    this.commit(docId, blocks, { select: { ids: [], editing: caret.id }, caret });
    return true;
  }
}

/** Khối chứa thoát ra được bằng Enter ở đoạn trống cuối / Backspace ở đầu. */
const ESCAPE_CONTAINERS = new Set(["blockquote", "callout", "pullquote", "details"]);
/** Enter ở cuối khối này tạo khối gì. */
const SPLIT_AS: Record<string, string> = { heading: "paragraph", codeBlock: "paragraph", preformatted: "paragraph" };

const firstText = (b: BNode): string | null => (b.inline ? b.id : b.content ? (b.content.map(firstText).find(Boolean) ?? null) : null);
const firstTextDeep = (b: BNode): BNode | null => {
  if (b.inline) return b;
  for (const c of b.content ?? []) { const t = firstTextDeep(c); if (t) return t; }
  return null;
};
function lastText(b: BNode): BNode | null {
  if (b.inline) return b;
  for (let i = (b.content?.length ?? 0) - 1; i >= 0; i--) { const t = lastText(b.content![i]); if (t) return t; }
  return null;
}

/** Thuộc tính chung giữ lại khi đổi loại khối. */
function keepCommon(attrs: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ["textAlign", "style", "className", "anchor"]) if (attrs[k] !== undefined) out[k] = attrs[k];
  return out;
}
/** Tách khối: khối mới giữ kiểu dáng, không giữ neo (id phải duy nhất). */
function keepOnSplit(attrs: Record<string, unknown>) {
  const { id: _id, anchor: _a, ...rest } = attrs;
  return rest;
}
const sameSel = (a: Selection, b: Selection) => a.editing === b.editing && a.ids.length === b.ids.length && a.ids.every((x, i) => x === b.ids[i]);
