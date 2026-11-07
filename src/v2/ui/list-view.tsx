import { ChevronDown, ChevronRight, GripVertical, Lock, Blocks } from "lucide-react";
import { useCallback, useState } from "react";
import { startDrag } from "../canvas/dnd";
import { useEditor, useEditorState } from "../context";
import { inlineText, type BNode } from "../core/model";
import type { BlockType } from "../core/registry";
import { cx } from "./attr-form";

// ---------------------------------------------------------------------------
// Cây khối
// ---------------------------------------------------------------------------
/** Tên hiển thị của một khối trong cây: loại + đoạn chữ đầu. */
export function blockLabel(node: BNode, type: BlockType | undefined): string {
  const text = node.inline ? inlineText(node.inline).trim() : node.content?.find((c) => c.inline && inlineText(c.inline).trim()) ? inlineText(node.content.find((c) => c.inline && inlineText(c.inline).trim())!.inline).trim() : "";
  const summary = type?.summary?.(node.attrs);
  const base = type?.title ?? node.type;
  const extra = text || summary;
  return extra ? `${base} · ${extra.slice(0, 40)}` : base;
}

export function ListView() {
  const { labels } = useEditor();
  const activeId = useEditorState((s) => s.focus[s.focus.length - 1] ?? s.rootId);
  const doc = useEditorState(useCallback((s) => s.docs[activeId], [activeId]));
  if (!doc) return null;
  return (
    <div className="ecx-listview" role="tree" aria-label={labels.listView}>
      {doc.blocks.map((b, i) => <ListRow key={b.id} node={b} depth={0} first={i === 0} />)}
      {!doc.blocks.length && <p className="ecx-muted ecx-list-empty">{labels.listEmpty}</p>}
      
    </div>
  );
}

function ListRow({ node, depth, first }: { node: BNode; depth: number; first?: boolean }) {
  const ctx = useEditor();
  const { store, registry, ui, host } = ctx;
  const selected = useEditorState(useCallback((s) => s.selection.ids.includes(node.id) || s.selection.editing === node.id, [node.id]));
  const anySelected = useEditorState((s) => s.selection.ids.length > 0 || !!s.selection.editing);
  const [open, setOpen] = useState(depth < 1);
  const type = registry.get(node.type);
  const Icon = type?.icon ?? Blocks;
  // Phần dùng chung / mẫu đồng bộ: khối con lấy từ tài liệu lồng
  const nestedId = node.type === "templatePart" && node.attrs.slug ? (host.documents?.idOf?.({ kind: "part", ref: node.attrs.slug }) ?? `part:${node.attrs.slug}`)
    : node.type === "syncedPattern" && node.attrs.ref ? (host.documents?.idOf?.({ kind: "pattern", ref: node.attrs.ref }) ?? `pattern:${node.attrs.ref}`) : null;
  const nestedBlocks = useEditorState(useCallback((s) => (nestedId ? s.docs[nestedId]?.blocks ?? null : null), [nestedId]));
  const kids = node.content ?? nestedBlocks ?? [];
  const hasKids = kids.length > 0;
  return (
    <div role="treeitem" aria-selected={selected} aria-expanded={hasKids ? open : undefined} aria-level={depth + 1}>
      <div className={cx("ecx-list-row", selected && "is-selected", nestedId && "is-nested")} style={{ paddingLeft: 8 + depth * 14 }} data-block={node.id}
        // Một tabstop cho cả cây (hàng đang chọn, không thì hàng đầu); mũi tên di chuyển, Enter/Space chọn (WAI-ARIA tree)
        tabIndex={selected || (first && !anySelected) ? 0 : -1}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); store.select([node.id], { editing: null }); } }}
        onClick={(e) => {
          if (e.shiftKey) store.selectRange(node.id);
          else store.select([node.id], { editing: null });
          ui.blockEl(node.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }}>
        {hasKids ? <button type="button" className="ecx-twisty" aria-label={open ? ctx.labels.collapse : ctx.labels.expand} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? <ChevronDown className="ecx-icon" /> : <ChevronRight className="ecx-icon" />}</button> : <span className="ecx-twisty" />}
        <Icon className="ecx-icon" />
        <span className="ecx-list-title">{blockLabel(node, type)}</span>
        {!!(node.attrs.lock || node.attrs.templateLock) && <Lock className="ecx-icon ecx-icon-sm" aria-label={ctx.labels.locked} />}
        <span className="ecx-list-drag" onPointerDown={(e) => { e.stopPropagation(); startDrag(ctx, e, [node.id]); }} title={ctx.labels.drag}><GripVertical className="ecx-icon" /></span>
      </div>
      {hasKids && open && <div role="group">{kids.map((k) => <ListRow key={k.id} node={k} depth={depth + 1} />)}</div>}
    </div>
  );
}
