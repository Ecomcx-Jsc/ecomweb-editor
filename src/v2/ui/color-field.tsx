import { ColorSwatchInput } from "../../shared/color-swatch";
import { useEditor } from "../context";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

// Theme không khai màu thì website dùng các màu mặc định này (core CSS) — vẫn cho chọn, như bản soạn cũ (shared/style-panel.tsx COLORS)
const DEFAULT_COLORS = { primary: "#2563eb", muted: "#6b7280", surface: "#f4f4f5", white: "#ffffff", black: "#111111" };

/** Ô màu: preset của theme + bảng chọn màu + bỏ màu. */
export function ColorInput({ value, onChange, label }: { value?: string; onChange(v: string | undefined): void; label: string }) {
  const { host } = useEditor();
  const declared = host.presets?.colors;
  const colorMap: Record<string, string> = declared && Object.keys(declared).length ? declared : DEFAULT_COLORS;
  const presets = Object.entries(colorMap);
  return (
    <div className="ecx-chip-row">
      {presets.map(([name, c]) => <button key={name} type="button" className={cx("ecx-chip ecx-chip-swatch", value === name && "is-active")} title={name} aria-label={`${label}: ${name}`} style={{ background: c }} onClick={() => onChange(value === name ? undefined : name)} />)}
      <ColorSwatchInput value={value && (colorMap[value] ?? value)} onChange={onChange} label={label} size={28} />
      {value && <button type="button" className="ecx-chip" onClick={() => onChange(undefined)}>×</button>}
    </div>
  );
}
