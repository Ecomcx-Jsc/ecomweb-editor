import { collectStyles, normalizeStyle, presetCss, type BlockStyle } from "@ecomcx/ecomweb-content";
import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { onAnimationsChange, pluginAnimations } from "../../shared/animation-store";
import { createPortal } from "react-dom";
import { DocBlocks } from "./block-list";
import { BLOCKS_MIME, blocksFromClipboard, serializeBlocks } from "../core/clipboard";
import { DocScopeProvider, useEditor, useEditorState, useUiTick } from "../context";
import { usePrefs } from "../prefs";
import { CANVAS_CSS } from "./canvas-css";
import { applyDocumentAttrs } from "./document-attrs";
import { wrapperNodes } from "./wrapper-props";
import { makeBlock, type BNode } from "../core/model";
import { flatten, topLevelOrdered } from "../core/ops";
import { insertSibling, now, richViews } from "../text/rich-text";

export type Device = "desktop" | "tablet" | "mobile";
export const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 768, mobile: 390 };

export interface CanvasProps {
  device?: Device;
  className?: string;
  /** Class của vùng nội dung trong iframe (theme thường tạo kiểu .ecx-content / .entry-content). */
  contentClassName?: string;
  /** Vẽ thêm quanh nội dung (vd tiêu đề bài phía trên). */
  before?: ReactNode;
  after?: ReactNode;
}

const SRC_DOC = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="ecx-canvas-body"></body></html>`;

/** Khung soạn: iframe mang CSS của website → soạn thấy đúng phông, màu, khoảng cách; media query theo bề rộng thiết bị. */
/** Tỉ lệ của chế độ thu nhỏ. */
export const ZOOM_OUT = 0.5;
/** Khổ "Máy tính" luôn vẽ rộng ít nhất bằng này (> 1024 để CSS tablet của website không áp lên); chỗ hẹp hơn thì thu nhỏ vừa khung thay vì vẽ hẹp. */
export const DESKTOP_MIN_WIDTH = 1100;

export function Canvas({ device = "desktop", className, contentClassName = "ecx-content", before, after }: CanvasProps) {
  const { ui, labels } = useEditor();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth));
    ro.observe(el); setWrapW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const onLoad = useCallback(() => {
    const f = frameRef.current;
    const d = f?.contentDocument;
    if (!f || !d) return;
    ui.canvasFrame = f;
    ui.canvasDoc = d;
    setDoc(d);
    ui.bump();
  }, [ui]);

  // srcDoc có thể đã nạp xong trước khi React gắn onLoad
  useLayoutEffect(() => {
    const d = frameRef.current?.contentDocument;
    if (d && d.readyState === "complete" && d.body?.classList.contains("ecx-canvas-body")) onLoad();
  }, [onLoad]);

  useEffect(() => () => { if (ui.canvasFrame === frameRef.current) { ui.canvasFrame = null; ui.canvasDoc = null; } }, [ui]);

  useUiTick();
  const width = DEVICE_WIDTH[device];
  // Thu nhỏ: khung soạn vẽ ở cỡ gấp đôi rồi thu còn một nửa → thấy cả trang, toạ độ kéo thả / thanh công cụ tự tính theo tỉ lệ
  const fit = !width && wrapW > 0 && wrapW < DESKTOP_MIN_WIDTH ? wrapW / DESKTOP_MIN_WIDTH : 1;
  const zoom = (ui.zoomOut ? ZOOM_OUT : 1) * fit;
  const style = zoom === 1 ? { width: width ? `${width}px` : "100%" }
    : { width: width ? `${width}px` : `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: width ? "top center" : "top left", flex: "none" };
  return (
    <div ref={wrapRef} className={["ecx-canvas-wrap", `is-${device}`, zoom !== 1 && "is-zoomed-out", className].filter(Boolean).join(" ")}>
      <iframe ref={frameRef} className="ecx-canvas-frame" title={labels.canvas} srcDoc={SRC_DOC} onLoad={onLoad}
        style={style} data-ecx-canvas="" />
      {doc && createPortal(<CanvasWrapper><CanvasRoot doc={doc} contentClassName={contentClassName} before={before} after={after} /></CanvasWrapper>, doc.body)}
    </div>
  );
}

/** Khung bao của website (host.canvasWrapper) quanh vùng soạn; không có → vùng soạn đứng trực tiếp trong <body>. */
function CanvasWrapper({ children }: { children: ReactNode }) {
  const { host } = useEditor();
  const nodes = useMemo(() => wrapperNodes(host.canvasWrapper), [host.canvasWrapper]);
  return <>{nodes.reduceRight<ReactNode>((inner, n) => createElement(n.tag, n.props, inner), children)}</>;
}

function CanvasRoot({ doc, contentClassName, before, after }: { doc: Document; contentClassName: string; before?: ReactNode; after?: ReactNode }) {
  const { store, labels, prefs, ui, host } = useEditor();
  const spotlight = usePrefs(prefs).spotlight;
  useUiTick();
  const focus = useEditorState((s) => s.focus[s.focus.length - 1] ?? null);
  const rootId = useEditorState((s) => s.rootId);
  const frameId = useEditorState((s) => s.frameId);
  const activeId = focus ?? rootId;
  // Sửa trang trong template: vẽ template (khoá), khối "Nội dung bài" bên trong vẽ tài liệu gốc
  const viewId = !focus && frameId ? frameId : activeId;
  const mode = useEditorState(useCallback((s) => s.docs[activeId]?.mode ?? "default", [activeId]));
  const title = useEditorState(useCallback((s) => s.docs[activeId]?.title, [activeId]));
  useCanvasDocument(doc);
  useCanvasStyles(doc);
  useCanvasKeys(doc);
  useCanvasEvents(doc);
  const hasRange = useRangeHighlight(doc);
  return (
    <div className={["ecx-canvas-root", contentClassName, host.canvasContentClass, focus && "is-focus-mode", spotlight && "is-spotlight", ui.zoomOut && "is-zoomed-out", hasRange && "has-text-range"].filter(Boolean).join(" ")} data-ecx-doc={activeId} tabIndex={-1}
      onDoubleClick={() => { if (ui.zoomOut) zoomIn(store, ui); }}
      onMouseDown={(e) => {
        if (ui.zoomOut) return store.clearSelection();
        // Bấm vào chỗ trống: bỏ chọn; bấm dưới khối cuối: thêm / đưa con trỏ vào đoạn trống cuối
        if (e.target !== e.currentTarget) return;
        const d = store.doc(activeId);
        if (!d || d.mode !== "default") return store.clearSelection();
        const last = d.blocks[d.blocks.length - 1];
        const lastEl = last ? doc.querySelector(`[data-ecx-block="${CSS.escape(last.id)}"]`) : null;
        if (lastEl && e.clientY < lastEl.getBoundingClientRect().bottom) return store.clearSelection();
        e.preventDefault();
        if (last?.type === "paragraph" && !(last.inline ?? []).length) store.focusText(last.id, 0);
        else store.insert(activeId, null, d.blocks.length, [makeBlock("paragraph")]);
      }}>
      {focus && <div className="ecx-focus-bar" contentEditable={false}><button type="button" className="ecx-focus-back" onClick={() => store.exitFocus()}>← {labels.back}</button><span>{title}</span></div>}
      {!focus && before}
      {viewId !== activeId
        ? <DocScopeProvider value={{ docId: viewId, mode: "disabled", depth: 0, chain: [viewId] }}><DocBlocks docId={viewId} /></DocScopeProvider>
        : <DocScopeProvider value={{ docId: activeId, mode, depth: 0 }}><DocBlocks docId={activeId} /></DocScopeProvider>}
      {!focus && after}
    </div>
  );
}

/** Thuộc tính <html> / <body> của website (host.canvasDocument) để CSS đã scope của theme khớp. */
function useCanvasDocument(doc: Document) {
  const { host } = useEditor();
  const spec = host.canvasDocument;
  useLayoutEffect(() => applyDocumentAttrs(doc, spec), [doc, spec]);
}

/** CSS trong iframe: nền của trình soạn, CSS website (host), preset theme, kiểu dáng các khối. */
function useCanvasStyles(doc: Document) {
  const { host, store } = useEditor();
  const head = doc.head;
  useLayoutEffect(() => {
    const nodes: HTMLElement[] = [];
    const add = (el: HTMLElement) => { head.appendChild(el); nodes.push(el); };
    const base = doc.createElement("style");
    base.dataset.ecx = "canvas";
    base.textContent = CANVAS_CSS;
    add(base);
    for (const s of host.canvasStyles ?? []) {
      if (typeof s === "string") {
        const l = doc.createElement("link");
        l.rel = "stylesheet";
        l.href = s;
        add(l);
      } else {
        const st = doc.createElement("style");
        st.textContent = s.css;
        add(st);
      }
    }
    // Màu viền chọn / phần dùng chung theo màu của giao diện bên ngoài (thương hiệu, sáng/tối)
    const outer = doc.defaultView?.frameElement as HTMLElement | null;
    if (outer) {
      const cs = getComputedStyle(outer);
      const vars = [["--ecx-ui", "--ecx-ed-accent"], ["--ecx-ui-nested", "--ecx-ed-brand"], ["--ecx-ui-font", "--ecx-ed-font"]]
        .map(([inner, from]) => [inner, cs.getPropertyValue(from).trim()]).filter(([, v]) => v);
      if (vars.length) {
        const st = doc.createElement("style");
        st.dataset.ecx = "chrome";
        st.textContent = `:root{${vars.map(([k, v]) => `${k}:${v}`).join(";")}}`;
        add(st);
      }
    }
    if (host.presets) {
      const p = doc.createElement("style");
      p.dataset.ecx = "presets";
      p.textContent = presetCss(host.presets, ":root");
      add(p);
    }
    return () => nodes.forEach((n) => n.remove());
  }, [doc, head, host.canvasStyles, host.presets]);

  // Kiểu dáng khối (class ecx-s-…) gom từ mọi tài liệu đang mở — cùng hàm website dùng
  const docs = useEditorState((s) => s.docs);
  // Kiểu dáng gom theo từng cây khối (cache theo tham chiếu): gõ chữ không đổi style → không duyệt lại cả tài liệu dài
  const perTree = useRef(new WeakMap<BNode[], BlockStyle[]>());
  const css = useMemo(() => {
    const styles: BlockStyle[] = [];
    for (const d of Object.values(docs)) {
      let list = perTree.current.get(d.blocks);
      if (!list) {
        list = [];
        for (const b of flatten(d.blocks)) if (b.attrs.style && typeof b.attrs.style === "object") { const st = normalizeStyle(b.attrs.style); if (st) list.push(st); }
        perTree.current.set(d.blocks, list);
      }
      styles.push(...list);
    }
    return collectStyles(styles);
  }, [docs]);
  void store;
  useLayoutEffect(() => {
    let el = head.querySelector<HTMLStyleElement>("style[data-ecx=blocks]");
    if (!el) { el = doc.createElement("style"); el.dataset.ecx = "blocks"; head.appendChild(el); }
    el.textContent = css;
  }, [css, doc, head]);
  // Keyframes của hiệu ứng plugin (registerAnimation) để xem thử trong khung soạn
  const animations = useSyncExternalStore(onAnimationsChange, pluginAnimations, pluginAnimations);
  useLayoutEffect(() => {
    let el = head.querySelector<HTMLStyleElement>("style[data-ecx=motion]");
    if (!el) { el = doc.createElement("style"); el.dataset.ecx = "motion"; head.appendChild(el); }
    el.textContent = animations.map((a) => a.css ?? "").join("\n");
  }, [animations, doc, head]);
}

/** Cuộn / đổi cỡ trong iframe → thanh công cụ đo lại vị trí. */
function useCanvasEvents(doc: Document) {
  const { ui } = useEditor();
  useEffect(() => {
    const win = doc.defaultView!;
    let raf = 0;
    const bump = () => { cancelAnimationFrame(raf); raf = win.requestAnimationFrame(() => ui.bump()); };
    win.addEventListener("scroll", bump, { passive: true });
    // Rê chuột: thôi chế độ đang gõ → thanh công cụ hiện lại
    const moved = () => ui.setTyping(false);
    doc.addEventListener("mousemove", moved, { passive: true });
    document.addEventListener("mousemove", moved, { passive: true });
    win.addEventListener("resize", bump);
    const ro = new ResizeObserver(bump);
    ro.observe(doc.body);
    return () => {
      win.removeEventListener("scroll", bump); win.removeEventListener("resize", bump); ro.disconnect(); cancelAnimationFrame(raf);
      doc.removeEventListener("mousemove", moved); document.removeEventListener("mousemove", moved);
    };
  }, [doc, ui]);
}

/** Đang gõ chữ / ô nhập: phím thuộc về ô đó. */
const typing = (el: Element | null) => !!el && ((el as HTMLElement).isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Phím khi đang chọn khối (không gõ chữ): xoá, nhân bản, di chuyển, chép/cắt/dán, hoàn tác. */
function useCanvasKeys(doc: Document) {
  const { store, ui } = useEditor();
  useEffect(() => {
    // Phím gõ khi focus ở Cây khối (trang ngoài, không phải iframe): cũng chạy như trong khung soạn
    const fromTree = (e: KeyboardEvent) => e.target instanceof Element && e.target.ownerDocument !== doc && !!e.target.closest(".ecx-listview");
    const onKey = (e: KeyboardEvent) => {
      // Ô gõ (ProseMirror) đã xử lý phím này
      if (e.defaultPrevented) return;
      const outer = fromTree(e);
      if (e.target instanceof Element && e.target.ownerDocument !== doc && !outer) return; // phím của trang ngoài ngoài Cây khối: không phải của khung soạn
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); return; }
      if (mod && k === "y") { e.preventDefault(); store.redo(); return; }
      if (typing(outer ? (e.target as Element) : doc.activeElement)) return;
      // Phím điều hướng của trình duyệt khi không gõ chữ (Safari: ⌘← / ⌘→ = quay lại / tới trang; Backspace ở trình duyệt cũ)
      // → chặn, không thì rời trình soạn và mất bài đang sửa
      if ((e.metaKey || e.altKey) && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !store.getState().range) { e.preventDefault(); return; }
      // Đang chọn chữ qua nhiều khối: xoá / gõ đè / Enter / mở rộng / thu về
      const range = store.getState().range;
      if (range) {
        if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); now(() => store.deleteRange()); return; }
        if (e.key === "Escape") { e.preventDefault(); store.clearSelection(); return; }
        if (e.key === "Enter") {
          e.preventDefault();
          now(() => store.batch(() => { if (store.deleteRange()) { const c = store.getState().caret; if (c) store.splitText(c.id, c.offset); } }));
          return;
        }
        if (e.shiftKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); store.extendRange(e.key === "ArrowDown" ? 1 : -1); return; }
        if (!e.shiftKey && /^Arrow/.test(e.key)) {
          e.preventDefault();
          const info = store.rangeInfo();
          const p = info && (e.key === "ArrowDown" || e.key === "ArrowRight" ? info.to : info.from);
          if (p) store.focusText(p.id, p.offset);
          return;
        }
        if (!mod && !e.altKey && e.key.length === 1) { e.preventDefault(); now(() => store.deleteRange(e.key)); return; }
      }
      if (e.key === "Backspace" && !store.getState().selection.ids.length) { e.preventDefault(); return; }
      const ids = store.getState().selection.ids;
      if (mod && k === "a") {
        e.preventDefault();
        store.select(store.getState().docs[store.activeDocId].blocks.map((b) => b.id), { editing: null });
        return;
      }
      if (ui.zoomOut) {
        // Thu nhỏ: Enter / Esc về cỡ thường; mũi tên đi giữa các phần
        if (e.key === "Escape" || (e.key === "Enter" && ids.length)) { e.preventDefault(); zoomIn(store, ui); return; }
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !e.shiftKey) {
          e.preventDefault();
          const top = store.getState().docs[store.activeDocId]?.blocks ?? [];
          const i = ids.length ? top.findIndex((b) => b.id === ids[0]) : -1;
          const next = top[Math.max(0, Math.min(top.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
          if (next) { store.select([next.id], { editing: null }); ui.blockEl(next.id)?.scrollIntoView({ block: "nearest" }); }
          return;
        }
      }
      if (!ids.length) return;
      if (e.altKey && e.key === "F10") { e.preventDefault(); ui.focusToolbar(); return; }
      if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); store.remove(ids); return; }
      if (e.key === "Escape") { e.preventDefault(); store.clearSelection(); ui.openInserter(null); return; }
      if (e.key === "Enter" && ids.length === 1) {
        e.preventDefault();
        const b = store.block(ids[0]);
        if (b?.inline) store.focusText(b.id, -1);
        else insertSibling(store, ids[0], 1);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const loc = store.locate(ids[dir > 0 ? ids.length - 1 : 0]);
        if (!loc) return;
        const order = flatten(store.getState().docs[loc.docId].blocks).filter((b) => !HIDDEN_NAV.has(b.type));
        const i = order.findIndex((b) => b.id === loc.block.id);
        const next = order[i + dir];
        if (!next) return;
        if (e.shiftKey) store.selectRange(next.id); else store.select([next.id], { editing: null });
        if (outer) document.querySelector<HTMLElement>(`.ecx-listview [data-block="${next.id}"]`)?.focus(); // đang ở Cây khối: giữ focus ở cây
        else ui.blockEl(next.id)?.focus({ preventScroll: false });
        return;
      }
      if (mod && e.shiftKey && k === "d") { e.preventDefault(); store.duplicate(ids); return; }
      if (e.altKey && e.shiftKey && k === "z") { e.preventDefault(); store.remove(ids); return; }
      if (mod && e.altKey && k === "t") { e.preventDefault(); insertSibling(store, ids[0], 0); return; }
      if (mod && e.altKey && k === "y") { e.preventDefault(); insertSibling(store, ids[ids.length - 1], 1); return; }
    };
    const selectedNodes = (): BNode[] => {
      if (store.getState().range) return store.rangeContent();
      const ids = store.getState().selection.ids;
      const loc = ids.length ? store.locate(ids[0]) : null;
      if (!loc) return [];
      return topLevelOrdered(store.getState().docs[loc.docId].blocks, ids).map((id) => store.block(id)!).filter(Boolean);
    };
    const onCopy = (e: ClipboardEvent, cut = false) => {
      if (typing(doc.activeElement) || !e.clipboardData) return;
      const nodes = selectedNodes();
      if (!nodes.length) return;
      const s = serializeBlocks(nodes);
      e.clipboardData.setData(BLOCKS_MIME, s.json);
      e.clipboardData.setData("text/html", s.html);
      e.clipboardData.setData("text/plain", s.text);
      e.preventDefault();
      if (cut && store.getState().range) store.deleteRange();
      else if (cut) store.remove(nodes.map((n) => n.id));
    };
    const onPaste = (e: ClipboardEvent) => {
      if (typing(doc.activeElement) || !e.clipboardData) return;
      const nodes = blocksFromClipboard(e.clipboardData);
      if (!nodes.length) return;
      e.preventDefault();
      // Dán đè lên dải chữ: xoá rồi chèn sau khối còn lại
      if (store.getState().range && store.deleteRange()) { const c = store.getState().caret; if (c) { store.insertAfter(c.id, nodes, { replaceEmpty: true }); return; } }
      const ids = store.getState().selection.ids;
      if (ids.length) store.insertAfter(ids[ids.length - 1], nodes, { replaceEmpty: false });
      else {
        const docId = store.activeDocId;
        store.insert(docId, null, store.getState().docs[docId].blocks.length, nodes);
      }
    };
    const cut = (e: ClipboardEvent) => onCopy(e, true);
    doc.addEventListener("keydown", onKey);
    document.addEventListener("keydown", onKey); // Cây khối nằm ở trang ngoài
    doc.addEventListener("copy", onCopy as EventListener);
    doc.addEventListener("cut", cut as EventListener);
    doc.addEventListener("paste", onPaste as EventListener);
    return () => {
      doc.removeEventListener("keydown", onKey);
      document.removeEventListener("keydown", onKey);
      doc.removeEventListener("copy", onCopy as EventListener);
      doc.removeEventListener("cut", cut as EventListener);
      doc.removeEventListener("paste", onPaste as EventListener);
    };
  }, [doc, store, ui]);
}

/** Khối không chọn riêng bằng phím mũi tên (đi thẳng vào chữ bên trong). */
const HIDDEN_NAV = new Set(["listItem", "taskItem", "tableRow"]);

/** Thôi thu nhỏ: phần đang chọn cuộn vào giữa màn hình. */
export function zoomIn(store: { getState(): { selection: { ids: string[] } } }, ui: { setZoomOut(v: boolean): void; blockEl(id: string): HTMLElement | null }) {
  ui.setZoomOut(false);
  const id = store.getState().selection.ids[0];
  if (id) requestAnimationFrame(() => ui.blockEl(id)?.scrollIntoView({ block: "center" }));
}

/**
 * Tô dải chữ chọn qua nhiều khối: CSS Custom Highlight (không đụng vùng chọn / focus của ô gõ); khối nguyên ở giữa (ảnh…)
 * có viền chọn. Trình duyệt chưa có Highlight → tô cả khối chữ.
 */
function useRangeHighlight(doc: Document): boolean {
  const { store, ui } = useEditor();
  const range = useEditorState((s) => s.range);
  const revision = useEditorState((s) => s.revision);
  useLayoutEffect(() => {
    const win = doc.defaultView as (Window & { Highlight?: new (...r: Range[]) => unknown; CSS: { highlights?: Map<string, unknown> } }) | null;
    const marked: HTMLElement[] = [];
    const info = range ? store.rangeInfo() : null;
    if (info && win) {
      const a = richViews.get(info.from.id), b = richViews.get(info.to.id);
      const highlights = win.CSS?.highlights;
      if (a && b && highlights && win.Highlight) {
        try {
          const r = doc.createRange();
          const s = a.domAtPos(Math.min(info.from.offset, a.state.doc.content.size)), t = b.domAtPos(Math.min(info.to.offset, b.state.doc.content.size));
          r.setStart(s.node, s.offset);
          r.setEnd(t.node, t.offset);
          highlights.set("ecx-range", new win.Highlight(r));
        } catch { highlights.delete("ecx-range"); }
      } else for (const tb of info.texts) { const el = ui.blockEl(tb.id); if (el) { el.classList.add("is-in-range"); marked.push(el); } }
      for (const id of info.whole) { const el = ui.blockEl(id); if (el) { el.classList.add("is-in-range"); marked.push(el); } }
    }
    return () => {
      win?.CSS?.highlights?.delete("ecx-range");
      for (const el of marked) el.classList.remove("is-in-range");
    };
  }, [range, revision, doc, store, ui]);
  return !!range;
}
