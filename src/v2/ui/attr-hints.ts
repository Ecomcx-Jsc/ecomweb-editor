import { format, messages } from "../../i18n";
import type { ChoiceKind } from "../core/host";

/**
 * Cách hiện từng thuộc tính của khối lõi trong bảng cài đặt: nhãn của giá trị chọn (không hiện giá trị thô như
 * "horizontal"), ô chọn lấy dữ liệu thật từ ứng dụng (vị trí menu, loại bài, chuyên mục…), thanh kéo, gợi ý,
 * và điều kiện hiện. Khoá: "khối.thuộc_tính" hoặc "*.thuộc_tính" (mọi khối).
 */
/** Giá trị của một lựa chọn; nhãn lấy từ src/locales/<ngôn ngữ>/hints.ts (khoá "khối.thuộc_tính.opt.<giá trị>"). */
export type Opt = string | number;
export interface AttrHint {
  /** Thuộc tính có nhãn riêng ở khối này (chữ: hints "<khoá>.label"). */
  label?: true;
  /** Khoá của hint (do hintOf điền) — dùng tra chữ. */
  key?: string;
  control?: "select" | "segmented" | "range" | "choice" | "newTab" | "suggest" | "code" | "hidden";
  options?: Opt[];
  /** Ô chọn lấy dữ liệu từ ứng dụng (host.choices); tham số tính từ thuộc tính hiện tại. */
  choice?: { kind: ChoiceKind; args?: (attrs: Record<string, unknown>) => Record<string, string> };
  suggestions?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Chỉ hiện khi điều kiện đúng (vd chuyên mục chỉ khi không "theo trang đang xem"). */
  when?: (attrs: Record<string, unknown>) => boolean;
  /** Có ghi chú dưới ô (chữ: hints "<khoá>.help"). */
  help?: true;
}

const ALIGN: Opt[] = ["left", "center", "right"];
const V_ALIGN: Opt[] = ["top", "center", "bottom"];
const SIZES: Opt[] = ["small", "medium", "large"];
const levels = (from: number, to: number, zero?: boolean): Opt[] => [
  ...(zero ? [0] : []),
  ...Array.from({ length: to - from + 1 }, (_, i) => from + i),
];
const notInherit = (a: Record<string, unknown>) => a.inherit === false;

export const ATTR_HINTS: Record<string, AttrHint> = {
  "*.textAlign": { control: "segmented", options: [...ALIGN, "justify"] },
  "*.mime": { control: "hidden" },
  "video.name": { control: "hidden" },
  "video.autoplay": { label: true },
  "video.loop": { label: true },
  "video.muted": { label: true },
  "video.controls": { label: true },
  "video.playsInline": { label: true },
  "video.preload": { control: "select", label: true, options: ["none", "metadata", "auto"] },
  "audio.autoplay": { label: true },
  "audio.loop": { label: true },
  "audio.preload": { control: "select", label: true, options: ["none", "metadata", "auto"] },
  "file.size": { control: "hidden" },
  "file.name": { label: true },
  "file.src": { label: true },
  "video.src": { label: true },
  "audio.src": { label: true },
  "youtube.src": { label: true },
  "youtube.start": { label: true },
  "image.src": { label: true },
  "cover.src": { label: true },
  "pullquote.citation": { label: true },
  "audio.name": { control: "hidden" },
  "heading.level": { control: "select", options: levels(1, 6), help: true },
  "postTitle.level": { control: "select", options: levels(1, 6) },
  "queryTitle.level": { control: "select", options: levels(1, 6), help: true },
  "breadcrumbs.separator": { control: "segmented", options: ["›", "/", "»", "→"] },
  "siteTitle.level": { control: "select", options: levels(1, 6, true) },
  "tableOfContents.maxLevel": { control: "select", options: levels(2, 6) },
  "codeBlock.language": { control: "suggest", suggestions: ["plaintext", "html", "css", "javascript", "typescript", "jsx", "tsx", "json", "php", "python", "bash", "sql", "csharp", "java", "go", "rust", "yaml", "markdown", "xml"] },
  "customHtml.html": { control: "code" },
  "group.padding": { control: "segmented", options: ["none", "small", "medium", "large"] },
  "columns.verticalAlign": { control: "segmented", options: V_ALIGN },
  "mediaText.verticalAlign": { control: "segmented", options: V_ALIGN },
  "cover.contentAlign": { control: "segmented", options: V_ALIGN },
  "cover.opacity": { control: "range", min: 0, max: 100, step: 5, unit: "%" },
  "mediaText.position": { control: "segmented", options: ["left", "right"] },
  "mediaText.width": { control: "range", min: 15, max: 85, step: 5, unit: "%" },
  "buttons.align": { control: "segmented", options: [...ALIGN, "space-between"] },
  "button.variant": { control: "segmented", options: ["primary", "secondary", "outline"] },
  "button.target": { control: "newTab" },
  "button.rel": { when: (a) => !!a.href, help: true },
  "spacer.height": { control: "suggest", suggestions: ["xs", "sm", "md", "lg", "xl", "2xl", "2rem", "4rem", "80px"], help: true },
  "callout.tone": { control: "segmented", options: ["info", "success", "warning", "danger"] },
  "image.align": { control: "select", options: [...ALIGN, "wide", "full"] },
  "image.size": { control: "choice", choice: { kind: "imageSize" } },
  "featuredImage.size": { control: "choice", choice: { kind: "imageSize" } },
  "featuredImage.aspect": { control: "select", options: ["auto", "16/9", "4/3", "1/1", "3/4"] },
  "socialLinks.size": { control: "segmented", options: SIZES },
  "socialLinks.align": { control: "segmented", options: ALIGN },
  "navigation.location": { control: "choice", choice: { kind: "menuLocation" }, help: true },
  "navigation.orientation": { control: "segmented", options: ["horizontal", "vertical"] },
  "navigation.overlayMenu": { control: "segmented", label: true, options: ["never", "mobile", "always"] },
  "gallery.linkTo": { control: "segmented", label: true, options: ["none", "media"] },
  "gallery.imageCrop": { label: true },
  "gallery.lightbox": { label: true },
  "countdown.expiredText": { label: true },
  "search.showLabel": { label: true },
  "search.buttonPosition": { control: "segmented", label: true, options: ["right", "left", "below"] },
  "postAuthor.showName": { label: true },
  "postAuthor.showBio": { label: true },
  "postAuthor.avatarSize": { label: true },
  "comments.avatarSize": { label: true },
  "comments.showDate": { label: true },
  "comments.order": { control: "segmented", options: ["asc", "desc"] },
  "termList.display": { control: "segmented", options: ["list", "cloud"] },
  "termList.showCount": { label: true },
  "termList.hideEmpty": { label: true },
  "termList.hierarchical": { label: true },
  "loginout.loginText": { label: true },
  "loginout.logoutText": { label: true },
  "pageList.parentId": { label: true },
  "archives.showCount": { label: true },
  "icon.name": { control: "select", options: ["check", "x", "star", "heart", "arrowRight", "phone", "mail", "mapPin", "clock", "info", "alert", "externalLink"] },
  "languageSwitcher.display": { control: "segmented", options: ["inline", "dropdown"] },
  "postTerms.taxonomy": { control: "choice", choice: { kind: "taxonomy" } },
  "query.postType": { control: "choice", choice: { kind: "postType" }, when: notInherit },
  "query.category": { control: "choice", choice: { kind: "term", args: () => ({ taxonomy: "category" }) }, when: notInherit },
  "query.tag": { control: "choice", choice: { kind: "term", args: () => ({ taxonomy: "post_tag" }) }, when: notInherit },
  "query.perPage": { when: notInherit },
  "query.orderBy": { control: "select", options: ["date", "modified", "title", "comment_count", "menu_order", "rand"], when: notInherit },
  "query.authorId": { label: true, when: notInherit },
  "query.search": { label: true, when: notInherit },
  "query.exclude": { label: true, when: notInherit },
  "query.sticky": { control: "select", options: ["any", "only", "exclude"], when: notInherit },
  "image.href": { label: true },
  "image.linkTarget": { control: "segmented", label: true, options: ["_self", "_blank"] },
  "orderedList.reversed": { label: true },
  "blockquote.citation": { label: true },
  "postDate.displayType": { control: "segmented", label: true, options: ["published", "modified"] },
  "query.paginate": { label: true, help: true, when: notInherit },
  "query.orderByMeta": { label: true, help: true, when: notInherit },
  "query.order": { control: "segmented", options: ["desc", "asc"], when: notInherit },
  "query.inherit": { help: true },
  "postTemplate.layout": { control: "segmented", options: ["list", "grid"] },
  "postTemplate.columns": { control: "range", min: 1, max: 6, step: 1, when: (a) => a.layout === "grid" },
  "templatePart.slug": { control: "choice", choice: { kind: "templatePart" } },
  "templatePart.tagName": { control: "select", options: ["div", "header", "footer", "aside", "section"] },
};

export function hintOf(block: string, attr: string): AttrHint {
  const key = ATTR_HINTS[`${block}.${attr}`] ? `${block}.${attr}` : ATTR_HINTS[`*.${attr}`] ? `*.${attr}` : "";
  return { ...(key ? ATTR_HINTS[key] : {}), key };
}

const text = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** Chữ nhãn / ghi chú của hint theo ngôn ngữ (undefined nếu hint không khai báo). */
export const hintText = (hint: AttrHint, part: "label" | "help", lang: string): string | undefined =>
  hint[part] && hint.key ? text(messages("hints", lang)[`${hint.key}.${part}`]) : undefined;

/** Nhãn của giá trị chọn: riêng của hint, rồi mẫu "Tiêu đề N", rồi nhãn chung của giá trị, cuối cùng là giá trị thô. */
export function optionLabel(hint: AttrHint, value: unknown, lang: string, fallback?: string): string {
  const t = messages("hints", lang);
  const v = String(value);
  if (hint.options?.some((x) => String(x) === v)) return text(t[`${hint.key}.opt.${v}`]) ?? (typeof value === "number" && value > 0 ? format(text(t.levelOption) ?? v, { n: value }) : undefined) ?? text(t[`value.${v}`]) ?? v;
  return fallback ?? text(t[`value.${v}`]) ?? v;
}

/** Cỡ ảnh mặc định khi ứng dụng không khai báo (nhãn: hints "imageSize.<cỡ>"). */
export const DEFAULT_IMAGE_SIZES: Opt[] = ["thumbnail", "medium", "large", "full"];
export const imageSizeLabel = (size: string, lang: string): string => text(messages("hints", lang)[`imageSize.${size}`]) ?? size;
