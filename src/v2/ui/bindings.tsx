import { Database, Unlink } from "lucide-react";
import { createElement, useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useDynamicData, useEditor } from "../context";
import { bindingSource, bindingSources, bindingsOf, subscribeBindingSources, type Binding } from "../core/bindings";
import type { BNode } from "../core/model";
import type { BlockProps } from "../core/registry";

export { CORE_BINDABLE, registerBindingSource, unregisterBindingSource, bindingSources, type Binding, type EditorBindingSource } from "../core/bindings";

/** Giá trị xem trước của thuộc tính được gắn (undefined = chưa gắn / nguồn chưa có dữ liệu mẫu). */
export function useBindingPreview(block: BNode, attr: string): { bound: boolean; value?: string; label?: string } {
  const dynamic = useDynamicData();
  useSyncExternalStore(subscribeBindingSources, bindingSources, bindingSources);
  const b = bindingsOf(block)?.[attr];
  const src = b ? bindingSource(b.source) : undefined;
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
  const all = useSyncExternalStore(subscribeBindingSources, bindingSources, bindingSources);
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
