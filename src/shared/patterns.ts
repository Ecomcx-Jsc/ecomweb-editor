import { normalizeContent } from "@ecomcx/ecomweb-content";
import { btn, buttons, h, p, text } from "./patterns-kit";
import { msgs } from "../i18n";
import { libraryPatterns } from "./patterns-library";

/**
 * Mẫu (pattern): đoạn nội dung dựng sẵn (giới thiệu, tính năng, bảng giá, kêu gọi hành động…) — chèn = chép khối vào bài,
 * sau đó sửa tự do (không liên kết với mẫu). Nguồn: lõi (registerCorePatterns), theme (patterns/*.json), plugin (registerPattern).
 */
export interface Pattern {
  /** Tên duy nhất: lõi "core/…", theme "theme/…", plugin "slug-plugin/…". */
  name: string;
  title: string;
  description?: string;
  /** Nhóm trong trình chèn: hero, features, cta, pricing, testimonials, faq, team, contact, text, gallery, footer, header… */
  category: string;
  keywords?: string;
  /** Nội dung: cây khối (`{ type: "doc", content }`), mảng khối, hoặc `{ version, blocks }` của @ecomcx/ecomweb-content. */
  content: unknown;
  /** Mẫu do người dùng tạo: id của mẫu. */
  ref?: number;
  /** Mẫu đồng bộ: chèn thành tham chiếu (`syncedPattern { ref }`) thay vì chép khối. */
  synced?: boolean;
}

const patterns = new Map<string, Pattern>();
const listeners = new Set<() => void>();
let snapshot: Pattern[] = [];
const changed = () => { snapshot = [...patterns.values()]; listeners.forEach((l) => l()); };

export function registerPattern(p: Pattern) { patterns.set(p.name, p); changed(); }
export function unregisterPattern(name: string) { if (patterns.delete(name)) changed(); }
export const registeredPatterns = (): Pattern[] => snapshot;
export function onPatternsChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** Khối của mẫu (đã chuẩn hoá theo @ecomcx/ecomweb-content). */
export function patternNodes(p: Pattern): Array<Record<string, unknown>> {
  const raw = Array.isArray(p.content) ? { type: "doc", content: p.content } : p.content;
  const { doc } = normalizeContent(raw);
  const main = doc.blocks.find((b) => b.type === "richtext");
  return ((main?.data as { content?: Array<Record<string, unknown>> } | undefined)?.content ?? []);
}

// ---------------------------------------------------------------------------
// Mẫu có sẵn của lõi (dựng bằng bộ khối cơ bản — mọi theme hiển thị được)
// ---------------------------------------------------------------------------
type L = Record<string, string>;
function corePatterns(t: L): Pattern[] {
  const plan = (name: string, price: string, variant: string) => ({ type: "group", attrs: { blockStyle: "card" }, content: [
    h(3, name), h(2, price, { style: { fontSize: { base: "2xl" } } }),
    { type: "bulletList", content: [1, 2, 3].map((n) => ({ type: "listItem", content: [p(`${t.item} ${n}`)] })) },
    buttons("left", btn(t.choose, variant)),
  ] });
  const col = (title: string) => ({ type: "column", content: [h(3, title), p(t.fText)] });
  return [
    { name: "core/hero", category: "hero", title: t.hero, description: t.heroD, keywords: "hero banner cover anh bia", content: [
      { type: "cover", attrs: { overlay: "#000000", opacity: 55, minHeight: "70vh", contentAlign: "center" }, content: [
        h(1, t.heroTitle, { textAlign: "center" }), p(t.heroText, { textAlign: "center" }), buttons("center", btn(t.start), btn(t.learn, "outline"))] }] },
    { name: "core/features-3", category: "features", title: t.features, description: t.featuresD, keywords: "features tinh nang cot", content: [
      h(2, t.featuresTitle, { textAlign: "center" }), { type: "spacer", attrs: { height: "md" } },
      { type: "columns", content: [col(t.f1), col(t.f2), col(t.f3)] }] },
    { name: "core/cta", category: "cta", title: t.cta, description: t.ctaD, keywords: "cta call to action keu goi", content: [
      { type: "group", attrs: { blockStyle: "card", style: { textAlign: { base: "center" }, padding: { base: "xl", mobile: "lg" } } }, content: [
        h(2, t.ctaTitle, { textAlign: "center" }), p(t.ctaText, { textAlign: "center" }), buttons("center", btn(t.ctaBtn))] }] },
    { name: "core/pricing-3", category: "pricing", title: t.pricing, description: t.pricingD, keywords: "pricing bang gia goi", content: [
      { type: "columns", content: [
        { type: "column", content: [plan(t.basic, "0đ", "outline")] },
        { type: "column", content: [plan(t.pro, `199k${t.perMonth}`, "primary")] },
        { type: "column", content: [plan(t.biz, `499k${t.perMonth}`, "outline")] }] }] },
    { name: "core/faq", category: "faq", title: t.faq, description: t.faqD, keywords: "faq hoi dap cau hoi", content: [
      h(2, t.faq), ...[1, 2, 3].map((n) => ({ type: "details", attrs: { summary: `${t.q} ${n}?` }, content: [p(t.a)] }))] },
    { name: "core/testimonial", category: "testimonials", title: t.testimonial, description: t.testimonialD, keywords: "testimonial danh gia cam nhan", content: [
      { type: "pullquote", attrs: { citation: t.who }, content: [text(t.quote)] }] },
    { name: "core/intro", category: "text", title: t.intro, description: t.introD, keywords: "about gioi thieu media", content: [
      { type: "mediaText", attrs: { position: "left", width: 50, verticalAlign: "center" }, content: [h(2, t.introTitle), p(t.introText), buttons("left", btn(t.learn, "outline"))] }] },
    { name: "core/contact", category: "contact", title: t.contact, description: t.contactD, keywords: "contact lien he", content: [
      h(2, t.contactTitle), p(t.contactText),
      { type: "socialLinks", attrs: { links: [{ service: "facebook", url: "https://facebook.com" }, { service: "zalo", url: "https://zalo.me" }, { service: "email", url: "mailto:hello@example.com" }] } }] },
  ];
}

let coreLocale: string | null = null;
/** Mẫu có sẵn của lõi (gọi lại với ngôn ngữ khác để đổi chữ trong mẫu). */
export function registerCorePatterns(locale = "vi") {
  if (coreLocale === locale) return;
  coreLocale = locale;
  for (const pattern of [...corePatterns(msgs("patterns", locale)), ...libraryPatterns(locale)]) patterns.set(pattern.name, pattern);
  changed();
}

export const PATTERN_CATEGORIES = ["hero", "features", "stats", "steps", "cta", "pricing", "testimonials", "faq", "team", "logos", "contact", "text", "gallery", "header", "footer"];
