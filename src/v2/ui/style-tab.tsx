import { normalizeStyle, type BlockStyle, type Device } from "@ecomcx/ecomweb-content";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Monitor, Smartphone, Tablet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { enLabels, viLabels, type EditorLabels } from "../../shared/labels";
import { useEditor } from "../context";
import { ColorInput } from "./color-field";
import { LayoutEffectsPanel } from "./layout-panel";
import { Section, Seg, cx } from "./style-controls";
import { SpacingControl, UnitInput } from "./unit-controls";

/**
 * Tab Kiểu dáng của khối (attrs.style, @ecomcx/ecomweb-content): một giao diện thống nhất cho chữ, màu, khoảng cách,
 * viền, bố cục, nền / hiệu ứng, hover và hiển thị. Thuộc tính theo khổ màn hình sửa theo khổ đang chọn ở đầu tab;
 * chưa đặt cho khổ nhỏ thì hiện giá trị kế thừa từ khổ lớn hơn.
 */
type Style = BlockStyle & Record<string, any>;
const RESPONSIVE = new Set(["padding", "margin", "gap", "width", "maxWidth", "minHeight", "fontSize", "lineHeight", "letterSpacing", "textAlign"]);
const SIZES = ["sm", "md", "lg", "xl", "2xl"];
const SPACES = ["0", "xs", "sm", "md", "lg", "xl", "2xl"];
const WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"];
const TYPO = ["fontFamily", "fontSize", "lineHeight", "letterSpacing", "fontWeight", "fontStyle", "textDecoration", "textTransform", "textAlign"];
const SPACING = ["padding", "margin", "gap", "width", "maxWidth", "minHeight"];

/** Ô giá trị (preset như `lg` hoặc `16px`, `1.5rem`…): lưu khi rời ô / Enter; sai thì viền đỏ, không lưu. */
function ValueInput({ value, onCommit, check, placeholder, label, inherited }: { value?: string | number; onCommit(v: string | null): void; check(v: string): boolean; placeholder?: string; label: string; inherited?: string }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(value == null ? "" : String(value)); setBad(false); }, [value]);
  const commit = () => {
    const v = text.trim();
    if (v === "") { setBad(false); if (value != null) onCommit(null); return; }
    if (!check(v)) { setBad(true); return; }
    setBad(false);
    if (v !== String(value ?? "")) onCommit(v);
  };
  return <input type="text" className="ecx-input" value={text} placeholder={inherited ?? placeholder} aria-label={label} aria-invalid={bad || undefined}
    onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />;
}

export function StyleTab({ type, style: raw, onChange, device, onDeviceChange, variants, variant, onVariantChange }: {
  type: string; style: unknown; onChange(style: BlockStyle | null): void; device: Device; onDeviceChange(d: Device): void;
  variants?: Array<{ name: string; label: string }>; variant?: string | null; onVariantChange?(v: string | null): void;
}) {
  const { host, labels } = useEditor();
  const t = labels.lang === "vi" ? viLabels : enLabels;
  const presets = host.presets;
  const sizes = presets?.fontSizes ? Object.keys(presets.fontSizes) : SIZES;
  const spaces = presets?.spacing ? ["0", ...Object.keys(presets.spacing)] : SPACES;
  const fonts = presets?.fonts ? Object.keys(presets.fonts) : ["body", "heading", "mono"];
  const style: Style = (normalizeStyle(raw) ?? {}) as Style;

  const commit = (next: Style) => onChange(normalizeStyle(next) ?? null);
  const get = (k: string): any => (RESPONSIVE.has(k) ? style[k]?.[device] : style[k]);
  const inherited = (k: string): string | undefined => {
    if (!RESPONSIVE.has(k) || device === "base" || get(k) !== undefined) return undefined;
    const v = device === "mobile" ? style[k]?.tablet ?? style[k]?.base : style[k]?.base;
    return v === undefined ? undefined : `${t.inherited}: ${typeof v === "object" ? "…" : v}`;
  };
  const set = (k: string, v: unknown) => {
    const next: Style = { ...style };
    if (RESPONSIVE.has(k)) {
      const r = { ...(style[k] ?? {}) };
      if (v === undefined || v === null || v === "") delete r[device]; else r[device] = v;
      next[k] = Object.keys(r).length ? r : undefined;
    } else next[k] = v === "" ? undefined : v;
    commit(next);
  };
  const setGroup = (k: "color" | "border", sub: string, v: unknown) => set(k, { ...(style[k] ?? {}), [sub]: v });
  const reset = (keys: string[]) => { const next: Style = { ...style }; for (const k of keys) delete next[k]; commit(next); };
  const has = (keys: string[]) => keys.some((k) => style[k] !== undefined);
  const ok = (k: string) => (v: string) => !!normalizeStyle({ [k]: v });
  const tag = (k: string) => RESPONSIVE.has(k) && device !== "base" ? <em className="ecx-device-tag">{t[`device_${device}` as keyof EditorLabels]}</em> : null;
  const row = (k: string, label: string, control: ReactNode) => (
    <div className="ecx-style-row" key={k}><span className="ecx-field-label">{label}{tag(k)}</span>{control}</div>
  );
  const appearance = `${style.fontWeight ?? ""}${style.fontStyle === "italic" ? "i" : ""}`;

  return (
    <div className="ecx-style-tab">
      <div className="ecx-style-device">
        <span className="ecx-field-label">{t.device}</span>
        <Seg label={t.device} value={device} onChange={(d) => onDeviceChange(d ?? "base")}
          options={[["base", Monitor, t.device_base], ["tablet", Tablet, t.device_tablet], ["mobile", Smartphone, t.device_mobile]]} />
      </div>

      {variants && variants.length > 0 && (
        <div className="ecx-style-row">
          <span className="ecx-field-label">{t.blockVariant}</span>
          <div role="radiogroup" aria-label={t.blockVariant} className="ecx-seg is-text">
            {[{ name: "", label: t.variant_default }, ...variants].map((v) => (
              <button key={v.name || "default"} type="button" role="radio" aria-checked={(variant ?? "") === v.name} className={cx("ecx-seg-btn", (variant ?? "") === v.name && "is-active")}
                onClick={() => onVariantChange?.(v.name || null)}>{v.label}</button>
            ))}
          </div>
        </div>
      )}

      <Section title={t.style_typography} modified={has(TYPO)} onReset={() => reset(TYPO)} moreOpen={has(["fontFamily", "letterSpacing", "textDecoration", "textTransform"])}
        more={<>
          {row("fontFamily", t.style_fontFamily,
            <select className="ecx-input" value={style.fontFamily ?? ""} aria-label={t.style_fontFamily} onChange={(e) => set("fontFamily", e.target.value || undefined)}>
              <option value="">{t.default}</option>
              {fonts.map((f) => <option key={f} value={f}>{(t as unknown as Record<string, string>)[`font_${f}`] ?? f}</option>)}
            </select>)}
          {row("letterSpacing", t.style_letterSpacing, <ValueInput label={t.style_letterSpacing} value={get("letterSpacing")} inherited={inherited("letterSpacing")} check={ok("letterSpacing")} placeholder="1px, 0.05em" onCommit={(v) => set("letterSpacing", v)} />)}
          {row("decoration", t.style_decoration, <Seg label={t.style_decoration} value={style.textDecoration} onChange={(v) => set("textDecoration", v)}
            options={[["none", "—", t.none], ["underline", "U̲", t.underlineText], ["line-through", "S̶", t.strikeText]]} />)}
          {row("transform", t.style_transform, <Seg label={t.style_transform} value={style.textTransform} onChange={(v) => set("textTransform", v)}
            options={[["none", "—", t.none], ["uppercase", "AB", t.upper], ["lowercase", "ab", t.lower], ["capitalize", "Ab", t.capitalize]]} />)}
        </>}>
        {row("fontSize", t.style_fontSize, <>
          <Seg label={t.style_fontSize} value={get("fontSize")} onChange={(v) => set("fontSize", v)} options={sizes.map((v) => [v, v.toUpperCase(), v] as [string, string, string])} />
          <ValueInput label={`${t.style_fontSize}: ${t.custom}`} value={sizes.includes(get("fontSize")) ? undefined : get("fontSize")} inherited={inherited("fontSize")} check={ok("fontSize")} placeholder="18px, 1.25rem" onCommit={(v) => set("fontSize", v)} />
        </>)}
        {row("appearance", t.style_appearance,
          <select className="ecx-input" value={appearance} aria-label={t.style_appearance} onChange={(e) => {
            const v = e.target.value;
            commit({ ...style, fontWeight: v.replace("i", "") || undefined, fontStyle: v.endsWith("i") ? "italic" : undefined });
          }}>
            <option value="">{t.default}</option>
            {WEIGHTS.flatMap((w) => [<option key={w} value={w}>{t[`weight_${w}` as keyof EditorLabels]}</option>, <option key={`${w}i`} value={`${w}i`}>{t[`weight_${w}` as keyof EditorLabels]} {t.italicSuffix}</option>])}
          </select>)}
        {row("lineHeight", t.style_lineHeight, <ValueInput label={t.style_lineHeight} value={get("lineHeight")} inherited={inherited("lineHeight")} check={ok("lineHeight")} placeholder="1.5" onCommit={(v) => set("lineHeight", v == null ? undefined : Number(v))} />)}
        {row("textAlign", t.textAlign, <Seg label={t.textAlign} value={get("textAlign")} onChange={(v) => set("textAlign", v)}
          options={[["left", AlignLeft, t.alignLeft], ["center", AlignCenter, t.alignCenter], ["right", AlignRight, t.alignRight], ["justify", AlignJustify, t.alignJustify]]} />)}
      </Section>

      <Section title={t.style_color} modified={has(["color"])} onReset={() => reset(["color"])}>
        {row("text", t.style_text, <ColorInput label={t.style_text} value={style.color?.text} onChange={(v) => setGroup("color", "text", v)} />)}
        {row("background", t.style_background, <ColorInput label={t.style_background} value={style.color?.background} onChange={(v) => setGroup("color", "background", v)} />)}
      </Section>

      <Section title={t.style_spacing} modified={has(SPACING)} onReset={() => reset(SPACING)} moreOpen={has(["gap", "width", "maxWidth", "minHeight"])}
        more={<>{(["gap", "width", "maxWidth", "minHeight"] as const).map((k) =>
          row(k, t[`style_${k}`], <ValueInput label={t[`style_${k}`]} value={get(k)} inherited={inherited(k)} check={ok(k)} placeholder={k === "gap" ? "md, 24px" : "100%, 640px, 60vh"} onCommit={(v) => set(k, v)} />))}</>}>
        <SpacingControl label={t.style_padding} steps={spaces} value={get("padding")} inherited={inherited("padding")} onChange={(v) => set("padding", v)} labels={{ vertical: labels.lang === "vi" ? "dọc" : "vertical", horizontal: labels.lang === "vi" ? "ngang" : "horizontal", link: t.linkSides, unlink: t.unlinkSides }} />
        <SpacingControl label={t.style_margin} steps={spaces} value={get("margin")} inherited={inherited("margin")} onChange={(v) => set("margin", v)} labels={{ vertical: labels.lang === "vi" ? "dọc" : "vertical", horizontal: labels.lang === "vi" ? "ngang" : "horizontal", link: t.linkSides, unlink: t.unlinkSides }} />
      </Section>

      <Section title={t.style_border} modified={has(["border", "radius"])} onReset={() => reset(["border", "radius"])} defaultOpen={has(["border", "radius"])}>
        {row("borderWidth", t.style_borderWidth, <UnitInput label={t.style_borderWidth} value={style.border?.width} max={20} units={["px", "em", "rem"]} onChange={(v) => setGroup("border", "width", v)} />)}
        {row("borderStyle", t.style_borderStyle, <Seg label={t.style_borderStyle} value={style.border?.style} onChange={(v) => setGroup("border", "style", v)}
          options={[["solid", "—", t.border_solid], ["dashed", "- -", t.border_dashed], ["dotted", "···", t.border_dotted]]} />)}
        {row("borderColor", t.style_borderColor, <ColorInput label={t.style_borderColor} value={style.border?.color} onChange={(v) => setGroup("border", "color", v)} />)}
        {row("radius", t.style_radius, <UnitInput label={t.style_radius} value={typeof style.radius === "string" ? style.radius : undefined} max={60} units={["px", "%", "em", "rem"]} onChange={(v) => set("radius", v)} />)}
      </Section>

      <LayoutEffectsPanel type={type} style={raw} onChange={onChange} device={device} />

      <Section title={t.style_visibility} modified={has(["hide"])} onReset={() => reset(["hide"])} defaultOpen={has(["hide"])}>
        {(["desktop", "tablet", "mobile"] as const).map((d) => (
          <label key={d} className="ecx-check"><input type="checkbox" checked={!!style.hide?.includes(d)}
            onChange={(e) => set("hide", e.target.checked ? [...(style.hide ?? []), d] : (style.hide ?? []).filter((x) => x !== d))} /> {t[`hide_${d}`]}</label>
        ))}
      </Section>
    </div>
  );
}
