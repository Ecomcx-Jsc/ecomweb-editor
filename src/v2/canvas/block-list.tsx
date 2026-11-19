import { controlsCss, normalizeStyle, styleClass, widthClass } from "@ecomcx/ecomweb-content";
import { blockControls } from "../../shared/panel-store";
import { Component, memo, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ErrorInfo, type MouseEvent, type PointerEvent, type ReactElement, type ReactNode } from "react";
import { DocScopeProvider, LoopPostContext, useDocScope, useEditor, useEditorState } from "../context";
import { ServerBlock } from "./server-block";
import { VariationChooser } from "./variation-picker";
import { startDrag } from "./dnd";
import { docIdOf, type NestedDocRef } from "../core/host";
import { blocksFromDoc, makeBlock, type BNode } from "../core/model";
import type { BlockEditProps, BlockProps } from "../core/registry";
import type { EditingMode } from "../core/store";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

/** Phần (khối cấp cao nhất của tài liệu đang sửa) chứa phần tử khối — null nếu nằm ngoài (template bị khoá). */
export function sectionOf(store: ReturnType<typeof useEditor>["store"], el: HTMLElement | null): string | null {
  const active = store.activeDocId;
  for (let cur = el; cur; cur = cur.parentElement?.closest<HTMLElement>("[data-ecx-block]") ?? null) {
    const loc = store.locate(cur.dataset.ecxBlock!);
    if (loc && loc.docId === active && !loc.parent) return loc.block.id;
  }
  return null;
}

/** Props gắn vào phần tử gốc của khối: chọn, viền, kiểu dáng, neo. */
/** Khối chứa mà con phủ kín: có nhãn rê chuột để bấm chọn chính khối chứa (xem canvas-css). */
const LABELED = new Set(["query", "postTemplate", "queryEmpty", "templatePart", "tabs", "tab", "accordion", "details", "popup", "testimonials", "carousel", "columns", "column", "buttons", "form", "mediaText", "cover"]);

export function useBlockProps(block: BNode, state: { selected: boolean; editing: boolean; mode: EditingMode }): BlockProps {
  const ctx = useEditor();
  const { store, registry, ui } = ctx;
  const a = block.attrs;
  const style = a.style && typeof a.style === "object" ? normalizeStyle(a.style) : undefined;
  const type = registry.get(block.type);
  const onMouseDown = useCallback((e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const own = target.closest<HTMLElement>("[data-ecx-block]");
    if (own?.dataset.ecxBlock !== block.id) return; // khối con tự xử lý
    e.stopPropagation();
    if (ui.zoomOut) {
      // Thu nhỏ: chọn cả phần (khối cấp cao nhất của tài liệu đang sửa) chứa chỗ bấm, không đặt con trỏ chữ
      e.preventDefault();
      const section = sectionOf(store, own);
      if (section) { store.select([section], { editing: null }); (own.ownerDocument.activeElement as HTMLElement | null)?.blur?.(); own.ownerDocument.querySelector<HTMLElement>(".ecx-canvas-root")?.focus({ preventScroll: true }); }
      return;
    }
    if (store.modeOf(block.id) === "disabled") return;
    const rich = target.closest<HTMLElement>("[data-ecx-rich]");
    if (rich && rich.isContentEditable && !e.shiftKey) return; // bấm vào chữ: ProseMirror đặt con trỏ, focus báo đang gõ
    // Ô nhập / nút thật của khối đặt chỗ tự xử lý; riêng vùng đánh dấu data-ecx-inert (bản xem trước không bấm được, vd khối Tìm kiếm) thì bấm vào là chọn khối
    if (target.closest("input, textarea, select, button, [contenteditable=true]") && !target.closest("[data-ecx-inert]") && !e.shiftKey) return;
    // Bấm vào phần đệm của ô bảng: con trỏ vào chữ trong ô (như bấm vào ô của Word / WordPress), không chọn cả ô
    if ((block.type === "tableCell" || block.type === "tableHeader") && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const text = block.content?.find((b) => b.inline);
      if (text) { e.preventDefault(); store.focusText(text.id, -1); return; }
    }
    e.preventDefault();
    // Chọn khối: rời ô gõ, đưa focus về khung soạn (phím Delete, ⌘C… thuộc về vùng chọn khối)
    const active = own.ownerDocument.activeElement as HTMLElement | null;
    if (active?.isContentEditable) active.blur();
    if (e.shiftKey) store.selectRange(block.id);
    else if (e.metaKey || e.ctrlKey) {
      const ids = store.getState().selection.ids;
      store.select(ids.includes(block.id) ? ids.filter((x) => x !== block.id) : [...ids, block.id], { editing: null });
    } else store.select([block.id], { editing: null });
    if (own.isContentEditable) own.ownerDocument.querySelector<HTMLElement>(".ecx-canvas-root")?.focus({ preventScroll: true });
    else own.focus({ preventScroll: true });
  }, [block.id, store, ui]);
  // Khối bố cục đang chọn: nắm chỗ trống (không phải chữ, ô nhập, khối con) rồi kéo = đổi chỗ như tay nắm ⠿ (bấm thường vẫn là bấm)
  const grab = state.selected && type?.kind !== "text";
  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey || ui.zoomOut) return;
    if (t.closest("[data-ecx-block]")?.getAttribute("data-ecx-block") !== block.id) return;
    // Chỉ xét trong khối (cả khung soạn là contenteditable)
    const hit = t.closest("[data-ecx-rich], input, textarea, select, button, a, [contenteditable=true], .ecx-pad-handles, .ecx-col-handles, .ecx-image-handle");
    if (hit && e.currentTarget.contains(hit) && !hit.closest("[data-ecx-inert]")) return;
    const ids = store.getState().selection.ids;
    startDrag(ctx, e, ids.includes(block.id) ? ids : [block.id]);
  }, [block.id, ctx, store, ui]);
  return {
    ref: null,
    "data-ecx-block": block.id,
    "data-type": block.type,
    ...(LABELED.has(block.type) ? { "data-ecx-label": type?.title ?? block.type } : {}),
    tabIndex: type?.kind === "text" ? undefined : -1,
    id: typeof a.anchor === "string" ? a.anchor : undefined,
    className: cx(
      "ecx-block",
      state.selected && "is-selected",
      state.editing && "is-editing",
      state.mode === "disabled" && "is-locked",
      style && styleClass(style),
      controlsCss(blockControls(), block.type, a)?.cls,
      widthClass(block.type, a),
      typeof a.blockStyle === "string" && `ecx-is-${a.blockStyle}`,
      typeof a.className === "string" && a.className,
    ),
    onMouseDown,
    ...(grab ? { onPointerDown, "data-ecx-grab": "" } : {}),
  };
}

class BlockBoundary extends Component<{ id: string; type: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(`[ecomweb-editor] khối ${this.props.type} lỗi`, error, info.componentStack); }
  render() {
    if (this.state.error) return <div className="ecx-block ecx-block-error" data-ecx-block={this.props.id} data-type={this.props.type} tabIndex={-1}>⚠ {this.props.type}: {this.state.error.message}</div>;
    return this.props.children;
  }
}

/** Một khối trên khung soạn (memo theo tham chiếu khối: chỉ vẽ lại khối đổi). */
export const Block = memo(function Block({ node }: { node: BNode }) {
  const { registry, store, labels, host } = useEditor();
  const scope = useDocScope();
  const selected = useEditorState(useCallback((s) => s.selection.ids.includes(node.id), [node.id]));
  const editing = useEditorState(useCallback((s) => s.selection.editing === node.id, [node.id]));
  const type = registry.get(node.type);
  const blockProps = useBlockProps(node, { selected, editing, mode: scope.mode });
  const setAttrs = useCallback((attrs: Record<string, unknown>) => store.setAttrs([node.id], attrs), [node.id, store]);
  const { ui } = useEditor();
  const picking = useSyncExternalStore(ui.subscribe, () => ui.pickIds.has(node.id));
  // (Hook phải gọi trước mọi return sớm — ô chọn bố cục trả về sớm khi đang chờ chọn.) Khối trong vòng lặp bài (query › postTemplate) giữ giao diện của trình soạn: website chỉ biết bài của trang, không biết bài của vòng lặp
  const loop = useContext(LoopPostContext);
  const Edit = type?.edit ?? FallbackEdit;
  const props: BlockEditProps = { block: node, attrs: node.attrs, setAttrs, blockProps, selected: selected || editing, editable: scope.mode !== "disabled", labels };
  if (picking && type?.layouts?.length && scope.mode !== "disabled")
    return <BlockBoundary id={node.id} type={node.type}><VariationChooser type={type} attrs={node.attrs} blockProps={blockProps as unknown as Record<string, unknown>} onPick={(v) => { setAttrs(v.attrs); ui.resolvePick(node.id); }} onSkip={() => ui.resolvePick(node.id, true)} /></BlockBoundary>;
  // editWhenSelected: đang chọn → ô giữ chỗ của trình soạn; vẫn đi qua ServerBlock để ô nhập không bị dựng lại (mất focus) khi chọn / bỏ chọn
  if (type?.serverRender && host.renderBlock && !loop)
    return <BlockBoundary id={node.id} type={node.type}><ServerBlock node={node} blockProps={blockProps} fallback={<Edit {...props} />} live={!(type.editWhenSelected && (selected || editing) && scope.mode !== "disabled")} /></BlockBoundary>;
  return <BlockBoundary id={node.id} type={node.type}><Edit {...props} /></BlockBoundary>;
});

/**
 * Danh sách khối: phần tử JSX của khối không đổi (cùng tham chiếu) được dùng lại → React bỏ qua ngay, không so props —
 * tài liệu dài gõ một phím chỉ vẽ lại khối đang gõ.
 */
function useBlockElements(list: readonly BNode[]): ReactElement[] {
  const cache = useRef(new WeakMap<BNode, ReactElement>());
  return list.map((b) => {
    let el = cache.current.get(b);
    if (!el) { el = <Block key={b.id} node={b} />; cache.current.set(b, el); }
    return el;
  });
}

/** Khối chưa có giao diện riêng: thẻ tên + tóm tắt (dữ liệu giữ nguyên). */
export function FallbackEdit({ block, blockProps, labels }: BlockEditProps) {
  const { registry } = useEditor();
  const type = registry.get(block.type);
  const Icon = type?.icon;
  const summary = type?.summary?.(block.attrs);
  return (
    <div {...blockProps} className={cx(blockProps.className, "ecx-placeholder-block", !type && "is-unknown")}>
      <span className="ecx-placeholder-title">{Icon && <Icon className="ecx-icon" />}{type?.title ?? block.type}</span>
      {summary && <span className="ecx-placeholder-summary">{summary}</span>}
      {!type && <span className="ecx-placeholder-summary">{labels.unknownBlock}</span>}
      {block.content && <InnerBlocks parent={block} />}
    </div>
  );
}

/**
 * Khối con của một khối chứa — vẽ thẳng (không thẻ bọc) để bố cục flex/grid của website giữ đúng.
 * `appender`: nút "+" cuối danh sách (khối chứa kiểu luồng như nhóm, cột) — danh sách, bảng, bộ cột tự thêm bằng thanh công cụ.
 */
export function InnerBlocks({ parent, appender = "auto" }: { parent: BNode; appender?: "auto" | "none" }) {
  const scope = useDocScope();
  const kids = parent.content ?? [];
  const { store } = useEditor();
  const showAppender = appender === "auto" && scope.mode === "default" && !kids.length && store.canInsertInto(parent.id);
  // Khối chứa đã có nội dung (Cột, Nhóm, Tab, Hộp lưu ý): nút "+" nhỏ ngay dưới khối cuối, hiện khi rê chuột / chọn — để thấy chỗ thêm tiếp và chỗ thả (như dòng "gõ / để chọn khối" của WordPress)
  const showTail = appender === "auto" && scope.mode === "default" && kids.length > 0 && TAIL_PARENTS.has(parent.type) && !isFlowLayout(parent) && store.canInsertInto(parent.id);
  const elements = useBlockElements(kids);
  return (
    <>
      {elements}
      {showAppender && <Appender docId={scope.docId} parentId={parent.id} index={0} />}
      {showTail && <TailAppender docId={scope.docId} parentId={parent.id} index={kids.length} />}
    </>
  );
}

const TAIL_PARENTS = new Set(["column", "group", "tab", "callout"]);
/** Nhóm dạng hàng ngang / lưới: thêm một ô vào hàng sẽ làm lệch bố cục → không có nút + cuối (dùng thanh công cụ / bảng chèn). */
const isFlowLayout = (b: BNode) => { const t = (b.attrs.style as { layout?: { type?: string } } | undefined)?.layout?.type; return t === "flex" || t === "grid"; };

/** Nút "+" nhỏ cuối khối chứa đã có nội dung: ẩn khi không rê chuột / chọn. */
function TailAppender({ docId, parentId, index }: { docId: string; parentId: string; index: number }) {
  const { ui, labels } = useEditor();
  return (
    <button type="button" className="ecx-tail-appender" title={labels.addBlock} aria-label={labels.addBlock} contentEditable={false} data-ecx-ui="" tabIndex={-1}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const f = ui.canvasFrame?.getBoundingClientRect();
        ui.openInserter({ mode: "appender", docId, parentId, index, rect: { left: (f?.left ?? 0) + r.left, top: (f?.top ?? 0) + r.top, bottom: (f?.top ?? 0) + r.bottom } });
      }} data-ecx-placeholder="add"><span aria-hidden="true">+</span></button>
  );
}

/** Nút "+" chèn khối vào khối chứa trống. */
export function Appender({ docId, parentId, index }: { docId: string; parentId: string | null; index: number }) {
  const { ui, labels } = useEditor();
  return (
    <button type="button" className="ecx-appender" title={labels.addBlock} contentEditable={false}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const f = ui.canvasFrame?.getBoundingClientRect();
        ui.openInserter({ mode: "appender", docId, parentId, index, rect: { left: (f?.left ?? 0) + r.left, top: (f?.top ?? 0) + r.top, bottom: (f?.top ?? 0) + r.bottom } });
      }} data-ecx-placeholder="add"><span aria-hidden="true">+</span> {labels.addBlock}</button>
  );
}

/** Danh sách khối cấp cao nhất của một tài liệu; tài liệu trống → ô "bắt đầu viết". */
export function DocBlocks({ docId }: { docId: string }) {
  const { store, labels } = useEditor();
  const doc = useEditorState(useCallback((s) => s.docs[docId], [docId]));
  const scope = useDocScope();
  const elements = useBlockElements(doc?.blocks ?? []);
  if (!doc) return null;
  if (!doc.blocks.length) {
    if (doc.mode !== "default") return null;
    return (
      <p className="ecx-default-appender" data-placeholder={labels.emptyDoc} tabIndex={0} role="button"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); const p = makeBlock("paragraph"); store.insert(docId, null, 0, [p]); }}
        onKeyDown={(e) => { if (e.key === "Enter") { const p = makeBlock("paragraph"); store.insert(docId, null, 0, [p]); } }}>
        {labels.emptyDoc}
      </p>
    );
  }
  void scope;
  return <>{elements}</>;
}

/**
 * Tài liệu lồng (header, footer, mẫu đồng bộ, nội dung bài trong template): khối con lấy từ tài liệu khác,
 * sửa ngay tại chỗ, lưu riêng. Tự tải qua host.documents khi chưa có trong store.
 */
export function NestedDoc({ docRef, mode, render }: { docRef: NestedDocRef; mode?: EditingMode; render?(content: ReactNode, state: NestedState): ReactNode }) {
  const { store, host, labels } = useEditor();
  const scope = useDocScope();
  const docId = useMemo(() => docIdOf(host, docRef), [host, docRef]);
  const doc = useEditorState(useCallback((s) => s.docs[docId], [docId]));
  const cycle = scope.chain?.includes(docId) || docId === scope.docId;

  useEffect(() => {
    if (cycle || store.doc(docId) || !host.documents) return;
    store.putDoc({ id: docId, kind: docRef.kind, ref: docRef.ref, status: "loading", blocks: [] });
    host.documents.load(docRef).then(
      (res) => {
        if (!res) return store.putDoc({ id: docId, kind: docRef.kind, status: "error", error: labels.missingPart, blocks: [] });
        const content = res.content as { blocks?: Array<{ type: string; data: unknown }> } | { type?: string };
        const rich = content && "blocks" in content && Array.isArray(content.blocks)
          ? content.blocks.find((b) => b.type === "richtext")?.data
          : content;
        store.putDoc({ id: docId, kind: docRef.kind, ref: docRef.ref, title: res.title, blocks: blocksFromDoc(rich as never), status: "ready", mode: res.readOnly ? "disabled" : undefined });
      },
      (err: unknown) => store.putDoc({ id: docId, kind: docRef.kind, status: "error", error: String((err as Error)?.message ?? err), blocks: [] }),
    );
  }, [cycle, docId, docRef, host, labels, store]);

  if (cycle) return <div className="ecx-nested-note">⟳ {docRef.kind} “{String(docRef.ref)}”</div>;
  const state: NestedState = { docId, status: doc?.status ?? (host.documents ? "loading" : "error"), error: doc?.error, title: doc?.title };
  const effective: EditingMode = scope.mode === "disabled" ? "disabled" : doc?.mode === "disabled" ? "disabled" : mode ?? doc?.mode ?? "default";
  const content = state.status === "ready"
    ? <DocScopeProvider value={{ docId, mode: effective, depth: scope.depth + 1, chain: [...(scope.chain ?? [scope.docId]), docId] }}><DocBlocks docId={docId} /></DocScopeProvider>
    : <div className="ecx-nested-note">{state.status === "loading" ? labels.loading : state.error ?? labels.loadFailed}</div>;
  return <>{render ? render(content, state) : content}</>;
}
export interface NestedState { docId: string; status: "loading" | "ready" | "error"; error?: string; title?: string }
