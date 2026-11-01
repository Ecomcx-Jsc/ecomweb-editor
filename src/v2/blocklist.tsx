import { normalizeStyle, styleClass } from "@ecomcx/ecomweb-content";
import { Component, memo, useCallback, useEffect, useMemo, type ErrorInfo, type MouseEvent, type ReactNode } from "react";
import { DocScopeProvider, useDocScope, useEditor, useEditorState } from "./context";
import { docIdOf, type NestedDocRef } from "./host";
import { blocksFromDoc, makeBlock, type BNode } from "./model";
import type { BlockEditProps, BlockProps } from "./registry";
import type { EditingMode } from "./store";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

/** Props gắn vào phần tử gốc của khối: chọn, viền, kiểu dáng, neo. */
export function useBlockProps(block: BNode, state: { selected: boolean; editing: boolean; mode: EditingMode }): BlockProps {
  const { store, registry } = useEditor();
  const a = block.attrs;
  const style = a.style && typeof a.style === "object" ? normalizeStyle(a.style) : undefined;
  const type = registry.get(block.type);
  const onMouseDown = useCallback((e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const own = target.closest<HTMLElement>("[data-ecx-block]");
    if (own?.dataset.ecxBlock !== block.id) return; // khối con tự xử lý
    e.stopPropagation();
    if (store.modeOf(block.id) === "disabled") return;
    const rich = target.closest<HTMLElement>("[data-ecx-rich]");
    if (rich && rich.isContentEditable && !e.shiftKey) return; // bấm vào chữ: ProseMirror đặt con trỏ, focus báo đang gõ
    if (target.closest("input, textarea, select, button, [contenteditable=true]") && !e.shiftKey) return;
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
  }, [block.id, store]);
  return {
    ref: null,
    "data-ecx-block": block.id,
    "data-type": block.type,
    tabIndex: type?.kind === "text" ? undefined : -1,
    id: typeof a.anchor === "string" ? a.anchor : undefined,
    className: cx(
      "ecx-block",
      state.selected && "is-selected",
      state.editing && "is-editing",
      state.mode === "disabled" && "is-locked",
      style && styleClass(style),
      typeof a.blockStyle === "string" && `ecx-is-${a.blockStyle}`,
      typeof a.className === "string" && a.className,
    ),
    onMouseDown,
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
  const { registry, store, labels } = useEditor();
  const scope = useDocScope();
  const selected = useEditorState(useCallback((s) => s.selection.ids.includes(node.id), [node.id]));
  const editing = useEditorState(useCallback((s) => s.selection.editing === node.id, [node.id]));
  const type = registry.get(node.type);
  const blockProps = useBlockProps(node, { selected, editing, mode: scope.mode });
  const setAttrs = useCallback((attrs: Record<string, unknown>) => store.setAttrs([node.id], attrs), [node.id, store]);
  const Edit = type?.edit ?? FallbackEdit;
  const props: BlockEditProps = { block: node, attrs: node.attrs, setAttrs, blockProps, selected: selected || editing, editable: scope.mode !== "disabled", labels };
  return <BlockBoundary id={node.id} type={node.type}><Edit {...props} /></BlockBoundary>;
});

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
  const showAppender = appender === "auto" && scope.mode === "default" && !kids.length;
  return (
    <>
      {kids.map((k) => <Block key={k.id} node={k} />)}
      {showAppender && <Appender docId={scope.docId} parentId={parent.id} index={0} />}
    </>
  );
}

/** Nút "+" chèn khối vào khối chứa trống. */
export function Appender({ docId, parentId, index }: { docId: string; parentId: string | null; index: number }) {
  const { ui, labels } = useEditor();
  return (
    <button type="button" className="ecx-appender" aria-label={labels.addBlock} title={labels.addBlock} contentEditable={false}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const f = ui.canvasFrame?.getBoundingClientRect();
        ui.openInserter({ mode: "appender", docId, parentId, index, rect: { left: (f?.left ?? 0) + r.left, top: (f?.top ?? 0) + r.top, bottom: (f?.top ?? 0) + r.bottom } });
      }}>+</button>
  );
}

/** Danh sách khối cấp cao nhất của một tài liệu; tài liệu trống → ô "bắt đầu viết". */
export function DocBlocks({ docId }: { docId: string }) {
  const { store, labels } = useEditor();
  const doc = useEditorState(useCallback((s) => s.docs[docId], [docId]));
  const scope = useDocScope();
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
  return <>{doc.blocks.map((b) => <Block key={b.id} node={b} />)}</>;
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
