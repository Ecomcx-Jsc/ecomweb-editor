import type { BlockAttrSpec } from "@ecomcx/ecomweb-content";
import type { ReactNode } from "react";
import { ColorSwatchInput } from "../../shared/color-swatch";
import { useEditor } from "../context";
import type { BlockType } from "../core/registry";

export const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

export const ATTR_LABELS: Record<string, [string, string]> = {
  level: ["Cấp tiêu đề", "Level"], textAlign: ["Căn chữ", "Text align"], start: ["Bắt đầu từ", "Start at"], language: ["Ngôn ngữ", "Language"],
  src: ["Ảnh / tệp", "Media"], alt: ["Mô tả ảnh (alt)", "Alt text"], title: ["Tiêu đề", "Title"], caption: ["Chú thích", "Caption"], width: ["Rộng", "Width"],
  height: ["Cao", "Height"], align: ["Căn", "Align"], size: ["Cỡ", "Size"], href: ["Liên kết", "Link"], target: ["Mở ở", "Open in"], rel: ["rel", "rel"],
  variant: ["Kiểu", "Variant"], text: ["Chữ", "Text"], background: ["Màu nền", "Background"], textColor: ["Màu chữ", "Text color"], padding: ["Đệm", "Padding"],
  verticalAlign: ["Căn dọc", "Vertical align"], stack: ["Xếp chồng trên điện thoại", "Stack on mobile"], tone: ["Loại", "Tone"], summary: ["Tóm tắt", "Summary"],
  open: ["Mở sẵn", "Open by default"], overlay: ["Màu phủ", "Overlay"], opacity: ["Độ mờ phủ", "Overlay opacity"], minHeight: ["Cao tối thiểu", "Min height"],
  contentAlign: ["Vị trí chữ", "Content position"], fixed: ["Cố định khi cuộn", "Fixed background"], position: ["Vị trí ảnh", "Media position"],
  columns: ["Số cột", "Columns"], footer: ["Hàng cuối là chân bảng", "Footer row"], html: ["HTML", "HTML"], url: ["Địa chỉ", "URL"], links: ["Liên kết", "Links"],
  showLabels: ["Hiện tên", "Show labels"], maxLevel: ["Cấp tối đa", "Max level"], location: ["Vị trí menu", "Menu location"], orientation: ["Hướng", "Orientation"],
  mobile: ["Nút menu điện thoại", "Mobile toggle"], placeholder: ["Chữ gợi ý", "Placeholder"], buttonText: ["Chữ trên nút", "Button text"], link: ["Có liên kết", "Link"],
  moreText: ["Chữ “đọc tiếp”", "Read more text"], aspect: ["Tỉ lệ khung", "Aspect ratio"], avatar: ["Ảnh đại diện", "Avatar"], taxonomy: ["Phân loại", "Taxonomy"],
  separator: ["Dấu ngăn", "Separator"], inherit: ["Theo trang đang xem", "Inherit query"], postType: ["Loại bài", "Post type"], perPage: ["Số bài", "Per page"],
  category: ["Chuyên mục", "Category"], tag: ["Thẻ", "Tag"], orderBy: ["Sắp xếp theo", "Order by"], order: ["Thứ tự", "Order"], layout: ["Bố cục", "Layout"],
  slug: ["Phần (slug)", "Part (slug)"], tagName: ["Thẻ HTML", "HTML tag"], checked: ["Đã xong", "Done"], poster: ["Ảnh xem trước", "Poster"], download: ["Cho tải về", "Download"],
  embed: ["Xem ngay trên trang", "Embed"], anchor: ["Neo (id)", "Anchor"], className: ["Class CSS", "CSS class"],
};
/** Thuộc tính sửa ở chỗ khác (thanh công cụ, trên khung soạn) hoặc dữ liệu kỹ thuật. */
const HIDDEN_ATTRS = new Set(["style", "blockStyle", "anchor", "className", "mediaId", "srcset", "webpSrcset", "images", "links", "colwidth", "colspan", "rowspan", "_v", "id"]); // gộp ô: dùng lệnh Gộp / Tách của công cụ bảng (sửa số tay làm lệch bảng)

const attrLabel = (name: string, spec: BlockAttrSpec, lang: "vi" | "en", translate?: (s: string) => string) =>
  spec.label ? (translate ? translate(spec.label) : spec.label) : ATTR_LABELS[name]?.[lang === "vi" ? 0 : 1] ?? name;

function controlOf(spec: BlockAttrSpec): NonNullable<BlockAttrSpec["control"]> {
  if (spec.control) return spec.control;
  if (spec.enum) return "select";
  switch (spec.type) {
    case "number": case "integer": return "number";
    case "boolean": return "checkbox";
    case "url": return "url";
    case "json": return "hidden";
    default: return "text";
  }
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="ecx-field"><span className="ecx-field-label">{label}</span>{children}</label>;
}

/** Form thuộc tính tự sinh từ mô tả (không phải viết giao diện cho từng khối). */
export function AttrForm({ type, attrs, onChange }: { type: BlockType; attrs: Record<string, any>; onChange(a: Record<string, unknown>): void }) {
  const { host, labels } = useEditor();
  const entries = Object.entries(type.attributes ?? {}).filter(([k, s]) => !HIDDEN_ATTRS.has(k) && controlOf(s) !== "hidden");
  if (!entries.length) return null;
  return (
    <div className="ecx-form">
      {entries.map(([k, spec]) => {
        const label = attrLabel(k, spec, labels.lang, host.translate);
        const value = attrs[k] ?? spec.default;
        const set = (v: unknown) => onChange({ [k]: v === "" || v === spec.default ? undefined : v });
        switch (controlOf(spec)) {
          case "checkbox":
            return <label key={k} className="ecx-check"><input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} /> {label}</label>;
          case "select":
            return (
              <Field key={k} label={label}>
                <select className="ecx-input" value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value === "" ? undefined : spec.type === "integer" || spec.type === "number" ? Number(e.target.value) : e.target.value)}>
                  {spec.default === undefined && <option value="">—</option>}
                  {(spec.enum ?? []).map((v, i) => <option key={String(v)} value={String(v)}>{spec.enumLabels?.[i] ? (host.translate?.(spec.enumLabels[i]) ?? spec.enumLabels[i]) : String(v)}</option>)}
                </select>
              </Field>
            );
          case "number":
            return <Field key={k} label={label}><input className="ecx-input" type="number" min={spec.min} max={spec.max} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))} /></Field>;
          case "textarea":
            return <Field key={k} label={label}><textarea className="ecx-input" rows={3} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} /></Field>;
          case "color":
            return (
              <Field key={k} label={label}>
                <span className="ecx-color-row">
                  <ColorSwatchInput value={value == null ? undefined : String(value)} onChange={set} label={label} />
                  <input className="ecx-input" value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} placeholder="#hex / primary" />
                </span>
              </Field>
            );
          case "media":
            return (
              <Field key={k} label={label}>
                <span className="ecx-color-row">
                  <input className="ecx-input" type="url" value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} placeholder="https://…" />
                  {host.media && <button type="button" className="ecx-btn" onClick={async () => { const [m] = await host.media!.pick({ kind: "image", multiple: false }); if (m) onChange({ [k]: m.url, ...(k === "src" ? { mediaId: m.id, alt: attrs.alt ?? (m.alt || undefined) } : {}) }); }}>{labels.chooseImage}</button>}
                </span>
              </Field>
            );
          default:
            return <Field key={k} label={label}><input className="ecx-input" type={controlOf(spec) === "url" ? "url" : "text"} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} /></Field>;
        }
      })}
    </div>
  );
}

