import { normalizeGradient, normalizeStyle, type BlockLayout, type BlockStyle, type Device } from "@ecomcx/ecomweb-content";
import { AlignCenterVertical, AlignEndVertical, AlignStartVertical, ArrowDown, ArrowRight, Columns3, LayoutGrid, Rows3, Square, StretchVertical, AlignHorizontalSpaceBetween, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { useEditor } from "./context";
import { ColorSwatchInput } from "../colorswatch";

/**
 * Bố cục, nền chuyển màu, bóng, tỉ lệ, ghim và hover (@ecomcx/ecomweb-content 1.15) — phần thêm của tab Kiểu dáng.
 * Giá trị theo khổ (hướng, căn, số cột) sửa theo khổ đang chọn ở bảng Kiểu dáng (`device`).
 */
const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
type Icon = ComponentType<{ className?: string }>;

function Seg<T extends string>({ value, options, onChange, label }: { value: T | undefined; options: Array<[T, Icon | string, string]>; onChange(v: T | undefined): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="ecx-seg">
      {options.map(([v, I, title]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} title={title} aria-label={title} className={cx("ecx-seg-btn", value === v && "is-active")}
          onClick={() => onChange(value === v ? undefined : v)}>{typeof I === "string" ? I : <I className="ecx-icon" />}</button>
      ))}
    </div>
  );
}
function Row({ label, children, device }: { label: string; children: ReactNode; device?: Device }) {
  const { labels } = useEditor();
  return (
    <div className="ecx-style-row">
      <span className="ecx-field-label">{label}{device && device !== "base" && <em className="ecx-device-tag">{device === "tablet" ? labels.lang === "vi" ? "Máy tính bảng" : "Tablet" : labels.lang === "vi" ? "Điện thoại" : "Mobile"}</em>}</span>
      {children}
    </div>
  );
}
function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="ecx-style-section">
      <button type="button" className="ecx-style-section-head" aria-expanded={open} onClick={() => setOpen(!open)}>{title}<span aria-hidden>{open ? "−" : "+"}</span></button>
      {open && <div className="ecx-style-section-body">{children}</div>}
    </section>
  );
}

const V = { vi: {
  layout: "Bố cục", type: "Kiểu", flow: "Nhóm", row: "Hàng ngang", stack: "Xếp dọc", grid: "Lưới", direction: "Hướng", justify: "Căn ngang", align: "Căn dọc",
  wrap: "Cho xuống dòng", columns: "Số cột", auto: "Tự chia", minWidth: "Rộng tối thiểu mỗi cột", effects: "Nền & hiệu ứng", gradient: "Nền chuyển màu",
  angle: "Góc", from: "Từ", to: "Đến", none: "Không", shadow: "Đổ bóng", ratio: "Tỉ lệ khung", sticky: "Ghim khi cuộn", top: "Cách mép trên",
  hover: "Khi rê chuột", text: "Màu chữ", background: "Màu nền", border: "Màu viền", lift: "Nhấc lên", start: "Đầu", center: "Giữa", end: "Cuối", between: "Dàn đều", stretch: "Kéo giãn",
}, en: {
  layout: "Layout", type: "Type", flow: "Group", row: "Row", stack: "Stack", grid: "Grid", direction: "Direction", justify: "Justify", align: "Align",
  wrap: "Allow wrapping", columns: "Columns", auto: "Auto", minWidth: "Minimum column width", effects: "Background & effects", gradient: "Gradient",
  angle: "Angle", from: "From", to: "To", none: "None", shadow: "Shadow", ratio: "Aspect ratio", sticky: "Sticky", top: "Top offset",
  hover: "Hover", text: "Text color", background: "Background", border: "Border color", lift: "Lift", start: "Start", center: "Center", end: "End", between: "Space between", stretch: "Stretch",
} };

/** Khối chứa (có khối con) mới có mục Bố cục. */
const CONTAINERS = new Set(["group", "column", "cover", "blockquote", "callout", "details", "query", "postTemplate", "mediaText"]);

type Kind = "flow" | "row" | "stack" | "grid";
export const layoutKind = (l?: BlockLayout): Kind => (!l ? "flow" : l.type === "grid" ? "grid" : l.direction?.base === "column" ? "stack" : "row");
export function layoutFor(kind: Kind, prev?: BlockLayout): BlockLayout | undefined {
  if (kind === "flow") return undefined;
  if (kind === "grid") return { type: "grid", columns: prev?.type === "grid" && prev.columns ? prev.columns : { base: 3 }, ...(prev?.justify ? { justify: prev.justify } : {}) };
  return { type: "flex", direction: { base: kind === "stack" ? "column" : "row" }, ...(prev?.justify ? { justify: prev.justify } : {}), ...(prev?.align ? { align: prev.align } : {}) };
}

export function LayoutEffectsPanel({ type, style: raw, onChange, device }: { type: string; style: unknown; onChange(style: BlockStyle | null): void; device: Device }) {
  const { labels, host } = useEditor();
  const t = V[labels.lang];
  const style: BlockStyle = normalizeStyle(raw) ?? {};
  const set = (patch: Partial<BlockStyle>) => {
    const next = { ...style, ...patch } as Record<string, unknown>;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    onChange(normalizeStyle(next) ?? null);
  };
  const l = style.layout;
  const kind = layoutKind(l);
  const setLayout = (patch: Partial<BlockLayout>) => { if (l) set({ layout: { ...l, ...patch } }); };
  /** Giá trị theo khổ đang chọn. */
  const resp = <T,>(v: Partial<Record<Device, T>> | undefined, x: T | undefined) => {
    const next = { ...(v ?? {}) } as Record<string, T>;
    if (x === undefined) delete next[device]; else next[device] = x;
    return Object.keys(next).length ? next : undefined;
  };

  // Nền chuyển màu: preset của theme hoặc hai màu + góc
  const gradPresets = Object.keys(host.presets?.gradients ?? {});
  const g = style.gradient && !gradPresets.includes(style.gradient) ? /^linear-gradient\((\d{1,3})deg, (#[0-9a-f]{3,8}) 0%, (#[0-9a-f]{3,8}) 100%\)$/i.exec(style.gradient) : null;
  const [angle, setAngle] = useState(g ? Number(g[1]) : 135);
  const [c1, setC1] = useState(g?.[2] ?? "#1a597b");
  const [c2, setC2] = useState(g?.[3] ?? "#f26251");
  const applyCustom = (a = angle, x = c1, y = c2) => set({ gradient: normalizeGradient(`linear-gradient(${a}deg, ${x} 0%, ${y} 100%)`) });
  const shadows = ["sm", "md", "lg", "xl", ...Object.keys(host.presets?.shadows ?? {}).filter((s) => !["sm", "md", "lg", "xl"].includes(s))];

  return (
    <div className="ecx-layout-panel">
      {CONTAINERS.has(type) && (
        <Section title={t.layout}>
          <Row label={t.type}>
            <Seg<Kind> label={t.type} value={kind} onChange={(k) => set({ layout: layoutFor(k ?? "flow", l) })}
              options={[["flow", Square, t.flow], ["row", Columns3, t.row], ["stack", Rows3, t.stack], ["grid", LayoutGrid, t.grid]]} />
          </Row>
          {l?.type === "flex" && <>
            <Row label={t.direction} device={device}>
              <Seg label={t.direction} value={l.direction?.[device] ?? (device === "base" ? "row" : undefined)} onChange={(v) => setLayout({ direction: resp(l.direction, v) as BlockLayout["direction"] })}
                options={[["row", ArrowRight, t.row], ["column", ArrowDown, t.stack]]} />
            </Row>
            <label className="ecx-check"><input type="checkbox" checked={l.wrap !== false} onChange={(e) => setLayout({ wrap: e.target.checked ? undefined : false })} /> {t.wrap}</label>
          </>}
          {l && (
            <Row label={t.justify} device={device}>
              <Seg label={t.justify} value={l.justify?.[device]} onChange={(v) => setLayout({ justify: resp(l.justify, v) as BlockLayout["justify"] })}
                options={[["start", AlignHorizontalJustifyStart, t.start], ["center", AlignHorizontalJustifyCenter, t.center], ["end", AlignHorizontalJustifyEnd, t.end], ["between", AlignHorizontalSpaceBetween, t.between]]} />
            </Row>
          )}
          {l && (
            <Row label={t.align} device={device}>
              <Seg label={t.align} value={l.align?.[device]} onChange={(v) => setLayout({ align: resp(l.align, v) as BlockLayout["align"] })}
                options={[["start", AlignStartVertical, t.start], ["center", AlignCenterVertical, t.center], ["end", AlignEndVertical, t.end], ["stretch", StretchVertical, t.stretch]]} />
            </Row>
          )}
          {l?.type === "grid" && <>
            <Row label={t.columns} device={device}>
              <select className="ecx-input" aria-label={t.columns} value={l.columns?.[device] ?? ""} onChange={(e) => setLayout({ columns: resp(l.columns, e.target.value ? Number(e.target.value) : undefined) })}>
                <option value="">{device === "base" ? t.auto : "—"}</option>
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </Row>
            {!l.columns?.base && (
              <Row label={t.minWidth}>
                <input className="ecx-input" aria-label={t.minWidth} placeholder="12rem" defaultValue={l.minColumnWidth ?? ""} onBlur={(e) => setLayout({ minColumnWidth: e.target.value.trim() || undefined })} />
              </Row>
            )}
          </>}
        </Section>
      )}

      <Section title={t.effects} defaultOpen={!!(style.gradient || style.shadow || style.aspectRatio || style.position)}>
        <Row label={t.gradient}>
          <div className="ecx-chip-row">
            <button type="button" className={cx("ecx-chip", !style.gradient && "is-active")} onClick={() => set({ gradient: undefined })}>{t.none}</button>
            {gradPresets.map((name) => (
              <button key={name} type="button" className={cx("ecx-chip ecx-chip-swatch", style.gradient === name && "is-active")} title={name} aria-label={name}
                style={{ background: host.presets!.gradients![name] }} onClick={() => set({ gradient: name })} />
            ))}
            <button type="button" className={cx("ecx-chip ecx-chip-swatch", g && "is-active")} title={labels.lang === "vi" ? "Tuỳ chỉnh" : "Custom"}
              style={{ background: `linear-gradient(${angle}deg, ${c1}, ${c2})` }} onClick={() => applyCustom()} />
          </div>
          {g && (
            <div className="ecx-gradient-edit">
              <label>{t.from} <input type="color" value={c1} onChange={(e) => { setC1(e.target.value); applyCustom(angle, e.target.value, c2); }} /></label>
              <label>{t.to} <input type="color" value={c2} onChange={(e) => { setC2(e.target.value); applyCustom(angle, c1, e.target.value); }} /></label>
              <label>{t.angle} <input type="range" min={0} max={360} step={15} value={angle} onChange={(e) => { setAngle(Number(e.target.value)); applyCustom(Number(e.target.value)); }} aria-label={t.angle} /> {angle}°</label>
            </div>
          )}
        </Row>
        <Row label={t.shadow}>
          <select className="ecx-input" aria-label={t.shadow} value={style.shadow ?? ""} onChange={(e) => set({ shadow: e.target.value || undefined })}>
            <option value="">—</option><option value="none">{t.none}</option>
            {shadows.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </Row>
        <Row label={t.ratio}>
          <select className="ecx-input" aria-label={t.ratio} value={style.aspectRatio ?? ""} onChange={(e) => set({ aspectRatio: e.target.value || undefined })}>
            <option value="">—</option>
            {["1/1", "4/3", "3/2", "16/9", "21/9", "3/4", "2/3", "9/16"].map((r) => <option key={r} value={r}>{r.replace("/", ":")}</option>)}
          </select>
        </Row>
        <label className="ecx-check"><input type="checkbox" checked={!!style.position} onChange={(e) => set({ position: e.target.checked ? { type: "sticky" } : undefined })} /> {t.sticky}</label>
      </Section>

      <Section title={t.hover} defaultOpen={!!style.hover}>
        {(["text", "background"] as const).map((k) => (
          <Row key={k} label={t[k]}>
            <ColorInput label={t[k]} value={style.hover?.color?.[k]} onChange={(v) => set({ hover: { ...style.hover, color: { ...style.hover?.color, [k]: v } } })} />
          </Row>
        ))}
        <Row label={t.border}>
          <ColorInput label={t.border} value={style.hover?.border?.color} onChange={(v) => set({ hover: { ...style.hover, border: v ? { color: v } : undefined } })} />
        </Row>
        <Row label={t.shadow}>
          <select className="ecx-input" aria-label={`${t.hover} ${t.shadow}`} value={style.hover?.shadow ?? ""} onChange={(e) => set({ hover: { ...style.hover, shadow: e.target.value || undefined } })}>
            <option value="">—</option>{shadows.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </Row>
        <label className="ecx-check"><input type="checkbox" checked={!!style.hover?.lift} onChange={(e) => set({ hover: { ...style.hover, lift: e.target.checked || undefined } })} /> {t.lift}</label>
      </Section>
    </div>
  );
}

/** Ô màu: preset của theme + bảng chọn màu + bỏ màu. */
function ColorInput({ value, onChange, label }: { value?: string; onChange(v: string | undefined): void; label: string }) {
  const { host } = useEditor();
  const presets = Object.entries(host.presets?.colors ?? {});
  return (
    <div className="ecx-chip-row">
      {presets.map(([name, c]) => <button key={name} type="button" className={cx("ecx-chip ecx-chip-swatch", value === name && "is-active")} title={name} aria-label={`${label}: ${name}`} style={{ background: c }} onClick={() => onChange(value === name ? undefined : name)} />)}
      <ColorSwatchInput value={value} onChange={onChange} label={label} />
      {value && <button type="button" className="ecx-chip" onClick={() => onChange(undefined)}>×</button>}
    </div>
  );
}
