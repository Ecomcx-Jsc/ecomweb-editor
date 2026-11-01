import { Database, Unlink } from "lucide-react";
import { createElement, useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useDynamicData, useEditor } from "./context";
import type { DynamicData } from "./host";
import type { BNode } from "./model";
import type { BlockProps } from "./registry";

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
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

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

/** Giá trị xem trước của thuộc tính được gắn (undefined = chưa gắn / nguồn chưa có dữ liệu mẫu). */
export function useBindingPreview(block: BNode, attr: string): { bound: boolean; value?: string; label?: string } {
  const dynamic = useDynamicData();
  useSyncExternalStore(subscribe, bindingSources, bindingSources);
  const b = bindingsOf(block)?.[attr];
  const src = b ? sources.get(b.source) : undefined;
  const [value, setValue] = useState<string | undefined>(undefined);
  const key = JSON.stringify(b ?? null);
  useEffect(() => {
    let alive = true;
    if (!b || !src?.preview) { setValue(undefined); return; }
    Promise.resolve(src.preview(b.args ?? {}, { dynamic })).then((v) => { if (alive) setValue(v == null || v === "" ? undefined : String(v)); }, () => { if (alive) setValue(undefined); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, src, dynamic]);
  if (!b) return { bound: false };
  const field = src?.fields?.find((f) => f.value === b.args?.[src.argKey ?? "field"])?.label ?? String(b.args?.[src?.argKey ?? "field"] ?? "");
  return { bound: true, value, label: `${src?.label ?? b.source}${field ? ` › ${field}` : ""}` };
}

/** Mục "Gắn dữ liệu" của bảng cài đặt: mỗi thuộc tính gắn được một dòng chọn nguồn + trường. */
export function BindingsPanel({ block, bindable, onChange }: { block: BNode; bindable: string[]; onChange(bindings: Record<string, Binding> | undefined): void }) {
  const { labels } = useEditor();
  const all = useSyncExternalStore(subscribe, bindingSources, bindingSources);
  const current = bindingsOf(block) ?? {};
  const vi = labels.lang === "vi";
  const ATTR: Record<string, string> = vi
    ? { content: "Nội dung", src: "Ảnh", alt: "Mô tả ảnh", caption: "Chú thích", text: "Chữ trên nút", href: "Liên kết" }
    : { content: "Content", src: "Image", alt: "Alt text", caption: "Caption", text: "Button text", href: "Link" };
  const set = (attr: string, b: Binding | undefined) => {
    const next = { ...current };
    if (b) next[attr] = b; else delete next[attr];
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <details className="ecx-advanced ecx-bindings" open={Object.keys(current).length > 0}>
      <summary><Database className="ecx-icon ecx-icon-sm" /> {vi ? "Gắn dữ liệu" : "Bind data"}</summary>
      <p className="ecx-muted">{vi ? "Lấy giá trị từ dữ liệu của website khi hiển thị (tiêu đề bài, trường meta, dữ liệu của plugin…) thay cho chữ gõ tay." : "Show a value from site data at render time (post title, meta field, plugin data…) instead of typed text."}</p>
      {bindable.map((attr) => {
        const b = current[attr];
        const src = b ? all.find((s) => s.name === b.source) : undefined;
        const options = all.filter((s) => !s.attributes || s.attributes.includes(attr));
        const argKey = src?.argKey ?? "field";
        return (
          <div key={attr} className="ecx-binding-row" data-binding={attr}>
            <span className="ecx-field-label">{ATTR[attr] ?? attr}</span>
            <div className="ecx-color-row">
              <select className="ecx-input" aria-label={`${ATTR[attr] ?? attr}: ${vi ? "nguồn" : "source"}`} value={b?.source ?? ""}
                onChange={(e) => { const s = all.find((x) => x.name === e.target.value); set(attr, s ? { source: s.name, args: s.fields?.length ? { [s.argKey ?? "field"]: s.fields[0].value } : {} } : undefined); }}>
                <option value="">{vi ? "— Không gắn —" : "— Not bound —"}</option>
                {options.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
                {b && !src && <option value={b.source}>{b.source}</option>}
              </select>
              {b && <button type="button" className="ecx-tool" aria-label={vi ? "Bỏ gắn" : "Unbind"} title={vi ? "Bỏ gắn" : "Unbind"} onClick={() => set(attr, undefined)}><Unlink className="ecx-icon" /></button>}
            </div>
            {b && (src?.fields?.length
              ? <select className="ecx-input" aria-label={`${ATTR[attr] ?? attr}: ${vi ? "trường" : "field"}`} value={String(b.args?.[argKey] ?? "")} onChange={(e) => set(attr, { ...b, args: { ...b.args, [argKey]: e.target.value } })}>
                  {src.fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              : <input className="ecx-input" aria-label={`${ATTR[attr] ?? attr}: ${argKey}`} placeholder={argKey} value={String(b.args?.[argKey] ?? "")}
                  onChange={(e) => set(attr, { ...b, args: { ...b.args, [argKey]: e.target.value.replace(/[^\w.-]/g, "").slice(0, 200) } })} />)}
          </div>
        );
      })}
    </details>
  );
}

/**
 * Chữ được gắn dữ liệu trong khung soạn: hiện giá trị xem trước (hoặc tên nguồn khi chưa có dữ liệu mẫu), không sửa tay được.
 * Bỏ gắn ở bảng cài đặt để gõ lại.
 */
export function BoundText({ tagName = "span", preview, blockProps, style, className }: { tagName?: string; preview: { value?: string; label?: string }; blockProps?: BlockProps; style?: CSSProperties; className?: string }) {
  const props: Partial<BlockProps> = blockProps ?? {};
  return createElement(tagName, {
    ...props,
    className: [props.className, className, "ecx-bound", !preview.value && "is-empty"].filter(Boolean).join(" "),
    style: { ...props.style, ...style },
    "data-ecx-bound": "",
    title: preview.label,
  }, preview.value ?? `[${preview.label}]`);
}
