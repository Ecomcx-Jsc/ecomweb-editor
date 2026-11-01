import type { BlockAttrSpec, Device } from "@ecomcx/ecomweb-content";
import { CORE_BLOCK_STYLES } from "@ecomcx/ecomweb-content";
import { Blocks, ChevronDown, ChevronRight, GripVertical, Lock } from "lucide-react";
import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import { enLabels, viLabels } from "../labels";
import { StylePanel } from "../stylepanel";
import { LayoutEffectsPanel } from "./layoutpanel";
import { BindingsPanel, CORE_BINDABLE } from "./bindings";
import { blockPanelsFor, onBlockPanelsChange } from "../panelstore";
import { useEditor, useEditorState } from "./context";
import { startDrag } from "./dnd";
import { inlineText, type BNode } from "./model";
import type { BlockType } from "./registry";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

const ATTR_LABELS: Record<string, [string, string]> = {
  level: ["Cấp tiêu đề", "Level"], textAlign: ["Căn chữ", "Text align"], start: ["Bắt đầu từ", "Start at"], language: ["Ngôn ngữ", "Language"],
  src: ["Ảnh / tệp", "Media"], alt: ["Mô tả ảnh (alt)", "Alt text"], title: ["Tiêu đề", "Title"], caption: ["Chú thích", "Caption"], width: ["Rộng", "Width"],
  height: ["Cao", "Height"], align: ["Căn", "Align"], size: ["Cỡ", "Size"], href: ["Liên kết", "Link"], target: ["Mở ở", "Open in"], rel: ["rel", "rel"],
  variant: ["Kiểu", "Variant"], text: ["Chữ", "Text"], background: ["Màu nền", "Background"], textColor: ["Màu chữ", "Text color"], padding: ["Đệm", "Padding"],
  verticalAlign: ["Căn dọc", "Vertical align"], stack: ["Xếp chồng trên điện thoại", "Stack on mobile"], tone: ["Loại", "Tone"], summary: ["Tóm tắt", "Summary"],
  open: ["Mở sẵn", "Open by default"], overlay: ["Màu phủ", "Overlay"], opacity: ["Độ mờ phủ", "Overlay opacity"], minHeight: ["Cao tối thiểu", "Min height"],
  contentAlign: ["Vị trí chữ", "Content position"], fixed: ["Cố định khi cuộn", "Fixed background"], position: ["Vị trí ảnh", "Media position"],
  columns: ["Số cột", "Columns"], footer: ["Hàng cuối là chân bảng", "Footer row"], html: ["HTML", "HTML"], url: ["Địa chỉ", "URL"], links: ["Liên kết", "Links"],
  showLabels: ["Hiện tên", "Show labels"], maxLevel: ["Cấp tối đa", "Max level"], location: ["Vị trí menu", "Menu location"], orientation: ["Hướng", "Orientation"],
  mobile: ["Nút menu điện thoại", "Mobile toggle"], placeholder: ["Chữ gợi ý", "Placeholder"], buttonText: ["Chữ trên nút", "Button text"], link: ["Có liên kết", "Link"],
  moreText: ["Chữ “đọc tiếp”", "Read more text"], aspect: ["Tỉ lệ khung", "Aspect ratio"], avatar: ["Ảnh đại diện", "Avatar"], taxonomy: ["Phân loại", "Taxonomy"],
  separator: ["Dấu ngăn", "Separator"], inherit: ["Theo trang đang xem", "Inherit query"], postType: ["Loại bài", "Post type"], perPage: ["Số bài", "Per page"],
  category: ["Chuyên mục", "Category"], tag: ["Thẻ", "Tag"], orderBy: ["Sắp xếp theo", "Order by"], order: ["Thứ tự", "Order"], layout: ["Bố cục", "Layout"],
  slug: ["Phần (slug)", "Part (slug)"], tagName: ["Thẻ HTML", "HTML tag"], checked: ["Đã xong", "Done"], poster: ["Ảnh xem trước", "Poster"], download: ["Cho tải về", "Download"],
  embed: ["Xem ngay trên trang", "Embed"], anchor: ["Neo (id)", "Anchor"], className: ["Class CSS", "CSS class"],
};
/** Thuộc tính sửa ở chỗ khác (thanh công cụ, trên khung soạn) hoặc dữ liệu kỹ thuật. */
const HIDDEN_ATTRS = new Set(["style", "blockStyle", "anchor", "className", "mediaId", "srcset", "webpSrcset", "images", "links", "colwidth", "_v", "id"]);

const attrLabel = (name: string, spec: BlockAttrSpec, lang: "vi" | "en", translate?: (s: string) => string) =>
  spec.label ? (translate ? translate(spec.label) : spec.label) : ATTR_LABELS[name]?.[lang === "vi" ? 0 : 1] ?? name;

function controlOf(spec: BlockAttrSpec): NonNullable<BlockAttrSpec["control"]> {
  if (spec.control) return spec.control;
  if (spec.enum) return "select";
  switch (spec.type) {
    case "number": case "integer": return "number";
    case "boolean": return "checkbox";
    case "url": return "url";
    case "json": return "hidden";
    default: return "text";
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="ecx-field"><span className="ecx-field-label">{label}</span>{children}</label>;
}

/** Form thuộc tính tự sinh từ mô tả (không phải viết giao diện cho từng khối). */
export function AttrForm({ type, attrs, onChange }: { type: BlockType; attrs: Record<string, any>; onChange(a: Record<string, unknown>): void }) {
  const { host, labels } = useEditor();
  const entries = Object.entries(type.attributes ?? {}).filter(([k, s]) => !HIDDEN_ATTRS.has(k) && controlOf(s) !== "hidden");
  if (!entries.length) return null;
  return (
    <div className="ecx-form">
      {entries.map(([k, spec]) => {
        const label = attrLabel(k, spec, labels.lang, host.translate);
        const value = attrs[k] ?? spec.default;
        const set = (v: unknown) => onChange({ [k]: v === "" || v === spec.default ? undefined : v });
        switch (controlOf(spec)) {
          case "checkbox":
            return <label key={k} className="ecx-check"><input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} /> {label}</label>;
          case "select":
            return (
              <Field key={k} label={label}>
                <select className="ecx-input" value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value === "" ? undefined : spec.type === "integer" || spec.type === "number" ? Number(e.target.value) : e.target.value)}>
                  {spec.default === undefined && <option value="">—</option>}
                  {(spec.enum ?? []).map((v, i) => <option key={String(v)} value={String(v)}>{spec.enumLabels?.[i] ? (host.translate?.(spec.enumLabels[i]) ?? spec.enumLabels[i]) : String(v)}</option>)}
                </select>
              </Field>
            );
          case "number":
            return <Field key={k} label={label}><input className="ecx-input" type="number" min={spec.min} max={spec.max} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))} /></Field>;
          case "textarea":
            return <Field key={k} label={label}><textarea className="ecx-input" rows={3} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} /></Field>;
          case "color":
            return (
              <Field key={k} label={label}>
                <span className="ecx-color-row">
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : "#000000"} onChange={(e) => set(e.target.value)} aria-label={label} />
                  <input className="ecx-input" value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} placeholder="#hex / primary" />
                </span>
              </Field>
            );
          case "media":
            return (
              <Field key={k} label={label}>
                <span className="ecx-color-row">
                  <input className="ecx-input" type="url" value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} placeholder="https://…" />
                  {host.media && <button type="button" className="ecx-btn" onClick={async () => { const [m] = await host.media!.pick({ kind: "image", multiple: false }); if (m) onChange({ [k]: m.url, ...(k === "src" ? { mediaId: m.id, alt: attrs.alt ?? (m.alt || undefined) } : {}) }); }}>{labels.chooseImage}</button>}
                </span>
              </Field>
            );
          default:
            return <Field key={k} label={label}><input className="ecx-input" type={controlOf(spec) === "url" ? "url" : "text"} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} /></Field>;
        }
      })}
    </div>
  );
}

/** Bảng cài đặt của khối đang chọn: thẻ khối, tab Cài đặt (form + phần riêng của khối), tab Kiểu dáng. */
export function Inspector({ blockStyles }: { blockStyles?: Record<string, Array<{ name: string; label: string }>> }) {
  const { store, registry, host, labels } = useEditor();
  const sel = useEditorState((s) => s.selection);
  useEditorState((s) => s.revision);
  const [tab, setTab] = useState<"settings" | "style">("settings");
  const [device, setDevice] = useState<Device>("base");
  const ids = sel.ids.length ? sel.ids : sel.editing ? [sel.editing] : [];
  const nodes = ids.map((id) => store.block(id)).filter(Boolean) as BNode[];
  if (!nodes.length) return <div className="ecx-inspector is-empty"><p className="ecx-muted">{labels.noSelection}</p></div>;
  const first = nodes[0];
  const type = registry.get(first.type);
  const same = nodes.every((n) => n.type === first.type);
  const Icon = type?.icon ?? Blocks;
  const disabled = store.modeOf(first.id) === "disabled";
  const setAttrs = (a: Record<string, unknown>) => store.setAttrs(ids, a);
  const Custom = same && nodes.length === 1 ? type?.inspector : undefined;
  const v1 = labels.lang === "vi" ? viLabels : enLabels;
  const bindable = type?.bindable ?? CORE_BINDABLE[first.type];
  const variants = [...(CORE_BLOCK_STYLES[first.type] ?? []).map((name) => ({ name, label: name })), ...(blockStyles?.[first.type] ?? [])];
  return (
    <div className="ecx-inspector">
      <div className="ecx-block-card">
        <Icon className="ecx-icon ecx-card-icon" />
        <div><strong>{nodes.length > 1 ? `${nodes.length} ${labels.blocks}` : type?.title ?? first.type}</strong>{type?.description && nodes.length === 1 && <p className="ecx-muted">{type.description}</p>}</div>
      </div>
      {disabled ? <p className="ecx-muted">{labels.readOnly}</p> : (
        <>
          <div className="ecx-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "settings"} className={cx(tab === "settings" && "is-active")} onClick={() => setTab("settings")}>{labels.settings}</button>
            {type?.supports?.style !== false && !store.isContentOnly(first.id) && <button type="button" role="tab" aria-selected={tab === "style"} className={cx(tab === "style" && "is-active")} onClick={() => setTab("style")}>{labels.lang === "vi" ? "Kiểu dáng" : "Styles"}</button>}
          </div>
          {tab === "settings" ? (
            <div className="ecx-panel">
              {same && type && <AttrForm type={type} attrs={first.attrs} onChange={setAttrs} />}
              {Custom && <Custom block={first} attrs={first.attrs} setAttrs={setAttrs} blockProps={null as never} selected editable labels={labels} />}
              {same && nodes.length === 1 && <PluginPanels type={first.type} attrs={first.attrs} setAttrs={setAttrs} />}
              {nodes.length === 1 && bindable?.length && <BindingsPanel block={first} bindable={bindable} onChange={(b) => setAttrs({ bindings: b })} />}
              {nodes.length === 1 && (
                <details className="ecx-advanced">
                  <summary>{labels.lang === "vi" ? "Nâng cao" : "Advanced"}</summary>
                  <Field label={ATTR_LABELS.anchor[labels.lang === "vi" ? 0 : 1]}><input className="ecx-input" value={String(first.attrs.anchor ?? "")} onChange={(e) => setAttrs({ anchor: e.target.value.replace(/[^\w-]/g, "") || undefined })} /></Field>
                  <Field label={ATTR_LABELS.className[labels.lang === "vi" ? 0 : 1]}><input className="ecx-input" value={String(first.attrs.className ?? "")} onChange={(e) => setAttrs({ className: e.target.value || undefined })} /></Field>
                </details>
              )}
            </div>
          ) : (
            <div className="ecx-panel">
              <StylePanel style={first.attrs.style} onChange={(st) => setAttrs({ style: st ?? undefined })} t={v1} device={device} onDeviceChange={setDevice} presets={host.presets}
                variants={variants.length ? variants : undefined} variant={(first.attrs.blockStyle as string) ?? null} onVariantChange={(v) => setAttrs({ blockStyle: v ?? undefined })} />
              <LayoutEffectsPanel type={first.type} style={first.attrs.style} onChange={(st) => setAttrs({ style: st ?? undefined })} device={device} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Panel của plugin (registerBlockPanel) cho loại khối đang chọn. */
function PluginPanels({ type, attrs, setAttrs }: { type: string; attrs: Record<string, any>; setAttrs(a: Record<string, unknown>): void }) {
  const { host } = useEditor();
  useSyncExternalStore(onBlockPanelsChange, () => blockPanelsFor(type).length, () => 0);
  const panels = blockPanelsFor(type);
  if (!panels.length) return null;
  return (
    <>
      {panels.map((p) => (
        <details key={p.id} className="ecx-advanced" open>
          <summary>{host.translate ? host.translate(p.title) : p.title}</summary>
          <p.component type={type} attrs={attrs} setAttrs={setAttrs} />
        </details>
      ))}
    </>
  );
}

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
  const { store, labels } = useEditor();
  const activeId = useEditorState((s) => s.focus[s.focus.length - 1] ?? s.rootId);
  const doc = useEditorState(useCallback((s) => s.docs[activeId], [activeId]));
  if (!doc) return null;
  return (
    <div className="ecx-listview" role="tree" aria-label={labels.listView}>
      {doc.blocks.map((b) => <ListRow key={b.id} node={b} depth={0} />)}
      {!doc.blocks.length && <p className="ecx-muted">{labels.emptyDoc}</p>}
      
    </div>
  );
}

function ListRow({ node, depth }: { node: BNode; depth: number }) {
  const ctx = useEditor();
  const { store, registry, ui, host } = ctx;
  const selected = useEditorState(useCallback((s) => s.selection.ids.includes(node.id) || s.selection.editing === node.id, [node.id]));
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
        onClick={(e) => {
          if (e.shiftKey) store.selectRange(node.id);
          else store.select([node.id], { editing: null });
          ui.blockEl(node.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }}>
        {hasKids ? <button type="button" className="ecx-twisty" aria-label={open ? "Collapse" : "Expand"} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? <ChevronDown className="ecx-icon" /> : <ChevronRight className="ecx-icon" />}</button> : <span className="ecx-twisty" />}
        <Icon className="ecx-icon" />
        <span className="ecx-list-title">{blockLabel(node, type)}</span>
        {!!(node.attrs.lock || node.attrs.templateLock) && <Lock className="ecx-icon ecx-icon-sm" aria-label={ctx.labels.locked} />}
        <span className="ecx-list-drag" onPointerDown={(e) => { e.stopPropagation(); startDrag(ctx, e, [node.id]); }} title={ctx.labels.drag}><GripVertical className="ecx-icon" /></span>
      </div>
      {hasKids && open && <div role="group">{kids.map((k) => <ListRow key={k.id} node={k} depth={depth + 1} />)}</div>}
    </div>
  );
}
