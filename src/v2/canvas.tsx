import { collectStyles, normalizeStyle, presetCss, type BlockStyle } from "@ecomcx/ecomweb-content";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DocBlocks } from "./blocklist";
import { BLOCKS_MIME, blocksFromClipboard, serializeBlocks } from "./clipboard";
import { DocScopeProvider, useEditor, useEditorState } from "./context";
import { CANVAS_CSS } from "./canvas-css";
import { makeBlock, type BNode } from "./model";
import { flatten, topLevelOrdered } from "./ops";
import { insertSibling } from "./richtext";

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
export function Canvas({ device = "desktop", className, contentClassName = "ecx-content", before, after }: CanvasProps) {
  const { ui, labels } = useEditor();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);

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

  const width = DEVICE_WIDTH[device];
  return (
    <div className={["ecx-canvas-wrap", `is-${device}`, className].filter(Boolean).join(" ")}>
      <iframe ref={frameRef} className="ecx-canvas-frame" title={labels.canvas} srcDoc={SRC_DOC} onLoad={onLoad}
        style={{ width: width ? `${width}px` : "100%" }} data-ecx-canvas="" />
      {doc && createPortal(<CanvasRoot doc={doc} contentClassName={contentClassName} before={before} after={after} />, doc.body)}
    </div>
  );
}

function CanvasRoot({ doc, contentClassName, before, after }: { doc: Document; contentClassName: string; before?: ReactNode; after?: ReactNode }) {
  const { store, labels } = useEditor();
  const focus = useEditorState((s) => s.focus[s.focus.length - 1] ?? null);
  const rootId = useEditorState((s) => s.rootId);
  const activeId = focus ?? rootId;
  const mode = useEditorState(useCallback((s) => s.docs[activeId]?.mode ?? "default", [activeId]));
  const title = useEditorState(useCallback((s) => s.docs[activeId]?.title, [activeId]));
  useCanvasStyles(doc);
  useCanvasKeys(doc);
  useCanvasEvents(doc);
  return (
    <div className={["ecx-canvas-root", contentClassName, focus && "is-focus-mode"].filter(Boolean).join(" ")} data-ecx-doc={activeId} tabIndex={-1}
      onMouseDown={(e) => {
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
      <DocScopeProvider value={{ docId: activeId, mode, depth: 0 }}><DocBlocks docId={activeId} /></DocScopeProvider>
      {!focus && after}
    </div>
  );
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
  const css = useMemo(() => {
    const styles: BlockStyle[] = [];
    for (const d of Object.values(docs)) for (const b of flatten(d.blocks)) {
      if (b.attrs.style && typeof b.attrs.style === "object") { const st = normalizeStyle(b.attrs.style); if (st) styles.push(st); }
    }
    return collectStyles(styles);
  }, [docs]);
  void store;
  useLayoutEffect(() => {
    let el = head.querySelector<HTMLStyleElement>("style[data-ecx=blocks]");
    if (!el) { el = doc.createElement("style"); el.dataset.ecx = "blocks"; head.appendChild(el); }
    el.textContent = css;
  }, [css, doc, head]);
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
    const onKey = (e: KeyboardEvent) => {
      // Ô gõ (ProseMirror) đã xử lý phím này
      if (e.defaultPrevented) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); return; }
      if (mod && k === "y") { e.preventDefault(); store.redo(); return; }
      if (typing(doc.activeElement)) return;
      const ids = store.getState().selection.ids;
      if (mod && k === "a") {
        e.preventDefault();
        store.select(store.getState().docs[store.activeDocId].blocks.map((b) => b.id), { editing: null });
        return;
      }
      if (!ids.length) return;
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
        ui.blockEl(next.id)?.focus({ preventScroll: false });
        return;
      }
      if (mod && e.shiftKey && k === "d") { e.preventDefault(); store.duplicate(ids); return; }
      if (e.altKey && e.shiftKey && k === "z") { e.preventDefault(); store.remove(ids); return; }
      if (mod && e.altKey && k === "t") { e.preventDefault(); insertSibling(store, ids[0], 0); return; }
      if (mod && e.altKey && k === "y") { e.preventDefault(); insertSibling(store, ids[ids.length - 1], 1); return; }
    };
    const selectedNodes = (): BNode[] => {
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
      if (cut) store.remove(nodes.map((n) => n.id));
    };
    const onPaste = (e: ClipboardEvent) => {
      if (typing(doc.activeElement) || !e.clipboardData) return;
      const nodes = blocksFromClipboard(e.clipboardData);
      if (!nodes.length) return;
      e.preventDefault();
      const ids = store.getState().selection.ids;
      if (ids.length) store.insertAfter(ids[ids.length - 1], nodes, { replaceEmpty: false });
      else {
        const docId = store.activeDocId;
        store.insert(docId, null, store.getState().docs[docId].blocks.length, nodes);
      }
    };
    const cut = (e: ClipboardEvent) => onCopy(e, true);
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("copy", onCopy as EventListener);
    doc.addEventListener("cut", cut as EventListener);
    doc.addEventListener("paste", onPaste as EventListener);
    return () => {
      doc.removeEventListener("keydown", onKey);
      doc.removeEventListener("copy", onCopy as EventListener);
      doc.removeEventListener("cut", cut as EventListener);
      doc.removeEventListener("paste", onPaste as EventListener);
    };
  }, [doc, store, ui]);
}

/** Khối không chọn riêng bằng phím mũi tên (đi thẳng vào chữ bên trong). */
const HIDDEN_NAV = new Set(["listItem", "taskItem", "tableRow"]);
