import { normalizeStyle } from "@ecomcx/ecomweb-content";
import { Link2, Link2Off } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEditor } from "../context";
import { Row, cx } from "./style-controls";
import type { Device } from "@ecomcx/ecomweb-content";
import { hideSpacingViz, showSpacingViz, type Side, type SpacingKind } from "../canvas/spacing-viz";
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
/** Đổi đơn vị giữ nguyên cỡ thật: px ↔ rem / em theo 16px (22px → 1.375rem). %, vw, vh phụ thuộc khung chứa → giữ số. */
export const convertUnit = (n: string, from: string, to: string): string => {
  const px = (u: string) => (u === "px" ? 1 : u === "rem" || u === "em" ? 16 : 0);
  if (n === "" || !px(from) || !px(to) || !Number.isFinite(Number(n))) return n;
  return String(Math.round((Number(n) * px(from)) / px(to) * 1000) / 1000);
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
        <select aria-label={`${label}: ${t.unit}`} value={unit} onChange={(e) => { const u = e.target.value, m = convertUnit(n, unit, u); setUnit(u); setN(m); if (m !== "") emit(m, u); }}>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      {slider && <input type="range" className="ecx-unit-slider" aria-label={`${label}: ${t.slider}`} min={0} max={sliderMax} step={unit === "px" || unit === "%" ? 1 : 0.1} value={n === "" ? 0 : Math.min(sliderMax, Number(n))}
        onChange={(e) => { setN(e.target.value); emit(e.target.value, unit); }} />}
    </div>
  );
}

type Box = string | Record<string, string> | undefined;
const sidesOf = (v: Box): Record<string, string> => (typeof v === "object" && v ? v : v ? { top: v, right: v, bottom: v, left: v } : {});
const SIDES: Side[] = ["top", "right", "bottom", "left"];

/**
 * Đệm / lề bốn cạnh: 4 ô Trên · Phải · Dưới · Trái (vạch đậm ở đúng cạnh, hiện tên bậc hoặc số), xích = 4 cạnh như nhau.
 * Rê chuột lên ô → khối đang chọn được tô vùng đệm (bên trong) / lề (bên ngoài) trên khung soạn. Bấm ô → bảng chọn bậc + giá trị tuỳ chỉnh.
 */
export function SpacingControl({ label, value, onChange, steps, inherited, labels, kind = "padding", device, onReset, vizTarget }: {
  label: string; value: Box; onChange(v: Box): void; steps: string[]; inherited?: string; labels: { vertical: string; horizontal: string; link: string; unlink: string; top: string; right: string; bottom: string; left: string };
  kind?: SpacingKind; device?: Device; onReset?(): void;
  /** Phần tử được tô (mặc định: khối đang chọn) — vd một phần của khối. */
  vizTarget?(): HTMLElement | null;
}) {
  const { store, ui } = useEditor();
  const t = useMsgs("controls");
  const sides = sidesOf(value);
  const [linked, setLinked] = useState(typeof value !== "object" || value === null || (sides.top === sides.bottom && sides.left === sides.right && sides.top === sides.left));
  const [open, setOpen] = useState<Side | null>(null);
  const hover = useRef<Side | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const ok = (v: string) => !!normalizeStyle({ padding: v });
  const blockEl = () => { if (vizTarget) return vizTarget(); const s = store.getState().selection; const id = s.ids[0] ?? s.editing; return id ? ui.blockEl(id) : null; };
  const names = () => Object.fromEntries(SIDES.map((s) => [s, sides[s] && steps.includes(sides[s]) ? sides[s].toUpperCase() : undefined])) as Partial<Record<Side, string>>;
  const viz = (side: Side | null) => { if (!side) { hideSpacingViz(ui.canvasDoc); return; } showSpacingViz(blockEl(), kind, linked ? SIDES : [side], names()); };
  // Giá trị đổi khi đang rê / đang mở bảng chọn: vẽ lại lớp tô sau khi khối nhận CSS mới
  useEffect(() => { const s = open ?? hover.current; if (!s) return; const r = requestAnimationFrame(() => viz(s)); return () => cancelAnimationFrame(r); });
  useEffect(() => () => hideSpacingViz(ui.canvasDoc), [ui]);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setOpen(null); viz(hover.current); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(null); viz(null); } };
    document.addEventListener("mousedown", out, true); document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", out, true); document.removeEventListener("keydown", esc, true); };
  });
  const set = (keys: string[], v: string | undefined) => {
    if (v !== undefined && !ok(v)) return;
    const next = { ...sides };
    for (const k of keys) { if (v === undefined) delete next[k]; else next[k] = v; }
    const vals = Object.values(next);
    onChange(!vals.length ? undefined : vals.length === 4 && vals.every((x) => x === vals[0]) ? vals[0] : next);
  };
  const target = (side: Side) => (linked ? SIDES : [side]);
  const shown = (v?: string) => (v === undefined ? "–" : steps.includes(v) ? (v === "0" ? "0" : v.toUpperCase()) : v);
  const cur = open ? sides[open] : undefined;
  return (
    <div className="ecx-box4" ref={ref} onMouseLeave={() => { hover.current = null; if (!open) viz(null); }}>
      <Row label={<>{label}{inherited && <em className="ecx-inherit">{inherited}</em>}</>} device={device} onReset={onReset}
        extra={<button type="button" className={cx("ecx-link-toggle", linked && "is-on")} aria-pressed={linked} title={linked ? labels.unlink : labels.link} aria-label={`${label}: ${linked ? labels.unlink : labels.link}`}
          onClick={() => setLinked(!linked)}>{linked ? <Link2 className="ecx-icon" /> : <Link2Off className="ecx-icon" />}</button>}>
        <div className="ecx-box4-grid">
          {SIDES.map((side) => (
            <button key={side} type="button" className={cx("ecx-box4-cell", `is-${side}`, sides[side] !== undefined && "is-set", open && target(open).includes(side) && "is-open")}
              aria-label={`${label} ${labels[side]}: ${shown(sides[side])}`} aria-haspopup="dialog" aria-expanded={open === side}
              onMouseEnter={() => { hover.current = side; viz(side); }} onFocus={() => viz(side)} onBlur={() => { if (!open) viz(null); }}
              onClick={() => setOpen(open === side ? null : side)}>
              <small>{labels[side]}</small><b>{shown(sides[side])}</b>
            </button>
          ))}
        </div>
      </Row>
      {open && (
        // key: đổi cạnh thì ô số mới, không giữ số đã gõ của cạnh trước
        <div key={open} className="ecx-box4-pop" role="dialog" aria-label={`${label} ${linked ? "" : labels[open]}`}>
          <div className="ecx-pop-title">{label}{linked ? "" : ` · ${labels[open]}`}</div>
          <div className="ecx-box4-steps" role="radiogroup" aria-label={label}>
            {steps.map((st) => (
              <button key={st} type="button" role="radio" aria-checked={cur === st} className={cx("ecx-chip", cur === st && "is-active")} onClick={() => set(target(open), st)}>{st === "0" ? "0" : st.toUpperCase()}</button>
            ))}
          </div>
          <UnitInput label={`${label}: ${t.customValue}`} value={cur && !steps.includes(cur) ? cur : undefined} max={160} onChange={(v) => set(target(open), v)} />
          <div className="ecx-pop-foot"><button type="button" className="ecx-link-btn" onClick={() => set(target(open), undefined)}>{t.reset}</button><button type="button" className="ecx-link-btn" onClick={() => { setOpen(null); viz(null); }}>OK</button></div>
        </div>
      )}
    </div>
  );
}
