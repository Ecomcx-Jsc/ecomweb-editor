import { CORE_NODES, lottieConfig, colorCss, iconListClass, resolveIcon, widgetMarkup, type WidgetEl } from "@ecomcx/ecomweb-content";
import { IconPicker } from "../ui/icon-picker";
import { ColorInput } from "../ui/color-field";
import { IconSvg } from "../ui/icon-svg";
import { BarChart3, Film, Hash, Image as ImageIcon, ListChecks, MapPin, Quote, Star } from "lucide-react";
import { createElement, useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useEditor } from "../context";
import { makeBlock } from "../core/model";
import type { BlockEditProps, BlockType } from "../core/registry";
import { useMsgs } from "../i18n";
import { messages } from "../../i18n";
import { RichText } from "../text/rich-text";
import { Section } from "../ui/style-controls";
import { IconTool } from "./tools";
import { MediaPick } from "./layout";
import { useActiveWithin } from "./resize";
import { AddItemButton, TextPlaceholder } from "../ui/placeholders";
import { iconBoxLayouts, iconListLayouts, progressLayouts, testimonialLayouts } from "./layout-options";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

/**
 * Widget lõi trên khung soạn: cùng cây markup với website (@ecomcx/ecomweb-content widgetMarkup) → vẽ y hệt.
 * Ô chữ (`field`) gõ trực tiếp trên khối, chỗ ảnh trống (`slot`) là ô chọn ảnh; số / thanh tiến độ hiện giá trị cuối (không chạy hiệu ứng).
 */
/** Gợi ý của từng ô chữ theo khối (không còn chữ mẫu thật dễ quên sửa). */
const FIELD_PH: Record<string, string> = { title: "boxTitle", text: "boxText", quote: "testimonialQuote", name: "testimonialName", role: "testimonialRole", label: "skill", address: "mapAddress" };

function WidgetEdit(props: BlockEditProps) {
  const { block, blockProps, setAttrs, editable } = props;
  const t = useMsgs("blocks") as Record<string, string>;
  const tp = useMsgs("placeholders") as unknown as Record<string, string>;
  const active = useActiveWithin(block.id);
  if (block.type === "iconList") return <IconListEdit {...props} />;
  const tree = widgetMarkup(block.type, block.attrs, true);
  if (!tree) return <div {...blockProps} className={cx(blockProps.className, "ecx-placeholder-block")}>{t.widgetEmpty}</div>;
  const ph = (f: string) => (block.type === "counter" && f === "title" ? tp.counterTitle : tp[FIELD_PH[f] ?? ""] ?? t[`widget_${f}`]);
  const draw = (el: WidgetEl | string, key: number, root?: boolean): ReactNode => {
    if (typeof el === "string") return el;
    if (el.field) {
      const f = el.field;
      return <RichText key={key} blockId={block.id} field={f} tagName="span" value={String(block.attrs[f] ?? "")} onChange={(v) => setAttrs({ [f]: v })} placeholder={ph(f)} placeholderAlways editable={editable} />;
    }
    const kids = el.slot === "media" ? [<MediaPick key="pick" blockId={block.id} compact />] : (el.children ?? []).map((c, i) => draw(c, i));
    // Bộ đếm: ô nhập số ngay trong khối khi đang chọn (nhắc chỉ dùng số thật)
    if (root && block.type === "counter" && editable && active) kids.push(
      <label key="end" className="ecx-ph-row ecx-ph-inline-field" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
        <span className="ecx-ph-label">{tp.counterEnd}</span>
        <input className="ecx-input" type="number" value={Number(block.attrs.end ?? 0)} onChange={(e) => setAttrs({ end: Number(e.target.value) || 0 })} />
        <span className="ecx-placeholder-hint">{tp.counterHint}</span>
      </label>,
    );
    const props: Record<string, unknown> = { key, ...el.props, className: el.className, style: el.style as CSSProperties };
    if (el.tag === "a") props.onClick = (e: Event) => e.preventDefault();
    if (el.tag === "img") props.draggable = false;
    if (root) Object.assign(props, blockProps, { className: cx(blockProps.className, el.className), style: { ...(blockProps.style ?? {}), ...el.style } });
    return createElement(el.tag, props, ...kids);
  };
  return <>{draw(tree, 0, true)}</>;
}

/** Icon List trên khung soạn: mỗi dòng gõ ngay trên khối (dòng trống website bỏ qua) + "+ Thêm dòng". */
function IconListEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const { ui } = useEditor();
  const active = useActiveWithin(block.id); // nút "Thêm dòng" chỉ hiện khi đang chọn / gõ trong khối (chiều cao khung soạn khớp website)
  const activeIdx = useSyncExternalStore(ui.subscribe, () => ui.activeItem.get(block.id) ?? 0);
  const items: Array<{ text: string; href?: string; icon?: string; tip?: string; color?: string; iconBg?: string; textColor?: string }> = Array.isArray(block.attrs.items) ? block.attrs.items : [];
  const list = items.length || !editable ? items : [{ text: "" }];
  const save = (next: typeof items) => setAttrs({ items: next });
  const stroke = Math.min(4, Math.max(0.5, Number(block.attrs.stroke) || 2));
  const icon = (name?: string, it?: { color?: string; iconBg?: string }) => name === "none" ? null : <IconSvg className="ecx-widget-icon" style={{ ...(colorCss(it?.color) ? { color: colorCss(it?.color) } : {}), ...(colorCss(it?.iconBg) ? { background: colorCss(it?.iconBg) } : {}) }} name={resolveIcon(name) ? name : resolveIcon(block.attrs.icon) ? block.attrs.icon : "check"} stroke={stroke} />;
  const ul = useRef<HTMLUListElement | null>(null);
  const focusAt = useRef<number | null>(null);
  // Sau khi thêm / xoá mục, đưa con trỏ vào đúng mục (Enter → mục mới, Backspace → mục trước)
  useEffect(() => { if (focusAt.current != null) { ul.current?.querySelectorAll<HTMLInputElement>("li input")[focusAt.current]?.focus(); focusAt.current = null; } });
  /** Enter: thêm mục ngay dưới; Backspace ở mục trống: xoá mục, về mục trước. */
  const key = (i: number) => (e: { key: string; shiftKey: boolean; preventDefault(): void; currentTarget: HTMLInputElement | HTMLTextAreaElement }) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); focusAt.current = i + 1; save([...list.slice(0, i + 1), { text: "" }, ...list.slice(i + 1)]); }
    else if (e.key === "Backspace" && e.currentTarget.value === "" && list.length > 1) { e.preventDefault(); focusAt.current = Math.max(0, i - 1); save(list.filter((_, k) => k !== i)); }
  };
  return (
    <ul {...blockProps} ref={(el) => { ul.current = el; const r = (blockProps as { ref?: unknown }).ref; if (typeof r === "function") (r as (n: HTMLUListElement | null) => void)(el); else if (r && typeof r === "object") (r as { current: unknown }).current = el; }} className={cx(blockProps.className, iconListClass(block.attrs))}>
      {list.map((it, i) => (
        <li key={i} className={editable && i === activeIdx ? "is-item-active" : undefined} data-ecx-tip={it.tip?.trim() ? it.tip.trim().slice(0, 120) : undefined} onFocusCapture={() => ui.setActiveItem(block.id, i)}>{icon(it.icon, it)}{editable
          ? <span style={colorCss(it.textColor) ? { color: colorCss(it.textColor) } : undefined}><TextPlaceholder value={it.text} placeholder={i === 0 ? tp.iconListItem : `${tp.addRow}…`} label={`${tp.addRow} ${i + 1}`} onKeyDown={key(i)} onChange={(v) => save(list.map((x, k) => (k === i ? { ...x, text: v } : x)))} /></span>
          : <span style={colorCss(it.textColor) ? { color: colorCss(it.textColor) } : undefined}>{it.text}</span>}</li>
      ))}
      {editable && active && <li className="ecx-ph-list-add"><AddItemButton label={tp.addRow} onClick={() => { focusAt.current = list.length; save([...list, { text: "" }]); }} /></li>}
    </ul>
  );
}

/** Các mục của Icon List: mỗi mục một hàng — chữ, icon riêng (theo danh sách / tên icon / không icon), liên kết; thêm / xoá mục. Dòng trống website bỏ qua. */
/** Icon ngay trên thanh: Icon Box (khi đầu hộp là icon) — chọn một lần, thấy ngay trên khối. */
function IconBoxTool({ block, setAttrs }: BlockEditProps) {
  const media = block.attrs.media;
  if (media && media !== "icon") return null;
  return <IconTool value={block.attrs.icon as string | undefined} onChange={(v) => setAttrs({ icon: v ?? "star" })} />;
}

/** Icon List: có mục đang chọn thì đổi icon của mục đó; chưa chọn mục nào thì đổi icon chung của danh sách. */
function IconListTool({ block, attrs, setAttrs }: BlockEditProps) {
  const { ui } = useEditor();
  useSyncExternalStore(ui.subscribe, ui.getTick);
  const items: Array<{ text: string; href?: string; icon?: string; tip?: string; color?: string; iconBg?: string; textColor?: string }> = Array.isArray(attrs.items) ? attrs.items : [];
  const sel = ui.activeItem.get(block.id);
  const item = sel != null ? items[sel] : undefined;
  if (!item) return <IconTool value={attrs.icon as string | undefined} onChange={(v) => setAttrs({ icon: v ?? "check" })} />;
  return <IconTool value={item.icon && item.icon !== "none" ? item.icon : (attrs.icon as string | undefined)} allowNone
    onChange={(v) => setAttrs({ items: items.map((x, k) => { if (k !== sel) return x; const n = { ...x }; if (v) n.icon = v; else n.icon = "none"; return n; }) })} />;
}

function IconListInspector({ block, attrs, setAttrs }: BlockEditProps) {
  const t = useMsgs("blocks") as Record<string, string>;
  const h = useMsgs("hints") as Record<string, string>;
  const { ui } = useEditor();
  useSyncExternalStore(ui.subscribe, ui.getTick);
  const items: Array<{ text: string; href?: string; icon?: string; tip?: string; color?: string; iconBg?: string; textColor?: string }> = Array.isArray(attrs.items) ? attrs.items : [];
  const sel = Math.min(Math.max(ui.activeItem.get(block.id) ?? 0, 0), Math.max(0, items.length - 1));
  const patch = (i: number, p: Record<string, string | undefined>) => setAttrs({ items: items.map((x, k) => {
    if (k !== i) return x;
    const next: Record<string, unknown> = { ...x, ...p };
    for (const key of Object.keys(next)) if (next[key] === undefined || (key !== "text" && next[key] === "")) delete next[key];
    return next;
  }) });
  const pick = (i: number) => ui.setActiveItem(block.id, i);
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= items.length) return; const next = items.slice(); [next[i], next[j]] = [next[j], next[i]]; setAttrs({ items: next }); pick(j); };
  return (
    <Section title={t.iconListItems} defaultOpen>
      {items.map((it, i) => (
        <div key={i} className={cx("ecx-item-row", i === sel && "is-active")} data-icon-list-item data-active={i === sel ? "" : undefined} onFocusCapture={() => pick(i)} onMouseDown={() => pick(i)}>
          <div className="ecx-item-row-head">
            <span className="ecx-item-n" aria-hidden="true">{i + 1}</span>
            <input className="ecx-input" aria-label={`${t.iconListText} ${i + 1}`} placeholder={t.iconListText} value={it.text ?? ""} onChange={(e) => patch(i, { text: e.target.value })} />
            {i === sel && <>
              <button type="button" className="ecx-tool" aria-label={`${t.iconListUp} ${i + 1}`} title={t.iconListUp} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="ecx-tool" aria-label={`${t.iconListDown} ${i + 1}`} title={t.iconListDown} disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
            </>}
            <button type="button" className="ecx-tool" aria-label={`${t.iconListRemove} ${i + 1}`} title={t.iconListRemove} onClick={() => setAttrs({ items: items.filter((_, k) => k !== i) })}>×</button>
          </div>
          {i === sel && (
            <div className="ecx-item-row-sub">
              <IconPicker label={`${t.iconListIcon} ${i + 1}`} value={it.icon} defaultLabel={t.iconListIconDefault} noneValue="none" onChange={(v) => patch(i, { icon: v })} />
              <input className="ecx-input" type="url" inputMode="url" aria-label={`${t.iconListLink} ${i + 1}`} placeholder={t.iconListLink} value={it.href ?? ""} onChange={(e) => patch(i, { href: e.target.value || undefined })} />
              <input className="ecx-input" aria-label={`${t.iconListTip} ${i + 1}`} placeholder={t.iconListTip} maxLength={120} value={it.tip ?? ""} onChange={(e) => patch(i, { tip: e.target.value || undefined })} />
              <div className="ecx-item-colors">
                <ColorInput label={`${t.iconListColor} ${i + 1}`} value={it.color} onChange={(v) => patch(i, { color: v })} />
                <ColorInput label={`${t.iconListBg} ${i + 1}`} value={it.iconBg} onChange={(v) => patch(i, { iconBg: v })} />
                <ColorInput label={`${t.iconListTextColor} ${i + 1}`} value={it.textColor} onChange={(v) => patch(i, { textColor: v })} />
              </div>
            </div>
          )}
        </div>
      ))}
      {items.length < 50 && <button type="button" className="ecx-btn" onClick={() => { setAttrs({ items: [...items, { text: "" }] }); pick(items.length); }}>+ {t.iconListAdd}</button>}
    </Section>
  );
}

/** Lottie trong trình soạn: không chạy thư viện (nhẹ, an toàn) — hiện poster hoặc ô giữ chỗ có tên tệp; chạy thật xem ở website / xem trước. */
function LottieEdit({ block, blockProps }: BlockEditProps) {
  const t = useMsgs("blocks") as Record<string, string>;
  const c = lottieConfig(block.attrs);
  const file = c.src.split(/[?#]/)[0].split("/").pop() ?? "";
  const style: CSSProperties = { ...(c.height ? { height: c.height } : {}), ...(c.maxWidth ? { maxWidth: c.maxWidth } : {}), ...(c.align === "left" ? { marginRight: "auto" } : c.align === "right" ? { marginLeft: "auto" } : { margin: "0 auto" }) };
  return (
    <div {...blockProps} className={cx(blockProps.className, "ecx-lottie", "ecx-lottie-edit")} style={{ ...blockProps.style, ...style }} role="img" aria-label={c.label || undefined}>
      {c.poster ? <img className="ecx-lottie-poster" src={c.poster} alt="" /> : (
        <div className="ecx-placeholder-block" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: c.height ?? 160 }}>
          <Film className="ecx-icon" /> <span>{file || t.lottieEmpty}</span>{c.src && !c.kind && <span className="ecx-muted"> — .lottie / .json</span>}
        </div>
      )}
    </div>
  );
}

const spec = (name: string) => CORE_NODES[name]?.attrs;
/** Thứ tự ô ở bảng phải: phần đầu hộp (icon / ảnh / số) trước, rồi chữ, rồi liên kết. Ô không kể tên giữ thứ tự cũ ở cuối. */
const ICON_BOX_ORDER = ["media", "icon", "number", "src", "alt", "width", "height", "iconStyle", "position", "verticalAlign", "hover", "title", "text", "level", "textAlign", "href", "linkMode", "buttonText", "fullHeight"];
function ordered<T>(attrs: Record<string, T>, order: string[]): Record<string, T> {
  return Object.fromEntries([...order.filter((k) => k in attrs), ...Object.keys(attrs).filter((k) => !order.includes(k))].map((k) => [k, attrs[k]]));
}
const OVERLAY_ORDER = ["media", "src", "alt", "title", "subtitle", "level", "href", "linkTarget", "ratio", "hAlign", "vAlign", "subtitleMode", "imageEffect", "overlayColor", "overlayOpacity", "restOpacity", "frame", "frameInset", "divider"];
const ICON_SELECT = { type: "string" as const };

/** Khối widget của lõi; `lang` = ngôn ngữ của trình soạn (chữ mẫu khi chèn). */
export function widgetBlocks(lang?: string): BlockType[] {
  const m = messages("blocks", lang) as Record<string, string>;
  const base = { kind: "atom" as const, category: "widgets", edit: WidgetEdit, supports: { style: true, anchor: true, className: true } };
  return [
    { ...base, name: "iconBox", toolbar: IconBoxTool, layouts: iconBoxLayouts(m), layoutsOnInsert: false, layoutOwns: ["position"], title: "Icon Box", icon: Star, keywords: "icon box hop bieu tuong tinh nang dich vu feature", attributes: ordered({ ...spec("iconBox"), icon: { ...ICON_SELECT, default: "star" }, src: { type: "url", control: "media" } }, ICON_BOX_ORDER), create: () => makeBlock("iconBox", { icon: "star", title: m.sampleBoxTitle, text: m.sampleBoxText }), summary: (a) => a.title },
    // Hộp ảnh đã gộp vào Hộp icon (media = ảnh): ẩn khỏi trình chèn, nội dung cũ vẫn sửa được
    { ...base, hidden: true, name: "imageBox", title: "Image Box", icon: ImageIcon, keywords: "image box hop anh the card dich vu", attributes: { ...spec("imageBox"), src: { type: "url", control: "media" } }, create: () => makeBlock("imageBox", { title: "", text: "" }), summary: (a) => a.title },
    // Ảnh phủ chữ: ảnh + lớp màu + khung viền + chữ hiện khi rê chuột (thẻ chuyên mục, bộ sưu tập, dự án)
    { ...base, name: "imageOverlay", title: "Image Overlay", icon: ImageIcon, keywords: "anh phu chu image overlay hover the chuyen muc bo suu tap du an banner", attributes: ordered({ ...spec("imageOverlay"), src: { type: "url", control: "media" }, overlayColor: { type: "string", control: "color" } }, OVERLAY_ORDER),
      create: () => makeBlock("imageOverlay", { title: m.sampleOverlayTitle, subtitle: m.sampleOverlaySubtitle, overlayColor: "primary", overlayOpacity: 65, imageEffect: "zoom", ratio: "4/3" }), summary: (a) => a.title },
    { ...base, name: "iconList", toolbar: IconListTool, layouts: iconListLayouts(m), layoutOwns: ["layout"], title: "Icon List", icon: ListChecks, keywords: "icon list danh sach bieu tuong loi ich checklist", inspector: IconListInspector, attributes: { ...spec("iconList"), icon: { ...ICON_SELECT, default: "check" } }, create: () => makeBlock("iconList", { items: [m.sampleList1, m.sampleList2, m.sampleList3, m.sampleList4].map((text) => ({ text })) }) },
    { ...base, name: "counter", title: "Counter", icon: Hash, keywords: "counter dem so con so thong ke number", attributes: spec("counter"), create: () => makeBlock("counter", { end: 1200, suffix: "+", title: m.sampleCounterTitle, textAlign: "center" }), summary: (a) => a.title },
    { ...base, name: "testimonial", layouts: testimonialLayouts(m), layoutOwns: ["variant"], title: "Testimonial", icon: Quote, keywords: "testimonial loi chung thuc danh gia khach hang review", attributes: ordered({ ...spec("testimonial"), src: { type: "url", control: "media" } }, ["variant", "quoteMark", "rating", "quote", "name", "role", "src", "alt", "textAlign"]), create: () => makeBlock("testimonial", { quote: m.sampleQuote, name: m.sampleName, role: m.sampleRole, rating: 5 }), summary: (a) => a.name },
    { ...base, name: "map", title: "Map", icon: MapPin, keywords: "map ban do dia chi google maps vi tri", attributes: ordered(spec("map") ?? {}, ["address", "title", "zoom", "height", "mapType"]), create: () => makeBlock("map", { address: m.sampleAddress }), summary: (a) => a.address },
    { ...base, name: "lottie", title: "Lottie", icon: Film, keywords: "lottie hoat anh animation json dotlottie chuyen dong", edit: LottieEdit,
      attributes: ordered({ ...spec("lottie"), poster: { type: "url", control: "media" } }, ["src", "poster", "trigger", "autoplay", "loop", "speed", "height", "maxWidth", "align", "label"]), create: () => makeBlock("lottie", {}), summary: (a) => String(a.src ?? "").split("/").pop() },
    { ...base, name: "progressBar", layouts: progressLayouts(m), layoutsOnInsert: false, layoutOwns: ["textPosition"], title: "Progress Bar", icon: BarChart3, keywords: "progress bar thanh tien do ky nang phan tram", attributes: spec("progressBar"), create: () => makeBlock("progressBar", { label: m.sampleSkill, value: 80 }), summary: (a) => a.label },
  ];
}
