import { CORE_NODES, ICON_NAMES, ICON_PATHS, widgetMarkup, type WidgetEl } from "@ecomcx/ecomweb-content";
import { BarChart3, Hash, Image as ImageIcon, ListChecks, Quote, Star } from "lucide-react";
import { createElement, type CSSProperties, type ReactNode } from "react";
import { makeBlock } from "../core/model";
import type { BlockEditProps, BlockType } from "../core/registry";
import { useMsgs } from "../i18n";
import { messages } from "../../i18n";
import { RichText } from "../text/rich-text";
import { Field } from "../ui/attr-form";
import { MediaPick } from "./layout";
import { useActiveWithin } from "./resize";
import { AddItemButton, TextPlaceholder } from "../ui/placeholders";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

/**
 * Widget lõi trên khung soạn: cùng cây markup với website (@ecomcx/ecomweb-content widgetMarkup) → vẽ y hệt.
 * Ô chữ (`field`) gõ trực tiếp trên khối, chỗ ảnh trống (`slot`) là ô chọn ảnh; số / thanh tiến độ hiện giá trị cuối (không chạy hiệu ứng).
 */
/** Gợi ý của từng ô chữ theo khối (không còn chữ mẫu thật dễ quên sửa). */
const FIELD_PH: Record<string, string> = { title: "boxTitle", text: "boxText", quote: "testimonialQuote", name: "testimonialName", role: "testimonialRole", label: "skill" };

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
  const items: Array<{ text: string; href?: string; icon?: string }> = Array.isArray(block.attrs.items) ? block.attrs.items : [];
  const list = items.length || !editable ? items : [{ text: "" }];
  const save = (next: typeof items) => setAttrs({ items: next });
  const icon = (name?: string) => <svg className="ecx-widget-icon" viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={ICON_PATHS[String(name ?? "")] ?? ICON_PATHS[String(block.attrs.icon ?? "check")] ?? ICON_PATHS.check} /></svg>;
  return (
    <ul {...blockProps} className={cx(blockProps.className, "ecx-icon-list", block.attrs.layout === "inline" && "is-inline")}>
      {list.map((it, i) => (
        <li key={i}>{icon(it.icon)}{editable
          ? <TextPlaceholder value={it.text} placeholder={i === 0 ? tp.iconListItem : `${tp.addRow}…`} label={`${tp.addRow} ${i + 1}`} onChange={(v) => save(list.map((x, k) => (k === i ? { ...x, text: v } : x)))} />
          : <span>{it.text}</span>}</li>
      ))}
      {editable && <li className="ecx-ph-list-add"><AddItemButton label={tp.addRow} onClick={() => save([...list, { text: "" }])} /></li>}
    </ul>
  );
}

/** Danh sách mục của Icon List: mỗi dòng một mục, "chữ | đường dẫn" (đường dẫn tuỳ chọn); dòng trống giữ khi đang gõ, website bỏ qua. Icon riêng từng mục: chỉ qua dữ liệu (AI / mẫu). */
function IconListInspector({ attrs, setAttrs }: BlockEditProps) {
  const t = useMsgs("blocks") as Record<string, string>;
  const items: Array<{ text: string; href?: string; icon?: string }> = Array.isArray(attrs.items) ? attrs.items : [];
  const value = items.map((it) => (it.href ? `${it.text} | ${it.href}` : it.text)).join("\n");
  const parse = (s: string) => s.split("\n").slice(0, 50).map((line, i) => {
    const [text, href] = line.split("|").map((x) => x.trim());
    return { ...(items[i]?.icon ? { icon: items[i].icon } : {}), text: text ?? "", ...(href ? { href } : {}) };
  });
  return <Field label={t.iconListItems}><textarea className="ecx-input" rows={6} value={value} data-icon-list-items onChange={(e) => setAttrs({ items: parse(e.target.value) })} /></Field>;
}

const spec = (name: string) => CORE_NODES[name]?.attrs;
const ICON_SELECT = { type: "string" as const, enum: ICON_NAMES };

/** Khối widget của lõi; `lang` = ngôn ngữ của trình soạn (chữ mẫu khi chèn). */
export function widgetBlocks(lang?: string): BlockType[] {
  const m = messages("blocks", lang) as Record<string, string>;
  const base = { kind: "atom" as const, category: "widgets", edit: WidgetEdit, supports: { style: true, anchor: true, className: true } };
  return [
    { ...base, name: "iconBox", title: "Icon Box", icon: Star, keywords: "icon box hop bieu tuong tinh nang dich vu feature", attributes: { ...spec("iconBox"), icon: { ...ICON_SELECT, default: "star" } }, create: () => makeBlock("iconBox", { icon: "star", title: "", text: "" }), summary: (a) => a.title },
    { ...base, name: "imageBox", title: "Image Box", icon: ImageIcon, keywords: "image box hop anh the card dich vu", attributes: { ...spec("imageBox"), src: { type: "url", control: "media" } }, create: () => makeBlock("imageBox", { title: "", text: "" }), summary: (a) => a.title },
    { ...base, name: "iconList", title: "Icon List", icon: ListChecks, keywords: "icon list danh sach bieu tuong loi ich checklist", inspector: IconListInspector, attributes: { ...spec("iconList"), icon: { ...ICON_SELECT, default: "check" } }, create: () => makeBlock("iconList", { items: [{ text: "" }, { text: "" }] }) },
    { ...base, name: "counter", title: "Counter", icon: Hash, keywords: "counter dem so con so thong ke number", attributes: spec("counter"), create: () => makeBlock("counter", { end: 0, suffix: "+", title: "", textAlign: "center" }), summary: (a) => a.title },
    { ...base, name: "testimonial", title: "Testimonial", icon: Quote, keywords: "testimonial loi chung thuc danh gia khach hang review", attributes: { ...spec("testimonial"), src: { type: "url", control: "media" } }, create: () => makeBlock("testimonial", { quote: "", name: "", role: "" }), summary: (a) => a.name },
    { ...base, name: "progressBar", title: "Progress Bar", icon: BarChart3, keywords: "progress bar thanh tien do ky nang phan tram", attributes: spec("progressBar"), create: () => makeBlock("progressBar", { label: "", value: 80 }), summary: (a) => a.label },
  ];
}
