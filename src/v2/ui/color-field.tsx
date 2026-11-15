import { useEffect, useRef, useState } from "react";
import { ColorSwatchInput } from "../../shared/color-swatch";
import { useEditor } from "../context";
import { useMsgs } from "../i18n";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

// Theme không khai màu thì website dùng các màu mặc định này (core CSS) — vẫn cho chọn, như bản soạn cũ (shared/style-panel.tsx COLORS)
const DEFAULT_COLORS = { primary: "#2563eb", muted: "#6b7280", surface: "#f4f4f5", white: "#ffffff", black: "#111111" };

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
  const css = value ? colors[value] ?? value : undefined;
  return (
    <div className="ecx-color-field" ref={ref}>
      <button type="button" className={cx("ecx-color-row-btn", open && "is-open")} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={cx("ecx-color-dot", !css && "is-none")} style={css ? { background: css } : undefined} />
        <span className="ecx-color-name">{label}</span>
        <span className="ecx-color-value">{value ? (colors[value] ? value : value.toUpperCase()) : t.noColor}</span>
      </button>
      {open && (
        <div className="ecx-color-pop" role="dialog" aria-label={label}>
          <div className="ecx-pop-title">{t.siteColors}</div>
          <div className="ecx-color-grid">
            {Object.entries(colors).map(([name, c]) => (
              <button key={name} type="button" className={cx("ecx-color-cell", value === name && "is-active")} title={name} aria-label={`${label}: ${name}`} aria-pressed={value === name}
                style={{ background: c }} onClick={() => { onChange(name); setOpen(false); }} />
            ))}
          </div>
          <p className="ecx-pop-hint">{t.colorHint}</p>
          <div className="ecx-pop-foot">
            <span className="ecx-pop-custom"><ColorSwatchInput value={css} onChange={(v) => onChange(v)} label={`${label}: ${t.customColor}`} size={24} /> {t.customColor}</span>
            {value && <button type="button" className="ecx-link-btn" onClick={() => { onChange(undefined); setOpen(false); }}>{t.clearColor}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
