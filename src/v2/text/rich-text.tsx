import type { RichNode } from "@ecomcx/ecomweb-content";
import { toggleMark } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { EditorState, Plugin, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createElement, useLayoutEffect, useRef, type CSSProperties, type Ref } from "react";
import { flushSync } from "react-dom";
import { useEditor, useEditorState, type EditorUi } from "../context";
import { inlineLength, makeBlock, type BNode } from "../core/model";
import { charToPos, docToInline, inlineToDoc, sameInline, type SchemaKind } from "./rich-schema";
import type { BlockProps } from "../core/registry";
import type { EditorStore } from "../core/store";
import { pasteIntoBlock } from "./paste";
import { flatten } from "../core/ops";

/**
 * Ô gõ chữ: ProseMirror gắn thẳng vào phần tử của khối (<p>, <h2>…) — không thêm thẻ bọc, nên CSS của theme áp đúng.
 * - Chế độ khối chữ (mặc định): chữ là `block.inline`; Enter tách khối, Backspace đầu khối nối khối trước…
 * - Chế độ thuộc tính (`onChange`): sửa một thuộc tính chữ (chữ trên nút, chú thích) — một dòng, không tách khối.
 */
export interface RichTextProps {
  blockId: string;
  value: RichNode[] | string | undefined;
  tagName?: string;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  /** Hiện chữ gợi ý cả khi không đang gõ (tiêu đề, chú thích). Mặc định chỉ khi đang gõ. */
  placeholderAlways?: boolean;
  /** Enter xuống dòng trong khối (mã nguồn). */
  multiline?: boolean;
  /** Không định dạng chữ. */
  plain?: boolean;
  /** Enter xuống dòng (hardBreak) thay vì tách khối, vẫn giữ định dạng (văn bản định dạng sẵn). */
  breakOnEnter?: boolean;
  /** Sửa thuộc tính (chuỗi) thay vì chữ của khối. */
  onChange?(value: string): void;
  /** Gắn props của khối vào chính ô gõ (khi ô gõ là phần tử gốc của khối). */
  blockProps?: BlockProps;
  editable?: boolean;
  /** Định danh phụ (một khối có nhiều ô gõ thuộc tính). */
  field?: string;
  "aria-label"?: string;
}

/** ProseMirror đang mở theo khối (thanh công cụ định dạng, liên kết đọc/ghi qua đây). */
export const richViews = new Map<string, EditorView>();
const viewKey = (blockId: string, field?: string) => (field ? `${blockId}#${field}` : blockId);

/** Loại schema của ô gõ: mã nguồn (chữ thuần, giữ khoảng trắng), định dạng sẵn (giữ khoảng trắng, có định dạng), chữ thường. */
const schemaKind = (p: RichTextProps): SchemaKind => (p.plain || p.multiline ? "code" : p.breakOnEnter ? "pre" : "inline");
const toInline = (v: RichNode[] | string | undefined): RichNode[] => (typeof v === "string" ? (v ? [{ type: "text", text: v }] : []) : v ?? []);
const toPlainString = (inline: RichNode[]) => inline.map((n) => (n.type === "text" ? n.text ?? "" : n.type === "hardBreak" ? "\n" : "")).join("");

export function RichText(props: RichTextProps) {
  const ctx = useEditor();
  const { store, ui } = ctx;
  const elRef = useRef<HTMLElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const lastValue = useRef<RichNode[]>(toInline(props.value));
  const key = viewKey(props.blockId, props.field);
  const editable = props.editable !== false;

  useLayoutEffect(() => {
    const el = elRef.current!;
    const state = EditorState.create({ doc: inlineToDoc(lastValue.current, schemaKind(propsRef.current)), plugins: [richKeymap(store, ui, propsRef, () => ctx.prefs.get().keepCaretInsideBlock), selectionReporter(store, ui, propsRef)] });
    const view = new EditorView({ mount: el }, {
      state,
      editable: () => propsRef.current.editable !== false,
      attributes: { role: "textbox", "aria-multiline": propsRef.current.onChange ? "false" : "true" },
      dispatchTransaction(tr) {
        const v = viewRef.current;
        if (!v) return;
        const next = v.state.apply(tr);
        v.updateState(next);
        syncEmpty(v);
        if (!tr.docChanged || tr.getMeta("external")) return;
        ui.fresh.delete(propsRef.current.blockId);
        const inline = docToInline(next.doc);
        lastValue.current = inline;
        const p = propsRef.current;
        if (p.onChange) p.onChange(toPlainString(inline));
        else {
          store.setInline(p.blockId, inline, { id: p.blockId, offset: next.selection.from, to: next.selection.to });
          detectSlash(v, store, ui, p);
        }
      },
      handleTextInput: (v, from, to, text) => inputRule(v, store, propsRef.current, from, to, text),
      handleKeyDown: (_v, e) => {
        if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter")) ui.setTyping(true);
        return false;
      },
      handlePaste: (v, event) => (propsRef.current.onChange ? false : pasteIntoBlock(ctx, propsRef.current.blockId, v, event)),
      handleDOMEvents: {
        keydown: (v, e) => {
          if (e.key === "Backspace" && !e.metaKey && !e.ctrlKey && !e.altKey) {
            syncSelection(v);
            backspaceKeydown.set(v, { start: atStart(v), t: Date.now() });
          }
          return false;
        },
        // Kéo chuột từ ô này sang khối chữ khác → chọn chữ qua nhiều khối
        // Chữ mẫu chưa sửa: nhả chuột xong mà chỉ có con trỏ (không kéo chọn) → chọn hết để gõ là thay
        mouseup: (v) => {
          const p = propsRef.current;
          if (ui.fresh.has(p.blockId) && v.state.selection.empty && v.state.doc.content.size > 0) setTimeout(() => { if (ui.fresh.has(p.blockId) && v.hasFocus() && v.state.selection.empty) v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, 0, v.state.doc.content.size))); }, 0);
          return false;
        },
        mousedown: (v, e) => {
          const p = propsRef.current;
          // Ô trống: bấm chỗ nào (kể cả giữa chữ gợi ý) con trỏ cũng về đầu ô — không để trình duyệt tự đặt theo toạ độ chuột lên chữ gợi ý
          if (e.button === 0 && !e.shiftKey && !e.metaKey && !e.ctrlKey && v.state.doc.content.size === 0 && v.editable) {
            e.preventDefault();
            v.focus();
            v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, 0)));
            return true;
          }
          if (e.button === 0 && !e.shiftKey && !p.onChange && !p.field) trackRangeDrag(store, v, p.blockId);
          return false;
        },
        focus: () => {
          const p = propsRef.current;
          ui.activeRich = viewKey(p.blockId, p.field);
          // Chữ mẫu của khối vừa chèn: chọn hết ở lần bấm đầu (sau khi chuột đặt con trỏ) để gõ là thay
          if (ui.fresh.has(p.blockId) && viewRef.current) { const v = viewRef.current; setTimeout(() => { if (ui.fresh.has(p.blockId) && v.hasFocus() && v.state.doc.content.size > 0) v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, 0, v.state.doc.content.size))); }, 0); }
          store.setEditing(p.blockId);
          ui.bump();
          return false;
        },
      },
    });
    viewRef.current = view;
    richViews.set(key, view);
    el.setAttribute("data-ecx-rich", "");
    if (propsRef.current.field) el.setAttribute("data-ecx-field", propsRef.current.field);
    syncEmpty(view);
    return () => {
      if (richViews.get(key) === view) richViews.delete(key);
      viewRef.current = null;
      view.destroy();
    };
    // Tạo lại khi đổi phần tử (h2 → h4: React thay thẻ mới); giá trị mới đồng bộ ở effect dưới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, props.tagName]);

  // Giá trị đổi từ ngoài (hoàn tác, nối khối, cộng tác) → thay nội dung, giữ con trỏ trong giới hạn
  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const inline = toInline(props.value);
    if (inline === lastValue.current || sameInline(inline, lastValue.current)) return;
    lastValue.current = inline;
    const doc = inlineToDoc(inline, schemaKind(props));
    const { from, to } = view.state.selection;
    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content).setMeta("external", true).setMeta("addToHistory", false);
    const size = tr.doc.content.size;
    tr.setSelection(TextSelection.create(tr.doc, Math.min(from, size), Math.min(to, size)));
    view.dispatch(tr);
  }, [props.value, props.plain, props.multiline, props.breakOnEnter]);

  // Yêu cầu đặt con trỏ (tách/nối khối, điều hướng, hoàn tác) — đồng bộ ngay sau khi vẽ, trước khi phím kế tiếp tới
  const caret = useEditorState((s) => (s.caret && s.caret.id === props.blockId && !props.field ? s.caret : null));
  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!caret || !view) return;
    store.consumeCaret(props.blockId);
    const doc = view.state.doc;
    const from = charToPos(doc, caret.offset);
    const to = caret.to != null ? charToPos(doc, caret.to) : from;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, from, to)).setMeta("external", true));
    // Firefox: đưa focus vào ô trong iframe từ trang ngoài (thanh công cụ, cây khối) phải focus cửa sổ iframe trước
    const win = view.dom.ownerDocument.defaultView;
    if (win && win !== window && !view.dom.ownerDocument.hasFocus()) win.focus();
    view.focus();
  }, [caret, props.blockId, store]);

  const bp = props.blockProps;
  const ref: Ref<HTMLElement> = (el) => {
    elRef.current = el;
    const r = bp?.ref;
    if (typeof r === "function") r(el);
    else if (r && typeof r === "object") (r as { current: HTMLElement | null }).current = el;
  };
  const className = ["ProseMirror", "ecx-rich", bp?.className, props.className].filter(Boolean).join(" ");
  return createElement(props.tagName ?? "p", {
    ...bp,
    ref,
    className,
    style: { ...(bp?.style ?? {}), ...props.style },
    "data-placeholder": props.placeholder,
    "data-placeholder-always": props.placeholderAlways ? "" : undefined,
    "aria-label": props["aria-label"] ?? props.placeholder,
    suppressContentEditableWarning: true,
    contentEditable: editable,
  });
}

function syncEmpty(view: EditorView) {
  const empty = view.state.doc.content.size === 0;
  if (empty) {
    view.dom.setAttribute("data-empty", "");
    // Ô trống trong khung co theo nội dung (nút, hàng ngang, ô bảng…): giữ đủ rộng cho chữ gợi ý, không bị cắt / xuống dòng từng chữ
    (view.dom as HTMLElement).style.setProperty("--ecx-ph", String(view.dom.getAttribute("data-placeholder")?.length ?? 0));
  } else view.dom.removeAttribute("data-empty");
}

// ---------------------------------------------------------------------------
// Phím
// ---------------------------------------------------------------------------
type PropsRef = { current: RichTextProps };

/**
 * Đọc lại vùng chọn từ DOM trước khi xử lý phím: phím di chuyển (End, Home, chuột) đổi vùng chọn của DOM nhưng
 * ProseMirror chỉ biết khi sự kiện selectionchange tới (bất đồng bộ) — gõ nhanh "End rồi Enter" sẽ dùng vùng chọn cũ.
 */
function syncSelection(view: EditorView | undefined): EditorState | null {
  if (!view) return null;
  (view as unknown as { domObserver?: { flush?(): void } }).domObserver?.flush?.();
  return view.state;
}

/**
 * Backspace thật vừa bấm: con trỏ có ở đầu khối *trước khi* trình duyệt xoá không. ProseMirror (domchange.ts "Same for backspace") gọi lại
 * handleKeyDown giả sau khi đã đọc thay đổi DOM — lúc đó chữ đầu đã bị xoá, con trỏ về 0 nên atStart() sai và nối nhầm khối trên.
 * Có bản ghi này thì lấy "ở đầu khối" theo lúc bấm phím, không theo trạng thái sau khi xoá.
 */
const backspaceKeydown = new WeakMap<EditorView, { start: boolean; t: number }>();
function backspaceAtStart(view: EditorView): boolean {
  const rec = backspaceKeydown.get(view);
  if (rec && Date.now() - rec.t < 400) return rec.start;
  return atStart(view);
}

function atStart(view: EditorView) { const s = view.state.selection; return s.empty && s.from === 0; }
function atEnd(view: EditorView) { const s = view.state.selection; return s.empty && s.from === view.state.doc.content.size; }

/** Mục danh sách chứa khối chữ (khối chữ là con đầu của listItem). */
function listItemOf(store: EditorStore, blockId: string): BNode | null {
  const loc = store.locate(blockId);
  return loc?.parent && (loc.parent.type === "listItem") && loc.index === 0 ? loc.parent : null;
}

/** Ô gõ kế bên theo thứ tự trên khung soạn (đi xuyên qua header/footer lồng nhau). */
export function neighborRich(ui: EditorUi, el: HTMLElement, dir: -1 | 1): HTMLElement | null {
  const doc = el.ownerDocument;
  const all = Array.from(doc.querySelectorAll<HTMLElement>("[data-ecx-rich]")).filter((e) => e.isContentEditable);
  const i = all.indexOf(el);
  void ui;
  return i < 0 ? null : all[i + dir] ?? null;
}

function focusNeighbor(store: EditorStore, ui: EditorUi, view: EditorView, dir: -1 | 1): boolean {
  const next = neighborRich(ui, view.dom as HTMLElement, dir);
  if (!next) return false;
  const id = next.closest<HTMLElement>("[data-ecx-block]")?.dataset.ecxBlock;
  const field = next.dataset.ecxField;
  if (id && !field) { now(() => store.focusText(id, dir < 0 ? -1 : 0)); return true; }
  const v = [...richViews.entries()].find(([, x]) => x.dom === next)?.[1];
  if (!v) return false;
  v.focus();
  const pos = dir < 0 ? v.state.doc.content.size : 0;
  v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, pos)));
  return true;
}

/**
 * Chạy thao tác của store rồi vẽ lại NGAY (không đợi React gom): khối mới có mặt và nhận con trỏ trước khi phím kế tiếp tới
 * — gõ nhanh sau Enter không lọt chữ vào khối cũ.
 */
export function now<T>(fn: () => T): T {
  let out!: T;
  flushSync(() => { out = fn(); });
  return out;
}

function richKeymap(store: EditorStore, ui: EditorUi, pr: PropsRef, keepCaret: () => boolean = () => false): Plugin {
  // Tuỳ chọn "Giữ con trỏ trong khối": mũi tên ở đầu/cuối khối không nhảy sang khối khác
  const nav = (view: EditorView, dir: -1 | 1) => !keepCaret() && focusNeighbor(store, ui, view, dir);
  const textMode = () => !pr.current.onChange;
  const slashKey = (key: string) => () => (ui.inserter?.mode === "slash" && ui.inserter.blockId === pr.current.blockId && ui.inserterKey ? ui.inserterKey(key) : false);
  /** Lệnh dùng vùng chọn mới nhất (đọc lại từ DOM). */
  const fresh = (cmd: (state: EditorState, dispatch: EditorView["dispatch"] | undefined, view: EditorView | undefined) => boolean) =>
    (state: EditorState, dispatch?: EditorView["dispatch"], view?: EditorView) => {
      const s = syncSelection(view) ?? state;
      return cmd(s, view ? view.dispatch.bind(view) : dispatch, view);
    };
  // Đọc lại vùng chọn từ DOM trước khi đổi định dạng: Shift+End rồi ⌘B ngay (<50ms) thì ProseMirror chưa kịp nhận vùng chọn → chỉ đặt storedMarks
  const mark = (name: string) => fresh((state, dispatch) => (state.schema.marks[name] ? toggleMark(state.schema.marks[name])(state, dispatch) : false));
  return keymap({
    ArrowDown: (_s, _d, view) => slashKey("ArrowDown")() || (!!view && view.endOfTextblock("down") && nav(view, 1)),
    ArrowUp: (_s, _d, view) => slashKey("ArrowUp")() || (!!view && view.endOfTextblock("up") && nav(view, -1)),
    // Shift+mũi tên ra ngoài khối: chọn chữ sang khối kế
    "Shift-ArrowDown": (_s, _d, view) => !!view && textMode() && !pr.current.field && view.endOfTextblock("down") && startRange(store, view, pr.current.blockId, 1),
    "Shift-ArrowUp": (_s, _d, view) => !!view && textMode() && !pr.current.field && view.endOfTextblock("up") && startRange(store, view, pr.current.blockId, -1),
    ArrowLeft: fresh((_s, _d, view) => !!view && atStart(view) && nav(view, -1)),
    ArrowRight: fresh((_s, _d, view) => !!view && atEnd(view) && nav(view, 1)),
    Escape: (_s, _d, view) => {
      if (slashKey("Escape")()) return true;
      store.select([pr.current.blockId]);
      (view?.dom as HTMLElement | undefined)?.blur();
      return true;
    },
    Tab: () => {
      if (slashKey("Enter")()) return true;
      const item = textMode() ? listItemOf(store, pr.current.blockId) : null;
      if (!item) return false;
      now(() => store.indentItem(item.id));
      return true;
    },
    "Shift-Tab": () => {
      const item = textMode() ? listItemOf(store, pr.current.blockId) : null;
      if (!item) return false;
      now(() => store.outdentItem(item.id, true));
      return true;
    },
    Enter: fresh((state, dispatch, view) => {
      if (slashKey("Enter")()) return true;
      const p = pr.current;
      if (!textMode()) return true;
      if (p.breakOnEnter) {
        dispatch?.(state.tr.replaceSelectionWith(state.schema.nodes.hardBreak.create()).scrollIntoView());
        return true;
      }
      if (p.multiline) {
        const text = state.doc.textContent;
        // Mã nguồn: Enter ở dòng trống cuối cùng → thoát ra đoạn văn mới (bỏ dòng trống)
        if (atEnd(view!) && text.endsWith("\n")) {
          const trimmed = text.replace(/\n+$/, "");
          now(() => store.batch(() => {
            store.setInline(p.blockId, trimmed ? [{ type: "text", text: trimmed }] : []);
            store.splitText(p.blockId, trimmed.length);
          }));
          return true;
        }
        dispatch?.(state.tr.insertText("\n"));
        return true;
      }
      // "---" + Enter → khoảng cách có đường kẻ (Spacer)
      const blk = store.block(p.blockId);
      if (blk?.type === "paragraph" && state.doc.textContent === "---") {
        const hr = makeBlock("spacer", { height: "md", line: true });
        const para = makeBlock("paragraph");
        now(() => store.replace(p.blockId, [hr, para], { select: { ids: [], editing: para.id }, caret: { id: para.id, offset: 0 } }));
        return true;
      }
      now(() => store.splitText(p.blockId, state.selection.from, state.selection.to));
      return true;
    }),
    "Shift-Enter": fresh((state, dispatch) => {
      if (!state.schema.nodes.hardBreak) dispatch?.(state.tr.insertText("\n"));
      else dispatch?.(state.tr.replaceSelectionWith(state.schema.nodes.hardBreak.create()).scrollIntoView());
      return true;
    }),
    Backspace: fresh((_s, _d, view) => {
      if (!view || !backspaceAtStart(view) || !textMode()) return false;
      now(() => store.mergeBackward(pr.current.blockId));
      return true;
    }),
    Delete: fresh((_s, _d, view) => {
      if (!view || !atEnd(view) || !textMode()) return false;
      now(() => store.mergeForward(pr.current.blockId));
      return true;
    }),
    "Mod-a": fresh(() => {
      // Một lần bấm chọn mọi khối của tài liệu (như Word / Docs: ⌘A ⌘C ⌘V chép cả bài). Tài liệu chỉ có một khối → để ProseMirror chọn chữ trong khối.
      // Muốn chọn riêng chữ của một khối: bấm ba lần (chọn đoạn) hoặc kéo chuột.
      if (!textMode()) return false;
      const loc = store.locate(pr.current.blockId);
      if (!loc) return false;
      const all = store.getState().docs[loc.docId].blocks;
      if (all.length < 2) return false;
      store.select(all.map((b) => b.id), { editing: null });
      return true;
    }),
    "Alt-F10": () => { ui.focusToolbar(); return true; },
    "Mod-z": () => { now(() => store.undo()); return true; },
    "Mod-Shift-z": () => { now(() => store.redo()); return true; },
    "Mod-y": () => { now(() => store.redo()); return true; },
    "Mod-b": mark("bold"),
    "Mod-i": mark("italic"),
    "Mod-u": mark("underline"),
    "Mod-Shift-x": mark("strike"),
    "Mod-e": mark("code"),
    "Mod-k": () => { if (pr.current.plain || pr.current.multiline) return false; ui.openLink?.(viewKey(pr.current.blockId, pr.current.field)); return true; },
    "Mod-Shift-d": () => { if (!textMode()) return false; store.duplicate([pr.current.blockId]); return true; },
    "Shift-Alt-z": () => { if (!textMode()) return false; store.remove([pr.current.blockId]); return true; },
    "Mod-Alt-t": () => { insertSibling(store, pr.current.blockId, 0); return true; },
    "Mod-Alt-y": () => { insertSibling(store, pr.current.blockId, 1); return true; },
    "Mod-Shift-Alt-t": () => { store.moveBy([pr.current.blockId], -1); return true; },
    "Mod-Shift-Alt-y": () => { store.moveBy([pr.current.blockId], 1); return true; },
  });
}

/** Thêm đoạn văn trống trước (0) / sau (1) khối. */
export function insertSibling(store: EditorStore, blockId: string, after: 0 | 1) {
  const loc = store.locate(blockId);
  if (!loc) return;
  const p = makeBlock("paragraph");
  store.insert(loc.docId, loc.parent?.id ?? null, loc.index + after, [p]);
}

/** Báo vị trí con trỏ cho store (hoàn tác trả con trỏ về đúng chỗ) và cho thanh công cụ (định dạng đang bật). */
function selectionReporter(store: EditorStore, ui: EditorUi, pr: PropsRef): Plugin {
  return new Plugin({
    view: () => ({
      update(view, prev) {
        if (view.state.selection.eq(prev.selection) && view.state.doc.eq(prev.doc)) return;
        if (!view.hasFocus()) return;
        const s = view.state.selection;
        if (!pr.current.onChange) store.reportCaret({ id: pr.current.blockId, offset: s.from, to: s.to });
        if (!view.state.doc.eq(prev.doc)) return ui.bump();
        // Di chuyển con trỏ: lần gõ sau là một bước hoàn tác mới
        store.breakMerge();
        ui.bump();
      },
    }),
  });
}

// ---------------------------------------------------------------------------
// Gõ tắt kiểu Markdown + slash
// ---------------------------------------------------------------------------
const PREFIX_RULES: Array<{ re: RegExp; make(rest: RichNode[]): { blocks: BNode[]; focus: BNode } }> = [
  ...[1, 2, 3, 4, 5, 6].map((level) => ({
    re: new RegExp(`^#{${level}}$`),
    make: (rest: RichNode[]) => { const h = makeBlock("heading", { level }, rest); return { blocks: [h], focus: h }; },
  })),
  { re: /^[-*+]$/, make: (rest) => { const p = makeBlock("paragraph", {}, rest); return { blocks: [makeBlock("bulletList", {}, [makeBlock("listItem", {}, [p])])], focus: p }; } },
  { re: /^1[.)]$/, make: (rest) => { const p = makeBlock("paragraph", {}, rest); return { blocks: [makeBlock("orderedList", {}, [makeBlock("listItem", {}, [p])])], focus: p }; } },
  { re: /^>$/, make: (rest) => { const p = makeBlock("paragraph", {}, rest); return { blocks: [makeBlock("blockquote", {}, [p])], focus: p }; } },
];

function inputRule(view: EditorView, store: EditorStore, p: RichTextProps, from: number, to: number, text: string): boolean {
  if (p.onChange || p.plain) return false;
  const blk = store.block(p.blockId);
  if (!blk || blk.type !== "paragraph") return false;
  const before = view.state.doc.textBetween(0, from, "\n", "￼");
  if (text === " " && from === to) {
    const rule = PREFIX_RULES.find((r) => r.re.test(before));
    if (!rule) return false;
    // Nằm trong mục danh sách thì không đổi thành danh sách lồng (tránh "- " trong danh sách)
    if (listItemOf(store, p.blockId) && !rule.re.test("#")) return false;
    const rest = docToInline(view.state.doc.cut(to));
    const { blocks, focus } = rule.make(rest);
    now(() => store.replace(p.blockId, blocks, { select: { ids: [], editing: focus.id }, caret: { id: focus.id, offset: 0 } }));
    return true;
  }
  if (text === "`" && before === "``" && from === to && from === 2) {
    const code = makeBlock("codeBlock", {}, docToInline(view.state.doc.cut(to)).filter((n) => n.type === "text").map((n) => ({ type: "text", text: n.text })));
    now(() => store.replace(p.blockId, [code], { select: { ids: [], editing: code.id }, caret: { id: code.id, offset: 0 } }));
    return true;
  }
  // **đậm** / *nghiêng* / `mã`: gõ dấu đóng → áp định dạng, bỏ dấu
  if (from !== to) return false;
  const rules: Array<[RegExp, string, string, number]> = [[/\*\*([^*\s][^*]*)\*$/, "*", "bold", 2], [/(?:^|[^*])\*([^*\s][^*]*)$/, "*", "italic", 1], [/`([^`]+)$/, "`", "code", 1]];
  for (const [re, ch, markName, open] of rules) {
    if (text !== ch) continue;
    const m = re.exec(before);
    if (!m) continue;
    const inner = m[1];
    // bold: "**chữ*" + "*" — dấu đóng đầu tiên đã nằm trong chữ
    const closeTyped = markName === "bold" ? 1 : 0;
    const openStart = from - inner.length - open - closeTyped;
    const mk = view.state.schema.marks[markName].create();
    const tr = view.state.tr;
    if (closeTyped) tr.delete(from - 1, from);
    tr.delete(openStart, openStart + open).addMark(openStart, openStart + inner.length, mk).removeStoredMark(mk);
    view.dispatch(tr);
    return true;
  }
  return false;
}

function detectSlash(view: EditorView, store: EditorStore, ui: EditorUi, p: RichTextProps) {
  const text = view.state.doc.textContent;
  const blk = store.block(p.blockId);
  // "/" + từ khoá (cho phép nhiều từ: "/tieu de"), tối đa 40 ký tự
  const m = /^\/((?:[^\s/][^/]{0,39})?)$/.exec(text);
  const open = ui.inserter?.mode === "slash" && ui.inserter.blockId === p.blockId;
  if (m && blk?.type === "paragraph" && view.state.selection.from === view.state.doc.content.size && store.canRemove(p.blockId)) {
    const loc = store.locate(p.blockId)!;
    const r = caretRect(view, ui);
    ui.openInserter({ mode: "slash", docId: loc.docId, parentId: loc.parent?.id ?? null, index: loc.index, blockId: p.blockId, query: m[1], rect: r });
  } else if (open) ui.openInserter(null);
}

/** Toạ độ con trỏ theo trang ngoài (popover neo vào đây). */
export function caretRect(view: EditorView, ui: EditorUi) {
  const c = view.coordsAtPos(view.state.selection.from);
  const f = ui.canvasFrame?.getBoundingClientRect();
  const scale = f && ui.canvasFrame ? f.width / (ui.canvasFrame.offsetWidth || f.width) || 1 : 1;
  const ox = f?.left ?? 0, oy = f?.top ?? 0;
  return { left: ox + c.left * scale, top: oy + c.top * scale, bottom: oy + c.bottom * scale };
}

export const isEmptyInline = (inline: RichNode[] | undefined) => !inlineLength(inline);

// ---------------------------------------------------------------------------
// Chọn chữ qua nhiều khối
// ---------------------------------------------------------------------------
/** Rời ô gõ, focus về khung soạn (phím của dải chữ do khung soạn xử lý), bỏ vùng chọn của trình duyệt. */
function leaveForRange(view: EditorView) {
  const doc = view.dom.ownerDocument;
  (view.dom as HTMLElement).blur();
  doc.getSelection()?.removeAllRanges();
  doc.querySelector<HTMLElement>(".ecx-canvas-root")?.focus({ preventScroll: true });
}

function startRange(store: EditorStore, view: EditorView, id: string, dir: -1 | 1): boolean {
  const loc = store.locate(id);
  if (!loc) return false;
  const order = flatten(store.getState().docs[loc.docId].blocks).filter((b) => b.inline);
  const next = order[order.findIndex((b) => b.id === id) + dir];
  if (!next) return false;
  const anchor = { id, offset: (syncSelection(view) ?? view.state).selection.anchor };
  leaveForRange(view);
  store.selectText(anchor, { id: next.id, offset: dir > 0 ? inlineLength(next.inline) : 0 });
  return true;
}

/** Nơi cuộn của khung soạn: chính tài liệu trong khung nếu nó cuộn, không thì tổ tiên cuộn được của iframe ở trang ngoài (admin thường để khung cao theo nội dung). */
function scrollerOf(doc: Document): { by(dy: number): void; top: number; bottom: number } {
  const win = doc.defaultView!;
  const own = doc.scrollingElement as HTMLElement | null;
  if (own && own.scrollHeight > win.innerHeight + 1) return { by: (dy) => win.scrollBy(0, dy), top: 0, bottom: win.innerHeight };
  const fe = win.frameElement as HTMLElement | null;
  if (!fe) return { by: (dy) => win.scrollBy(0, dy), top: 0, bottom: win.innerHeight };
  let el: HTMLElement | null = fe.parentElement;
  while (el && !(/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1)) el = el.parentElement;
  const host = el ?? (fe.ownerDocument.scrollingElement as HTMLElement);
  const hostRect = el ? el.getBoundingClientRect() : { top: 0, bottom: fe.ownerDocument.defaultView!.innerHeight };
  const f = fe.getBoundingClientRect();
  // Vùng nhìn thấy của host, đổi sang toạ độ bên trong khung
  return { by: (dy) => host.scrollBy(0, dy), top: hostRect.top - f.top, bottom: hostRect.bottom - f.top };
}

/** Theo chuột từ lúc bấm trong ô gõ tới lúc nhả: sang khối chữ khác → dải chữ; quay về ô cũ → chọn chữ trong ô. Giữ chuột ở mép khung thì tự cuộn theo. */
function trackRangeDrag(store: EditorStore, view: EditorView, id: string) {
  const doc = view.dom.ownerDocument;
  let anchor: number | null = null;
  let crossed = false;
  let last: { x: number; y: number } | null = null;
  let raf = 0;
  /** Ô chữ dưới chuột; chuột nằm ở khoảng trống (lề, khoảng cách giữa khối, dưới khối cuối) → ô chữ gần nhất theo chiều dọc, toạ độ kẹp vào trong ô đó. */
  const richAt = (x: number, y: number): { el: HTMLElement; x: number; y: number } | null => {
    const hit = (doc.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-ecx-rich]:not([data-ecx-field])");
    if (hit) return { el: hit, x, y };
    let best: HTMLElement | null = null, bestD = Infinity;
    doc.querySelectorAll<HTMLElement>("[data-ecx-rich]:not([data-ecx-field])").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.height) return;
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d < bestD) { bestD = d; best = el; }
    });
    if (!best || bestD > 160) return null;
    const r = (best as HTMLElement).getBoundingClientRect();
    return { el: best, x: Math.max(r.left + 1, Math.min(r.right - 1, x)), y: Math.max(r.top + 1, Math.min(r.bottom - 1, y)) };
  };
  const apply = (px: number, py: number, e?: MouseEvent) => {
    const at = richAt(px, py);
    const bid = at?.el.closest<HTMLElement>("[data-ecx-block]")?.dataset.ecxBlock;
    if (!at || !bid) return;
    const target = bid === id ? view : richViews.get(bid);
    if (!target) return;
    if (bid === id && !crossed) return; // trong cùng ô: ProseMirror tự chọn
    if (anchor == null) anchor = view.state.selection.anchor;
    const pos = target.posAtCoords({ left: at.x, top: at.y })?.pos ?? 0;
    if (!crossed) { crossed = true; leaveForRange(view); }
    e?.preventDefault();
    store.selectText({ id, offset: anchor }, { id: bid, offset: pos });
    if (bid === id) crossed = false;
  };
  // Tự cuộn: chuột trong vùng 56px sát mép trên / dưới → cuộn (nhanh dần theo độ sát mép), rồi cập nhật vùng chọn theo khối mới dưới chuột
  const tick = () => {
    raf = 0;
    if (!last || !crossed) return;
    const s = scrollerOf(doc), zone = 56;
    let dy = 0;
    if (last.y > s.bottom - zone) dy = Math.min(28, 4 + (last.y - (s.bottom - zone)) / 2);
    else if (last.y < s.top + zone) dy = -Math.min(28, 4 + ((s.top + zone) - last.y) / 2);
    if (dy) { s.by(dy); apply(last.x, Math.max(s.top + 1, Math.min(s.bottom - 1, last.y))); raf = requestAnimationFrame(tick); }
  };
  const move = (e: MouseEvent) => {
    if (!(e.buttons & 1)) return up();
    last = { x: e.clientX, y: e.clientY };
    apply(e.clientX, e.clientY, e);
    if (crossed && !raf) raf = requestAnimationFrame(tick);
  };
  const up = () => {
    if (raf) cancelAnimationFrame(raf);
    doc.removeEventListener("mousemove", move);
    doc.removeEventListener("mouseup", up);
    if (store.getState().range) { doc.getSelection()?.removeAllRanges(); doc.querySelector<HTMLElement>(".ecx-canvas-root")?.focus({ preventScroll: true }); }
  };
  doc.addEventListener("mousemove", move);
  doc.addEventListener("mouseup", up);
}
