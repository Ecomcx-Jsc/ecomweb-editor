import { CORE_NODES, ICON_NAMES, widgetMarkup, type WidgetEl } from "@ecomcx/ecomweb-content";
import { BarChart3, Hash, Image as ImageIcon, ListChecks, Quote, Star } from "lucide-react";
import { createElement, type CSSProperties, type ReactNode } from "react";
import { makeBlock } from "../core/model";
import type { BlockEditProps, BlockType } from "../core/registry";
import { useMsgs } from "../i18n";
import { messages } from "../../i18n";
import { RichText } from "../text/rich-text";
import { Field } from "../ui/attr-form";
import { MediaPick } from "./layout";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

/**
 * Widget lõi trên khung soạn: cùng cây markup với website (@ecomcx/ecomweb-content widgetMarkup) → vẽ y hệt.
 * Ô chữ (`field`) gõ trực tiếp trên khối, chỗ ảnh trống (`slot`) là ô chọn ảnh; số / thanh tiến độ hiện giá trị cuối (không chạy hiệu ứng).
 */
function WidgetEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const t = useMsgs("blocks") as Record<string, string>;
  const tree = widgetMarkup(block.type, block.attrs, true);
  if (!tree || (block.type === "iconList" && !tree.children?.length)) return <div {...blockProps} className={cx(blockProps.className, "ecx-placeholder-block")}>{t.widgetEmpty}</div>;
  const draw = (el: WidgetEl | string, key: number, root?: boolean): ReactNode => {
    if (typeof el === "string") return el;
    if (el.field) {
      const f = el.field;
      return <RichText key={key} blockId={block.id} field={f} tagName="span" value={String(block.attrs[f] ?? "")} onChange={(v) => setAttrs({ [f]: v })} placeholder={t[`widget_${f}`]} placeholderAlways editable={editable} />;
    }
    const kids = el.slot === "media" ? [<MediaPick key="pick" blockId={block.id} />] : (el.children ?? []).map((c, i) => draw(c, i));
    const props: Record<string, unknown> = { key, ...el.props, className: el.className, style: el.style as CSSProperties };
    if (el.tag === "a") props.onClick = (e: Event) => e.preventDefault();
    if (el.tag === "img") props.draggable = false;
    if (root) Object.assign(props, blockProps, { className: cx(blockProps.className, el.className), style: { ...(blockProps.style ?? {}), ...el.style } });
    return createElement(el.tag, props, ...kids);
  };
  return <>{draw(tree, 0, true)}</>;
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
    { ...base, name: "iconBox", title: "Icon Box", icon: Star, keywords: "icon box hop bieu tuong tinh nang dich vu feature", attributes: { ...spec("iconBox"), icon: { ...ICON_SELECT, default: "star" } }, create: () => makeBlock("iconBox", { icon: "star", title: m.sampleTitle, text: m.sampleText }), summary: (a) => a.title },
    { ...base, name: "imageBox", title: "Image Box", icon: ImageIcon, keywords: "image box hop anh the card dich vu", attributes: { ...spec("imageBox"), src: { type: "url", control: "media" } }, create: () => makeBlock("imageBox", { title: m.sampleTitle, text: m.sampleText }), summary: (a) => a.title },
    { ...base, name: "iconList", title: "Icon List", icon: ListChecks, keywords: "icon list danh sach bieu tuong loi ich checklist", inspector: IconListInspector, attributes: { ...spec("iconList"), icon: { ...ICON_SELECT, default: "check" } }, create: () => makeBlock("iconList", { items: [m.sampleItem1, m.sampleItem2, m.sampleItem3].map((text) => ({ text })) }) },
    { ...base, name: "counter", title: "Counter", icon: Hash, keywords: "counter dem so con so thong ke number", attributes: spec("counter"), create: () => makeBlock("counter", { end: 100, suffix: "+", title: m.sampleCounter, textAlign: "center" }), summary: (a) => a.title },
    { ...base, name: "testimonial", title: "Testimonial", icon: Quote, keywords: "testimonial loi chung thuc danh gia khach hang review", attributes: { ...spec("testimonial"), src: { type: "url", control: "media" } }, create: () => makeBlock("testimonial", { quote: m.sampleQuote, name: m.sampleName, role: m.sampleRole }), summary: (a) => a.name },
    { ...base, name: "progressBar", title: "Progress Bar", icon: BarChart3, keywords: "progress bar thanh tien do ky nang phan tram", attributes: spec("progressBar"), create: () => makeBlock("progressBar", { label: m.sampleSkill, value: 80 }), summary: (a) => a.label },
  ];
}
