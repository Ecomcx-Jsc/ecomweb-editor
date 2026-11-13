import { normalizeStyle } from "@ecomcx/ecomweb-content";
import { Link2, Link2Off, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useEditor } from "../context";
import { cx } from "./style-controls";
import { useMsgs } from "../i18n";

/**
 * Điều khiển giá trị có đơn vị (cỡ viền, bo góc, khoảng cách…): ô số + chọn đơn vị + thanh kéo.
 * Khoảng cách: thanh kéo theo bậc preset của theme (0, xs… 2xl), nút ⚙ chuyển sang giá trị tuỳ chỉnh có đơn vị,
 * khoá liên kết bốn cạnh hoặc chỉnh riêng chiều dọc / ngang.
 */
const UNITS = ["px", "rem", "em", "%", "vw", "vh"];
const parse = (v: unknown): { n: string; unit: string } | null => {
  const m = typeof v === "string" ? /^(-?\d*\.?\d+)(px|rem|em|%|vw|vh)?$/.exec(v.trim()) : typeof v === "number" ? [String(v), String(v), "px"] : null;
  return m ? { n: m[1], unit: m[2] ?? "px" } : null;
};

export function UnitInput({ value, onChange, label, max = 100, units = UNITS, slider = true, placeholder }: { value?: string; onChange(v: string | undefined): void; label: string; max?: number; units?: string[]; slider?: boolean; placeholder?: string }) {
  const t = useMsgs("controls");
  const p = parse(value);
  const [n, setN] = useState(p?.n ?? "");
  const [unit, setUnit] = useState(p?.unit ?? units[0]);
  useEffect(() => { const q = parse(value); setN(q?.n ?? ""); if (q) setUnit(q.unit); }, [value]);
  const emit = (num: string, u: string) => onChange(num === "" ? undefined : `${num}${u}`);
  const sliderMax = unit === "px" ? max : unit === "%" || unit.startsWith("v") ? 100 : Math.max(4, Math.round(max / 16));
  return (
    <div className="ecx-unit-row">
      <div className="ecx-unit-input">
        <input type="number" inputMode="decimal" aria-label={label} value={n} placeholder={p ? undefined : value ?? placeholder ?? ""} step={unit === "px" || unit === "%" ? 1 : 0.1}
          onChange={(e) => { setN(e.target.value); emit(e.target.value, unit); }} />
        <select aria-label={`${label}: ${t.unit}`} value={unit} onChange={(e) => { setUnit(e.target.value); if (n !== "") emit(n, e.target.value); }}>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      {slider && <input type="range" className="ecx-unit-slider" aria-label={`${label}: ${t.slider}`} min={0} max={sliderMax} step={unit === "px" || unit === "%" ? 1 : 0.1} value={n === "" ? 0 : Math.min(sliderMax, Number(n))}
        onChange={(e) => { setN(e.target.value); emit(e.target.value, unit); }} />}
    </div>
  );
}

/** Thanh kéo theo bậc preset + nút sang giá trị tuỳ chỉnh. */
function StepSlider({ value, steps, onChange, label, sideIcon }: { value?: string; steps: string[]; onChange(v: string | undefined): void; label: string; sideIcon?: string }) {
  const t = useMsgs("controls");
  const isPreset = value === undefined || steps.includes(value);
  const [custom, setCustom] = useState(!isPreset);
  useEffect(() => { if (!isPreset) setCustom(true); }, [isPreset]);
  const idx = value === undefined ? -1 : steps.indexOf(value);
  return (
    <div className="ecx-step-row">
      {sideIcon && <span className={cx("ecx-side-icon", sideIcon)} aria-hidden="true" />}
      {custom
        ? <UnitInput label={label} value={isPreset ? undefined : value} onChange={onChange} max={120} />
        : (
          <div className="ecx-steps">
            <input type="range" aria-label={label} min={-1} max={steps.length - 1} step={1} value={idx} aria-valuetext={idx < 0 ? "—" : steps[idx]}
              onChange={(e) => { const i = Number(e.target.value); onChange(i < 0 ? undefined : steps[i]); }} />
            <span className="ecx-step-value">{idx < 0 ? "—" : steps[idx].toUpperCase()}</span>
          </div>
        )}
      <button type="button" className={cx("ecx-tool", custom && "is-active")} aria-pressed={custom} title={custom ? (t.usePresets) : (t.customValue)} aria-label={`${label}: ${custom ? (t.usePresets2) : (t.customValue2)}`}
        onClick={() => { setCustom(!custom); if (custom && !isPreset) onChange(undefined); }}><SlidersHorizontal className="ecx-icon ecx-icon-sm" /></button>
    </div>
  );
}

type Box = string | Record<string, string> | undefined;
const sidesOf = (v: Box): Record<string, string> => (typeof v === "object" && v ? v : v ? { top: v, right: v, bottom: v, left: v } : {});

/** Lề trong / ngoài: liên kết (một giá trị) hoặc dọc + ngang. */
export function SpacingControl({ label, value, onChange, steps, inherited, labels }: {
  label: string; value: Box; onChange(v: Box): void; steps: string[]; inherited?: string; labels: { vertical: string; horizontal: string; link: string; unlink: string; top: string; right: string; bottom: string; left: string };
}) {
  const sides = sidesOf(value);
  const [linked, setLinked] = useState(typeof value !== "object" || value === null || (sides.top === sides.bottom && sides.left === sides.right && sides.top === sides.left));
  const ok = (v: string) => !!normalizeStyle({ padding: v });
  const set = (keys: string[], v: string | undefined) => {
    if (v !== undefined && !ok(v)) return;
    const next = { ...sides };
    for (const k of keys) { if (v === undefined) delete next[k]; else next[k] = v; }
    const vals = Object.values(next);
    onChange(!vals.length ? undefined : vals.length === 4 && vals.every((x) => x === vals[0]) ? vals[0] : next);
  };
  return (
    <div className="ecx-spacing">
      <div className="ecx-spacing-head">
        <span className="ecx-field-label">{label}{inherited && <em className="ecx-inherit">{inherited}</em>}</span>
        <button type="button" className="ecx-tool" aria-pressed={linked} title={linked ? labels.unlink : labels.link} aria-label={`${label}: ${linked ? labels.unlink : labels.link}`} onClick={() => setLinked(!linked)}>
          {linked ? <Link2 className="ecx-icon ecx-icon-sm" /> : <Link2Off className="ecx-icon ecx-icon-sm" />}
        </button>
      </div>
      {linked
        ? <StepSlider label={label} steps={steps} value={typeof value === "string" ? value : sides.top} onChange={(v) => set(["top", "right", "bottom", "left"], v)} sideIcon="is-all" />
        : <>
            {/* Bỏ liên kết: bốn cạnh riêng (đặt lệch được, vd chỉ padding-bottom) */}
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <StepSlider key={side} label={`${label} ${labels[side]}`} steps={steps} value={sides[side]} onChange={(v) => set([side], v)} sideIcon={`is-${side}`} />
            ))}
          </>}
    </div>
  );
}
