import type { RichNode } from "@ecomcx/ecomweb-content";
import { toggleMark } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { EditorState, Plugin, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createElement, useLayoutEffect, useRef, type CSSProperties, type Ref } from "react";
import { flushSync } from "react-dom";
import { useEditor, useEditorState, type EditorUi } from "./context";
import { inlineLength, makeBlock, type BNode } from "./model";
import { charToPos, docToInline, inlineToDoc, sameInline, type SchemaKind } from "./richschema";
import type { BlockProps } from "./registry";
import type { EditorStore } from "./store";
import { pasteIntoBlock } from "./clipboard";

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
        focus: () => {
          const p = propsRef.current;
          ui.activeRich = viewKey(p.blockId, p.field);
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
  if (empty) view.dom.setAttribute("data-empty", "");
  else view.dom.removeAttribute("data-empty");
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

function atStart(view: EditorView) { const s = view.state.selection; return s.empty && s.from === 0; }
function atEnd(view: EditorView) { const s = view.state.selection; return s.empty && s.from === view.state.doc.content.size; }

/** Mục danh sách chứa khối chữ (khối chữ là con đầu của listItem/taskItem). */
function listItemOf(store: EditorStore, blockId: string): BNode | null {
  const loc = store.locate(blockId);
  return loc?.parent && (loc.parent.type === "listItem" || loc.parent.type === "taskItem") && loc.index === 0 ? loc.parent : null;
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
  const mark = (name: string) => (state: EditorState, dispatch?: EditorView["dispatch"]) => (state.schema.marks[name] ? toggleMark(state.schema.marks[name])(state, dispatch) : false);
  const slashKey = (key: string) => () => (ui.inserter?.mode === "slash" && ui.inserter.blockId === pr.current.blockId && ui.inserterKey ? ui.inserterKey(key) : false);
  /** Lệnh dùng vùng chọn mới nhất (đọc lại từ DOM). */
  const fresh = (cmd: (state: EditorState, dispatch: EditorView["dispatch"] | undefined, view: EditorView | undefined) => boolean) =>
    (state: EditorState, dispatch?: EditorView["dispatch"], view?: EditorView) => {
      const s = syncSelection(view) ?? state;
      return cmd(s, view ? view.dispatch.bind(view) : dispatch, view);
    };
  return keymap({
    ArrowDown: (_s, _d, view) => slashKey("ArrowDown")() || (!!view && view.endOfTextblock("down") && nav(view, 1)),
    ArrowUp: (_s, _d, view) => slashKey("ArrowUp")() || (!!view && view.endOfTextblock("up") && nav(view, -1)),
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
      // "---" + Enter → đường kẻ
      const blk = store.block(p.blockId);
      if (blk?.type === "paragraph" && state.doc.textContent === "---") {
        const hr = makeBlock("horizontalRule");
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
      if (!view || !atStart(view) || !textMode()) return false;
      now(() => store.mergeBackward(pr.current.blockId));
      return true;
    }),
    Delete: fresh((_s, _d, view) => {
      if (!view || !atEnd(view) || !textMode()) return false;
      now(() => store.mergeForward(pr.current.blockId));
      return true;
    }),
    "Mod-a": fresh((state) => {
      // Đã chọn hết chữ trong khối → chọn mọi khối của tài liệu
      if (!textMode() || state.selection.from > 0 || state.selection.to < state.doc.content.size) return false;
      const loc = store.locate(pr.current.blockId);
      if (!loc) return false;
      store.select(store.getState().docs[loc.docId].blocks.map((b) => b.id), { editing: null });
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
  { re: /^\[ ?\]$/, make: (rest) => { const p = makeBlock("paragraph", {}, rest); return { blocks: [makeBlock("taskList", {}, [makeBlock("taskItem", { checked: false }, [p])])], focus: p }; } },
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
  if (m && blk?.type === "paragraph" && view.state.selection.from === view.state.doc.content.size) {
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
