import { AlignCenter, AlignLeft, AlignRight, ArrowUpLeft, Bold, ChevronDown, ChevronUp, Code, Copy, CopyPlus, GripVertical, IndentDecrease, IndentIncrease, Italic, Link2, Link2Off, MoreVertical, PanelTop, Strikethrough, Trash2, Underline, Ungroup, Group as GroupIcon, Blocks, ArrowUpToLine, ArrowDownToLine } from "lucide-react";
import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { serializeBlocks } from "./clipboard";
import { useEditor, useEditorState, useUiTick } from "./context";
import { startDrag } from "./dnd";
import type { BNode } from "./model";
import { topLevelOrdered } from "./ops";
import type { BlockTransform } from "./registry";
import { insertSibling, richViews } from "./richtext";
import { canContain } from "./structure";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

export function ToolButton({ label, onClick, active, disabled, children, className, ...rest }: { label: string; onClick?(): void; active?: boolean; disabled?: boolean; children: ReactNode; className?: string } & Record<string, unknown>) {
  return (
    <button type="button" className={cx("ecx-tool", active && "is-active", className)} aria-label={label} title={label} aria-pressed={active} disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick} {...rest}>{children}</button>
  );
}

/** Menu thả xuống (không lấy focus khỏi ô gõ). */
export function Dropdown({ label, trigger, children, className }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className={cx("ecx-dropdown", className)} ref={ref}>
      <ToolButton label={label} onClick={() => setOpen((o) => !o)} active={open} aria-haspopup="menu" aria-expanded={open}>{trigger}</ToolButton>
      {open && <div className="ecx-menu" role="menu">{children(() => setOpen(false))}</div>}
    </div>
  );
}
export function MenuItem({ icon: Icon, label, onClick, danger, shortcut }: { icon?: ComponentType<{ className?: string }>; label: string; onClick(): void; danger?: boolean; shortcut?: string }) {
  return (
    <button type="button" role="menuitem" className={cx("ecx-menu-item", danger && "is-danger")} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {Icon ? <Icon className="ecx-icon" /> : <span className="ecx-icon" />}<span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

/** Thanh công cụ nổi phía trên khối đang chọn / đang gõ. */
export function BlockToolbar() {
  const ctx = useEditor();
  const { store, ui, registry, labels } = ctx;
  useUiTick();
  const sel = useEditorState((s) => s.selection);
  useEditorState((s) => s.revision);
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => { ui.openLink = (key) => setLink(key); return () => { ui.openLink = null; }; }, [ui]);

  const ids = sel.ids.length ? sel.ids : sel.editing ? [sel.editing] : [];
  // Đo vị trí SAU khi DOM của khung soạn cập nhật (khối vừa tạo chưa có DOM lúc vẽ thanh công cụ)
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const r = unionRect(ids.map((id) => ui.blockRect(id)));
    setRect((prev) => (prev && r && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height ? prev : r));
  });
  const nodes = ids.map((id) => store.block(id)).filter(Boolean) as BNode[];
  if (!nodes.length || ui.drag || ui.inserter?.mode === "slash" || (ui.typing && !link)) return null;
  const loc = store.locate(nodes[0].id);
  if (!loc || store.getState().docs[loc.docId].mode === "disabled") return null;
  const frame = ui.canvasFrame?.getBoundingClientRect();
  if (!rect || !frame || rect.bottom < frame.top || rect.top > frame.bottom) return null;

  const first = nodes[0];
  const type = registry.get(first.type);
  const sameType = nodes.every((n) => n.type === first.type);
  const Icon = type?.icon ?? Blocks;
  const editingText = !sel.ids.length && !!sel.editing;
  const view = editingText ? activeView(ui.activeRich, sel.editing!) : null;
  const ordered = topLevelOrdered(store.getState().docs[loc.docId].blocks, ids);
  const parent = loc.parent;
  const listItem = parent && (parent.type === "listItem" || parent.type === "taskItem") && loc.index === 0 ? parent : null;
  const transforms = sameType ? (type?.transforms ?? []).filter((t) => nodes.length === 1 || t.multiple) : [];
  const height = 44;
  const top = Math.max(frame.top + 4, rect.top - height - 8);
  const left = Math.max(frame.left + 4, Math.min(rect.left, frame.right - 420));
  const editProps = { block: first, attrs: first.attrs, setAttrs: (a: Record<string, unknown>) => store.setAttrs(ids, a), blockProps: null as never, selected: true, editable: true, labels };
  const Extra = sameType && nodes.length === 1 ? type?.toolbar : undefined;
  const hasAlign = sameType && !!type?.attributes?.textAlign;

  const doTransform = (t: BlockTransform) => {
    const res = t.convert(ordered.map((id) => store.block(id)!));
    if (!res?.length) return;
    store.batch(() => {
      store.replace(ordered[0], res, { select: { ids: [res[0].id], editing: null }, caret: null });
      if (ordered.length > 1) store.remove(ordered.slice(1), { focusNeighbor: false });
    });
    const text = firstText(res[0]);
    if (text) store.focusText(text, -1);
  };
  const copy = async () => {
    const s = serializeBlocks(ordered.map((id) => store.block(id)!));
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([s.text], { type: "text/plain" }), "text/html": new Blob([s.html], { type: "text/html" }) })]);
    } catch { /* trình duyệt chặn ghi clipboard: người dùng vẫn chép được bằng Ctrl+C */ }
  };
 /** Công cụ của các khối bao ngoài (bảng, bộ cột, nhóm nút) — mỗi loại một lần, gần nhất trước. */
  const contextTools = (ancestors: string[], currentId: string) => {
    const seen = new Set<string>();
    return [...ancestors, currentId].reverse().map((id) => {
      const anc = store.block(id);
      const T = anc ? registry.get(anc.type)?.contextToolbar : undefined;
      if (!anc || !T || seen.has(anc.type)) return null;
      seen.add(anc.type);
      return <div className="ecx-tool-group" key={`ctx-${id}`}><T ancestor={anc} currentId={currentId} /></div>;
    });
  };
  const nested = first.type === "templatePart" || first.type === "syncedPattern" ? ui.blockEl(first.id)?.dataset.ecxNested : undefined;
  const canGroup = canContain(parent?.type ?? null, "group");

  return (
    <>
      <div className="ecx-toolbar" role="toolbar" aria-label={type?.title ?? first.type} style={{ top, left }} data-block={first.id}
        onKeyDown={(e) => {
          // Bàn phím trên thanh công cụ: ←/→ đi giữa các nút, Esc quay về khối
          const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(":scope > .ecx-tool-group button:not(:disabled), :scope > .ecx-tool-group .ecx-dropdown > button"));
          const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            if (i < 0) return;
            e.preventDefault();
            buttons[(i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
          } else if (e.key === "Escape" && !(e.target as HTMLElement).closest(".ecx-menu")) {
            e.preventDefault();
            if (editingText && sel.editing) store.focusText(sel.editing, -1);
            else ui.blockEl(first.id)?.focus();
          }
        }}>
        <div className="ecx-tool-group">
          {parent && <ToolButton label={labels.selectParent} onClick={() => store.select([parent.id], { editing: null })}><ArrowUpLeft className="ecx-icon" /></ToolButton>}
          {transforms.length ? (
            <Dropdown label={labels.transform} trigger={<><Icon className="ecx-icon" /><ChevronDown className="ecx-icon ecx-icon-sm" /></>}>
              {(close) => transforms.map((t, i) => {
                const target = registry.get(t.to);
                return <MenuItem key={i} icon={target?.icon} label={`${target?.title ?? t.to}${t.title ? ` ${t.title}` : ""}`} onClick={() => { close(); doTransform(t); }} />;
              })}
            </Dropdown>
          ) : <span className="ecx-tool is-static" title={type?.title}><Icon className="ecx-icon" /></span>}
          <ToolButton label={labels.drag} className="ecx-drag-handle" onPointerDown={(e: React.PointerEvent) => startDrag(ctx, e, ordered)}><GripVertical className="ecx-icon" /></ToolButton>
          <div className="ecx-movers">
            <ToolButton label={labels.moveUp} onClick={() => store.moveBy(ordered, -1)}><ChevronUp className="ecx-icon ecx-icon-sm" /></ToolButton>
            <ToolButton label={labels.moveDown} onClick={() => store.moveBy(ordered, 1)}><ChevronDown className="ecx-icon ecx-icon-sm" /></ToolButton>
          </div>
        </div>
        {sameType && type?.variations?.some((v) => v.attrs && v.isActive) && (
          <div className="ecx-tool-group">
            <Dropdown label={labels.level} trigger={<span className="ecx-tool-text">{type.variations.find((v) => v.isActive?.(first.attrs))?.title ?? type.title}</span>}>
              {(close) => type.variations!.filter((v) => v.attrs).map((v) => <MenuItem key={v.name} icon={v.icon} label={v.title} onClick={() => { close(); store.setAttrs(ids, v.attrs!); }} />)}
            </Dropdown>
          </div>
        )}
        {hasAlign && (
          <div className="ecx-tool-group">
            {([["left", AlignLeft, labels.alignLeft], ["center", AlignCenter, labels.alignCenter], ["right", AlignRight, labels.alignRight]] as const).map(([v, I, l]) => (
              <ToolButton key={v} label={l} active={first.attrs.textAlign === v} onClick={() => store.setAttrs(ids, { textAlign: first.attrs.textAlign === v ? undefined : v })}><I className="ecx-icon" /></ToolButton>
            ))}
          </div>
        )}
        {view && !type?.plain && !type?.multiline && <MarkTools view={view} onLink={() => setLink(ui.activeRich ?? sel.editing)} />}
        {listItem && (
          <div className="ecx-tool-group">
            <ToolButton label="Outdent" onClick={() => store.outdentItem(listItem.id, true)}><IndentDecrease className="ecx-icon" /></ToolButton>
            <ToolButton label="Indent" onClick={() => store.indentItem(listItem.id)}><IndentIncrease className="ecx-icon" /></ToolButton>
          </div>
        )}
        {Extra && <div className="ecx-tool-group"><Extra {...editProps} /></div>}
        {nodes.length === 1 && contextTools(loc.ancestors, first.id)}
        {nested && <div className="ecx-tool-group"><ToolButton label={labels.editOriginal} className="ecx-tool-wide" onClick={() => store.enterFocus(nested)}><PanelTop className="ecx-icon" /><span className="ecx-tool-text">{labels.editOriginal}</span></ToolButton></div>}
        <div className="ecx-tool-group">
          <Dropdown label={labels.more} trigger={<MoreVertical className="ecx-icon" />}>
            {(close) => (
              <>
                <MenuItem icon={CopyPlus} label={labels.duplicate} shortcut={`${mod}⇧D`} onClick={() => { close(); store.duplicate(ordered); }} />
                <MenuItem icon={ArrowUpToLine} label={labels.insertBefore} shortcut={`${mod}⌥T`} onClick={() => { close(); insertSibling(store, ordered[0], 0); }} />
                <MenuItem icon={ArrowDownToLine} label={labels.insertAfter} shortcut={`${mod}⌥Y`} onClick={() => { close(); insertSibling(store, ordered[ordered.length - 1], 1); }} />
                <MenuItem icon={Copy} label={labels.copy} onClick={() => { close(); void copy(); }} />
                {canGroup && <MenuItem icon={GroupIcon} label={labels.group} onClick={() => { close(); store.wrap(ordered, "group"); }} />}
                {nodes.length === 1 && first.content && first.type === "group" && <MenuItem icon={Ungroup} label={labels.ungroup} onClick={() => { close(); store.unwrap(first.id); }} />}
                <MenuItem icon={Trash2} label={labels.remove} shortcut="⇧⌥Z" danger onClick={() => { close(); store.remove(ordered); }} />
              </>
            )}
          </Dropdown>
        </div>
      </div>
      {link && view && <LinkPopover viewKey={link} top={top + height + 4} left={left} onClose={() => setLink(null)} />}
    </>
  );
}

function activeView(activeKey: string | null, editing: string): EditorView | null {
  if (activeKey && activeKey.split("#")[0] === editing) return richViews.get(activeKey) ?? null;
  return richViews.get(editing) ?? null;
}

function MarkTools({ view, onLink }: { view: EditorView; onLink(): void }) {
  const { labels } = useEditor();
  const state = view.state;
  const isActive = (name: string) => {
    const type = state.schema.marks[name];
    const { from, to, empty, $from } = state.selection;
    if (empty) return !!type.isInSet(state.storedMarks ?? $from.marks());
    return state.doc.rangeHasMark(from, to, type);
  };
  const toggle = (name: string) => {
    const type = view.state.schema.marks[name];
    const { from, to, empty } = view.state.selection;
    const tr = view.state.tr;
    if (empty) tr.setStoredMarks(isActive(name) ? (view.state.storedMarks ?? view.state.selection.$from.marks()).filter((m) => m.type !== type) : [...(view.state.storedMarks ?? view.state.selection.$from.marks()), type.create()]);
    else if (isActive(name)) tr.removeMark(from, to, type);
    else tr.addMark(from, to, type.create());
    view.dispatch(tr);
    view.focus();
  };
  const tools: Array<[string, typeof Bold, string, string]> = [["bold", Bold, labels.bold, `${mod}B`], ["italic", Italic, labels.italic, `${mod}I`], ["underline", Underline, labels.underline, `${mod}U`], ["strike", Strikethrough, labels.strike, `${mod}⇧X`], ["code", Code, labels.code, `${mod}E`]];
  return (
    <div className="ecx-tool-group">
      {tools.map(([name, I, l, k]) => <ToolButton key={name} label={`${l} (${k})`} active={isActive(name)} onClick={() => toggle(name)}><I className="ecx-icon" /></ToolButton>)}
      <ToolButton label={`${labels.link} (${mod}K)`} active={isActive("link")} onClick={onLink}><Link2 className="ecx-icon" /></ToolButton>
    </div>
  );
}

/** Hộp sửa liên kết của chữ đang chọn (con trỏ trong liên kết → sửa cả liên kết). */
function LinkPopover({ viewKey, top, left, onClose }: { viewKey: string; top: number; left: number; onClose(): void }) {
  const { labels } = useEditor();
  const view = richViews.get(viewKey);
  const range = view ? linkRange(view) : null;
  const current = range?.mark?.attrs as { href?: string; target?: string } | undefined;
  const [href, setHref] = useState(current?.href ?? "");
  const [blank, setBlank] = useState(current?.target === "_blank");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  if (!view || !range) return null;
  const apply = () => {
    const url = href.trim();
    const { from, to } = range;
    const tr = view.state.tr.removeMark(from, to, view.state.schema.marks.link);
    if (url && /^(https?:|mailto:|tel:|\/|#)/i.test(url)) tr.addMark(from, to, view.state.schema.marks.link.create({ href: url, target: blank ? "_blank" : null, rel: blank ? "noopener" : null }));
    tr.setSelection(TextSelection.create(tr.doc, to));
    view.dispatch(tr);
    view.focus();
    onClose();
  };
  return (
    <form className="ecx-popover ecx-link-popover" style={{ top, left }} onSubmit={(e) => { e.preventDefault(); apply(); }} onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); view.focus(); } }}>
      <input ref={input} className="ecx-search" type="text" inputMode="url" placeholder="https://…" value={href} onChange={(e) => setHref(e.target.value)} aria-label={labels.linkUrl} />
      <label className="ecx-check"><input type="checkbox" checked={blank} onChange={(e) => setBlank(e.target.checked)} /> {labels.openNewTab}</label>
      <div className="ecx-popover-actions">
        {current && <button type="button" className="ecx-btn" onClick={() => { view.dispatch(view.state.tr.removeMark(range.from, range.to, view.state.schema.marks.link)); view.focus(); onClose(); }}><Link2Off className="ecx-icon" /> {labels.unlink}</button>}
        <button type="submit" className="ecx-btn ecx-btn-primary">{labels.apply}</button>
      </div>
    </form>
  );
}

/** Đoạn chữ áp liên kết: vùng bôi đen, hoặc cả liên kết đang có con trỏ ở trong. */
function linkRange(view: EditorView) {
  const { from, to, empty, $from } = view.state.selection;
  const type = view.state.schema.marks.link;
  if (!empty) {
    let mark = null as ReturnType<typeof type.create> | null;
    view.state.doc.nodesBetween(from, to, (n) => { const m = type.isInSet(n.marks); if (m) mark = m; });
    return { from, to, mark };
  }
  const mark = type.isInSet($from.marks()) ?? ($from.nodeBefore ? type.isInSet($from.nodeBefore.marks) : null);
  if (!mark) return null;
  let start = from, end = from;
  const doc = view.state.doc;
  while (start > 0 && doc.nodeAt(start - 1) && mark.isInSet(doc.nodeAt(start - 1)!.marks)) start--;
  while (end < doc.content.size && doc.nodeAt(end) && mark.isInSet(doc.nodeAt(end)!.marks)) end++;
  return { from: start, to: end, mark };
}

function unionRect(rects: Array<DOMRect | null>): DOMRect | null {
  const list = rects.filter(Boolean) as DOMRect[];
  if (!list.length) return null;
  const l = Math.min(...list.map((r) => r.left)), t = Math.min(...list.map((r) => r.top));
  const r = Math.max(...list.map((x) => x.right)), b = Math.max(...list.map((x) => x.bottom));
  return new DOMRect(l, t, r - l, b - t);
}
const firstText = (b: BNode): string | null => (b.inline ? b.id : (b.content ?? []).map(firstText).find(Boolean) ?? null);

/** Đường thả khi kéo khối. */
export function DropIndicator() {
  const { ui, labels } = useEditor();
  useUiTick();
  const t = ui.drag?.target;
  if (!ui.drag) return null;
  return (
    <>
      {t && <div className="ecx-drop-line" style={{ left: t.rect.left, top: t.rect.top, width: t.rect.width, height: t.rect.height }} data-horizontal={t.horizontal || undefined} />}
      <div className="ecx-drag-chip" style={{ left: ui.drag.x + 12, top: ui.drag.y + 12 }}>{ui.drag.ids.length > 1 ? `${ui.drag.ids.length} ${labels.blocks}` : "⠿"}</div>
    </>
  );
}
