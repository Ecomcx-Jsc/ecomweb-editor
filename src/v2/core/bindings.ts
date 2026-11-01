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
export function registerCoreBindingSources(lang: "vi" | "en") {
  const vi = lang === "vi";
  registerBindingSource({
    name: "core/post", label: vi ? "Bài đang xem" : "Current post",
    fields: [
      { value: "title", label: vi ? "Tiêu đề" : "Title" }, { value: "excerpt", label: vi ? "Tóm tắt" : "Excerpt" }, { value: "date", label: vi ? "Ngày đăng" : "Date" },
      { value: "author", label: vi ? "Tác giả" : "Author" }, { value: "link", label: vi ? "Đường dẫn" : "Link" }, { value: "featuredImage", label: vi ? "Ảnh đại diện" : "Featured image" },
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
  registerBindingSource({ name: "core/post-meta", label: vi ? "Trường meta của bài" : "Post meta field", argKey: "key", preview: (args) => (args.key ? `{${args.key}}` : undefined) });
  registerBindingSource({
    name: "core/site", label: vi ? "Website" : "Site",
    fields: [{ value: "title", label: vi ? "Tên website" : "Site title" }, { value: "tagline", label: vi ? "Khẩu hiệu" : "Tagline" }, { value: "url", label: "URL" }, { value: "logo", label: "Logo" }],
    preview: (args, { dynamic }) => (args.field === "title" ? dynamic?.site?.title : args.field === "tagline" ? dynamic?.site?.tagline : args.field === "logo" ? dynamic?.site?.logo ?? undefined : undefined),
  });
}

export const bindingsOf = (b: BNode) => (b.attrs.bindings as Record<string, Binding> | undefined) ?? undefined;
