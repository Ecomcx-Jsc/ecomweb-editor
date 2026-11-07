import type { BlockAttrSpec } from "@ecomcx/ecomweb-content";
import { useEffect, useState, type ReactNode } from "react";
import { useEditor } from "../context";
import type { Choice, ChoiceKind } from "../core/host";
import type { BlockType } from "../core/registry";
import { messages } from "../../i18n";
import { DEFAULT_IMAGE_SIZES, hintOf, hintText, imageSizeLabel, optionLabel, type AttrHint } from "./attr-hints";
import { ColorInput } from "./color-field";
import { mediaSrcsets } from "../blocks/media-actions";

export const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

/** Tên thuộc tính theo ngôn ngữ (chữ: src/locales/<ngôn ngữ>/attrs.ts, khoá = tên thuộc tính). */
export const attrName = (name: string, lang: string): string | undefined => { const v = messages("attrs", lang)[name]; return typeof v === "string" ? v : undefined; };
/** Thuộc tính sửa ở chỗ khác (thanh công cụ, trên khung soạn) hoặc dữ liệu kỹ thuật. */
const HIDDEN_ATTRS = new Set(["style", "blockStyle", "anchor", "className", "mediaId", "srcset", "webpSrcset", "images", "links", "colwidth", "colspan", "rowspan", "_v", "id"]); // gộp ô: dùng lệnh Gộp / Tách của công cụ bảng (sửa số tay làm lệch bảng)

const attrLabel = (name: string, spec: BlockAttrSpec, lang: string, translate?: (s: string) => string) =>
  spec.label ? (translate ? translate(spec.label) : spec.label) : attrName(name, lang) ?? name;

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

export function Field({ label, children, group }: { label: string; children: ReactNode; group?: boolean }) {
  // Nhiều nút (chọn phân đoạn): không bọc <label> — bấm vào chữ nhãn sẽ bấm luôn nút đầu tiên
  if (group) return <div className="ecx-field" role="group" aria-label={label}><span className="ecx-field-label">{label}</span>{children}</div>;
  return <label className="ecx-field"><span className="ecx-field-label">{label}</span>{children}</label>;
}

/** Lựa chọn lấy từ ứng dụng (host.choices); null = ứng dụng không cung cấp → ô gõ tay. */
function useChoices(kind: ChoiceKind | undefined, args: Record<string, string> | undefined): Choice[] | null | undefined {
  const { host, labels } = useEditor();
  const key = JSON.stringify([kind, args]);
  const [state, setState] = useState<{ key: string; list: Choice[] | null } | null>(null);
  useEffect(() => {
    if (!kind) return;
    let alive = true;
    const fallback = kind === "imageSize" ? DEFAULT_IMAGE_SIZES.map((v) => ({ value: String(v), label: imageSizeLabel(String(v), labels.lang) })) : null;
    if (!host.choices) { setState({ key, list: fallback }); return; }
    Promise.resolve(host.choices(kind, args)).then((list) => { if (alive) setState({ key, list: list?.length || !fallback ? list : fallback }); }, () => { if (alive) setState({ key, list: fallback }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, host]);
  return state?.key === key ? state.list : undefined;
}

function SegText({ value, options, onChange, label }: { value: string | undefined; options: Array<[string, string]>; onChange(v: string | undefined): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="ecx-seg is-text">
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={cx("ecx-seg-btn", value === v && "is-active")} onClick={() => onChange(value === v ? undefined : v)}>{text}</button>
      ))}
    </div>
  );
}

/** Ô chọn dữ liệu thật (vị trí menu, loại bài…): giá trị cũ không còn trong danh sách vẫn hiện (không mất). */
function ChoiceField({ hint, attrs, value, set, label }: { hint: AttrHint; attrs: Record<string, unknown>; value: unknown; set(v: unknown): void; label: string }) {
  const { labels } = useEditor();
  const list = useChoices(hint.choice?.kind, hint.choice?.args?.(attrs));
  const v = value == null ? "" : String(value);
  if (list === null) return <input className="ecx-input" aria-label={label} value={v} onChange={(e) => set(e.target.value)} />;
  return (
    <select className="ecx-input" aria-label={label} value={v} disabled={list === undefined} onChange={(e) => set(e.target.value || undefined)}>
      <option value="">{list === undefined ? labels.choiceLoading : labels.choiceSelect}</option>
      {list?.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      {v && list && !list.some((c) => c.value === v) && <option value={v}>{v} {labels.choiceMissing}</option>}
    </select>
  );
}

/** Form thuộc tính tự sinh từ mô tả khối + gợi ý hiển thị (attr-hints): không phải viết giao diện cho từng khối. */
export function AttrForm({ type, attrs, onChange }: { type: BlockType; attrs: Record<string, any>; onChange(a: Record<string, unknown>): void }) {
  const { host, labels } = useEditor();
  const lang = labels.lang;
  const entries = Object.entries(type.attributes ?? {})
    .map(([k, s]) => [k, s, hintOf(type.name, k)] as const)
    .filter(([k, s, h]) => !HIDDEN_ATTRS.has(k) && controlOf(s) !== "hidden" && h.control !== "hidden" && (!h.when || h.when(attrs)));
  if (!entries.length) return null;
  return (
    <div className="ecx-form">
      {entries.map(([k, spec, hint]) => {
        const label = hintText(hint, "label", lang) ?? attrLabel(k, spec, lang, host.translate);
        const value = attrs[k] ?? spec.default;
        const set = (v: unknown) => onChange({ [k]: v === "" || v === spec.default ? undefined : v });
        const helpText = hintText(hint, "help", lang);
        const help = helpText && <span className="ecx-field-help">{helpText}</span>;
        const num = spec.type === "integer" || spec.type === "number";
        const opts = (): Array<[string, string]> => hint.options
          ? hint.options.map((v) => [String(v), optionLabel(hint, v, lang)])
          : (spec.enum ?? []).map((v, i) => [String(v), spec.enumLabels?.[i] ? (host.translate?.(spec.enumLabels[i]) ?? spec.enumLabels[i]) : optionLabel(hint, v, lang)]);
        const parse = (v: string) => (v === "" ? undefined : num ? Number(v) : v);
        switch (hint.control ?? controlOf(spec)) {
          case "checkbox":
            return <div key={k}><label className="ecx-check"><input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} /> {label}</label>{help}</div>;
          case "newTab":
            return <label key={k} className="ecx-check"><input type="checkbox" checked={value === "_blank"} onChange={(e) => set(e.target.checked ? "_blank" : undefined)} /> {labels.openInNewTab}</label>;
          case "segmented":
            return <Field key={k} label={label} group><SegText label={label} value={value == null ? undefined : String(value)} options={opts()} onChange={(v) => set(v === undefined ? undefined : parse(v))} />{help}</Field>;
          case "select":
            return (
              <Field key={k} label={label}>
                <select className="ecx-input" value={value == null ? "" : String(value)} onChange={(e) => set(parse(e.target.value))}>
                  {spec.default === undefined && <option value="">—</option>}
                  {opts().map(([v, text]) => <option key={v} value={v}>{text}</option>)}
                </select>
                {help}
              </Field>
            );
          case "choice":
            return <Field key={k} label={label}><ChoiceField hint={hint} attrs={attrs} value={value} set={set} label={label} />{help}</Field>;
          case "range": {
            const min = hint.min ?? spec.min ?? 0, max = hint.max ?? spec.max ?? 100;
            const n = value == null || value === "" ? min : Number(value);
            return (
              <Field key={k} label={label}>
                <span className="ecx-range-row">
                  <input type="range" min={min} max={max} step={hint.step ?? 1} value={n} aria-label={label} onChange={(e) => set(Number(e.target.value))} />
                  <output>{n}{hint.unit ?? ""}</output>
                </span>
                {help}
              </Field>
            );
          }
          case "suggest": {
            const id = `ecx-sug-${type.name}-${k}`;
            return (
              <Field key={k} label={label}>
                <input className="ecx-input" list={id} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} />
                <datalist id={id}>{hint.suggestions?.map((x) => <option key={x} value={x} />)}</datalist>
                {help}
              </Field>
            );
          }
          case "number":
            return <Field key={k} label={label}><input className="ecx-input" type="number" min={spec.min} max={spec.max} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))} />{help}</Field>;
          case "code":
            return <Field key={k} label={label}><textarea className="ecx-input ecx-code-input" rows={6} spellCheck={false} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} />{help}</Field>;
          case "textarea":
            return <Field key={k} label={label}><textarea className="ecx-input" rows={3} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} />{help}</Field>;
          case "color":
            return <Field key={k} label={label} group><ColorInput label={label} value={value == null ? undefined : String(value)} onChange={(v) => set(v)} />{help}</Field>;
          case "media":
            return (
              <Field key={k} label={label}>
                <span className="ecx-color-row">
                  <input className="ecx-input" type="url" value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} placeholder="https://…" />
                  {host.media && <button type="button" className="ecx-btn" onClick={async () => { const [m] = await host.media!.pick({ kind: "image", multiple: false }); if (m) onChange({ [k]: m.url, ...(k === "src" ? { mediaId: m.id, alt: attrs.alt ?? (m.alt || undefined), width: m.width ?? undefined, height: m.height ?? undefined, srcset: mediaSrcsets(m).srcset, webpSrcset: mediaSrcsets(m).webpSrcset } : {}) /* đổi ảnh thì kích thước khai báo theo ảnh mới (không giữ cỡ ảnh cũ → méo tỉ lệ / nhảy layout) */ }); }}>{labels.chooseImage}</button>}
                </span>
                {help}
              </Field>
            );
          default:
            return <Field key={k} label={label}><input className="ecx-input" type={controlOf(spec) === "url" ? "url" : "text"} value={value == null ? "" : String(value)} onChange={(e) => set(e.target.value)} />{help}</Field>;
        }
      })}
    </div>
  );
}
