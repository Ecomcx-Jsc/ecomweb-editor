import { useEffect, useRef, useState } from "react";
import { ColorSwatchInput } from "../../shared/color-swatch";
import { useEditor } from "../context";
import { useMsgs } from "../i18n";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

// Theme không khai màu thì website dùng các màu mặc định này (core CSS) — vẫn cho chọn, như bản soạn cũ (shared/style-panel.tsx COLORS)
const DEFAULT_COLORS = { primary: "#1a597b", muted: "#5d6a75", surface: "#f3f4f6", white: "#ffffff", black: "#111111" };

/** Tách giá trị màu thành màu gốc + độ đậm 1–100: `primary/40` → primary 40; `#1a597bcc` → #1a597b 80; còn lại (rgb / hsl / tên) → đậm 100, không chỉnh được. */
export function splitAlpha(v?: string): { base?: string; alpha: number; editable: boolean } {
  if (!v) return { alpha: 100, editable: false };
  const m = /^([a-z][a-z0-9-]{0,30})\/([1-9]\d?)$/.exec(v);
  if (m) return { base: m[1], alpha: Number(m[2]), editable: true };
  if (/^#[0-9a-f]{8}$/i.test(v)) return { base: v.slice(0, 7), alpha: Math.round((parseInt(v.slice(7), 16) / 255) * 100), editable: true };
  if (/^#[0-9a-f]{6}$/i.test(v) || /^#[0-9a-f]{3}$/i.test(v)) return { base: v, alpha: 100, editable: true };
  if (/^[a-z][a-z0-9-]{0,30}$/.test(v)) return { base: v, alpha: 100, editable: true };
  return { base: v, alpha: 100, editable: false };
}
/** Ghép lại: preset → `name/NN`, hex → #rrggbbaa; đậm 100 → bỏ phần độ đậm. */
export function joinAlpha(base: string, alpha: number): string {
  const a = Math.min(100, Math.max(1, Math.round(alpha)));
  if (a >= 100) return base;
  if (/^#[0-9a-f]{3}$/i.test(base)) base = "#" + [...base.slice(1)].map((c) => c + c).join("");
  if (/^#[0-9a-f]{6}$/i.test(base)) return base + Math.round((a / 100) * 255).toString(16).padStart(2, "0");
  return `${base}/${a}`;
}

export function useSiteColors(): Record<string, string> {
  const { host } = useEditor();
  const declared = host.presets?.colors;
  return declared && Object.keys(declared).length ? declared : DEFAULT_COLORS;
}

/**
 * Ô màu gọn: một dòng [chấm màu] tên ô … tên màu. Bấm mở bảng: màu của website (đổi bảng màu website là cả trang đổi theo),
 * màu tự chọn, về mặc định. Thay cho lưới chấm màu luôn mở (tốn chỗ khi khối có nhiều ô màu).
 */
export function ColorInput({ value, onChange, label }: { value?: string; onChange(v: string | undefined): void; label: string }) {
  const colors = useSiteColors();
  const t = useMsgs("controls");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", out, true); document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", out, true); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  const { base, alpha, editable } = splitAlpha(value);
  const baseCss = base ? colors[base] ?? base : undefined;
  // Xem trước có độ đậm: trộn màu gốc với trong suốt (cùng công thức website dùng)
  const css = baseCss ? (alpha < 100 ? `color-mix(in srgb, ${baseCss} ${alpha}%, transparent)` : baseCss) : undefined;
  return (
    <div className="ecx-color-field" ref={ref}>
      <button type="button" className={cx("ecx-color-row-btn", open && "is-open")} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={cx("ecx-color-dot", !css && "is-none")} style={css ? { background: css } : undefined} />
        <span className="ecx-color-name">{label}</span>
        <span className="ecx-color-value">{value ? (alpha < 100 ? `${(colors[base ?? ""] ? base : (base ?? "").toUpperCase())} · ${alpha}%` : colors[value] ? value : value.toUpperCase()) : t.noColor}</span>
      </button>
      {open && (
        <div className="ecx-color-pop" role="dialog" aria-label={label}>
          <div className="ecx-pop-title">{t.siteColors}</div>
          <div className="ecx-color-grid">
            {Object.entries(colors).map(([name, c]) => (
              <button key={name} type="button" className={cx("ecx-color-cell", base === name && "is-active")} title={name} aria-label={`${label}: ${name}`} aria-pressed={base === name}
                style={{ background: c }} onClick={() => { onChange(alpha < 100 ? joinAlpha(name, alpha) : name); setOpen(false); }} />
            ))}
          </div>
          <label className="ecx-color-alpha">
            <span>{t.colorOpacity}</span>
            <input type="range" min={1} max={100} step={1} value={alpha} disabled={!value || !editable} aria-label={`${label}: ${t.colorOpacity}`}
              onChange={(e) => base && onChange(joinAlpha(base, Number(e.target.value)))} />
            <output>{alpha}%</output>
          </label>
          <p className="ecx-pop-hint">{t.colorHint}</p>
          <div className="ecx-pop-foot">
            <span className="ecx-pop-custom"><ColorSwatchInput value={baseCss && /^#[0-9a-f]{6}$/i.test(baseCss) ? baseCss : baseCss} onChange={(v) => onChange(alpha < 100 ? joinAlpha(v, alpha) : v)} label={`${label}: ${t.customColor}`} size={24} /> {t.customColor}</span>
            {value && <button type="button" className="ecx-link-btn" onClick={() => { onChange(undefined); setOpen(false); }}>{t.clearColor}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
