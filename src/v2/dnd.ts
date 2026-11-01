import type { PointerEvent as ReactPointerEvent } from "react";
import type { EditorContextValue, DropTarget } from "./context";
import type { InsertOption } from "./inserter";
import type { BNode } from "./model";
import { canContain } from "./structure";

/**
 * Kéo thả bằng pointer (không dùng HTML5 drag): kéo khối (tay nắm, cây khối) hoặc khối mới (thư viện) vào khung soạn.
 * Vị trí thả: khối dưới con trỏ → trước/sau theo nửa trên/dưới (nửa trái/phải nếu khối cha xếp ngang), khối chứa trống → vào trong.
 * Chỗ không đặt được (cột ngoài bộ cột…) thì leo lên khối cha.
 */
const THRESHOLD = 5;

export function startDrag(ctx: EditorContextValue, e: ReactPointerEvent, ids: string[]) {
  if (e.button !== 0 || !ids.length || !ids.every((id) => ctx.store.canMove(id))) return;
  const types = ids.map((id) => ctx.store.block(id)?.type).filter(Boolean) as string[];
  begin(ctx, e, { ids, types });
}

export function startDragNew(ctx: EditorContextValue, e: ReactPointerEvent, option: InsertOption) {
  if (e.button !== 0) return;
  begin(ctx, e, { ids: [], types: [option.type], create: () => option.create(), newType: option.type });
}

interface Source { ids: string[]; types: string[]; create?: () => BNode; newType?: string }

function begin(ctx: EditorContextValue, e: ReactPointerEvent, src: Source) {
  const { ui, store } = ctx;
  const sx = e.clientX, sy = e.clientY;
  const handle = e.currentTarget as HTMLElement;
  let started = false;
  let scrollTimer = 0;
  const pointerId = e.pointerId;

  const move = (ev: PointerEvent) => {
    const { x, y } = toParent(ctx, ev);
    if (!started) {
      if (Math.hypot(x - sx, y - sy) < THRESHOLD) return;
      started = true;
      try { handle.setPointerCapture(pointerId); } catch { /* đã thả */ }
      document.body.classList.add("is-dragging");
      ui.canvasDoc?.body.classList.add("is-dragging");
      for (const id of src.ids) ui.blockEl(id)?.classList.add("is-dragging-source");
    }
    const target = unlocked(store, findTarget(ctx, x, y, src));
    ui.setDrag({ ids: src.ids, newType: src.newType, x, y, target });
    autoScroll(ctx, y);
  };
  const cleanup = () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("keydown", key, true);
    ui.canvasDoc?.removeEventListener("pointermove", move);
    ui.canvasDoc?.removeEventListener("pointerup", up);
    document.body.classList.remove("is-dragging");
    ui.canvasDoc?.body.classList.remove("is-dragging");
    for (const id of src.ids) ui.blockEl(id)?.classList.remove("is-dragging-source");
    clearInterval(scrollTimer);
    try { handle.releasePointerCapture(pointerId); } catch { /* không giữ */ }
  };
  const up = (ev: PointerEvent) => {
    const wasStarted = started;
    const target = started ? unlocked(store, findTarget(ctx, toParent(ctx, ev).x, toParent(ctx, ev).y, src)) : null;
    cleanup();
    ui.setDrag(null);
    if (!wasStarted || !target) return;
    if (src.create) store.insert(target.docId, target.parentId, target.index, [src.create()]);
    else store.moveTo(src.ids, target.docId, target.parentId, target.index);
    // Không để click sau khi thả chèn thêm khối (thư viện khối)
    handle.addEventListener("click", (c) => { c.stopPropagation(); c.preventDefault(); }, { capture: true, once: true });
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    cleanup();
    ui.setDrag(null);
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  document.addEventListener("keydown", key, true);
  ui.canvasDoc?.addEventListener("pointermove", move);
  ui.canvasDoc?.addEventListener("pointerup", up);

  function autoScroll(c: EditorContextValue, y: number) {
    const f = c.ui.canvasFrame?.getBoundingClientRect();
    clearInterval(scrollTimer);
    if (!f) return;
    const win = c.ui.canvasDoc?.defaultView;
    const edge = 60;
    const dy = y < f.top + edge ? -12 : y > f.bottom - edge ? 12 : 0;
    if (dy && win) scrollTimer = window.setInterval(() => win.scrollBy(0, dy), 16);
  }
}

/** Sự kiện trong iframe có toạ độ theo iframe → đổi sang toạ độ trang ngoài. */
function toParent(ctx: EditorContextValue, ev: PointerEvent) {
  const view = (ev.target as Node | null)?.ownerDocument;
  if (view && view === ctx.ui.canvasDoc && ctx.ui.canvasFrame) {
    const f = ctx.ui.canvasFrame.getBoundingClientRect();
    const scale = f.width / (ctx.ui.canvasFrame.offsetWidth || f.width) || 1;
    return { x: f.left + ev.clientX * scale, y: f.top + ev.clientY * scale };
  }
  return { x: ev.clientX, y: ev.clientY };
}

function findTarget(ctx: EditorContextValue, x: number, y: number, src: Source): DropTarget | null {
  const { ui, store } = ctx;
  const frame = ui.canvasFrame, doc = ui.canvasDoc;
  if (!frame || !doc) return null;
  const f = frame.getBoundingClientRect();
  if (x < f.left || x > f.right || y < f.top || y > f.bottom) return null;
  const scale = f.width / (frame.offsetWidth || f.width) || 1;
  const ix = (x - f.left) / scale, iy = (y - f.top) / scale;
  const toParentRect = (r: DOMRect) => ({ left: f.left + r.left * scale, top: f.top + r.top * scale, width: r.width * scale, height: r.height * scale });

  let el = doc.elementFromPoint(ix, iy) as HTMLElement | null;
  let blockEl = el?.closest<HTMLElement>("[data-ecx-block]") ?? null;
  // Không thả vào chính khối đang kéo / con của nó
  while (blockEl && src.ids.some((id) => blockEl!.dataset.ecxBlock === id || isInside(store, blockEl!.dataset.ecxBlock!, id))) {
    blockEl = blockEl.parentElement?.closest<HTMLElement>("[data-ecx-block]") ?? null;
  }
  if (!blockEl) {
    // Ngoài mọi khối: thả vào cuối / đầu tài liệu đang hiện, theo khối cấp cao nhất gần nhất
    const docId = store.activeDocId;
    const top = store.getState().docs[docId]?.blocks ?? [];
    if (!top.length) return validate(store, src, { docId, parentId: null, index: 0, rect: toParentRect(doc.querySelector(".ecx-canvas-root")!.getBoundingClientRect()), horizontal: false });
    let idx = top.length;
    for (let i = 0; i < top.length; i++) {
      const r = ui.blockEl(top[i].id)?.getBoundingClientRect();
      if (r && iy < r.top + r.height / 2) { idx = i; break; }
    }
    const ref = ui.blockEl(top[Math.min(idx, top.length - 1)].id)!.getBoundingClientRect();
    const lineY = idx < top.length ? ref.top - 2 : ref.bottom + 2;
    return validate(store, src, { docId, parentId: null, index: idx, rect: toParentRect(new DOMRect(ref.left, lineY - 2, ref.width, 4)), horizontal: false });
  }
  void el;
  el = null;
  let id = blockEl.dataset.ecxBlock!;
  for (let guard = 0; guard < 12; guard++) {
    const loc = store.locate(id);
    if (!loc) return null;
    const node = loc.block;
    const r = ui.blockEl(id)!.getBoundingClientRect();
    // Khối chứa trống (có nút "+") → thả vào trong
    if (node.content && !node.content.length && canContainAll(node.type, src.types)) {
      return { docId: loc.docId, parentId: node.id, index: 0, rect: toParentRect(r), horizontal: false };
    }
    const parentEl = ui.blockEl(id)!.parentElement;
    const horizontal = !!parentEl && isRow(parentEl);
    const after = horizontal ? ix > r.left + r.width / 2 : iy > r.top + r.height / 2;
    const parentType = loc.parent?.type ?? null;
    if (canContainAll(parentType, src.types)) {
      const line = horizontal
        ? new DOMRect((after ? r.right : r.left) - 2, r.top, 4, r.height)
        : new DOMRect(r.left, (after ? r.bottom : r.top) - 2, r.width, 4);
      return { docId: loc.docId, parentId: loc.parent?.id ?? null, index: loc.index + (after ? 1 : 0), rect: toParentRect(line), horizontal };
    }
    if (!loc.parent) return null;
    id = loc.parent.id;
  }
  return null;
}

function validate(store: EditorContextValue["store"], src: Source, t: DropTarget): DropTarget | null {
  const parentType = t.parentId ? store.block(t.parentId)?.type ?? null : null;
  if (store.doc(t.docId)?.mode === "disabled") return null;
  return canContainAll(parentType, src.types) ? t : null;
}
const canContainAll = (parentType: string | null, types: string[]) => types.every((t) => canContain(parentType, t));
/** Chỗ thả bị khoá (templateLock) → không nhận. */
function unlocked(store: EditorContextValue["store"], t: DropTarget | null): DropTarget | null { return t && store.canInsertInto(t.parentId) ? t : null; }
const isInside = (store: EditorContextValue["store"], id: string, ancestor: string) => !!store.locate(id)?.ancestors.includes(ancestor);
function isRow(el: HTMLElement) {
  const s = el.ownerDocument.defaultView!.getComputedStyle(el);
  return (s.display.includes("flex") && !s.flexDirection.startsWith("column")) || (s.display.includes("grid") && s.gridAutoFlow.startsWith("column"));
}
