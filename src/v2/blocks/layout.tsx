import { blockShell, buttonWrapShell, colorCss, coverParts, spacingValue } from "@ecomcx/ecomweb-content";
import { ChevronsUpDown, Columns2, Columns3, Columns4, Info, LayoutPanelLeft, Minus, MousePointerClick, PanelTop, RectangleHorizontal, Square, Table2, Image as ImageIcon } from "lucide-react";
import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { InnerBlocks } from "../canvas/block-list";
import { withoutOverridden } from "./inline-style";
import { makeBlock } from "../core/model";
import type { BlockEditProps, BlockType } from "../core/registry";
import { RichText } from "../text/rich-text";
import { BoundText, useBindingPreview } from "../ui/bindings";
import { useEditor } from "../context";
import { ButtonsTools, ColumnsTools, TableTools, addColumnTo } from "./tools";
import { ColumnHandles, useActiveWithin } from "./resize";
import { layoutFor, layoutKind } from "../ui/layout-panel";
import { normalizeStyle, type BlockStyle } from "@ecomcx/ecomweb-content";
import { ToolButton } from "../ui/toolbar";
import { AddItemButton, MediaPlaceholder } from "../ui/placeholders";
import type { MediaItem } from "../../shared/types";
import { LayoutGrid, Rows3, Columns3 as RowIcon } from "lucide-react";
import { useMsgs } from "../i18n";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
const PADDING: Record<string, string> = { none: "0", small: "0.75rem", medium: "1.5rem", large: "3rem" };
const TONES: Record<string, string> = { info: "#2563eb", success: "#16a34a", warning: "#d97706", danger: "#dc2626" };
/** Gộp props của khối với class + style inline riêng; `attrs` có `style` thì bỏ phần inline mà kiểu dáng đã thay (khớp website). */
const merge = (bp: BlockEditProps["blockProps"], className: string, style?: CSSProperties, attrs?: Record<string, unknown>) =>
  ({ ...bp, className: cx(bp.className, className), style: { ...(bp.style ?? {}), ...(attrs?.style ? withoutOverridden(style ?? {}, attrs.style) : style) } });

/** Props của vỏ khối lấy từ markup dùng chung với website: thẻ-class-style-thuộc tính cố định + props của canvas (id, chọn khối). */
const shellProps = (bp: BlockEditProps["blockProps"], type: string, attrs: Record<string, unknown>, parent?: { type: string; attrs?: Record<string, unknown> }) => {
  const sh = blockShell(type, attrs, parent)!;
  return { ...merge(bp, sh.className ?? "", sh.style as CSSProperties, attrs), ...sh.attrs };
};

function GroupEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const style: BlockStyle = normalizeStyle(block.attrs.style) ?? {};
  // Nhóm mới chèn (chưa chọn bố cục, chưa có nội dung): hỏi bố cục ngay trong khối như WordPress — đoạn văn bên trong vẫn gõ được ngay (gõ "/nhom" rồi gõ tiếp)
  const kids = block.content ?? [];
  const fresh = editable && !style.layout && (!kids.length || (kids.length === 1 && kids[0].type === "paragraph" && !kids[0].inline?.length));
  const items: Array<["stack" | "row" | "grid", typeof Square, string]> = [["stack", Rows3, tp.layoutStack], ["row", RowIcon, tp.layoutRow], ["grid", LayoutGrid, tp.layoutGrid]];
  return (
    <div {...shellProps(blockProps, "group", block.attrs)} data-ecx-placeholder={fresh ? "layout" : undefined}>
      {fresh && (
        <div className="ecx-media-placeholder ecx-ph-choose" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
          <p className="ecx-ph-title">{tp.chooseLayout}</p>
          <div className="ecx-ph-choices">
            {items.map(([k, I, label]) => <button key={k} type="button" className="ecx-ph-choice" onClick={() => setAttrs({ style: normalizeStyle({ ...style, layout: layoutFor(k) }) })}><I className="ecx-icon" aria-hidden />{label}</button>)}
          </div>
        </div>
      )}
      <InnerBlocks parent={block} />
    </div>
  );
}

/** Thanh công cụ của nhóm: đổi nhanh Nhóm / Hàng ngang / Xếp dọc / Lưới (giữ các kiểu dáng khác). */
function GroupLayoutTools({ attrs, setAttrs, labels }: BlockEditProps) {
  const style: BlockStyle = normalizeStyle(attrs.style) ?? {};
  const kind = layoutKind(style.layout);
  const t = useMsgs("blocks");
  const items: Array<["flow" | "row" | "stack" | "grid", typeof Square, string]> = [["flow", Square, t.group], ["row", RowIcon, t.row], ["stack", Rows3, t.stack], ["grid", LayoutGrid, t.grid]];
  return (
    <>
      {items.map(([k, I, label]) => (
        <ToolButton key={k} label={label} active={kind === k} onClick={() => setAttrs({ style: normalizeStyle({ ...style, layout: layoutFor(k, style.layout) }) })}><I className="ecx-icon" /></ToolButton>
      ))}
    </>
  );
}
const groupWith = (layout?: BlockStyle["layout"], kids = 1) => makeBlock("group", layout ? { style: { layout } } : {}, Array.from({ length: kids }, () => makeBlock("paragraph")));

function ColumnsEdit({ block, blockProps, editable, labels }: BlockEditProps) {
  const { store } = useEditor();
  const t = useMsgs("blocks");
  const a = block.attrs;
  const active = useActiveWithin(block.id);
  const shell = blockShell("columns", a)!; // vỏ dùng chung với website (@ecomcx/ecomweb-content)
  return (
    <div {...merge(blockProps, shell.className!, shell.style as CSSProperties, block.attrs)}>
      <InnerBlocks parent={block} appender="none" />
      {active && editable && block.content!.length > 1 && <ColumnHandles block={block} />}
      {active && editable && block.content!.length < 6 && store.canInsertInto(block.id) && (
        <button type="button" className="ecx-add-column" contentEditable={false} title={t.addColumn} aria-label={t.addColumn}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={() => addColumnTo(store, block)}>+</button>
      )}
    </div>
  );
}

function ColumnEdit({ block, blockProps }: BlockEditProps) {
  const { store } = useEditor();
  const parent = store.locate(block.id)?.parent;
  const shell = blockShell("column", block.attrs, parent ? { type: parent.type, attrs: parent.attrs } : undefined)!;
  return (
    <div {...merge(blockProps, shell.className!, shell.style as CSSProperties, block.attrs)}>
      <InnerBlocks parent={block} />
    </div>
  );
}

function ButtonsEdit({ block, blockProps }: BlockEditProps) {
  return <div {...shellProps(blockProps, "buttons", block.attrs)}><InnerBlocks parent={block} appender="none" /></div>;
}

function ButtonEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const { store } = useEditor();
  const tp = useMsgs("placeholders");
  const a = block.attrs;
  const bound = useBindingPreview(block, "text");
  const inGroup = store.locate(block.id)?.parent?.type === "buttons";
  // Website: nút đứng riêng nằm trong đoạn <p class="ecx-buttons"> (căn lề); trong khối "buttons" thì là chính thẻ <a>
  const link = (
    <a {...shellProps(inGroup ? blockProps : ({} as BlockEditProps["blockProps"]), "button", a)} onClick={(e) => e.preventDefault()}>
      {bound.bound ? <BoundText preview={bound} /> : <RichText blockId={block.id} field="text" tagName="span" value={String(a.text ?? "")} onChange={(v) => setAttrs({ text: v })} placeholder={tp.buttonText} placeholderAlways editable={editable} />}
    </a>
  );
  if (inGroup) return link;
  const wrap = buttonWrapShell(a);
  return <p {...merge(blockProps, wrap.className ?? "", wrap.style as CSSProperties)}>{link}</p>;
}

function SpacerEdit({ block, blockProps }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const props = shellProps(blockProps, "spacer", block.attrs);
  const h = props.style?.height ?? block.attrs.height;
  // Nhãn kích thước chỉ trong trình soạn (CSS ::before, không thêm phần tử con — website là div rỗng)
  return <div {...props} data-ecx-size={tp.spacer.replace("{size}", String(h ?? ""))} />;
}

function SeparatorEdit({ blockProps }: BlockEditProps) {
  return <hr {...(blockProps as object)} />;
}

function CalloutEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const title = String(block.attrs.title ?? "");
  return (
    <div {...shellProps(blockProps, "callout", block.attrs)}>
      {/* website chỉ in tiêu đề khi có chữ: trình soạn luôn có ô tiêu đề (gợi ý "không bắt buộc") để thấy chỗ gõ */}
      {(title || editable) && <RichText blockId={block.id} field="title" tagName="p" className="ecx-callout-title cms-callout-title" style={{ margin: 0, fontWeight: 600 }} value={title} onChange={(v) => setAttrs({ title: v })} placeholder={tp.calloutTitle} placeholderAlways editable={editable} />}
      <InnerBlocks parent={block} />
    </div>
  );
}

function DetailsEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  return (
    <details {...(merge(blockProps, "ecx-details") as object)} open>
      <summary onClick={(e) => e.preventDefault()}>
        <RichText blockId={block.id} field="summary" tagName="span" value={String(block.attrs.summary ?? "")} onChange={(v) => setAttrs({ summary: v })} placeholder={tp.detailsSummary} placeholderAlways editable={editable} />
      </summary>
      <InnerBlocks parent={block} />
    </details>
  );
}

/** Nút "+ Thêm …" cuối khối chứa nhiều mục (accordion, carousel): chỉ khi đang thao tác trong khối. */
function AddChild({ block, label, make }: { block: BlockEditProps["block"]; label: string; make(): ReturnType<typeof makeBlock> }) {
  const { store } = useEditor();
  const active = useActiveWithin(block.id);
  const loc = store.locate(block.id);
  if (!active || !loc || !store.canInsertInto(block.id)) return null;
  return <AddItemButton label={label} onClick={() => { const b = make(); store.insert(loc.docId, block.id, block.content?.length ?? 0, [b]); }} />;
}

function AccordionEdit({ block, blockProps, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  return <div {...(merge(blockProps, "ecx-accordion") as object)}><InnerBlocks parent={block} />{editable && <AddChild block={block} label={tp.addItem} make={() => makeBlock("details", { summary: "" }, [makeBlock("paragraph")])} />}</div>;
}

/** Thẻ đang mở của từng khối tabs trên khung soạn (không lưu vào nội dung — website luôn mở thẻ đầu). */
const openTabs = new Map<string, number>();
const tabListeners = new Set<() => void>();
const setOpenTab = (id: string, i: number) => { openTabs.set(id, i); tabListeners.forEach((l) => l()); };
const useOpenTab = (id: string) => useSyncExternalStore((l) => { tabListeners.add(l); return () => { tabListeners.delete(l); }; }, () => openTabs.get(id) ?? 0);

/** Tabs như website (TabsClient): thanh tiêu đề (vai trò tablist / tab) + một thẻ hiện; tiêu đề gõ ngay trên thanh, trống = "Tab N". */
function TabsEdit({ block, blockProps, editable }: BlockEditProps) {
  const { store } = useEditor();
  const tp = useMsgs("placeholders");
  const active = useOpenTab(block.id);
  const tabs = (block.content ?? []).filter((c) => c.type === "tab");
  return (
    <div {...(merge(blockProps, "ecx-tabs") as object)}>
      <div role="tablist" className="ecx-tabs-list">
        {tabs.map((tab, i) => (
          <div key={tab.id} role="tab" aria-selected={i === active} tabIndex={-1} className={cx("ecx-tab-button", i === active && "is-active")} onMouseDown={() => setOpenTab(block.id, i)}>
            <RichText blockId={tab.id} field="title" tagName="span" value={String(tab.attrs.title ?? "")} onChange={(v) => store.setAttrs([tab.id], { title: v })} placeholder={tp.tabTitle} placeholderAlways editable={editable} />
          </div>
        ))}
        {/* Nút thêm tab nằm ngay trên hàng tab */}
        {editable && store.canInsertInto(block.id) && <AddItemButton label={tp.addTab} onClick={() => {
          const loc = store.locate(block.id);
          if (!loc) return;
          store.insert(loc.docId, block.id, block.content?.length ?? 0, [makeBlock("tab", { title: "" }, [makeBlock("paragraph")])]);
          setOpenTab(block.id, tabs.length);
        }} />}
      </div>
      <InnerBlocks parent={block} />
    </div>
  );
}

function TabEdit({ block, blockProps }: BlockEditProps) {
  const { store } = useEditor();
  const loc = store.locate(block.id);
  const parentId = loc?.parent?.id ?? "";
  const index = (loc?.parent?.content ?? []).filter((c) => c.type === "tab").findIndex((c) => c.id === block.id);
  const open = useOpenTab(parentId) === index;
  const within = useActiveWithin(block.id);
  // Chọn khối nằm trong thẻ đang ẩn (danh sách khối, tìm kiếm…) → mở thẻ đó
  useEffect(() => { if (within && !open && parentId) setOpenTab(parentId, index); }, [within, open, parentId, index]);
  return (
    <div {...(merge(blockProps, "ecx-tab ecx-tab-panel", open ? undefined : { display: "none" }) as object)} role="tabpanel">
      <InnerBlocks parent={block} />
    </div>
  );
}

function CarouselEdit({ block, blockProps, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  return <div {...(merge(blockProps, "ecx-carousel") as object)}><InnerBlocks parent={block} />{editable && <AddChild block={block} label={tp.addSlide} make={() => makeBlock("group", {}, [makeBlock("paragraph")])} />}</div>;
}

/** Shortcode: ô nhập tên luôn hiện ngay trên khối. */
function ShortcodeEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const name = String(block.attrs.name ?? "");
  if (!editable) return <div {...(merge(blockProps, "ecx-shortcode", { fontFamily: "monospace", opacity: 0.8 }) as object)}>[{name || "shortcode"}]</div>;
  return (
    <div {...(merge(blockProps, "ecx-shortcode ecx-media-placeholder ecx-ph-inline") as object)} data-ecx-placeholder="shortcode">
      <label className="ecx-ph-row" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
        <span className="ecx-ph-mono" aria-hidden>[ ]</span>
        <span className="ecx-ph-label">{tp.shortcodeName}</span>
        <input className="ecx-input ecx-ph-mono" value={name} placeholder="shortcode" onChange={(e) => setAttrs({ name: e.target.value.replace(/[^\w-]/g, "") || undefined })} />
      </label>
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** ISO / chuỗi ngày → giá trị ô datetime-local (giờ máy). */
const toLocalInput = (v: unknown) => { const d = new Date(String(v ?? "")); return Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}` : ""; };

function CountdownEdit({ block, blockProps, setAttrs, editable, labels }: BlockEditProps) {
  const a = block.attrs;
  const tp = useMsgs("placeholders");
  const valid = Number.isFinite(Date.parse(String(a.target ?? "")));
  const active = useActiveWithin(block.id);
  // Chọn ngày giờ ngay trong khối (thiếu / sai thời điểm: website không vẽ khối → nói rõ, không để khối "mất tích" im lặng)
  if (!valid || (editable && active)) return (
    <div {...(merge(blockProps, "ecx-countdown ecx-media-placeholder", {}) as object)} data-ecx-placeholder="countdown">
      <span className="ecx-ph-digits" aria-hidden>00 : 00 : 00 : 00</span>
      {editable && <label className="ecx-ph-row" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
        <span className="ecx-ph-label">{tp.countdownTarget}</span>
        <input className="ecx-input" type="datetime-local" value={toLocalInput(a.target)} onChange={(e) => setAttrs({ target: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
      </label>}
      {!valid && <p className="ecx-placeholder-hint">{labels.countdownNoTarget}</p>}
    </div>
  );
  return <div {...(merge(blockProps, "ecx-countdown", { textAlign: "center" }) as object)}>{a.label ? <p style={{ margin: 0 }}>{String(a.label)}</p> : null}<strong>{String(a.target)}</strong></div>;
}

/** Sao xám → bấm vào sao để chấm ngay trên khối. */
function RatingEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const max = Math.min(10, Math.max(1, Number(block.attrs.max) || 5)), v = Number(block.attrs.value) || 0;
  return (
    <div {...(merge(blockProps, "ecx-rating") as object)} aria-label={`${v}/${max}`} title={editable ? tp.rateHint : undefined} data-ecx-placeholder={editable && !v ? "rating" : undefined}>
      {Array.from({ length: max }, (_, i) => editable
        ? <button key={i} type="button" className="ecx-ph-star" contentEditable={false} aria-label={tp.rateStar.replace("{n}", String(i + 1))} aria-pressed={i < Math.round(v)} onMouseDown={(e) => e.stopPropagation()} onClick={() => setAttrs({ value: i + 1 })} style={{ color: i < Math.round(v) ? "#f59e0b" : "#d4d4d8" }}>★</button>
        : <span key={i} style={{ color: i < Math.round(v) ? "#f59e0b" : "#d4d4d8" }}>★</span>)}
      {editable && !v && <span className="ecx-placeholder-hint" contentEditable={false}>{tp.rateHint}</span>}
    </div>
  );
}

function CoverEdit({ block, blockProps, setAttrs, labels }: BlockEditProps) {
  const a = block.attrs;
  const src = typeof a.src === "string" ? a.src : "";
  const { host } = useEditor();
  const select = (items: MediaItem[]) => setAttrs({ src: items[0].url, alt: items[0].alt || undefined, mediaId: items[0].id });
  const t = useMsgs("blocks"); // hook phải gọi trước mọi return sớm: chọn ảnh/màu làm đổi nhánh render
  const tp = useMsgs("placeholders");
  // Chưa có ảnh lẫn màu: chỗ chọn ảnh nền hoặc màu nền (không để khối trắng trơn vô hình)
  const st = normalizeStyle(a.style);
  if (!src && !a.overlay && !st?.color?.background && !st?.gradient && !st?.background?.image) {
    // Ảnh hoặc chỉ cần màu nền (không bắt buộc ảnh)
    const colors = (
      <span className="ecx-chip-row" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
        <span className="ecx-ph-label">{t.background}</span>
        {Object.entries(host.presets?.colors ?? { primary: "#1a597b", black: "#111", muted: "#757575" }).map(([name, c]) => (
          <button key={name} type="button" className="ecx-chip ecx-chip-swatch" title={name} aria-label={`${t.background}: ${name}`} style={{ background: c }} onClick={() => setAttrs({ overlay: name, opacity: 100 })} />
        ))}
      </span>
    );
    return <MediaPlaceholder kind="image" blockProps={merge(blockProps, "ecx-cover-placeholder") as BlockEditProps["blockProps"]} title={tp.dropCover} onSelect={select} onUrl={(url) => setAttrs({ src: url })} extra={colors} />;
  }
  const { overlay, fixed, imgStyle, overlayStyle } = coverParts(a);
  return (
    <div {...shellProps(blockProps, "cover", a)}>
      {src && !fixed && <img className="ecx-cover-img" src={src} alt={String(a.alt ?? "")} draggable={false} style={imgStyle as CSSProperties} />}
      {overlay && <span className="ecx-cover-overlay" aria-hidden="true" style={overlayStyle as CSSProperties} />}
      <div className="ecx-cover-inner"><InnerBlocks parent={block} /></div>
    </div>
  );
}

function MediaTextEdit({ block, blockProps }: BlockEditProps) {
  // Ô ảnh rỗng = vùng thả lớn (cùng kiểu ô thả với khối Ảnh)
  const a = block.attrs;
  return (
    <div {...shellProps(blockProps, "mediaText", a)}>
      <figure className="ecx-media-text-media" style={{ margin: 0 }}>{typeof a.src === "string" && a.src ? <img src={a.src} alt={String(a.alt ?? "")} draggable={false} /> : <MediaPick blockId={block.id} />}</figure>
      <div className="ecx-media-text-content"><InnerBlocks parent={block} /></div>
    </div>
  );
}

/** Chỗ chọn ảnh trong khối (ảnh + chữ, hộp ảnh, lời chứng thực…): vùng thả + Tải lên / Thư viện / URL. */
export function MediaPick({ blockId, compact }: { blockId: string; compact?: boolean }) {
  const { store } = useEditor();
  const select = (items: MediaItem[]) => store.setAttrs([blockId], { src: items[0].url, alt: items[0].alt || undefined, mediaId: items[0].id });
  return <MediaPlaceholder kind="image" compact={compact} className="ecx-media-pick" onSelect={select} onUrl={(url) => store.setAttrs([blockId], { src: url })} />;
}

/** Bảng mới chèn: hỏi số cột / hàng trước (thay cho bảng trống cỡ cố định). */
function TableSetup({ block, blockProps }: BlockEditProps) {
  const { store } = useEditor();
  const tp = useMsgs("placeholders");
  const create = (cols: number, rows: number) => {
    const c = Math.min(12, Math.max(1, cols || 2)), r = Math.min(50, Math.max(1, rows || 2));
    const content = Array.from({ length: r }, (_, i) => makeBlock("tableRow", {}, Array.from({ length: c }, () => cell(i === 0 && r > 1))));
    store.replace(block.id, [{ ...block, content }], { select: { ids: [], editing: content[0].content![0].content![0].id }, caret: { id: content[0].content![0].content![0].id, offset: 0 } });
  };
  return (
    <div {...merge(blockProps, "ecx-table ecx-media-placeholder ecx-ph-table")} data-ecx-placeholder="table">
      <p className="ecx-ph-title"><Table2 className="ecx-icon" aria-hidden />{tp.createTable}</p>
      <form className="ecx-ph-row" contentEditable={false} onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); create(Number(f.get("cols")), Number(f.get("rows"))); }}>
        <label className="ecx-ph-field"><span className="ecx-ph-label">{tp.columns}</span><input className="ecx-input" name="cols" type="number" min={1} max={12} defaultValue={2} /></label>
        <label className="ecx-ph-field"><span className="ecx-ph-label">{tp.rows}</span><input className="ecx-input" name="rows" type="number" min={1} max={50} defaultValue={2} /></label>
        <button type="submit" className="ecx-btn ecx-btn-primary">{tp.create}</button>
      </form>
    </div>
  );
}

function TableEdit(props: BlockEditProps) {
  const { block, blockProps } = props;
  if (!block.content?.length && props.editable) return <TableSetup {...props} />;
  return (
    <div {...merge(blockProps, "ecx-table table-wrap")}>
      <table className={block.attrs.fixed ? "is-fixed" : undefined}><tbody><InnerBlocks parent={block} appender="none" /></tbody></table>
    </div>
  );
}
function RowEdit({ block, blockProps }: BlockEditProps) {
  return <tr {...(blockProps as object)}><InnerBlocks parent={block} appender="none" /></tr>;
}
function CellEdit({ block, blockProps }: BlockEditProps) {
  const Tag = block.type === "tableHeader" ? "th" : "td";
  const span = (n: unknown) => (Number(n) > 1 ? Number(n) : undefined);
  return <Tag {...(blockProps as object)} colSpan={span(block.attrs.colspan)} rowSpan={span(block.attrs.rowspan)}><InnerBlocks parent={block} appender="none" /></Tag>;
}

// Cột mới chèn để trống (nút "+ Thêm khối" giữa cột); cột đều không đặt `width` (website chia đều), cột lệch đặt % thật (33 / 67)
const col = (width?: number) => makeBlock("column", width ? { width } : {}, []);
const columns = (...widths: number[]) => makeBlock("columns", {}, widths.map((w) => col(w)));
const cell = (header = false) => makeBlock(header ? "tableHeader" : "tableCell", {}, [makeBlock("paragraph")]);

export function layoutBlocks(): BlockType[] {
  return [
    {
      name: "group", title: "Nhóm", icon: Square, category: "design", keywords: "nhom group khung section container", kind: "container", edit: GroupEdit,
      attributes: { background: { type: "string", control: "color" }, textColor: { type: "string", control: "color" }, padding: { type: "string", enum: ["none", "small", "medium", "large"], default: "medium" }, constrained: { type: "boolean", default: false } },
      create: (attrs) => makeBlock("group", attrs ?? {}, [makeBlock("paragraph")]),
      toolbar: GroupLayoutTools,
      variations: [
        { name: "row", title: "Hàng ngang", standalone: true, icon: RowIcon, keywords: "hang ngang row flex xep ngang", create: () => groupWith(layoutFor("row"), 2) },
        { name: "stack", title: "Xếp dọc", standalone: true, icon: Rows3, keywords: "xep doc stack flex cot", create: () => groupWith(layoutFor("stack"), 2) },
        { name: "grid", title: "Lưới", standalone: true, icon: LayoutGrid, keywords: "luoi grid o cot", create: () => groupWith(layoutFor("grid"), 3) },
      ],
      supports: { style: true, anchor: true, className: true, blockStyle: true },
      transforms: [{ to: "columns", convert: (b) => [makeBlock("columns", {}, b.flatMap((g) => g.content ?? []).map((c) => makeBlock("column", {}, [c])))] }],
    },
    {
      name: "columns", title: "Cột", icon: Columns2, category: "design", keywords: "cot columns bo cuc layout", kind: "container", edit: ColumnsEdit,
      attributes: { verticalAlign: { type: "string", enum: ["top", "center", "bottom"] }, stack: { type: "boolean", default: true } },
      create: () => columns(0, 0), contextToolbar: ColumnsTools,
      variations: [
        { name: "50-50", title: "50 / 50", icon: Columns2, create: () => columns(0, 0) },
        { name: "33-33-33", title: "33 / 33 / 33", icon: Columns3, create: () => columns(0, 0, 0) },
        { name: "33-66", title: "33 / 66", icon: LayoutPanelLeft, create: () => columns(33, 67) },
        { name: "66-33", title: "66 / 33", icon: LayoutPanelLeft, create: () => columns(67, 33) },
        { name: "25x4", title: "25 / 25 / 25 / 25", icon: Columns4, create: () => columns(0, 0, 0, 0) },
      ],
      supports: { style: true, anchor: true, className: true },
    },
    { name: "column", title: "Cột", icon: RectangleHorizontal, kind: "container", edit: ColumnEdit, hidden: true, attributes: { width: { type: "number", min: 1, max: 100 } }, create: () => col(), supports: { style: true } },
    {
      name: "buttons", title: "Nút", icon: MousePointerClick, category: "design", keywords: "nut button cta lien ket", kind: "container", edit: ButtonsEdit,
      attributes: { align: { type: "string", enum: ["left", "center", "right", "space-between"] } },
      create: () => makeBlock("buttons", {}, [makeBlock("button", { variant: "primary" })]), contextToolbar: ButtonsTools,
      supports: { style: true, anchor: true, className: true },
    },
    {
      name: "button", title: "Nút", icon: MousePointerClick, kind: "atom", edit: ButtonEdit, hidden: true,
      attributes: { text: { type: "string" }, href: { type: "url" }, target: { type: "string", enum: ["_self", "_blank"] }, rel: { type: "string" }, variant: { type: "string", enum: ["primary", "secondary", "outline"], default: "primary" } },
      create: (attrs) => makeBlock("button", { variant: "primary", ...attrs }),
      supports: { style: true, className: true }, summary: (a) => a.text,
    },
    {
      name: "spacer", title: "Khoảng trống", icon: ChevronsUpDown, category: "design", keywords: "khoang trong spacer cach", kind: "atom", edit: SpacerEdit,
      attributes: { height: { type: "string", default: "lg" } }, summary: (a) => a.height,
    },
    { name: "horizontalRule", title: "Đường kẻ", icon: Minus, category: "design", keywords: "duong ke divider hr separator", kind: "atom", edit: SeparatorEdit, supports: { style: true, className: true, blockStyle: true } },
    {
      name: "callout", title: "Hộp lưu ý", icon: Info, category: "design", keywords: "luu y callout thong bao canh bao note", kind: "container", edit: CalloutEdit,
      attributes: { tone: { type: "string", enum: ["info", "success", "warning", "danger"], default: "info" }, title: { type: "string" } },
      create: () => makeBlock("callout", { tone: "info" }, [makeBlock("paragraph")]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "details", title: "Chi tiết", icon: PanelTop, category: "text", keywords: "chi tiet details accordion faq hoi dap an hien", kind: "container", edit: DetailsEdit,
      attributes: { summary: { type: "string" }, open: { type: "boolean", default: false } },
      create: () => makeBlock("details", {}, [makeBlock("paragraph")]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "accordion", title: "Accordion", icon: PanelTop, category: "text", keywords: "accordion faq hoi dap nhieu muc", kind: "container", edit: AccordionEdit,
      attributes: { multiple: { type: "boolean", default: false } },
      create: () => makeBlock("accordion", {}, [makeBlock("details", { summary: "" }, [makeBlock("paragraph")]), makeBlock("details", { summary: "" }, [makeBlock("paragraph")])]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "tabs", title: "Tabs", icon: PanelTop, category: "text", keywords: "tabs the tab chuyen doi noi dung", kind: "container", edit: TabsEdit,
      create: () => makeBlock("tabs", {}, [makeBlock("tab", { title: "" }, [makeBlock("paragraph")]), makeBlock("tab", { title: "" }, [makeBlock("paragraph")])]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "tab", title: "Tab", icon: PanelTop, category: "text", keywords: "tab", kind: "container", edit: TabEdit, hidden: true, structure: { parents: ["tabs"] },
      attributes: { title: { type: "string" } }, create: () => makeBlock("tab", { title: "" }, [makeBlock("paragraph")]),
    },
    {
      name: "carousel", title: "Carousel", icon: Columns3, category: "design", keywords: "carousel slider slide truot anh", kind: "container", edit: CarouselEdit,
      attributes: { slidesPerView: { type: "integer", default: 1, min: 1, max: 4 } },
      create: () => makeBlock("carousel", { slidesPerView: 1 }, [makeBlock("group", {}, [makeBlock("paragraph")]), makeBlock("group", {}, [makeBlock("paragraph")])]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "shortcode", title: "Shortcode", icon: Square, category: "design", keywords: "shortcode ma nhung plugin", kind: "atom", edit: ShortcodeEdit,
      attributes: { name: { type: "string" }, args: { type: "json", default: {} } }, supports: { style: true, anchor: true, className: true },
    },
    {
      name: "countdown", title: "Đếm ngược", icon: Square, category: "design", keywords: "dem nguoc countdown khuyen mai sale", kind: "atom", edit: CountdownEdit,
      attributes: { target: { type: "string" }, label: { type: "string" }, expiredText: { type: "string" } }, supports: { style: true, anchor: true, className: true },
    },
    {
      name: "rating", title: "Đánh giá sao", icon: Square, category: "design", keywords: "danh gia sao rating review", kind: "atom", edit: RatingEdit,
      attributes: { value: { type: "number", default: 5, min: 0, max: 10 }, max: { type: "integer", default: 5, min: 1, max: 10 }, label: { type: "string" } }, supports: { style: true, anchor: true, className: true },
    },
    {
      name: "cover", title: "Ảnh bìa", icon: ImageIcon, category: "media", keywords: "anh bia cover banner hero", kind: "container", edit: CoverEdit,
      attributes: { src: { type: "url", control: "media" }, alt: { type: "string" }, overlay: { type: "string", control: "color" }, opacity: { type: "integer", default: 50, min: 0, max: 100 }, minHeight: { type: "string", default: "400px" }, contentAlign: { type: "string", enum: ["top", "center", "bottom"], default: "center" }, fixed: { type: "boolean", default: false }, constrained: { type: "boolean", default: false } },
      create: () => makeBlock("cover", { opacity: 50, minHeight: "400px" }, [makeBlock("heading", { level: 2, textAlign: "center" })]),
      supports: { style: true, anchor: true, className: true },
    },
    {
      name: "mediaText", title: "Ảnh + chữ", icon: LayoutPanelLeft, category: "media", keywords: "anh chu media text", kind: "container", edit: MediaTextEdit,
      attributes: { src: { type: "url", control: "media" }, alt: { type: "string" }, position: { type: "string", enum: ["left", "right"], default: "left" }, width: { type: "integer", default: 50, min: 20, max: 80 }, verticalAlign: { type: "string", enum: ["top", "center", "bottom"], default: "center" }, stack: { type: "boolean", default: true } },
      create: () => makeBlock("mediaText", {}, [makeBlock("heading", { level: 3 }), makeBlock("paragraph")]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "table", title: "Bảng", icon: Table2, category: "text", keywords: "bang table", kind: "container", edit: TableEdit,
      attributes: { footer: { type: "boolean", default: false }, fixed: { type: "boolean", default: false } },
      create: () => makeBlock("table", {}, []), contextToolbar: TableTools,
      supports: { style: true, anchor: true, className: true, blockStyle: true },
    },
    { name: "tableRow", title: "Hàng", icon: Table2, kind: "container", edit: RowEdit, hidden: true },
    { name: "tableCell", title: "Ô", icon: Table2, kind: "container", edit: CellEdit, hidden: true, attributes: { colspan: { type: "integer", default: 1 }, rowspan: { type: "integer", default: 1 } } },
    { name: "tableHeader", title: "Ô tiêu đề", icon: Table2, kind: "container", edit: CellEdit, hidden: true, attributes: { colspan: { type: "integer", default: 1 }, rowspan: { type: "integer", default: 1 } } },
  ];
}
