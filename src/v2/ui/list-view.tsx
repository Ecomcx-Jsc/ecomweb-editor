import { ChevronDown, ChevronRight, GripVertical, Lock, Blocks, MoreVertical, X, EyeOff } from "lucide-react";
import { useCallback, useState } from "react";
import { startDrag } from "../canvas/dnd";
import { useEditor, useEditorState } from "../context";
import { inlineText, type BNode } from "../core/model";
import type { BlockType } from "../core/registry";
import { cx } from "./attr-form";
import { isHidden } from "./block-menu";

// ---------------------------------------------------------------------------
// Cây khối
// ---------------------------------------------------------------------------
/** Tên hiển thị của một khối trong cây: loại + đoạn chữ đầu. */
export function blockLabel(node: BNode, type: BlockType | undefined): string {
  if (typeof node.attrs.customName === "string" && node.attrs.customName) return node.attrs.customName;
  const text = node.inline ? inlineText(node.inline).trim() : node.content?.find((c) => c.inline && inlineText(c.inline).trim()) ? inlineText(node.content.find((c) => c.inline && inlineText(c.inline).trim())!.inline).trim() : "";
  const summary = type?.summary?.(node.attrs);
  const base = type?.title ?? node.type;
  const extra = text || summary;
  return extra ? `${base} · ${extra.slice(0, 40)}` : base;
}

/** Cột trái "Cây khối": tab Cây khối / Dàn ý (tiêu đề + số chữ) và nút đóng. */
export function ListView({ onClose }: { onClose?(): void }) {
  const { labels } = useEditor();
  const [tab, setTab] = useState<"tree" | "outline">("tree");
  const activeId = useEditorState((s) => s.focus[s.focus.length - 1] ?? s.rootId);
  const doc = useEditorState(useCallback((s) => s.docs[activeId], [activeId]));
  if (!doc) return null;
  return (
    <>
      <div className="ecx-tabs ecx-left-tabs">
        <div className="ecx-tablist" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "tree"} className={tab === "tree" ? "is-active" : undefined} onClick={() => setTab("tree")}>{labels.listView}</button>
        <button type="button" role="tab" aria-selected={tab === "outline"} className={tab === "outline" ? "is-active" : undefined} onClick={() => setTab("outline")}>{labels.outline}</button>
        </div>
        {onClose && <button type="button" className="ecx-left-close" aria-label={labels.close} title={labels.close} onClick={onClose}><X className="ecx-icon" /></button>}
      </div>
      {tab === "outline" ? <Outline blocks={doc.blocks} /> : (
        <div className="ecx-listview" role="tree" aria-label={labels.listView}>
          {doc.blocks.map((b, i) => <ListRow key={b.id} node={b} depth={0} first={i === 0} />)}
          {!doc.blocks.length && <p className="ecx-muted ecx-list-empty">{labels.listEmpty}</p>}
        </div>
      )}
    </>
  );
}

/** Thống kê chữ + dàn ý tiêu đề của tài liệu (như tab Outline của WordPress): báo cấp tiêu đề nhảy cóc, tiêu đề trống. */
export function outlineOf(blocks: BNode[]) {
  const heads: Array<{ id: string; level: number; text: string; skipped: boolean }> = [];
  let text = "";
  let prev = 0;
  const walk = (list: BNode[]) => list.forEach((b) => {
    if (b.inline) {
      const t = inlineText(b.inline);
      text += ` ${t}`;
      if (b.type === "heading") {
        const level = Number(b.attrs.level) || 2;
        heads.push({ id: b.id, level, text: t.trim(), skipped: prev > 0 && level > prev + 1 });
        prev = level;
      }
    }
    if (b.content) walk(b.content);
  });
  walk(blocks);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { heads, words, chars: text.replace(/\s+/g, "").length, minutes: Math.max(1, Math.ceil(words / 200)) };
}

function Outline({ blocks }: { blocks: BNode[] }) {
  const { store, ui, labels } = useEditor();
  const o = outlineOf(blocks);
  return (
    <div className="ecx-outline">
      <dl className="ecx-outline-stats">
        <div><dt>{labels.outlineChars}</dt><dd>{o.chars.toLocaleString()}</dd></div>
        <div><dt>{labels.outlineWords}</dt><dd>{o.words.toLocaleString()}</dd></div>
        <div><dt>{labels.outlineTime}</dt><dd>{o.minutes} {labels.outlineMinutes}</dd></div>
      </dl>
      {o.heads.length ? (
        <ul className="ecx-outline-heads">
          {o.heads.map((h) => (
            <li key={h.id} style={{ paddingLeft: (h.level - 1) * 12 }}>
              <button type="button" onClick={() => { store.select([h.id], { editing: null }); ui.blockEl(h.id)?.scrollIntoView({ block: "center", behavior: "smooth" }); }}>
                <span className="ecx-outline-level">H{h.level}</span>
                <span className={cx(!h.text && "ecx-muted")}>{h.text || labels.outlineEmpty}</span>
                {h.skipped && <em className="ecx-outline-warn">{labels.outlineSkipped}</em>}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="ecx-muted">{labels.outlineNone}</p>}
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
  // Menu ⋮ / chuột phải của dòng = menu khối dùng chung (chọn khối trước, như WordPress); khối trong phần dùng chung lồng thì không
  const openMenu = (x: number, y: number) => {
    if (!store.locate(node.id)) return;
    if (!selected) store.select([node.id], { editing: null });
    const ids = store.getState().selection.ids.includes(node.id) ? store.getState().selection.ids : [node.id];
    ui.openContextMenu({ x, y, ids });
  };
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
        }}
        onContextMenu={(e) => { e.preventDefault(); openMenu(e.clientX, e.clientY); }}>
        {hasKids ? <button type="button" className="ecx-twisty" aria-label={open ? ctx.labels.collapse : ctx.labels.expand} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? <ChevronDown className="ecx-icon" /> : <ChevronRight className="ecx-icon" />}</button> : <span className="ecx-twisty" />}
        <Icon className="ecx-icon" />
        <span className="ecx-list-title">{blockLabel(node, type)}</span>
        {isHidden(node) && <EyeOff className="ecx-icon ecx-icon-sm" aria-label={ctx.labels.hidden} />}
        {!!(node.attrs.lock || node.attrs.templateLock) && <Lock className="ecx-icon ecx-icon-sm" aria-label={ctx.labels.locked} />}
        <button type="button" className="ecx-list-menu" aria-label={ctx.labels.options} title={ctx.labels.options} tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); openMenu(r.left, r.bottom + 4); }}><MoreVertical className="ecx-icon" /></button>
        <span className="ecx-list-drag" onPointerDown={(e) => { e.stopPropagation(); startDrag(ctx, e, [node.id]); }} title={ctx.labels.drag}><GripVertical className="ecx-icon" /></span>
      </div>
      {hasKids && open && <div role="group">{kids.map((k) => <ListRow key={k.id} node={k} depth={depth + 1} />)}</div>}
    </div>
  );
}
