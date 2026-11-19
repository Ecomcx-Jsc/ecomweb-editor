import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { normalizeStyle, type BlockStyle } from "@ecomcx/ecomweb-content";
import { useEditor, useEditorState } from "../context";
import { hideSpacingViz, showSpacingViz } from "../canvas/spacing-viz";
import type { BNode } from "../core/model";
import { labelsLegacy } from "../../shared/labels";

/** Thả tay nắm: focus về khung soạn để ⌘Z / Delete… thuộc về trình soạn ngay. */
const focusCanvas = (el: HTMLElement) => el.ownerDocument.querySelector<HTMLElement>(".ecx-canvas-root")?.focus({ preventScroll: true });

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
  const { store, labels, ui } = useEditor();
  const ref = useRef<HTMLSpanElement>(null);
  const [gaps, setGaps] = useState<Array<{ left: number; top: number; height: number }>>([]);
  const cols = block.content ?? [];
  const measure = () => {
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
  };
  useLayoutEffect(measure);
  // Đổi khổ màn hình / thu nhỏ khung: cột có thể xuống dòng mà không vẽ lại → đo lại, không để tay kéo nằm ngoài khung (tràn ngang)
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
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
    handle.classList.add("is-dragging");
    // Alt + kéo: đổi KHOẢNG CÁCH giữa các cột (ô "Khoảng giữa các cột") thay vì độ rộng; số px hiện cạnh tay nắm
    if (e.altKey) {
      const startGap = Math.max(0, Math.round(b.left - a.right)), x0 = e.clientX;
      const device = ui.device === "desktop" ? "base" : ui.device;
      const moveGap = (ev: PointerEvent) => {
        const px = Math.max(0, Math.min(200, Math.round(startGap + (ev.clientX - x0) * 2)));
        handle.dataset.left = `${px}px`; handle.dataset.right = "";
        const cur = store.block(block.id)?.attrs.columnsGap;
        const obj: Record<string, string> = cur && typeof cur === "object" ? { ...(cur as Record<string, string>) } : typeof cur === "string" && cur ? { base: cur } : {};
        obj[device] = `${px}px`;
        store.setAttrs([block.id], { columnsGap: obj });
      };
      const upGap = () => { handle.removeEventListener("pointermove", moveGap); handle.removeEventListener("pointerup", upGap); handle.classList.remove("is-dragging"); store.breakMerge(); focusCanvas(handle); };
      handle.addEventListener("pointermove", moveGap);
      handle.addEventListener("pointerup", upGap);
      return;
    }
    const move = (ev: PointerEvent) => {
      const ratio = Math.min(0.9, Math.max(0.1, (ev.clientX - a.left) / (b.right - a.left)));
      const wa = Math.round(pair * ratio), wb = Math.round(pair - pair * ratio);
      // Nhãn % hai bên tay nắm khi đang kéo
      handle.dataset.left = `${wa}%`; handle.dataset.right = `${wb}%`;
      const ids = cols.map((c) => c.id);
      store.batch(() => {
        widths.forEach((w, k) => {
          const val = k === i ? wa : k === i + 1 ? wb : Math.round(w);
          store.setAttrs([ids[k]], { width: val });
        });
      });
    };
    const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); handle.classList.remove("is-dragging"); store.breakMerge(); focusCanvas(handle); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
  return (
    <span ref={ref} className="ecx-col-handles" contentEditable={false} aria-hidden="true">
      {gaps.map((g, i) => (
        <span key={i} className="ecx-col-handle" style={{ left: g.left, top: g.top, height: g.height }} title={`${labels.resize} · Alt: ${labels.resizeGap}`}
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
    const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); store.breakMerge(); focusCanvas(handle); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
  return <span ref={ref} className="ecx-image-handle" contentEditable={false} title={labels.resize} style={pos ? { left: pos.left - 7, top: pos.top - 7 } : { visibility: "hidden" }}
    onPointerDown={start} onMouseDown={(e) => e.stopPropagation()} />;
}

/** Kéo mép dưới để đổi chiều cao khối (Khoảng trống): ghi `attrs.height` = "NNpx". Dùng chung kiểu tay nắm của dải đệm. */
export function HeightHandle({ blockId }: { blockId: string }) {
  const { store, ui, labels } = useEditor();
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    const el = ui.blockEl(blockId);
    if (!el) return;
    const h0 = el.getBoundingClientRect().height, y0 = e.clientY;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("is-dragging");
    const move = (ev: PointerEvent) => store.setAttrs([blockId], { height: `${Math.max(8, Math.round(h0 + ev.clientY - y0))}px` });
    const up = () => {
      handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up);
      handle.classList.remove("is-dragging"); store.breakMerge(); focusCanvas(handle);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
  return (
    <span className="ecx-pad-handles" contentEditable={false} aria-hidden="true">
      <span className="ecx-pad-handle is-bottom" title={labels.resize} onPointerDown={start} onMouseDown={(e) => e.stopPropagation()} />
    </span>
  );
}

/**
 * Vùng kéo đệm / lề trên, dưới của khối bố cục đang chọn (Nhóm, Bộ cột, Cột): vùng rộng hết khối, cao bằng giá trị thật; kéo đổi giá trị
 * của khổ màn hình đang xem (lưu px, giữ các cạnh khác); rê / kéo thì vùng được tô kèm số px — như ô Đệm / Lề ở bảng bên phải.
 */
export function PaddingHandles({ blockId }: { blockId: string }) {
  const { store, ui, labels: v2 } = useEditor();
  const L = labelsLegacy(v2.lang);
  const ref = useRef<HTMLSpanElement>(null);
  type Side = "top" | "bottom" | "left" | "right";
  // Cỡ thật (px) của đệm / lề từng cạnh: vùng kéo dày đúng bằng nó (tối thiểu 8px) — kéo ở bất kỳ đâu trong vùng
  const [px, setPx] = useState({ pt: 0, pb: 0, pl: 0, pr: 0, mt: 0, mb: 0, ml: 0, mr: 0 });
  useLayoutEffect(() => {
    const el = ui.blockEl(blockId);
    if (!el) return;
    const cs = el.ownerDocument.defaultView!.getComputedStyle(el), n = (k: string) => Math.round(parseFloat(cs.getPropertyValue(k)) || 0);
    const next = { pt: n("padding-top"), pb: n("padding-bottom"), pl: n("padding-left"), pr: n("padding-right"), mt: n("margin-top"), mb: n("margin-bottom"), ml: n("margin-left"), mr: n("margin-right") };
    setPx((p) => (JSON.stringify(p) === JSON.stringify(next) ? p : next));
  });
  const start = (kind: "padding" | "margin", side: Side, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    const el = ui.blockEl(blockId);
    if (!el) return;
    const horizontal = side === "left" || side === "right";
    const startPx = parseFloat(el.ownerDocument.defaultView!.getComputedStyle(el).getPropertyValue(`${kind}-${side}`)) || 0;
    const p0 = horizontal ? e.clientX : e.clientY;
    const device = ui.device === "desktop" ? "base" : ui.device;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("is-dragging");
    const move = (ev: PointerEvent) => {
      // Cạnh dưới / phải: kéo ra xa (xuống / sang phải) là tăng; đệm cạnh trên / trái: kéo vào trong tăng; lề trên / trái: kéo ra ngoài (lên / sang trái) tăng
      const d = (horizontal ? ev.clientX : ev.clientY) - p0;
      const outward = side === "top" || side === "left";
      const px = Math.max(0, Math.round(startPx + (kind === "margin" && outward ? -d : d) * (kind === "padding" && side === "right" ? -1 : 1)));
      const node = store.block(blockId);
      if (!node) return;
      const style = (normalizeStyle(node.attrs.style) ?? {}) as BlockStyle & Record<"padding" | "margin", Record<string, unknown> | undefined>;
      const cur = style[kind]?.[device];
      const sides = typeof cur === "object" && cur ? { ...(cur as Record<string, string>) } : typeof cur === "string" ? { top: cur, right: cur, bottom: cur, left: cur } : {};
      sides[side] = `${px}px`;
      store.setAttrs([blockId], { style: normalizeStyle({ ...style, [kind]: { ...(style[kind] ?? {}), [device]: sides } }) ?? undefined });
      requestAnimationFrame(() => showSpacingViz(ui.blockEl(blockId), kind, [side]));
    };
    // Nghe ở cả tài liệu khung soạn (không dựa vào pointer capture): tay nắm dịch chỗ khi giá trị đổi (cạnh phải / dưới) làm capture mất giữa chừng
    const doc = el.ownerDocument;
    const up = () => {
      doc.removeEventListener("pointermove", move, true); doc.removeEventListener("pointerup", up, true); doc.removeEventListener("pointercancel", up, true);
      handle.classList.remove("is-dragging"); hideSpacingViz(ui.canvasDoc); store.breakMerge(); focusCanvas(handle);
    };
    doc.addEventListener("pointermove", move, true);
    doc.addEventListener("pointerup", up, true);
    doc.addEventListener("pointercancel", up, true);
  };
  const w = (n: number) => Math.max(8, n);
  const zones = [
    ["padding", "top", { top: 0, height: w(px.pt) }],
    ["padding", "bottom", { bottom: 0, height: w(px.pb) }],
    ["margin", "top", { top: -w(px.mt), height: w(px.mt) }],
    ["margin", "bottom", { bottom: -w(px.mb), height: w(px.mb) }],
    // Hai cạnh ngang chỉ có tay nắm khi giá trị đã > 0 (dải rộng đúng bằng nó, nằm trong vùng đệm / lề) — không phủ lên chữ hay khối bên cạnh
    ...(px.pl > 0 ? [["padding", "left", { left: 0, width: px.pl }]] : []),
    ...(px.pr > 0 ? [["padding", "right", { right: 0, width: px.pr }]] : []),
    ...(px.ml > 0 ? [["margin", "left", { left: -px.ml, width: px.ml }]] : []),
    ...(px.mr > 0 ? [["margin", "right", { right: -px.mr, width: px.mr }]] : []),
  ] as ReadonlyArray<readonly ["padding" | "margin", Side, React.CSSProperties]>;
  return (
    <span ref={ref} className="ecx-pad-handles" contentEditable={false} aria-hidden="true">
      {zones.map(([kind, side, pos]) => (
        <span key={kind + side} className={`ecx-pad-zone is-${kind} is-${side}`} style={pos} title={kind === "padding" ? L.style_padding : L.style_margin} data-ecx-zone={`${kind}-${side}`}
          onPointerDown={(e) => start(kind, side, e)} onMouseDown={(e) => e.stopPropagation()}
          onPointerEnter={() => showSpacingViz(ui.blockEl(blockId), kind, [side])}
          onPointerLeave={(e) => { if (!(e.currentTarget as HTMLElement).classList.contains("is-dragging")) hideSpacingViz(ui.canvasDoc); }} />
      ))}
    </span>
  );
}

/**
 * Tay kéo độ rộng nội dung bên trong của Nhóm: hai tay ở hai mép vùng nội dung (khối con đầu tiên); kéo vào / ra là đổi độ rộng đối xứng,
 * số px hiện cạnh tay khi kéo. Kéo hết cỡ ra mép = về "Hết khối". Lưu vào `contentWidth` như ô ở bảng Cài đặt.
 */
export function ContentWidthHandles({ blockId }: { blockId: string }) {
  const { store, ui } = useEditor();
  const [box, setBox] = useState<{ left: number; right: number; max: number } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  /** Đo theo giá trị ràng buộc (max-width của khối con), không theo kích thước khối con — hàng ngang / lưới / xếp dọc làm khối con co theo chữ. */
  const measure = () => {
    const el = ui.blockEl(blockId), kid = el?.querySelector(":scope > [data-ecx-block]") as HTMLElement | null;
    if (!el || !kid) return null;
    const win = el.ownerDocument.defaultView!, cs = win.getComputedStyle(el), g = el.getBoundingClientRect();
    const padL = parseFloat(cs.paddingLeft) || 0, max = Math.round(g.width - padL - (parseFloat(cs.paddingRight) || 0));
    const mwRaw = win.getComputedStyle(kid).maxWidth, mw = mwRaw.endsWith("px") ? parseFloat(mwRaw) : NaN;
    const width = Math.min(max, Number.isFinite(mw) ? Math.round(mw) : max);
    const left = Math.round(padL + (max - width) / 2);
    return { left, right: left + width, max, width };
  };
  useLayoutEffect(() => {
    const m = measure();
    setBox((p) => (!m ? null : p && p.left === m.left && p.right === m.right && p.max === m.max ? p : { left: m.left, right: m.right, max: m.max }));
  });
  const start = (dir: 1 | -1, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const handle = e.currentTarget as HTMLElement, m = measure();
    if (!m) return;
    const x0 = e.clientX;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("is-dragging");
    const move = (ev: PointerEvent) => {
      const w = Math.min(m.max, Math.max(240, Math.round(m.width + 2 * dir * (ev.clientX - x0))));
      const node = store.block(blockId);
      if (!node) return;
      setDrag(w);
      store.setAttrs([blockId], { constrained: undefined, contentWidth: w >= m.max ? undefined : `${w}px` });
    };
    const up = () => {
      handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up);
      handle.classList.remove("is-dragging"); setDrag(null); store.breakMerge(); focusCanvas(handle);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
  if (!box) return null;
  return (
    <span className="ecx-cw-handles" contentEditable={false} aria-hidden="true">
      {/* Vùng nội dung hiện rõ giữa hai tay: nội dung canh giữa (chữ, logo) co lại đối xứng nên nhìn như đứng yên — khung này cho thấy độ rộng đang đổi */}
      <span className={`ecx-cw-guide${drag !== null ? " is-dragging" : ""}`} style={{ left: box.left, width: box.right - box.left }} />
      {([["left", box.left, -1], ["right", box.right, 1]] as const).map(([side, x, dir]) => (
        <span key={side} className={`ecx-cw-handle is-${side}`} style={{ left: x }} data-ecx-zone={`content-width-${side}`}
          onPointerDown={(e) => start(dir === 1 ? 1 : -1, e)} onMouseDown={(e) => e.stopPropagation()}>
          {drag !== null && <span className="ecx-cw-tip">{drag}px</span>}
        </span>
      ))}
    </span>
  );
}
