import { ColorSwatchInput } from "../../shared/color-swatch";
import { useEditor } from "../context";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

/** Ô màu: preset của theme + bảng chọn màu + bỏ màu. */
export function ColorInput({ value, onChange, label }: { value?: string; onChange(v: string | undefined): void; label: string }) {
  const { host } = useEditor();
  const presets = Object.entries(host.presets?.colors ?? {});
  return (
    <div className="ecx-chip-row">
      {presets.map(([name, c]) => <button key={name} type="button" className={cx("ecx-chip ecx-chip-swatch", value === name && "is-active")} title={name} aria-label={`${label}: ${name}`} style={{ background: c }} onClick={() => onChange(value === name ? undefined : name)} />)}
      <ColorSwatchInput value={value} onChange={onChange} label={label} size={28} />
      {value && <button type="button" className="ecx-chip" onClick={() => onChange(undefined)}>×</button>}
    </div>
  );
}
