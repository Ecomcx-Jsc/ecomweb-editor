import { useEffect } from "react";
import { useEditor } from "../context";
import type { BNode } from "../core/model";
import type { EditorState } from "../core/store";

/**
 * Khối trượt về chỗ mới khi thứ tự đổi (lên / xuống, kéo thả, chèn, xoá, hoàn tác) thay vì nhảy (kiểu FLIP):
 * thứ tự trong cây đổi → đo vị trí cũ ngay lúc store báo (DOM chưa vẽ lại) → khung hình kế tiếp đo vị trí mới →
 * đặt khối về chỗ cũ rồi thả về 0. Gõ chữ không đổi thứ tự → không đo, không chạy.
 */
export const MOVE_MS = 340;
// Dừng êm, không nảy (như lò xo tắt dần): quãng đường còn lại giảm theo hàm mũ, hằng số thời gian 75ms → ~35% sau 40ms, ~70% sau 100ms
const TAU = 75;
export const MOVE_EASE = `linear(${Array.from({ length: 21 }, (_, i) => { const t = (i / 20) * MOVE_MS; return ((1 - Math.exp(-t / TAU)) / (1 - Math.exp(-MOVE_MS / TAU))).toFixed(3) + ` ${i * 5}%`; }).join(", ")})`;
// Trình duyệt chưa hiểu linear(): đường cong gần giống
const FALLBACK_EASE = "cubic-bezier(.25, .7, .3, 1)";

/** Vị trí của mọi khối trong cây: id → "cha:thứ tự". */
export function orderMap(docs: EditorState["docs"]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (list: readonly BNode[], parent: string) => list.forEach((b, i) => { out.set(b.id, `${parent}:${i}`); if (b.content) walk(b.content, b.id); });
  for (const d of Object.values(docs)) walk(d.blocks, d.id);
  return out;
}

/** Khối cần trượt: đã có trước, đổi chỗ trong cây, và vị trí trên màn hình đổi; bỏ khối con khi khối cha cùng trượt một quãng. */
export function movesToAnimate(before: Map<string, string>, after: Map<string, string>, oldRects: Map<string, DOMRect>, newRect: (id: string) => DOMRect | null, parentOf: (id: string) => string | null) {
  const moves = new Map<string, { dx: number; dy: number }>();
  for (const id of after.keys()) {
    const o = oldRects.get(id);
    if (!before.has(id) || !o) continue; // khối mới chèn: hiện ngay
    const n = newRect(id);
    if (!n) continue;
    const dx = o.left - n.left, dy = o.top - n.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    moves.set(id, { dx, dy });
  }
  // Khối cha đã trượt → khối con đi theo; chỉ trượt riêng phần chênh lệch
  const abs = new Map(moves);
  for (const [id, m] of abs) {
    for (let p = parentOf(id); p; p = parentOf(p)) {
      const pm = abs.get(p);
      if (!pm) continue;
      const rx = m.dx - pm.dx, ry = m.dy - pm.dy;
      if (Math.abs(rx) < 1 && Math.abs(ry) < 1) moves.delete(id); else moves.set(id, { dx: rx, dy: ry });
      break;
    }
  }
  return moves;
}

export function useMoveAnimation(doc: Document) {
  const { store } = useEditor();
  useEffect(() => {
    const win = doc.defaultView;
    if (!win) return;
    let docs = store.getState().docs;
    let order = orderMap(docs);
    let raf = 0;
    const els = () => doc.querySelectorAll<HTMLElement>("[data-ecx-block]");
    const off = store.subscribe(() => {
      const next = store.getState().docs;
      if (next === docs) return;
      const nextOrder = orderMap(next);
      docs = next;
      let changed = nextOrder.size !== order.size;
      if (!changed) for (const [id, p] of nextOrder) if (order.get(id) !== p) { changed = true; break; }
      const before = order;
      order = nextOrder;
      if (!changed || win.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      // DOM vẫn là bản cũ: đo vị trí cũ (bỏ phần đang trượt dở)
      const old = new Map<string, DOMRect>();
      for (const el of els()) {
        for (const a of el.getAnimations?.() ?? []) if (a.id === "ecx-move") a.finish();
        old.set(el.dataset.ecxBlock!, el.getBoundingClientRect());
      }
      win.cancelAnimationFrame(raf);
      raf = win.requestAnimationFrame(() => {
        const byId = new Map<string, HTMLElement>();
        for (const el of els()) byId.set(el.dataset.ecxBlock!, el);
        const parentOf = (id: string) => byId.get(id)?.parentElement?.closest<HTMLElement>("[data-ecx-block]")?.dataset.ecxBlock ?? null;
        const moves = movesToAnimate(before, nextOrder, old, (id) => byId.get(id)?.getBoundingClientRect() ?? null, parentOf);
        for (const [id, { dx, dy }] of moves) {
          const el = byId.get(id);
          if (!el?.animate) continue;
          const frames = [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }];
          try { el.animate(frames, { duration: MOVE_MS, easing: MOVE_EASE, id: "ecx-move" }); }
          catch { el.animate(frames, { duration: MOVE_MS, easing: FALLBACK_EASE, id: "ecx-move" }); }
        }
      });
    });
    return () => { off(); win.cancelAnimationFrame(raf); };
  }, [doc, store]);
}
