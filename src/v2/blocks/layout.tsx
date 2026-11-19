import { resolveIcon, coverVideo, countdownRules, nextTarget, CORE_NODES, testimonialsConfig, testimonialsVars, popupClass, popupConfig, popupPlayStyle, popupVars, carouselConfig, carouselData, carouselVars, COUNTDOWN_ZONES, countdownParts, countdownTarget, wallInZone, blockShell, buttonIcon, buttonWrapShell, colorCss, controlsCss, coverParts, spacingValue, tabsClass } from "@ecomcx/ecomweb-content";
import { IconPicker } from "../ui/icon-picker";
import { BgVideoPreview } from "../ui/bg-video-preview";
import { IconSvg } from "../ui/icon-svg";
import { blockControls } from "../../shared/panel-store";
import { ChevronLeft, ChevronRight, Plus, ChevronsUpDown, Columns2, Columns3, Columns4, Info, LayoutPanelLeft, Minus, MousePointerClick, PanelTop, RectangleHorizontal, Square, Table2, Image as ImageIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { InnerBlocks } from "../canvas/block-list";
import { withoutOverridden } from "./inline-style";
import { makeBlock, type BNode } from "../core/model";
import { messages } from "../../i18n";
import { accordionLayouts, carouselLayouts, mediaTextLayouts, tabsLayouts } from "./layout-options";
import type { BlockEditProps, BlockType } from "../core/registry";
import { RichText } from "../text/rich-text";
import { BoundText, useBindingPreview } from "../ui/bindings";
import { useEditor, useEditorState } from "../context";
import { ButtonTools, ButtonsTools, ColumnsTools, TableTools, addColumnTo } from "./tools";
import { ColumnHandles, ContentWidthHandles, HeightHandle, PaddingHandles, useActiveWithin } from "./resize";
import { ColumnInspector, ColumnsInspector } from "./columns-inspector";
import { layoutFor, layoutKind } from "../ui/layout-panel";
import { normalizeStyle, tableClass, type BlockStyle } from "@ecomcx/ecomweb-content";
import { Dropdown, MenuItem, ToolButton } from "../ui/toolbar";
import { useSiteColors } from "../ui/color-field";
import { AddItemButton, MediaPlaceholder } from "../ui/placeholders";
import type { MediaItem } from "../../shared/types";
import { Copy, LayoutGrid, Rows3, Columns3 as RowIcon, MoveHorizontal, Palette, Trash2 } from "lucide-react";
import { useMsgs } from "../i18n";
import { Section } from "../ui/style-controls";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
const PADDING: Record<string, string> = { none: "0", small: "0.75rem", medium: "1.5rem", large: "3rem" };
const TONES: Record<string, string> = { info: "#1a597b", success: "#16a34a", warning: "#d97706", danger: "#dc2626" };
/** Gộp props của khối với class + style inline riêng; `attrs` có `style` thì bỏ phần inline mà kiểu dáng đã thay (khớp website). */
const merge = (bp: BlockEditProps["blockProps"], className: string, style?: CSSProperties, attrs?: Record<string, unknown>) =>
  ({ ...bp, className: cx(bp.className, className), style: { ...(bp.style ?? {}), ...(attrs?.style ? withoutOverridden(style ?? {}, attrs.style) : style) } });

/** Props của vỏ khối lấy từ markup dùng chung với website: thẻ-class-style-thuộc tính cố định + props của canvas (id, chọn khối). */
const shellProps = (bp: BlockEditProps["blockProps"], type: string, attrs: Record<string, unknown>, parent?: { type: string; attrs?: Record<string, unknown> }) => {
  const sh = blockShell(type, attrs, parent)!;
  // Phần nhắm chính thẻ khối (vd phần "Nút" = chính <a>) cũng gỡ inline trùng như attrs.style (khớp website)
  const self = controlsCss(blockControls(), type, attrs)?.self;
  return { ...merge(bp, sh.className ?? "", sh.style as CSSProperties, self ? { style: { ...self, ...(normalizeStyle(attrs.style) ?? {}) } } : attrs), ...sh.attrs };
};

/** Biểu tượng hai lớp của Phần: dải nền + hai dòng chữ — mỗi kiểu nền một biểu tượng để nhận ra ngay trong bảng chèn. */
const sectionIcon = (fill: string, ink: string, stroke?: string) => function SectionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="5" width="21" height="14" rx="2" fill={fill} stroke={stroke ?? "none"} strokeWidth="1.5" />
      <rect x="6" y="9" width="12" height="2" rx="1" fill={ink} />
      <rect x="8" y="13" width="8" height="2" rx="1" fill={ink} opacity=".7" />
    </svg>
  );
};
const SECTION_ICONS = { plain: sectionIcon("none", "currentColor", "currentColor"), light: sectionIcon("#e5e7eb", "#6b7280"), brand: sectionIcon("#1a597b", "#ffffff"), dark: sectionIcon("#111827", "#ffffff") };

/** Phần (Section): nhóm rộng hết trang + khung nội dung + đệm lớn, có sẵn tiêu đề và đoạn mẫu để thấy ngay đây là một phần của trang. */
function sectionWith(m: Record<string, string>, extra: Record<string, unknown>): BNode {
  return makeBlock("group", { align: "full", constrained: true, padding: "large", ...extra }, [makeBlock("heading", { level: 2, textAlign: "center" }, m.sampleSectionTitle), makeBlock("paragraph", { textAlign: "center" }, m.sampleSectionText)]);
}

function GroupEdit({ block, blockProps, setAttrs, editable, selected }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const { store } = useEditor();
  const style: BlockStyle = normalizeStyle(block.attrs.style) ?? {};
  // Nhóm mới chèn (chưa chọn bố cục, chưa có nội dung): hỏi bố cục ngay trong khối như WordPress — đoạn văn bên trong vẫn gõ được ngay (gõ "/nhom" rồi gõ tiếp)
  const kids = block.content ?? [];
  const fresh = editable && !style.layout && (!kids.length || (kids.length === 1 && kids[0].type === "paragraph" && !kids[0].inline?.length));
  const items: Array<["stack" | "row" | "grid", typeof Square, string]> = [["stack", Rows3, tp.layoutStack], ["row", RowIcon, tp.layoutRow], ["grid", LayoutGrid, tp.layoutGrid]];
  return (
    <div {...shellProps(blockProps, "group", block.attrs)} data-ecx-placeholder={fresh ? "layout" : undefined}>
      <BgVideoPreview style={block.attrs.style} />
      <InnerBlocks parent={block} />
      {/* Chọn bố cục nằm dưới đoạn văn: thanh công cụ nổi của đoạn nằm phía trên, không che các nút */}
      {fresh && (
        <div className="ecx-media-placeholder ecx-ph-choose" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
          <p className="ecx-ph-title">{tp.chooseLayout}</p>
          <div className="ecx-ph-choices">
            {items.map(([k, I, label]) => <button key={k} type="button" className="ecx-ph-choice" onClick={() => { setAttrs({ style: normalizeStyle({ ...style, layout: layoutFor(k) }) }); const first = kids[0]; if (first?.type === "paragraph") store.focusText(first.id, 0); }}><I className="ecx-icon" aria-hidden />{label}</button>)}
          </div>
        </div>
      )}
      {selected && editable && <PaddingHandles blockId={block.id} />}
      {selected && editable && !fresh && <ContentWidthHandles blockId={block.id} />}
    </div>
  );
}

/** Thanh công cụ của nhóm: đổi nhanh Nhóm / Hàng ngang / Xếp dọc / Lưới (giữ các kiểu dáng khác). */
function GroupLayoutTools({ block, attrs, setAttrs, labels }: BlockEditProps) {
  const { store } = useEditor();
  const colors = useSiteColors();
  const style: BlockStyle = normalizeStyle(attrs.style) ?? {};
  const kind = layoutKind(style.layout);
  const t = useMsgs("blocks");
  const items: Array<["flow" | "row" | "stack" | "grid", typeof Square, string]> = [["flow", Square, t.group], ["row", RowIcon, t.row], ["stack", Rows3, t.stack], ["grid", LayoutGrid, t.grid]];
  return (
    <>
      {items.map(([k, I, label]) => (
        <ToolButton key={k} label={label} active={kind === k} onClick={() => setAttrs({ style: normalizeStyle({ ...style, layout: layoutFor(k, style.layout) }) })}><I className="ecx-icon" /></ToolButton>
      ))}
      <Dropdown label={t.contentWidth} trigger={<span className="ecx-tool-text" data-ecx-content-width={attrs.contentWidth || (attrs.constrained ? "site" : "fill")}><MoveHorizontal className="ecx-icon" /></span>}>
        {(close) => ([["fill", t.cwFill], ["site", t.cwSite], ["720px", "720px"], ["960px", "960px"], ["1140px", "1140px"]] as const).map(([v, l]) => {
          const cur = attrs.contentWidth || (attrs.constrained ? "site" : "fill");
          return <MenuItem key={v} label={(v === cur ? "✓ " : "") + l} onClick={() => { close(); setAttrs({ constrained: v === "site" ? true : undefined, contentWidth: v.endsWith("px") ? v : undefined }); }} />;
        })}
      </Dropdown>
      <Dropdown label={t.quickColor} trigger={<span className="ecx-tool-text"><Palette className="ecx-icon" /></span>}>
        {(close) => (
          <div className="ecx-quick-colors" role="group" aria-label={t.quickColor}>
            {Object.entries(colors).map(([name, css]) => (
              <button key={name} type="button" className="ecx-color-dot" title={name} aria-label={name} data-color={name} style={{ background: css }}
                onClick={() => { close(); /* Nhóm chưa có đệm: thêm đệm vừa để chữ không dính sát mép vùng màu */ setAttrs({ style: normalizeStyle({ ...style, color: { ...style.color, background: name } }), ...(!attrs.padding && !style.padding ? { padding: "medium" } : {}) }); }} />
            ))}
            <button type="button" className="ecx-color-dot is-none" title={t.noColor} aria-label={t.noColor} data-color="none"
              onClick={() => { close(); setAttrs({ style: normalizeStyle({ ...style, color: { ...style.color, background: undefined } }) }); }} />
          </div>
        )}
      </Dropdown>
      <ToolButton label={t.addSectionBelow} onClick={() => store.insertAfter(block.id, [makeBlock("group", {}, [makeBlock("paragraph")])], { replaceEmpty: false })}><Plus className="ecx-icon" /></ToolButton>
    </>
  );
}
const groupWith = (layout?: BlockStyle["layout"], kids = 1) => makeBlock("group", layout ? { style: { layout } } : {}, Array.from({ length: kids }, () => makeBlock("paragraph")));

/** Bố cục cột cho lưới chọn khi vừa chèn Bộ cột (0 = chia đều). */
const COLUMN_LAYOUTS: number[][] = [[100], [0, 0], [67, 33], [33, 67], [0, 0, 0], [50, 25, 25], [25, 25, 50], [25, 50, 25], [20, 60, 20], [0, 0, 0, 0], [40, 20, 20, 20], [20, 20, 20, 40], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
const layoutName = (w: number[]) => w.map((x) => (x || Math.round(100 / w.length))).join(" / ");

function ColumnsEdit({ block, blockProps, editable, labels, selected }: BlockEditProps) {
  const { store } = useEditor();
  const t = useMsgs("blocks");
  const tp = useMsgs("placeholders");
  const a = block.attrs;
  const active = useActiveWithin(block.id);
  const shell = blockShell("columns", a)!; // vỏ dùng chung với website (@ecomcx/ecomweb-content)
  const pick = (widths: number[]) => {
    const cols = widths.map((w) => makeBlock("column", w && widths.length > 1 ? { width: w } : {}, [makeBlock("paragraph")]));
    const first = cols[0].content![0].id;
    store.replace(block.id, [{ ...block, content: cols }], { select: { ids: [], editing: first }, caret: { id: first, offset: 0 } });
  };
  // Lệnh chèn "Bộ cột" tạo khối chưa có cột: hỏi bố cục ngay trên khung soạn (biến thể 50 / 50… đã có cột thì không hỏi)
  if (editable && !block.content?.length) return (
    <div {...merge(blockProps, "", undefined, block.attrs)} data-ecx-placeholder="columns">
      <div className="ecx-media-placeholder ecx-ph-choose" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
        <p className="ecx-ph-title">{tp.chooseColumns}</p>
        <div className="ecx-col-layouts">
          {COLUMN_LAYOUTS.map((w) => (
            <button key={w.join("-")} type="button" className="ecx-col-layout" aria-label={layoutName(w)} title={layoutName(w)} onClick={() => pick(w)}>
              {w.map((x, i) => <span key={i} style={{ flexGrow: x || 1 }} />)}
            </button>
          ))}
        </div>
        <button type="button" className="ecx-ph-skip" onClick={() => pick([0, 0])}>{tp.skip}</button>
      </div>
    </div>
  );
  return (
    <div {...merge(blockProps, shell.className!, shell.style as CSSProperties, block.attrs)}>
      <BgVideoPreview style={block.attrs.style} />
      <InnerBlocks parent={block} appender="none" />
      {active && editable && block.content!.length > 1 && <ColumnHandles block={block} />}
      {selected && editable && <PaddingHandles blockId={block.id} />}
      {active && editable && block.content!.length < 6 && store.canInsertInto(block.id) && (
        <button type="button" className="ecx-add-column" contentEditable={false} title={t.addColumn} aria-label={t.addColumn}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={() => addColumnTo(store, block)}>+</button>
      )}
    </div>
  );
}

function ColumnEdit({ block, blockProps, selected, editable }: BlockEditProps) {
  const { store } = useEditor();
  const parent = store.locate(block.id)?.parent;
  const shell = blockShell("column", block.attrs, parent ? { type: parent.type, attrs: parent.attrs } : undefined)!;
  return (
    <div {...merge(blockProps, shell.className!, shell.style as CSSProperties, block.attrs)}>
      <BgVideoPreview style={block.attrs.style} />
      <InnerBlocks parent={block} />
      {selected && editable && <PaddingHandles blockId={block.id} />}
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
  // Icon của nút (content buttonIcon — cùng svg với website)
  const ic = buttonIcon(a);
  const icon = ic && <svg className="ecx-widget-icon" viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={String((ic.children?.[0] as { props?: { d?: string } })?.props?.d ?? "")} /></svg>;
  // Website: nút đứng riêng nằm trong đoạn <p class="ecx-buttons"> (căn lề); trong khối "buttons" thì là chính thẻ <a>
  const link = (
    <a {...shellProps(inGroup ? blockProps : ({} as BlockEditProps["blockProps"]), "button", a)} title={typeof a.tooltip === "string" && a.tooltip ? a.tooltip : undefined} onClick={(e) => e.preventDefault()}>
      {icon && (a.iconPosition !== "right" || a.iconOnly === true) && icon}
      {/* Chỉ icon: chữ sửa ở ô "Chữ" bên phải (thành nhãn cho trình đọc màn hình) */}
      {icon && a.iconOnly === true ? null : bound.bound ? <BoundText preview={bound} /> : <RichText blockId={block.id} field="text" tagName="span" value={String(a.text ?? "")} onChange={(v) => setAttrs({ text: v })} placeholder={tp.buttonText} placeholderAlways editable={editable} />}
      {icon && a.iconPosition === "right" && a.iconOnly !== true && icon}
    </a>
  );
  if (inGroup) return link;
  const wrap = buttonWrapShell(a);
  return <p {...merge(blockProps, wrap.className ?? "", wrap.style as CSSProperties)}>{link}</p>;
}

function SpacerEdit({ block, blockProps, selected, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const props = shellProps(blockProps, "spacer", block.attrs);
  const h = block.attrs.height ?? "lg"; // tên cỡ (xl) hoặc độ dài người nhập — không in chuỗi var(--…) thô
  // Nhãn kích thước chỉ trong trình soạn (CSS ::before, không thêm phần tử con — website là div rỗng)
  return <div {...props} data-ecx-size={tp.spacer.replace("{size}", String(h ?? ""))}>{selected && editable && <HeightHandle blockId={block.id} />}</div>;
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

/** Popup khi soạn: nút mở (sửa chữ ngay trên nút) + khung "Nội dung popup" luôn mở để dựng nội dung bên trong như mọi khối khác. */
function PopupEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const c = popupConfig(block.attrs);
  const shell = c.triggerStyle === "link" || c.triggerStyle === "play" ? null : blockShell("button", { variant: c.triggerStyle });
  const [preview, setPreview] = useState(false);
  return (
    <div {...(merge(blockProps, cx(popupClass(c), preview && "is-previewing"), popupVars(c) as CSSProperties) as object)}>
      <div className="ecx-popup-trigger-row">
        <span className={`ecx-popup-trigger ${shell ? shell.className : c.triggerStyle === "play" ? "is-play" : "is-link"}`} style={(shell?.style ?? (c.triggerStyle === "play" ? popupPlayStyle(block.attrs) : undefined)) as CSSProperties}>
          <RichText blockId={block.id} field="triggerText" tagName="span" value={String(block.attrs.triggerText ?? "")} onChange={(v) => setAttrs({ triggerText: v })} placeholder={tp.popupTrigger} placeholderAlways editable={editable} />
        </span>
        <button type="button" className="ecx-popup-preview-btn" contentEditable={false} data-ecx-ui onMouseDown={(e) => e.preventDefault()} onClick={() => setPreview(true)}>{tp.popupPreview}</button>
      </div>
      <div className="ecx-popup-frame">
        <span className="ecx-popup-frame-label" contentEditable={false} data-ecx-ui>{preview ? tp.popupPreviewing : tp.popupContent}</span>
        {preview && <button type="button" className="ecx-popup-preview-close" contentEditable={false} data-ecx-ui aria-label={tp.popupPreviewClose} title={tp.popupPreviewClose} onMouseDown={(e) => e.preventDefault()} onClick={() => setPreview(false)}>×</button>}
        <InnerBlocks parent={block} />
      </div>
    </div>
  );
}

/** Lời chứng thực nhiều mục: khung soạn luôn xếp lưới (kể cả dạng slider) để thấy và sửa được mọi mục; website chạy slider khi chọn dạng đó. */
function TestimonialsEdit({ block, blockProps, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const c = testimonialsConfig(block.attrs);
  return (
    <div {...(merge(blockProps, "ecx-testimonials", testimonialsVars(c) as CSSProperties) as object)} data-layout={c.layout}>
      <InnerBlocks parent={block} appender="none" />
      {editable && <AddChild block={block} label={tp.addTestimonial} make={() => makeBlock("testimonial", { quote: "", name: "", role: "", rating: 5 })} />}
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
  const a = block.attrs;
  const cls = cx("ecx-accordion", Number(a.columns) === 2 && "is-cols-2", `has-icon-${["plus", "none"].includes(String(a.icon)) ? a.icon : "arrow"}`, a.iconSide === "left" && "is-icon-left");
  return <div {...(merge(blockProps, cls) as object)}><InnerBlocks parent={block} />{editable && <AddChild block={block} label={tp.addItem} make={() => makeBlock("details", { summary: "" }, [makeBlock("paragraph")])} />}</div>;
}

/** Thẻ đang mở của từng khối tabs trên khung soạn (không lưu vào nội dung — website luôn mở thẻ đầu). */
const openTabs = new Map<string, number>();
const tabListeners = new Set<() => void>();
const setOpenTab = (id: string, i: number) => { openTabs.set(id, i); tabListeners.forEach((l) => l()); };
const useOpenTab = (id: string) => useSyncExternalStore((l) => { tabListeners.add(l); return () => { tabListeners.delete(l); }; }, () => openTabs.get(id) ?? 0);

/** Danh sách tab ở bảng phải (như Kadence: tiêu đề, icon, phụ đề của TỪNG tab ngay trong khối cha — không phải chọn từng tab con). Chọn hàng = mở tab đó trên khung soạn. */
function TabsInspector({ block }: BlockEditProps) {
  const t = useMsgs("blocks") as Record<string, string>;
  const h = useMsgs("hints") as Record<string, string>;
  const { store } = useEditor();
  const active = useOpenTab(block.id);
  const tabs = (block.content ?? []).filter((c) => c.type === "tab");
  const set = (id: string, a: Record<string, unknown>) => store.setAttrs([id], a);
  return (
    <Section title={t.tabsItems} defaultOpen>
      {tabs.map((tab, i) => (
        <div key={tab.id} className={cx("ecx-item-row", i === active && "is-active")} data-tab-row onFocusCapture={() => setOpenTab(block.id, i)} onMouseDown={() => setOpenTab(block.id, i)}>
          <div className="ecx-item-row-head">
            <span className="ecx-item-n" aria-hidden="true">{i + 1}</span>
            <input className="ecx-input" aria-label={`${t.tabTitleField} ${i + 1}`} placeholder={t.tabTitleField} value={String(tab.attrs.title ?? "")} onChange={(e) => set(tab.id, { title: e.target.value })} />
          </div>
          {i === active && (
            <div className="ecx-item-row-sub">
              <IconPicker label={`${t.tabIconField} ${i + 1}`} value={typeof tab.attrs.icon === "string" ? tab.attrs.icon : undefined} allowNone onChange={(v) => set(tab.id, { icon: v })} />
              <input className="ecx-input" aria-label={`${t.tabSubtitleField} ${i + 1}`} placeholder={t.tabSubtitleField} value={String(tab.attrs.subtitle ?? "")} onChange={(e) => set(tab.id, { subtitle: e.target.value || undefined })} />
            </div>
          )}
        </div>
      ))}
    </Section>
  );
}

/** Tabs như website (TabsClient): thanh tiêu đề (vai trò tablist / tab) + một thẻ hiện; tiêu đề gõ ngay trên thanh, trống = "Tab N". */
function TabsEdit({ block, blockProps, editable }: BlockEditProps) {
  const { store } = useEditor();
  const tp = useMsgs("placeholders");
  const active = useOpenTab(block.id);
  const tabs = (block.content ?? []).filter((c) => c.type === "tab");
  return (
    <div {...(merge(blockProps, tabsClass(block.attrs)) as object)}>
      <div role="tablist" className="ecx-tabs-list" aria-orientation={block.attrs.orientation === "vertical" ? "vertical" : undefined}>
        {tabs.map((tab, i) => {
          return (
            <div key={tab.id} role="tab" aria-selected={i === active} tabIndex={-1} className={cx("ecx-tab-button", i === active && "is-active")} style={{ "--i": i } as CSSProperties} onMouseDown={() => setOpenTab(block.id, i)}>
              {resolveIcon(tab.attrs.icon) && <IconSvg className="ecx-tab-icon" name={tab.attrs.icon} size={18} />}
              <span className="ecx-tab-label">
                <RichText blockId={tab.id} field="title" tagName="span" value={String(tab.attrs.title ?? "")} onChange={(v) => store.setAttrs([tab.id], { title: v })} placeholder={tp.tabTitle} placeholderAlways editable={editable} />
                {!!tab.attrs.subtitle && <small className="ecx-tab-subtitle">{String(tab.attrs.subtitle)}</small>}
              </span>
            </div>
          );
        })}
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

/** Thanh công cụ khi đang ở trong Tabs: dời tab đang mở sang trái / phải, thêm tab. */
function TabsTools({ ancestor }: { ancestor: BNode; currentId: string }) {
  const { store } = useEditor();
  const tp = useMsgs("placeholders");
  const open = useOpenTab(ancestor.id);
  const tabs = (ancestor.content ?? []).filter((c) => c.type === "tab");
  const cur = tabs[open];
  const move = (dir: -1 | 1) => { if (!cur) return; store.moveBy([cur.id], dir); setOpenTab(ancestor.id, open + dir); };
  const canEdit = store.canInsertInto(ancestor.id);
  return (
    <>
      <ToolButton label={tp.moveTabLeft} disabled={!canEdit || open <= 0} onClick={() => move(-1)}><ChevronLeft className="ecx-icon" /></ToolButton>
      <ToolButton label={tp.moveTabRight} disabled={!canEdit || open >= tabs.length - 1} onClick={() => move(1)}><ChevronRight className="ecx-icon" /></ToolButton>
      <ToolButton label={tp.addTab} disabled={!canEdit} onClick={() => {
        const loc = store.locate(ancestor.id);
        if (!loc) return;
        store.insert(loc.docId, ancestor.id, ancestor.content?.length ?? 0, [makeBlock("tab", { title: "" }, [makeBlock("paragraph")])], { focus: false });
        setOpenTab(ancestor.id, tabs.length);
      }}><Plus className="ecx-icon" /></ToolButton>
    </>
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
    <div {...(merge(blockProps, "ecx-tab ecx-tab-panel", { "--i": index, ...(open ? {} : { display: "none" }) } as CSSProperties) as object)} role="tabpanel">
      <InnerBlocks parent={block} />
    </div>
  );
}

/**
 * Carousel trên khung soạn — cùng DOM / CSS với website (.ecx-carousel › .ecx-carousel-track): cuộn ngang bám mép slide, số slide thấy cùng lúc theo khổ,
 * nút trước / sau hai bên, chấm theo vị trí. Gõ / chọn trong slide nào thì track tự cuộn tới slide đó; thêm, nhân đôi, xoá, đổi chỗ slide ở thanh công cụ (CarouselTools)
 * và hàng dưới khối. Không còn cách "ẩn slide bằng CSS" — slide nào cũng nằm thật trong track nên chọn, kéo thả, danh sách khối đều đúng.
 */
function CarouselEdit({ block, blockProps, editable }: BlockEditProps) {
  const { store } = useEditor();
  const tp = useMsgs("placeholders");
  const c = carouselConfig(block.attrs);
  const kids = block.content ?? [];
  const track = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ index: 0, visible: c.per });
  const count = kids.length;
  const measure = useCallback(() => {
    const el = track.current, first = el?.children[0] as HTMLElement | undefined;
    if (!el || !first) return;
    const step = ((el.children[1] as HTMLElement | undefined)?.offsetLeft ?? first.offsetLeft + first.offsetWidth) - first.offsetLeft || first.offsetWidth || 1;
    const gap = Math.max(0, step - first.offsetWidth);
    const visible = Math.max(1, Math.min(count, Math.round((el.clientWidth + gap) / step)));
    setPos((p) => { const index = Math.max(0, Math.min(Math.max(0, count - visible), Math.round(el.scrollLeft / step))); return p.index === index && p.visible === visible ? p : { index, visible }; });
  }, [count]);
  useLayoutEffect(() => { measure(); });
  useEffect(() => {
    const el = track.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  const goTo = useCallback((i: number, smooth = true) => {
    const el = track.current, kid = el?.children[i] as HTMLElement | undefined;
    if (el && kid) el.scrollTo({ left: kid.offsetLeft - (el.children[0] as HTMLElement).offsetLeft, behavior: smooth ? "smooth" : "auto" });
  }, []);
  const sel = useEditorState(useCallback((s) => {
    const cur = s.selection.ids.length ? s.selection.ids : s.selection.editing ? [s.selection.editing] : [];
    return kids.findIndex((k) => cur.some((x) => x === k.id || !!store.locate(x)?.ancestors.includes(k.id)));
  }, [kids, store]));
  // Chọn / gõ trong slide đang ngoài khung nhìn (từ danh sách khối, tìm kiếm, phím mũi tên) → cuộn tới slide đó
  useEffect(() => {
    if (sel < 0) return;
    const el = track.current, kid = el?.children[sel] as HTMLElement | undefined;
    if (!el || !kid) return;
    if (kid.offsetLeft < el.scrollLeft - 2 || kid.offsetLeft + kid.offsetWidth > el.scrollLeft + el.clientWidth + 2) goTo(sel);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  // Thêm / nhân đôi slide → căn slide mới nằm trọn khung nhìn. Trình duyệt cũng tự cuộn theo con trỏ (chỉ vừa đủ thấy con trỏ, lệch mép) —
  // nên đợi cuộn dừng hẳn rồi mới căn, để không bị bước cuộn tự động đó ghi đè.
  const seen = useRef<string[] | null>(null);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settle = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { const i = pending.current; pending.current = null; if (i != null) goTo(i, false); }, 160);
  }, [goTo]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const ids = kids.map((k) => k.id), before = seen.current;
    seen.current = ids;
    if (!before || ids.length <= before.length) return;
    const added = ids.findIndex((id) => !before.includes(id));
    if (added >= 0) { pending.current = added; settle(); }
  }, [kids, settle]);
  const last = Math.max(0, count - pos.visible);
  const cur = sel >= 0 ? sel : Math.min(pos.index, Math.max(0, count - 1));
  const many = last > 0;
  const prev = () => goTo(pos.index <= 0 ? (c.loop ? last : 0) : pos.index - 1);
  const next = () => goTo(pos.index >= last ? (c.loop ? 0 : last) : pos.index + 1);
  const chev = (d: string) => <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
  return (
    <div {...(merge(blockProps, "ecx-carousel", carouselVars(c) as CSSProperties) as object)} {...carouselData({ ...c, effect: "slide" })}>
      <div className="ecx-carousel-track" ref={track} onScroll={() => { measure(); if (pending.current != null) settle(); }}>
        <InnerBlocks parent={block} />
      </div>
      <div contentEditable={false} onMouseDown={(e) => e.preventDefault()}>
        {c.arrows && many && <>
          <button type="button" className="ecx-carousel-arrow is-prev" aria-label={tp.prevSlide} disabled={!c.loop && pos.index <= 0} onClick={prev}>{chev("m15 18-6-6 6-6")}</button>
          <button type="button" className="ecx-carousel-arrow is-next" aria-label={tp.nextSlide} disabled={!c.loop && pos.index >= last} onClick={next}>{chev("m9 18 6-6-6-6")}</button>
        </>}
        {c.dots && many && (
          <div className="ecx-carousel-dots">
            {Array.from({ length: last + 1 }, (_, i) => <button key={i} type="button" className="ecx-carousel-dot" aria-label={`${tp.slide} ${i + 1}`} aria-current={i === pos.index ? "true" : undefined} onClick={() => goTo(i)} />)}
          </div>
        )}
      </div>
      {/* Hàng thao tác chỉ có trên khung soạn (website không vẽ): thêm / nhân đôi / xoá slide + vị trí */}
      <div className="ecx-carousel-nav" contentEditable={false} onMouseDown={(e) => e.preventDefault()}>
        {editable && <AddChild block={block} label={tp.addSlide} make={() => makeBlock("group", {}, [makeBlock("heading", { level: 3 }), makeBlock("paragraph")])} />}
        {editable && count > 0 && <button type="button" aria-label={tp.duplicateSlide} title={tp.duplicateSlide} onClick={() => store.duplicate([kids[cur].id])}><Copy className="ecx-icon" /></button>}
        {editable && count > 1 && <button type="button" className="ecx-carousel-del" aria-label={tp.removeSlide} title={tp.removeSlide} onClick={() => store.remove([kids[cur].id])}><Trash2 className="ecx-icon" /></button>}
        {count > 0 && <span className="ecx-carousel-count" aria-hidden="true">{tp.slide} {cur + 1} / {count}</span>}
      </div>
    </div>
  );
}

/** Thanh công cụ khi đang trong một slide: đổi chỗ trái / phải, nhân đôi, thêm, xoá slide hiện tại. */
function CarouselTools({ ancestor, currentId }: { ancestor: BNode; currentId: string }) {
  const { store } = useEditor();
  const tp = useMsgs("placeholders");
  const kids = ancestor.content ?? [];
  const i = kids.findIndex((k) => k.id === currentId || !!store.locate(currentId)?.ancestors.includes(k.id));
  if (i < 0) return null;
  const canEdit = store.canInsertInto(ancestor.id);
  return (
    <>
      <ToolButton label={tp.moveSlideLeft} disabled={!canEdit || i <= 0} onClick={() => store.moveBy([kids[i].id], -1)}><ChevronLeft className="ecx-icon" /></ToolButton>
      <ToolButton label={tp.moveSlideRight} disabled={!canEdit || i >= kids.length - 1} onClick={() => store.moveBy([kids[i].id], 1)}><ChevronRight className="ecx-icon" /></ToolButton>
      <ToolButton label={tp.duplicateSlide} disabled={!canEdit} onClick={() => store.duplicate([kids[i].id])}><Copy className="ecx-icon" /></ToolButton>
      <ToolButton label={tp.removeSlide} disabled={!canEdit || kids.length <= 1} onClick={() => store.remove([kids[i].id])}><Trash2 className="ecx-icon" /></ToolButton>
    </>
  );
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

/** Ngày giờ kết thúc + múi giờ (dùng ở dải dưới đồng hồ và ở bảng phải — cùng một chỗ chỉnh, cùng logic đổi múi giờ giữ nguyên thời điểm). */
function CountdownTimeFields({ attrs: a, setAttrs }: { attrs: Record<string, any>; setAttrs(v: Record<string, unknown>): void }) {
  const tp = useMsgs("placeholders");
  const tz = typeof a.timezone === "string" && a.timezone ? a.timezone : "";
  const evergreen = a.mode === "evergreen";
  const mode = (
    <div className="ecx-ph-row" role="radiogroup" aria-label={tp.countdownMode}>
      {([["date", tp.countdownModeDate], ["evergreen", tp.countdownModeEvergreen]] as const).map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={(a.mode ?? "date") === v} className={cx("ecx-btn", (a.mode ?? "date") === v && "is-active")} onClick={() => setAttrs({ mode: v === "date" ? undefined : v, ...(v === "evergreen" && !a.evergreenHours && !a.evergreenMinutes ? { evergreenHours: 24 } : {}) })}>{label}</button>
      ))}
    </div>
  );
  if (evergreen) return (
    <>
      {mode}
      <div className="ecx-ph-row">
        <label className="ecx-ph-inline-field"><span className="ecx-ph-label">{tp.countdownHours}</span>
          <input className="ecx-input" type="number" min={0} max={2160} value={Number(a.evergreenHours ?? 0)} onChange={(e) => setAttrs({ evergreenHours: Math.max(0, Math.min(2160, Math.round(Number(e.target.value) || 0))) || undefined })} /></label>
        <label className="ecx-ph-inline-field"><span className="ecx-ph-label">{tp.countdownMinutes}</span>
          <input className="ecx-input" type="number" min={0} max={59} value={Number(a.evergreenMinutes ?? 0)} onChange={(e) => setAttrs({ evergreenMinutes: Math.max(0, Math.min(59, Math.round(Number(e.target.value) || 0))) || undefined })} /></label>
      </div>
      <p className="ecx-placeholder-hint">{tp.countdownEvergreenHint}</p>
    </>
  );
  return (
    <>
      {mode}
      <label className="ecx-ph-row">
        <span className="ecx-ph-label">{tp.countdownTarget}</span>
        <input className="ecx-input" type="datetime-local" value={tz ? String(a.target ?? "").slice(0, 16) : toLocalInput(a.target)}
          onChange={(e) => setAttrs({ target: e.target.value ? (tz ? e.target.value : new Date(e.target.value).toISOString()) : undefined })} />
      </label>
      <label className="ecx-ph-row">
        <span className="ecx-ph-label">{tp.countdownZone}</span>
        <select className="ecx-input" aria-label={tp.countdownZone} value={tz} onChange={(e) => {
          const next = e.target.value, ms = countdownTarget(a);
          // Đổi múi giờ giữ nguyên thời điểm đã đặt: giờ tường mới (hoặc ISO của máy khi về "Theo máy người xem")
          setAttrs({ timezone: next || undefined, ...(Number.isFinite(ms) ? { target: next ? wallInZone(ms, next) : new Date(ms).toISOString() } : {}) });
        }}>
          <option value="">{tp.countdownZoneLocal}</option>
          {COUNTDOWN_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </label>
    </>
  );
}

/** Bảng phải của Đếm ngược: chọn ngày giờ bằng lịch + múi giờ (trước đây ô "Mở ở" là ô chữ gõ tay). */
function CountdownInspector({ attrs, setAttrs }: BlockEditProps) {
  const t = useMsgs("blocks") as Record<string, string>;
  return (
    <Section title={t.countdownWhen} defaultOpen>
      <div className="ecx-countdown-fields"><CountdownTimeFields attrs={attrs} setAttrs={setAttrs} /></div>
    </Section>
  );
}

function CountdownEdit({ block, blockProps, setAttrs, editable, labels }: BlockEditProps) {
  const a = block.attrs;
  const tp = useMsgs("placeholders");
  const valid = countdownRules(a).evergreenMs ? true : Number.isFinite(countdownTarget(a));
  const active = useActiveWithin(block.id);
  // Ngày giờ + múi giờ: một dải gọn ngay dưới đồng hồ (đồng hồ vẫn chạy thật để thấy kết quả khi chỉnh)
  const strip = editable && (
    <div className="ecx-countdown-setup" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
      <CountdownTimeFields attrs={a} setAttrs={setAttrs} />
    </div>
  );
  // Thiếu / sai thời điểm: website không vẽ khối → nói rõ, không để khối "mất tích" im lặng
  if (!valid) return (
    <div {...(merge(blockProps, "ecx-countdown ecx-media-placeholder", {}) as object)} data-ecx-placeholder="countdown">
      <span className="ecx-ph-digits" aria-hidden>00 : 00 : 00 : 00</span>
      {strip}
      <p className="ecx-placeholder-hint">{labels.countdownNoTarget}</p>
    </div>
  );
  if (editable && active) return (
    <div {...(merge(blockProps, "ecx-countdown-edit") as object)}>
      <CountdownPreview block={block} blockProps={{} as BlockEditProps["blockProps"]} />
      {strip}
    </div>
  );
  return <CountdownPreview block={block} blockProps={blockProps} />;
}

/** Đếm ngược chạy thật như website (cùng countdownParts + markup), nhãn đơn vị theo ngôn ngữ trình soạn. */
function CountdownPreview({ block, blockProps }: Pick<BlockEditProps, "block" | "blockProps">) {
  const a = block.attrs;
  const tp = useMsgs("placeholders");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  // Evergreen: trên khung soạn luôn đếm từ đầu thời lượng khi mở trang (website thì theo từng người xem); lặp lại: dời mốc như website
  const rules = countdownRules(a);
  const [openedAt] = useState(() => Date.now());
  const target = rules.evergreenMs ? openedAt + rules.evergreenMs : nextTarget(countdownTarget(a), rules.repeat, now);
  const left = Math.max(0, target - now);
  const cls = cx("ecx-countdown", a.layout === "inline" && "is-inline", a.divider === true && "has-divider", rules.pause && "has-pause");
  // Trên khung soạn "ẩn" và "chuyển trang" không thật sự chạy (khối vẫn phải thấy để sửa) — chỉ chữ thay thế mới hiện
  if (left === 0 && rules.action === "message" && a.expiredText) return <div {...(merge(blockProps, "ecx-countdown is-expired") as object)}>{String(a.expiredText)}</div>;
  return (
    <div {...(merge(blockProps, cls) as object)} role="timer">
      {a.label ? <p className="ecx-countdown-label">{String(a.label)}</p> : null}
      <div className="ecx-countdown-parts">{countdownParts(a, left, { d: tp.cdDays, h: tp.cdHours, m: tp.cdMinutes, s: tp.cdSeconds }).map((p) => <span key={p.u} className={`ecx-countdown-${p.u}`}><strong>{p.value}</strong><small>{p.label}</small></span>)}</div>
      {a.postText ? <p className="ecx-countdown-post">{String(a.postText)}</p> : null}
      {rules.pause && <button type="button" className="ecx-countdown-pause" contentEditable={false} aria-label="⏸" onMouseDown={(e) => e.preventDefault()}>⏸</button>}
    </div>
  );
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
      {coverVideo(a) && <video className="ecx-cover-video" src={coverVideo(a)!} poster={src || undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} style={imgStyle as CSSProperties} />}
      {src && !fixed && !coverVideo(a) && <img className="ecx-cover-img" src={src} alt={String(a.alt ?? "")} draggable={false} style={imgStyle as CSSProperties} />}
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
    <div {...merge(blockProps, tableClass(block.attrs))}>
      <table className={block.attrs.fixed ? "is-fixed" : undefined}>{typeof block.attrs.caption === "string" && block.attrs.caption.trim() && <caption>{block.attrs.caption}</caption>}<tbody><InnerBlocks parent={block} appender="none" /></tbody></table>
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

export function layoutBlocks(lang?: string): BlockType[] {
  const m = messages("blocks", lang) as Record<string, string>;
  const p = (t = "") => makeBlock("paragraph", {}, t);
  /** Hạn mặc định của đếm ngược: 3 ngày sau, 23:59 (giờ máy người soạn). */
  const soon = () => { const d = new Date(Date.now() + 3 * 864e5); d.setHours(23, 59, 0, 0); const z = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
  return [
    {
      name: "group", title: "Nhóm", icon: Square, category: "design", keywords: "nhom group khung section container", kind: "container", edit: GroupEdit,
      attributes: { background: { type: "string", control: "color" }, textColor: { type: "string", control: "color" }, padding: { type: "string", enum: ["none", "small", "medium", "large"], default: "medium" }, constrained: { type: "boolean", default: false, control: "hidden" }, contentWidth: { type: "string", control: "hidden" },
        href: { type: "url" }, linkTarget: { type: "string", enum: ["_self", "_blank"] }, linkLabel: { type: "string" }, collapseHeight: { type: "string" }, collapseFade: { type: "boolean", default: true }, collapseOnce: { type: "boolean", default: false }, moreText: { type: "string" }, lessText: { type: "string" } },
      create: (attrs) => makeBlock("group", attrs ?? {}, [makeBlock("paragraph")]),
      toolbar: GroupLayoutTools,
      variations: [
        { name: "row", title: "Hàng ngang", standalone: true, legacy: true, icon: RowIcon, keywords: "hang ngang row flex xep ngang", create: () => groupWith(layoutFor("row"), 2) },
        { name: "stack", title: "Xếp dọc", standalone: true, legacy: true, icon: Rows3, keywords: "xep doc stack flex cot", create: () => groupWith(layoutFor("stack"), 2) },
        { name: "grid", title: "Lưới", standalone: true, legacy: true, icon: LayoutGrid, keywords: "luoi grid o cot", create: () => groupWith(layoutFor("grid"), 3) },
        // Phần (Section): dải rộng hết trang, nội dung nằm trong khung, đệm lớn — cái người dùng thường tìm đầu tiên khi dựng trang
        { name: "section", title: "Section", standalone: true, icon: SECTION_ICONS.plain, keywords: "phan section dai rong full width hero khoi lon trang", create: () => sectionWith(m, {}) },
        { name: "section-light", title: "Phần nền sáng", standalone: true, legacy: true, icon: SECTION_ICONS.light, keywords: "phan section nen sang xam nhat xen ke", create: () => sectionWith(m, { style: { color: { background: "muted/10" } } }) },
        { name: "section-brand", title: "Phần nền màu thương hiệu", standalone: true, legacy: true, icon: SECTION_ICONS.brand, keywords: "phan section nen mau thuong hieu primary noi bat", create: () => sectionWith(m, { background: "primary", textColor: "#ffffff" }) },
        { name: "section-dark", title: "Phần nền tối", standalone: true, legacy: true, icon: SECTION_ICONS.dark, keywords: "phan section nen toi dark den", create: () => sectionWith(m, { background: "#111827", textColor: "#ffffff" }) },
      ],
      supports: { style: true, anchor: true, className: true, blockStyle: true },
      transforms: [{ to: "columns", convert: (b) => [makeBlock("columns", {}, b.flatMap((g) => g.content ?? []).map((c) => makeBlock("column", {}, [c])))] }],
    },
    {
      name: "columns", title: "Row Layout", icon: Columns2, category: "design", keywords: "hang bo cuc row layout cot columns chia cot luoi", kind: "container", edit: ColumnsEdit,
      // Cài đặt vẽ ở ColumnsInspector (số cột, bố cục theo khổ, khe, căn dọc) — ô tự sinh ẩn
      attributes: { verticalAlign: { type: "string", enum: ["top", "center", "bottom", "stretch"], control: "hidden" }, stack: { type: "boolean", default: true, control: "hidden" } },
      create: () => columns(), contextToolbar: ColumnsTools, inspector: ColumnsInspector,
      variations: [
        { name: "50-50", title: "50 / 50", legacy: true, icon: Columns2, create: () => columns(0, 0) },
        { name: "33-33-33", title: "33 / 33 / 33", legacy: true, icon: Columns3, create: () => columns(0, 0, 0) },
        { name: "33-66", title: "33 / 66", legacy: true, icon: LayoutPanelLeft, create: () => columns(33, 67) },
        { name: "66-33", title: "66 / 33", legacy: true, icon: LayoutPanelLeft, create: () => columns(67, 33) },
        { name: "25x4", title: "25 / 25 / 25 / 25", legacy: true, icon: Columns4, create: () => columns(0, 0, 0, 0) },
      ],
      supports: { style: true, anchor: true, className: true },
    },
    { name: "column", title: "Cột", icon: RectangleHorizontal, kind: "container", edit: ColumnEdit, inspector: ColumnInspector, hidden: true, attributes: { width: { type: "number", min: 1, max: 100, control: "hidden" }, href: { type: "url", control: "hidden" }, linkTarget: { type: "string", enum: ["_self", "_blank"], control: "hidden" }, linkLabel: { type: "string", control: "hidden" } }, create: () => col(), supports: { style: true } },
    {
      name: "buttons", title: "Nút", icon: MousePointerClick, category: "design", keywords: "nut button cta lien ket", kind: "container", edit: ButtonsEdit,
      attributes: { align: { type: "string", enum: ["left", "center", "right", "space-between"] }, orientation: { type: "string", enum: ["horizontal", "vertical"], default: "horizontal" } },
      create: () => makeBlock("buttons", {}, [makeBlock("button", { variant: "primary", text: m.sampleButton })]), contextToolbar: ButtonsTools,
      supports: { style: true, anchor: true, className: true },
    },
    {
      name: "button", title: "Nút", icon: MousePointerClick, kind: "atom", edit: ButtonEdit, hidden: true,
      attributes: { text: { type: "string" }, href: { type: "url" }, target: { type: "string", enum: ["_self", "_blank"] }, rel: { type: "string" }, tooltip: { type: "string" }, variant: { type: "string", enum: ["primary", "secondary", "outline"], default: "primary" },
        icon: { type: "string" }, iconPosition: { type: "string", enum: ["left", "right"] }, width: { type: "string", enum: ["auto", "full"] }, ariaLabel: { type: "string" },
        iconOnly: { type: "boolean", default: false }, iconReveal: { type: "boolean", default: false } },
      create: (attrs) => makeBlock("button", { variant: "primary", ...attrs }), toolbar: ButtonTools,
      supports: { style: true, className: true }, summary: (a) => a.text,
    },
    {
      name: "spacer", title: "Khoảng cách / Đường kẻ", icon: ChevronsUpDown, category: "design", keywords: "khoang trong spacer cach duong ke divider hr separator ngan cach", kind: "atom", edit: SpacerEdit,
      attributes: { height: { type: "string", default: "lg" }, line: { type: "boolean", default: false }, lineStyle: { type: "string", enum: ["solid", "dashed", "dotted", "double"], default: "solid" }, lineWeight: { type: "integer", min: 1, max: 12, default: 1 },
        lineWidth: { type: "integer", min: 5, max: 100, default: 100 }, lineAlign: { type: "string", enum: ["left", "center", "right"], default: "center" }, lineColor: { type: "string", control: "color" } }, summary: (a) => a.height,
    },
    { name: "horizontalRule", title: "Đường kẻ", icon: Minus, category: "design", keywords: "duong ke divider hr separator", kind: "atom", edit: SeparatorEdit, supports: { style: true, className: true, blockStyle: true } },
    {
      name: "callout", title: "Hộp lưu ý", icon: Info, category: "design", keywords: "luu y callout thong bao canh bao note", kind: "container", edit: CalloutEdit,
      attributes: { tone: { type: "string", enum: ["info", "success", "warning", "danger"], default: "info" }, title: { type: "string" } },
      create: () => makeBlock("callout", { tone: "info" }, [p(m.sampleCallout)]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "popup", title: "Popup", icon: PanelTop, category: "design", keywords: "popup hop thoai modal cua so noi bat nut mo dialog lightbox", kind: "container", edit: PopupEdit,
      attributes: { ...CORE_NODES.popup.attrs, align: { type: "string", enum: ["wide", "full"], control: "hidden" }, triggerText: { type: "string", control: "hidden" }, label: { type: "string" } },
      create: () => makeBlock("popup", { triggerText: m.samplePopupButton }, [makeBlock("heading", { level: 3 }, m.samplePopupTitle), p(m.samplePopupText)]),
      supports: { style: true, anchor: true, className: true },
    },
    {
      name: "testimonials", title: "Đánh giá khách hàng", icon: Square, category: "design", keywords: "loi chung thuc danh gia khach hang review testimonial luoi slider nhieu", kind: "container", edit: TestimonialsEdit,
      attributes: { ...CORE_NODES.testimonials.attrs, align: { type: "string", enum: ["wide", "full"], control: "hidden" }, columnsTablet: { ...CORE_NODES.testimonials.attrs!.columnsTablet, default: 2 }, columnsMobile: { ...CORE_NODES.testimonials.attrs!.columnsMobile, default: 1 } },
      create: () => makeBlock("testimonials", { columns: 3 }, [[m.sampleQuote, m.sampleName, m.sampleRole], [m.sampleQuote2, m.sampleName2, m.sampleRole2], [m.sampleQuote3, m.sampleName3, m.sampleRole3]].map(([quote, name, role]) => makeBlock("testimonial", { quote, name, role, rating: 5 }))),
      variations: [{ name: "slider", title: "Đánh giá khách hàng (Slider)", standalone: true, icon: Square, keywords: "loi chung thuc slider carousel truot",
        create: () => makeBlock("testimonials", { layout: "carousel", columns: 1, autoplay: true }, [[m.sampleQuote, m.sampleName, m.sampleRole], [m.sampleQuote2, m.sampleName2, m.sampleRole2], [m.sampleQuote3, m.sampleName3, m.sampleRole3]].map(([quote, name, role]) => makeBlock("testimonial", { quote, name, role, rating: 5 }))) }],
      supports: { style: true, anchor: true, className: true },
    },
    {
      name: "details", title: "Chi tiết", icon: PanelTop, category: "text", keywords: "chi tiet details accordion faq hoi dap an hien", kind: "container", edit: DetailsEdit,
      attributes: { summary: { type: "string" }, open: { type: "boolean", default: false } },
      create: () => makeBlock("details", { summary: m.sampleDetails }, [p(m.sampleDetailsBody)]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "accordion", title: "Accordion", icon: PanelTop, category: "text", keywords: "accordion faq hoi dap nhieu muc", kind: "container", edit: AccordionEdit,
      attributes: { multiple: { type: "boolean", default: false }, columns: { type: "number", enum: [1, 2], default: 1 }, icon: { type: "string", enum: ["arrow", "plus", "none"], default: "arrow" }, iconSide: { type: "string", enum: ["left", "right"], default: "right" }, titleTag: { type: "string", enum: ["div", "h2", "h3", "h4", "h5", "h6"], default: "div" }, startOpen: { type: "string", enum: ["none", "first", "all"], default: "none" }, faq: { type: "boolean", default: false } },
      layouts: accordionLayouts(m), create: () => makeBlock("accordion", {}, [makeBlock("details", { summary: m.sampleFaq1 }, [p(m.sampleFaqBody)]), makeBlock("details", { summary: m.sampleFaq2 }, [p(m.sampleFaqBody)])]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "tabs", title: "Tabs", icon: PanelTop, category: "text", keywords: "tabs the tab chuyen doi noi dung", kind: "container", edit: TabsEdit,
      attributes: { tabsAlign: { type: "string", enum: ["flex-start", "center", "flex-end", "space-between"] }, initial: { type: "number", min: 1 }, orientation: { type: "string", enum: ["horizontal", "vertical"], default: "horizontal" }, mobileAccordion: { type: "boolean", default: false }, iconPosition: { type: "string", enum: ["left", "right", "top"], default: "left" }, iconOnly: { type: "boolean", default: false } },
      layouts: tabsLayouts(m), layoutOwns: ["orientation"], inspector: TabsInspector, create: () => makeBlock("tabs", {}, [makeBlock("tab", { title: m.sampleTab1 }, [p(m.sampleTabBody)]), makeBlock("tab", { title: m.sampleTab2 }, [p(m.sampleTabBody)])]), contextToolbar: TabsTools, supports: { style: true, anchor: true, className: true },
    },
    {
      name: "tab", title: "Tab", icon: PanelTop, category: "text", keywords: "tab", kind: "container", edit: TabEdit, hidden: true, structure: { parents: ["tabs"] },
      attributes: { title: { type: "string" }, icon: { type: "string" }, subtitle: { type: "string" } }, supports: { anchor: true }, create: () => makeBlock("tab", { title: "" }, [makeBlock("paragraph")]),
    },
    {
      name: "carousel", title: "Slider", icon: Columns3, category: "design", keywords: "slider carousel slide truot anh trinh chieu banner hero", kind: "container", edit: CarouselEdit,
      attributes: {
        slidesPerView: { type: "integer", default: 1, min: 1, max: 4 }, slidesTablet: { type: "integer", min: 1, max: 4 }, slidesMobile: { type: "integer", min: 1, max: 4 },
        arrows: { type: "boolean", default: true }, dots: { type: "boolean", default: true }, autoplay: { type: "boolean", default: false },
        interval: { type: "integer", default: 5, min: 2, max: 30 }, loop: { type: "boolean", default: true }, gap: { type: "string" },
        effect: { type: "string", enum: ["slide", "fade"], default: "slide" }, speed: { type: "integer", default: 400, min: 150, max: 1500 },
        heightMode: { type: "string", enum: ["auto", "ratio", "min"], default: "auto" }, ratio: { type: "string", enum: ["16/9", "4/3", "3/2", "1/1", "21/9", "3/1"], default: "16/9" }, minHeight: { type: "string" },
        arrowStyle: { type: "string", enum: ["circle", "square", "plain", "light"], default: "circle" }, dotStyle: { type: "string", enum: ["dot", "line", "light"], default: "dot" },
        arrowPos: { type: "string", enum: ["center", "bottom"], default: "center" }, hoverPause: { type: "boolean", default: true } },
      layouts: carouselLayouts(m), contextToolbar: CarouselTools,
      // Slider ảnh bìa (hero): mờ dần, tự chạy, nút + chấm trắng; mỗi slide là Nhóm có nền màu thương hiệu — đổi sang ảnh ở Kiểu dáng › Nền
      variations: [{ name: "hero", title: "Hero Slider", standalone: true, icon: Columns3, keywords: "slider hero banner anh bia trinh chieu mo dan",
        create: () => makeBlock("carousel", { slidesPerView: 1, effect: "fade", heightMode: "min", minHeight: "26rem", autoplay: true, interval: 6, arrowStyle: "light", dotStyle: "light" },
          [m.sampleSlide1, m.sampleSlide2, m.sampleSlide3].map((title, i) => makeBlock("group", { background: ["primary", "#111827", "accent"][i], textColor: "#ffffff", padding: "large" }, [makeBlock("heading", { level: 2, textAlign: "center" }, title), makeBlock("paragraph", { textAlign: "center" }, m.sampleHeroText)]))) }], create: () => makeBlock("carousel", { slidesPerView: 1 }, [m.sampleSlide1, m.sampleSlide2, m.sampleSlide3].map((title) => makeBlock("group", {}, [makeBlock("heading", { level: 3 }, title), p(m.sampleSlideText)]))), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "shortcode", title: "Shortcode", icon: Square, category: "design", keywords: "shortcode ma nhung plugin", kind: "atom", edit: ShortcodeEdit,
      attributes: { name: { type: "string" }, args: { type: "json", default: {} } }, supports: { style: true, anchor: true, className: true },
    },
    {
      name: "countdown", title: "Đếm ngược", icon: Square, category: "design", inspector: CountdownInspector, keywords: "dem nguoc countdown khuyen mai sale", kind: "atom", edit: CountdownEdit, create: () => makeBlock("countdown", { target: soon(), label: m.sampleCountdownLabel, layout: "block", pad: true, showDays: true, showSeconds: true }),
      attributes: { target: { type: "string", control: "hidden" }, timezone: { type: "string", enum: [...COUNTDOWN_ZONES], control: "hidden" }, label: { type: "string" }, postText: { type: "string" }, expiredText: { type: "string" }, layout: { type: "string", enum: ["block", "inline"], default: "block" }, divider: { type: "boolean", default: false }, pad: { type: "boolean", default: true }, showDays: { type: "boolean", default: true }, showSeconds: { type: "boolean", default: true }, daysLabel: { type: "string" }, hoursLabel: { type: "string" }, minutesLabel: { type: "string" }, secondsLabel: { type: "string" },
        expireAction: { type: "string", enum: ["zero", "message", "hide", "redirect"] }, redirectUrl: { type: "url" }, repeat: { type: "string", enum: ["none", "daily", "weekly", "monthly", "yearly"], default: "none" },
        mode: { type: "string", enum: ["date", "evergreen"], default: "date", control: "hidden" }, evergreenHours: { type: "integer", min: 0, max: 2160, control: "hidden" }, evergreenMinutes: { type: "integer", min: 0, max: 59, control: "hidden" },
        evergreenReset: { type: "integer", min: 0, max: 365, default: 30 }, pauseButton: { type: "boolean", default: false } }, supports: { style: true, anchor: true, className: true },
    },
    {
      name: "rating", title: "Đánh giá sao", icon: Square, category: "design", keywords: "danh gia sao rating review", kind: "atom", edit: RatingEdit,
      attributes: { value: { type: "number", default: 5, min: 0, max: 10 }, max: { type: "integer", default: 5, min: 1, max: 10 }, label: { type: "string" } }, supports: { style: true, anchor: true, className: true },
    },
    {
      name: "cover", title: "Ảnh bìa", icon: ImageIcon, category: "media", keywords: "anh bia cover banner hero", kind: "container", edit: CoverEdit,
      attributes: { src: { type: "url", control: "media" }, alt: { type: "string" }, overlay: { type: "string", control: "color" }, opacity: { type: "integer", default: 50, min: 0, max: 100 }, minHeight: { type: "string", default: "400px" }, contentAlign: { type: "string", enum: ["top", "center", "bottom"], default: "center" }, fixed: { type: "boolean", default: false }, constrained: { type: "boolean", default: false }, videoSrc: { type: "url" } },
      create: () => makeBlock("cover", { opacity: 50, minHeight: "400px" }, [makeBlock("heading", { level: 2, textAlign: "center" })]),
      supports: { style: true, anchor: true, className: true },
    },
    {
      name: "mediaText", layouts: mediaTextLayouts(m), layoutsOnInsert: false, layoutOwns: ["position"], title: "Ảnh + chữ", icon: LayoutPanelLeft, category: "media", keywords: "anh chu media text", kind: "container", edit: MediaTextEdit,
      attributes: { src: { type: "url", control: "media" }, alt: { type: "string" }, position: { type: "string", enum: ["left", "right"], default: "left" }, width: { type: "integer", default: 50, min: 20, max: 80 }, verticalAlign: { type: "string", enum: ["top", "center", "bottom"], default: "center" }, stack: { type: "boolean", default: true } },
      create: () => makeBlock("mediaText", {}, [makeBlock("heading", { level: 3 }), makeBlock("paragraph")]), supports: { style: true, anchor: true, className: true },
    },
    {
      name: "table", title: "Bảng", icon: Table2, category: "text", keywords: "bang table", kind: "container", edit: TableEdit,
      attributes: {
        footer: { type: "boolean", default: false }, fixed: { type: "boolean", default: false },
        striped: { type: "boolean", default: false }, hoverRows: { type: "boolean", default: false },
        lines: { type: "string", enum: ["all", "rows", "columns", "none"], default: "all" },
        density: { type: "string", enum: ["compact", "normal", "roomy"], default: "normal" },
        stickyHead: { type: "boolean", default: false }, caption: { type: "string" },
      },
      create: () => makeBlock("table", {}, [[m.sampleTh1, m.sampleTh2, m.sampleTh3], [m.sampleTd1, m.sampleTd2, m.sampleTd3], [m.sampleTd4, m.sampleTd5, m.sampleTd6]].map((row, r) => makeBlock("tableRow", {}, row.map((t) => makeBlock(r === 0 ? "tableHeader" : "tableCell", {}, [p(t)]))))), contextToolbar: TableTools,
      supports: { style: true, anchor: true, className: true, blockStyle: true },
    },
    { name: "tableRow", title: "Hàng", icon: Table2, kind: "container", edit: RowEdit, hidden: true },
    { name: "tableCell", title: "Ô", icon: Table2, kind: "container", edit: CellEdit, hidden: true, attributes: { colspan: { type: "integer", default: 1 }, rowspan: { type: "integer", default: 1 } } },
    { name: "tableHeader", title: "Ô tiêu đề", icon: Table2, kind: "container", edit: CellEdit, hidden: true, attributes: { colspan: { type: "integer", default: 1 }, rowspan: { type: "integer", default: 1 } } },
  ];
}
