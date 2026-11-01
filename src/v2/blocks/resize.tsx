import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useEditor, useEditorState } from "../context";
import type { BNode } from "../model";

/** Khối hoặc khối con của nó đang được chọn / gõ (hiện tay nắm đổi cỡ). */
export function useActiveWithin(id: string) {
  const { store } = useEditor();
  return useEditorState(useCallback((s) => {
    const cur = s.selection.ids.length ? s.selection.ids : s.selection.editing ? [s.selection.editing] : [];
    return cur.some((c) => c === id || !!store.locate(c)?.ancestors.includes(id));
  }, [id, store]));
}

/**
 * Tay nắm giữa các cột: kéo đổi tỉ lệ hai cột kề nhau (độ rộng lưu theo %, tổng 100) — một lần kéo là một bước hoàn tác.
 * Đặt tuyệt đối trong khối cột nên không ảnh hưởng bố cục flex.
 */
export function ColumnHandles({ block }: { block: BNode }) {
  const { store, labels } = useEditor();
  const ref = useRef<HTMLSpanElement>(null);
  const [gaps, setGaps] = useState<Array<{ left: number; top: number; height: number }>>([]);
  const cols = block.content ?? [];
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const hr = host.getBoundingClientRect();
    const els = Array.from(host.children).filter((c) => (c as HTMLElement).dataset.type === "column") as HTMLElement[];
    const next = els.slice(0, -1).map((el, i) => {
      const a = el.getBoundingClientRect(), b = els[i + 1].getBoundingClientRect();
      // Cột xuống dòng (màn hẹp): không có khe ngang
      if (Math.abs(a.top - b.top) > 4) return null;
      return { left: (a.right + b.left) / 2 - hr.left, top: Math.min(a.top, b.top) - hr.top, height: Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top) };
    }).filter(Boolean) as Array<{ left: number; top: number; height: number }>;
    setGaps((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  });
  const start = (i: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const host = ref.current!.parentElement!;
    const els = Array.from(host.children).filter((c) => (c as HTMLElement).dataset.type === "column") as HTMLElement[];
    const total = els.reduce((s, el) => s + el.getBoundingClientRect().width, 0);
    const widths = els.map((el) => (el.getBoundingClientRect().width / total) * 100);
    const a = els[i].getBoundingClientRect(), b = els[i + 1].getBoundingClientRect();
    const pair = widths[i] + widths[i + 1];
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const ratio = Math.min(0.9, Math.max(0.1, (ev.clientX - a.left) / (b.right - a.left)));
      const wa = Math.round(pair * ratio), wb = Math.round(pair - pair * ratio);
      const ids = cols.map((c) => c.id);
      store.batch(() => {
        widths.forEach((w, k) => {
          const val = k === i ? wa : k === i + 1 ? wb : Math.round(w);
          store.setAttrs([ids[k]], { width: val });
        });
      });
    };
    const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); store.breakMerge(); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
  return (
    <span ref={ref} className="ecx-col-handles" contentEditable={false} aria-hidden="true">
      {gaps.map((g, i) => (
        <span key={i} className="ecx-col-handle" style={{ left: g.left, top: g.top, height: g.height }} title={labels.resize}
          data-ecx-col-handle={i} onPointerDown={(e) => start(i, e)} onMouseDown={(e) => e.stopPropagation()} />
      ))}
    </span>
  );
}

/** Tay nắm góc phải dưới của ảnh: kéo đổi bề rộng (giữ tỉ lệ), không vượt khung. */
export function ImageHandle({ blockId }: { blockId: string }) {
  const { store, labels } = useEditor();
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Đặt đúng góc của ảnh (ảnh có thể hẹp hơn khung figure), đo lại khi ảnh tải xong / đổi cỡ
  useLayoutEffect(() => {
    const img = ref.current?.parentElement?.querySelector("img");
    if (!img) return;
    const measure = () => setPos((p) => {
      const next = { left: img.offsetLeft + img.offsetWidth, top: img.offsetTop + img.offsetHeight };
      return p && p.left === next.left && p.top === next.top ? p : next;
    });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(img);
    img.addEventListener("load", measure);
    return () => { ro.disconnect(); img.removeEventListener("load", measure); };
  }, []);
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    const img = handle.parentElement?.querySelector("img");
    if (!img) return;
    const r = img.getBoundingClientRect();
    const max = handle.parentElement!.parentElement?.getBoundingClientRect().width ?? Infinity;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalHeight / img.naturalWidth : r.height / r.width;
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const w = Math.round(Math.min(max, Math.max(48, ev.clientX - r.left)));
      store.setAttrs([blockId], { width: w, height: Math.round(w * ratio) || undefined });
    };
    const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); store.breakMerge(); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
  return <span ref={ref} className="ecx-image-handle" contentEditable={false} title={labels.resize} style={pos ? { left: pos.left - 7, top: pos.top - 7 } : { visibility: "hidden" }}
    onPointerDown={start} onMouseDown={(e) => e.stopPropagation()} />;
}
