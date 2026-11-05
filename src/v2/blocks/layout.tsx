import { colorCss, spacingValue } from "@ecomcx/ecomweb-content";
import { ChevronsUpDown, Columns2, Columns3, Columns4, Info, LayoutPanelLeft, Minus, MousePointerClick, PanelTop, RectangleHorizontal, Square, Table2, Image as ImageIcon } from "lucide-react";
import type { CSSProperties } from "react";
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
import { MediaActions, useFileDrop } from "./media-actions";
import type { MediaItem } from "../../shared/types";
import { LayoutGrid, Rows3, Columns3 as RowIcon } from "lucide-react";
import { useMsgs } from "../i18n";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
const PADDING: Record<string, string> = { none: "0", small: "0.75rem", medium: "1.5rem", large: "3rem" };
const TONES: Record<string, string> = { info: "#2563eb", success: "#16a34a", warning: "#d97706", danger: "#dc2626" };
/** Gộp props của khối với class + style inline riêng; `attrs` có `style` thì bỏ phần inline mà kiểu dáng đã thay (khớp website). */
const merge = (bp: BlockEditProps["blockProps"], className: string, style?: CSSProperties, attrs?: Record<string, unknown>) =>
  ({ ...bp, className: cx(bp.className, className), style: { ...(bp.style ?? {}), ...(attrs?.style ? withoutOverridden(style ?? {}, attrs.style) : style) } });

function GroupEdit({ block, blockProps }: BlockEditProps) {
  const a = block.attrs;
  const bg = colorCss(a.background), fg = colorCss(a.textColor);
  const pad = PADDING[a.padding as string] ?? (bg ? PADDING.medium : undefined);
  return (
    <div {...merge(blockProps, cx("ecx-group cms-group", a.padding && `ecx-group-${a.padding} cms-group-${a.padding}`), { background: bg, color: fg, padding: pad, borderRadius: bg ? 12 : undefined }, a)}>
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
  const stack = a.stack !== false;
  const active = useActiveWithin(block.id);
  const alignItems = a.verticalAlign === "center" ? "center" : a.verticalAlign === "bottom" ? "flex-end" : "flex-start";
  return (
    <div {...merge(blockProps, cx("ecx-columns cms-columns", a.verticalAlign && `ecx-columns-${a.verticalAlign}`, stack && "is-stack"), { display: "flex", flexWrap: stack ? "wrap" : "nowrap", gap: "1.5rem", alignItems, position: "relative" }, block.attrs)}>
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
  const w = Number(block.attrs.width) > 0 ? Number(block.attrs.width) : 1;
  return (
    <div {...merge(blockProps, "ecx-column cms-column", { flex: `${w} 1 0`, minWidth: "min(100%, 14rem)" }, block.attrs)}>
      <InnerBlocks parent={block} />
    </div>
  );
}

function ButtonsEdit({ block, blockProps }: BlockEditProps) {
  return <div {...merge(blockProps, cx("ecx-buttons-group", block.attrs.align && `is-${block.attrs.align}`))}><InnerBlocks parent={block} appender="none" /></div>;
}

function ButtonEdit({ block, blockProps, setAttrs, editable, labels }: BlockEditProps) {
  const a = block.attrs;
  const variant = a.variant === "secondary" || a.variant === "outline" ? a.variant : "primary";
  const bound = useBindingPreview(block, "text");
  const look: CSSProperties = variant === "outline"
    ? { border: "1px solid var(--ecx-button-bg, var(--cms-button-bg, var(--primary, currentColor)))", color: "var(--ecx-button-bg, var(--cms-button-bg, var(--primary, inherit)))" }
    : variant === "secondary"
      ? { background: "var(--ecx-button-secondary-bg, var(--cms-button-secondary-bg, rgba(127,127,127,.15)))", color: "inherit" }
      : { background: "var(--ecx-button-bg, var(--cms-button-bg, var(--primary, #18181b)))", color: "var(--ecx-button-fg, var(--cms-button-fg, #fff))" };
  return (
    <span {...merge(blockProps, cx("ecx-button cms-button", `ecx-button-${variant} cms-button-${variant}`), { display: "inline-block", padding: "0.6em 1.2em", borderRadius: 8, fontWeight: 600, lineHeight: 1.2, ...look }, a)}>
      {bound.bound ? <BoundText preview={bound} /> : <RichText blockId={block.id} field="text" tagName="span" value={String(a.text ?? "")} onChange={(v) => setAttrs({ text: v })} placeholder={labels.buttonText} placeholderAlways editable={editable} />}
    </span>
  );
}

function SpacerEdit({ block, blockProps }: BlockEditProps) {
  return <div {...merge(blockProps, "ecx-spacer", { height: spacingValue(block.attrs.height ?? "lg") ?? "1.5rem" })} aria-hidden="true" />;
}

function SeparatorEdit({ blockProps }: BlockEditProps) {
  return <hr {...(blockProps as object)} />;
}

function CalloutEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const tone = TONES[block.attrs.tone as string] ? (block.attrs.tone as string) : "info";
  return (
    <div {...merge(blockProps, cx("ecx-callout cms-callout", `ecx-callout-${tone} cms-callout-${tone}`), { borderLeft: `4px solid ${TONES[tone]}`, background: `color-mix(in srgb, ${TONES[tone]} 8%, transparent)`, padding: "0.75rem 1rem", borderRadius: 8 }, block.attrs)} role="note">
      <RichText blockId={block.id} field="title" tagName="p" className="ecx-callout-title cms-callout-title" style={{ margin: 0, fontWeight: 600 }} value={String(block.attrs.title ?? "")} onChange={(v) => setAttrs({ title: v })} placeholder="…" editable={editable} />
      <InnerBlocks parent={block} />
    </div>
  );
}

function DetailsEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  return (
    <details {...(merge(blockProps, "ecx-details") as object)} open>
      <summary onClick={(e) => e.preventDefault()}>
        <RichText blockId={block.id} field="summary" tagName="span" value={String(block.attrs.summary ?? "")} onChange={(v) => setAttrs({ summary: v })} placeholder="…" placeholderAlways editable={editable} />
      </summary>
      <InnerBlocks parent={block} />
    </details>
  );
}

function CoverEdit({ block, blockProps, setAttrs, labels }: BlockEditProps) {
  const a = block.attrs;
  const src = typeof a.src === "string" ? a.src : "";
  const { host } = useEditor();
  const select = (items: MediaItem[]) => setAttrs({ src: items[0].url, alt: items[0].alt || undefined, mediaId: items[0].id });
  const drop = useFileDrop("image", select);
  // Chưa có ảnh lẫn màu: chỗ chọn ảnh nền hoặc màu nền (không để khối trắng trơn vô hình)
  if (!src && !a.overlay) {
    const t = useMsgs("blocks");
    return (
      <div {...merge(blockProps, cx("ecx-media-placeholder ecx-cover-placeholder", drop.over && "is-drop-target"))} {...drop.props}>
        <span className="ecx-placeholder-title"><ImageIcon className="ecx-icon" />{t.cover}</span>
        <p className="ecx-placeholder-hint">{t.pickABackgroundImage}</p>
        <MediaActions kind="image" onSelect={select} onUrl={(url) => setAttrs({ src: url })} />
        <div className="ecx-chip-row" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
          {Object.entries(host.presets?.colors ?? { primary: "#1a597b", black: "#111", muted: "#757575" }).map(([name, c]) => (
            <button key={name} type="button" className="ecx-chip ecx-chip-swatch" title={name} aria-label={`${t.background}: ${name}`} style={{ background: c }} onClick={() => setAttrs({ overlay: name, opacity: 100 })} />
          ))}
        </div>
      </div>
    );
  }
  const overlay = colorCss(a.overlay) ?? (src ? "#000" : undefined);
  return (
    <div {...merge(blockProps, cx("ecx-cover", a.contentAlign && a.contentAlign !== "center" && `is-${a.contentAlign}`, a.fixed && src && "is-fixed"), { minHeight: spacingValue(a.minHeight ?? "400px") }, a)}>
      {src && <img className="ecx-cover-img" src={src} alt={String(a.alt ?? "")} draggable={false} />}
      {overlay && <span className="ecx-cover-overlay" aria-hidden="true" style={{ background: overlay, opacity: Math.min(100, Math.max(0, Number(a.opacity ?? 50))) / 100 }} />}
      <div className="ecx-cover-inner"><InnerBlocks parent={block} /></div>
    </div>
  );
}

function MediaTextEdit({ block, blockProps }: BlockEditProps) {
  const a = block.attrs;
  const width = Math.min(80, Math.max(20, Number(a.width) || 50));
  return (
    <div {...merge(blockProps, cx("ecx-media-text", a.position === "right" && "is-right", a.verticalAlign && a.verticalAlign !== "center" && `is-${a.verticalAlign}`, a.stack !== false && "is-stack"), { ["--ecx-media-width" as string]: `${width}%` } as CSSProperties)}>
      <figure className="ecx-media-text-media" style={{ margin: 0 }}>{typeof a.src === "string" && a.src ? <img src={a.src} alt={String(a.alt ?? "")} draggable={false} /> : <MediaPick blockId={block.id} />}</figure>
      <div className="ecx-media-text-content"><InnerBlocks parent={block} /></div>
    </div>
  );
}

/** Ô chọn ảnh dùng chung (ảnh bìa, ảnh + chữ). */
/** Chỗ chọn ảnh trong khối (ảnh + chữ…): tải lên / thư viện / URL, kéo thả tệp. */
export function MediaPick({ blockId }: { blockId: string }) {
  const { store, labels } = useEditor();
  const select = (items: MediaItem[]) => store.setAttrs([blockId], { src: items[0].url, alt: items[0].alt || undefined, mediaId: items[0].id });
  const drop = useFileDrop("image", select);
  return (
    <div className={cx("ecx-media-placeholder ecx-media-pick", drop.over && "is-drop-target")} {...drop.props}>
      <span className="ecx-placeholder-title"><ImageIcon className="ecx-icon" />{labels.image}</span>
      <MediaActions kind="image" compact onSelect={select} onUrl={(url) => store.setAttrs([blockId], { src: url })} />
    </div>
  );
}

function TableEdit({ block, blockProps }: BlockEditProps) {
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

const col = (width?: number) => makeBlock("column", width ? { width } : {}, [makeBlock("paragraph")]);
const columns = (...widths: number[]) => makeBlock("columns", {}, widths.map((w) => col(w)));
const cell = (header = false) => makeBlock(header ? "tableHeader" : "tableCell", {}, [makeBlock("paragraph")]);

export function layoutBlocks(): BlockType[] {
  return [
    {
      name: "group", title: "Nhóm", icon: Square, category: "design", keywords: "nhom group khung section container", kind: "container", edit: GroupEdit,
      attributes: { background: { type: "string", control: "color" }, textColor: { type: "string", control: "color" }, padding: { type: "string", enum: ["none", "small", "medium", "large"], default: "medium" } },
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
      create: () => columns(1, 1), contextToolbar: ColumnsTools,
      variations: [
        { name: "50-50", title: "50 / 50", icon: Columns2, create: () => columns(1, 1) },
        { name: "33-33-33", title: "33 / 33 / 33", icon: Columns3, create: () => columns(1, 1, 1) },
        { name: "30-70", title: "30 / 70", icon: LayoutPanelLeft, create: () => columns(30, 70) },
        { name: "70-30", title: "70 / 30", icon: LayoutPanelLeft, create: () => columns(70, 30) },
        { name: "25x4", title: "25 / 25 / 25 / 25", icon: Columns4, create: () => columns(1, 1, 1, 1) },
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
      name: "cover", title: "Ảnh bìa", icon: ImageIcon, category: "media", keywords: "anh bia cover banner hero", kind: "container", edit: CoverEdit,
      attributes: { src: { type: "url", control: "media" }, alt: { type: "string" }, overlay: { type: "string", control: "color" }, opacity: { type: "integer", default: 50, min: 0, max: 100 }, minHeight: { type: "string", default: "400px" }, contentAlign: { type: "string", enum: ["top", "center", "bottom"], default: "center" }, fixed: { type: "boolean", default: false } },
      create: () => makeBlock("cover", { opacity: 50, minHeight: "400px" }, [makeBlock("heading", { level: 2, textAlign: "center" })]),
      supports: { style: true, anchor: true, className: true },
    },
    {
      name: "mediaText", title: "Ảnh + chữ", icon: LayoutPanelLeft, category: "media", keywords: "anh chu media text", kind: "container", edit: MediaTextEdit,
      attributes: { src: { type: "url", control: "media" }, alt: { type: "string" }, position: { type: "string", enum: ["left", "right"], default: "left" }, width: { type: "integer", default: 50, min: 20, max: 80 }, verticalAlign: { type: "string", enum: ["top", "center", "bottom"], default: "center" }, stack: { type: "boolean", default: true } },
      create: () => makeBlock("mediaText", {}, [makeBlock("paragraph")]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "table", title: "Bảng", icon: Table2, category: "text", keywords: "bang table", kind: "container", edit: TableEdit,
      attributes: { footer: { type: "boolean", default: false }, fixed: { type: "boolean", default: false } },
      create: () => makeBlock("table", {}, [0, 1, 2].map((r) => makeBlock("tableRow", {}, [cell(r === 0), cell(r === 0), cell(r === 0)]))), contextToolbar: TableTools,
      supports: { style: true, anchor: true, className: true, blockStyle: true },
    },
    { name: "tableRow", title: "Hàng", icon: Table2, kind: "container", edit: RowEdit, hidden: true },
    { name: "tableCell", title: "Ô", icon: Table2, kind: "container", edit: CellEdit, hidden: true, attributes: { colspan: { type: "integer", default: 1 }, rowspan: { type: "integer", default: 1 } } },
    { name: "tableHeader", title: "Ô tiêu đề", icon: Table2, kind: "container", edit: CellEdit, hidden: true, attributes: { colspan: { type: "integer", default: 1 }, rowspan: { type: "integer", default: 1 } } },
  ];
}
