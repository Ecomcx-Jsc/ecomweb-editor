import { msgs } from "../../i18n";
import type { DynamicData } from "./host";
import type { BNode } from "./model";

/**
 * Gắn dữ liệu trong trình soạn (attrs.bindings, @ecomcx/ecomweb-content 1.15): chọn nguồn cho thuộc tính của khối, xem trước giá trị.
 * Website lấy giá trị thật lúc hiển thị (theme-sdk: CORE_BINDING_SOURCES + bindingSources của plugin).
 * Plugin đăng ký nguồn cho trình soạn: registerBindingSource (admin-sdk) — tên trùng với nguồn phía website.
 */
export interface EditorBindingSource {
  /** "nhóm/tên" — trùng tên nguồn phía website. */
  name: string;
  label: string;
  /** Trường chọn được (đặt vào args[argKey]). Không có → ô nhập tự do. */
  fields?: Array<{ value: string; label: string }>;
  /** Tham số do ô chọn / ô nhập đặt (mặc định "field"). */
  argKey?: string;
  /** Chỉ cho các thuộc tính này (vd ["src"] cho nguồn ảnh). Mặc định mọi thuộc tính gắn được. */
  attributes?: string[];
  /** Giá trị xem trước trong trình soạn (dữ liệu mẫu của trang đang sửa). */
  preview?(args: Record<string, string | number | boolean>, ctx: { dynamic?: DynamicData }): string | undefined | Promise<string | undefined>;
}

export interface Binding { source: string; args?: Record<string, string | number | boolean> }

/** Thuộc tính gắn được của khối lõi; khối plugin khai báo bằng BlockType.bindable. */
export const CORE_BINDABLE: Record<string, string[]> = { paragraph: ["content"], heading: ["content"], image: ["src", "alt", "caption"], button: ["text", "href"] };

const sources = new Map<string, EditorBindingSource>();
const listeners = new Set<() => void>();
let snapshot: EditorBindingSource[] = [];
const changed = () => { snapshot = [...sources.values()]; listeners.forEach((l) => l()); };
export function registerBindingSource(src: EditorBindingSource) { sources.set(src.name, src); changed(); }
export function unregisterBindingSource(name: string) { if (sources.delete(name)) changed(); }
export const bindingSources = () => snapshot;
export const bindingSource = (name: string) => sources.get(name);
export const subscribeBindingSources = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Nguồn lõi (trùng tên với CORE_BINDING_SOURCES của theme-sdk). Nhãn theo ngôn ngữ. */
export function registerCoreBindingSources(lang: string) {
  const t = msgs("bindings", lang);
  registerBindingSource({
    name: "core/post", label: t.srcPost,
    fields: [
      { value: "title", label: t.fTitle }, { value: "excerpt", label: t.fExcerpt }, { value: "date", label: t.fDate },
      { value: "author", label: t.fAuthor }, { value: "link", label: t.fLink }, { value: "featuredImage", label: t.fFeaturedImage },
    ],
    preview: (args, { dynamic }) => {
      const p = dynamic?.post;
      switch (args.field) {
        case "title": return p?.title; case "excerpt": return p?.excerpt; case "date": return p?.date; case "author": return p?.author;
        case "featuredImage": return p?.image ?? undefined; case "link": return "/…";
        default: return undefined;
      }
    },
  });
  registerBindingSource({ name: "core/post-meta", label: t.srcPostMeta, argKey: "key", preview: (args) => (args.key ? `{${args.key}}` : undefined) });
  registerBindingSource({
    name: "core/site", label: t.srcSite,
    fields: [{ value: "title", label: t.fSiteTitle }, { value: "tagline", label: t.fTagline }, { value: "url", label: "URL" }, { value: "logo", label: "Logo" }],
    preview: (args, { dynamic }) => (args.field === "title" ? dynamic?.site?.title : args.field === "tagline" ? dynamic?.site?.tagline : args.field === "logo" ? dynamic?.site?.logo ?? undefined : undefined),
  });
}

export const bindingsOf = (b: BNode) => (b.attrs.bindings as Record<string, Binding> | undefined) ?? undefined;
