import { normalizeStyle, type BlockStyle, type Device } from "@ecomcx/ecomweb-content";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { labelsLegacy, type EditorLabels } from "../../shared/labels";
import { useEditor } from "../context";
import { ColorInput } from "./color-field";
import { GradientField } from "./layout-panel";
import { MotionPanel } from "./motion-panel";
import { Row, Section, Seg, StateTabs, cx } from "./style-controls";
import { styleGroups, type StyleGroup } from "./style-supports";
import { FourInput, SpacingControl, UnitInput } from "./unit-controls";
import { useMsgs } from "../i18n";

/**
 * Tab Kiểu dáng của khối (attrs.style, @ecomcx/ecomweb-content): một giao diện thống nhất cho chữ, màu, khoảng cách,
 * viền, bố cục, nền / hiệu ứng, hover và hiển thị. Thuộc tính theo khổ màn hình sửa theo khổ đang chọn ở đầu tab;
 * chưa đặt cho khổ nhỏ thì hiện giá trị kế thừa từ khổ lớn hơn.
 */
type Style = BlockStyle & Record<string, any>;
const RESPONSIVE = new Set(["padding", "margin", "gap", "width", "maxWidth", "minHeight", "fontSize", "lineHeight", "letterSpacing", "textAlign", "order"]);
const SIZES = ["sm", "md", "lg", "xl", "2xl"];
const SPACES = ["0", "xs", "sm", "md", "lg", "xl", "2xl"];
const WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"];
const TYPO = ["fontFamily", "fontSize", "lineHeight", "letterSpacing", "fontWeight", "fontStyle", "textDecoration", "textTransform", "textAlign"];
const SPACING = ["padding", "margin"];
const STRUCTURE = ["gap", "width", "maxWidth", "minHeight", "aspectRatio", "zIndex", "grow", "order"];
type State = "normal" | "hover";

/** Bậc preset theo cỡ tăng dần (theme có thể khai lộn thứ tự: lg trước md). Tên lạ giữ thứ tự khai, đứng sau. */
const STEP_ORDER = ["0", "none", "3xs", "2xs", "xxs", "xs", "sm", "md", "base", "lg", "xl", "2xl", "xxl", "3xl", "4xl", "5xl", "6xl"];
export const byStep = (keys: string[]) => [...keys].sort((a, b) => { const i = STEP_ORDER.indexOf(a), j = STEP_ORDER.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });

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

/**
 * `part`: "style" = biến thể, chữ, màu (tab Kiểu dáng); "advanced" = khoảng cách, viền, bố cục / hiệu ứng, hover, chuyển động, ẩn hiện
 * (tab Nâng cao — lớp chung của mọi khối như Advanced của Elementor); bỏ trống = tất cả. Ô Nền vẽ ở BackgroundControl.
 */
export function StyleTab({ type, style: raw, onChange, device, onDeviceChange, variants, variant, onVariantChange, part, lead, parts, structure }: {
  type: string; style: unknown; onChange(style: BlockStyle | null): void; device: Device; onDeviceChange(d: Device): void;
  variants?: Array<{ name: string; label: string }>; variant?: string | null; onVariantChange?(v: string | null): void; part?: "style" | "advanced";
  /** Mục vẽ sau Chữ / Màu (mục riêng của khối, ô Nền). */
  lead?: ReactNode;
  /** Ô đứng đầu mục Cấu trúc (vd thẻ HTML của khối chứa — là thuộc tính của khối, không nằm trong style). */
  structure?: ReactNode;
  /** Khối chia phần: các phần đứng đầu; Kiểu chữ / Màu chung của cả khối chỉ hiện khi đã có giá trị (nội dung cũ). */
  parts?: boolean;
}) {
  const { host, labels, registry } = useEditor();
  const t = labelsLegacy(labels.lang);
  const ct = useMsgs("controls");
  const lt = useMsgs("layout");
  const [colorState, setColorState] = useState<State>("normal");
  const [borderState, setBorderState] = useState<State>("normal");
  const presets = host.presets;
  const sizes = presets?.fontSizes ? byStep(Object.keys(presets.fontSizes)) : SIZES;
  const spaces = presets?.spacing ? ["0", ...byStep(Object.keys(presets.spacing))] : SPACES;
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
  const setGroup = (k: "color" | "border" | "link", sub: string, v: unknown) => set(k, { ...(style[k] ?? {}), [sub]: v });
  // Khoá theo khổ (cỡ chữ, khoảng cách…): chỉ bỏ giá trị của khổ đang chọn, không xoá các khổ khác
  const reset = (keys: string[]) => {
    const next: Style = { ...style };
    for (const k of keys) {
      if (RESPONSIVE.has(k) && device !== "base" && style[k] && typeof style[k] === "object") {
        const r = { ...style[k] }; delete r[device];
        next[k] = Object.keys(r).length ? r : undefined;
      } else delete next[k];
    }
    commit(next);
  };
  const has = (keys: string[]) => keys.some((k) => RESPONSIVE.has(k) && device !== "base" ? style[k]?.[device] !== undefined : style[k] !== undefined);
  const ok = (k: string) => (v: string) => !!normalizeStyle({ [k]: v });
  // Ô chuẩn: cụm khổ màn hình nếu ô chỉnh theo khổ; nút ↶ khi ô (ở khổ đang xem) đã có giá trị
  const KEYS: Record<string, string[]> = { appearance: ["fontWeight", "fontStyle"], decoration: ["textDecoration"], transform: ["textTransform"], borderWidth: [], borderStyle: [], borderColor: [] };
  const row = (k: string, label: string, control: ReactNode) => {
    const keys = KEYS[k] ?? [k];
    return <Row key={k} label={label} device={RESPONSIVE.has(k) ? device : undefined} onReset={keys.length && has(keys) ? () => reset(keys) : undefined}>{control}</Row>;
  };
  // Nhóm khối hỗ trợ; nhóm đã có giá trị vẫn hiện để sửa / xoá (dữ liệu cũ, khối dán từ nơi khác)
  const groups = styleGroups(type, registry.get(type));
  // Như bộ khối lớn: Kiểu dáng = chữ, màu, viền, nền & hiệu ứng, khi rê chuột; Nâng cao = khoảng cách, bố cục, ghim, chuyển động, hiển thị
  const inPart = (g: StyleGroup) => !part || (part === "style") === ["typography", "color", "border"].includes(g);
  const show = (g: StyleGroup, keys: string[]) => inPart(g) && ((groups.has(g) && !(parts && (g === "typography" || g === "color"))) || keys.some((k) => style[k] !== undefined));
  const container = registry.get(type)?.kind === "container";
  // Trạng thái rê chuột nằm ngay trong mục Màu / Viền (công tắc Thường · Rê chuột), không còn mục "Khi rê chuột" riêng
  const hoverOk = groups.has("hover") || style.hover !== undefined;
  const fxOk = groups.has("effects") || ["gradient", "shadow", "aspectRatio", "position"].some((k) => style[k] !== undefined);
  const setHover = (patch: NonNullable<BlockStyle["hover"]>) => set("hover", { ...style.hover, ...patch });
  const shadows = ["sm", "md", "lg", "xl", ...Object.keys(presets?.shadows ?? {}).filter((x) => !["sm", "md", "lg", "xl"].includes(x))];
  const shadowSelect = (value: string | undefined, onPick: (v: string | undefined) => void, label: string, none = true) => (
    <select className="ecx-input" aria-label={label} value={value ?? ""} onChange={(e) => onPick(e.target.value || undefined)}>
      <option value="">—</option>{none && <option value="none">{lt.none}</option>}
      {shadows.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}
    </select>
  );
  const appearance = `${style.fontWeight ?? ""}${style.fontStyle === "italic" ? "i" : ""}`;

  return (
    <div className="ecx-style-tab">

      {part !== "advanced" && variants && variants.length > 0 && (
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

      {parts && lead}

      {show("typography", TYPO) && <Section title={t.style_typography} modified={has(TYPO)} onReset={() => reset(TYPO)} moreOpen={has(["fontFamily", "letterSpacing", "textDecoration", "textTransform"])}
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
          <Seg label={t.style_fontSize} value={get("fontSize")} onChange={(v) => set("fontSize", v)} options={sizes.map((v) => [v, v.toUpperCase(), presets?.fontSizes?.[v] ? `${v} · ${presets.fontSizes[v]}` : v] as [string, string, string])} />
          {/* Cỡ tuỳ chỉnh: ô số + đơn vị + thanh kéo (preset chọn ở hàng trên; giá trị clamp() cũ hiện làm gợi ý) */}
          <UnitInput label={`${t.style_fontSize}: ${t.custom}`} value={sizes.includes(get("fontSize")) ? undefined : get("fontSize")} placeholder={inherited("fontSize") ?? "18px"} units={["px", "rem", "em"]} max={96} onChange={(v) => set("fontSize", v)} />
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
      </Section>}

      {show("color", ["color", "textGradient", "link"]) && <Section title={t.style_color} modified={has(["color", "textGradient", "link"]) || !!style.hover?.color} onReset={() => commit({ ...style, color: undefined, textGradient: undefined, link: undefined, hover: style.hover && { ...style.hover, color: undefined } })}>
        {hoverOk && <StateTabs value={colorState} onChange={setColorState} />}
        {hoverOk && colorState === "hover" ? <>
          <ColorInput label={t.style_text} value={style.hover?.color?.text} onChange={(v) => setHover({ color: { ...style.hover?.color, text: v } })} />
          {!groups.has("background") && <ColorInput label={t.style_background} value={style.hover?.color?.background} onChange={(v) => setHover({ color: { ...style.hover?.color, background: v } })} />}
          {container && <ColorInput label={t.style_linkHover} value={style.link?.hover} onChange={(v) => setGroup("link", "hover", v)} />}
        </> : <>
          <ColorInput label={t.style_text} value={style.color?.text} onChange={(v) => setGroup("color", "text", v)} />
          {/* Khối có ô Nền: màu nền / nền chuyển màu sửa ở đó (một chỗ) */}
          {!groups.has("background") && <ColorInput label={t.style_background} value={style.color?.background} onChange={(v) => setGroup("color", "background", v)} />}
          {!groups.has("background") && fxOk && <Row label={lt.gradient} onReset={has(["gradient"]) ? () => reset(["gradient"]) : undefined}><GradientField value={style.gradient} onChange={(v) => set("gradient", v)} /></Row>}
          <Row label={t.style_textGradient} onReset={has(["textGradient"]) ? () => reset(["textGradient"]) : undefined}><GradientField value={style.textGradient} onChange={(v) => set("textGradient", v)} /></Row>
          {/* Khối chứa: màu liên kết của nội dung bên trong (Đoạn / Tiêu đề có mục Liên kết riêng) */}
          {container && <ColorInput label={t.style_link} value={style.link?.color} onChange={(v) => setGroup("link", "color", v)} />}
          {container && !hoverOk && <ColorInput label={t.style_linkHover} value={style.link?.hover} onChange={(v) => setGroup("link", "hover", v)} />}
        </>}
      </Section>}

      {!parts && lead}

      {show("spacing", SPACING) && <Section title={t.style_spacing} modified={has(SPACING)} onReset={() => reset(SPACING)}>
        <SpacingControl kind="padding" device={device} onReset={has(["padding"]) ? () => reset(["padding"]) : undefined} label={t.style_padding} steps={spaces} value={get("padding")} inherited={inherited("padding")} onChange={(v) => set("padding", v)} labels={{ vertical: ct.vertical, horizontal: ct.horizontal, top: ct.sideTop, right: ct.sideRight, bottom: ct.sideBottom, left: ct.sideLeft, link: t.linkSides, unlink: t.unlinkSides }} />
        <SpacingControl kind="margin" device={device} onReset={has(["margin"]) ? () => reset(["margin"]) : undefined} label={t.style_margin} steps={spaces} value={get("margin")} inherited={inherited("margin")} onChange={(v) => set("margin", v)} labels={{ vertical: ct.vertical, horizontal: ct.horizontal, top: ct.sideTop, right: ct.sideRight, bottom: ct.sideBottom, left: ct.sideLeft, link: t.linkSides, unlink: t.unlinkSides }} />
      </Section>}

      {/* Cấu trúc: kích thước khối (rộng, rộng tối đa, cao tối thiểu, tỉ lệ khung), khe giữa khối con */}
      {inPart("spacing") && (groups.has("spacing") || has(STRUCTURE)) && <Section title={ct.structure} modified={has(STRUCTURE)} onReset={() => reset(STRUCTURE)} defaultOpen={has(STRUCTURE)}>
        {structure}
        {(["width", "maxWidth", "minHeight", ...(container ? ["gap" as const] : [])] as const).map((k) =>
          row(k, t[`style_${k}`], <ValueInput label={t[`style_${k}`]} value={get(k)} inherited={inherited(k)} check={ok(k)} placeholder={k === "gap" ? "md, 24px" : "100%, 640px, 60vh"} onCommit={(v) => set(k, v)} />))}
        {container && ([["zIndex", -1, 9999], ["grow", 0, 10], ["order", -10, 10]] as const).map(([k, min, max]) =>
          row(k, ct[k], <input className="ecx-input" type="number" min={min} max={max} step={1} aria-label={ct[k]} value={get(k) ?? ""} placeholder={inherited(k)}
            onChange={(e) => set(k, e.target.value === "" ? undefined : Number(e.target.value))} />))}
        {container && <p className="ecx-field-help">{ct.orderHelp}</p>}
        {fxOk && row("aspectRatio", lt.ratio,
          <select className="ecx-input" aria-label={lt.ratio} value={style.aspectRatio ?? ""} onChange={(e) => set("aspectRatio", e.target.value || undefined)}>
            <option value="">—</option>
            {["1/1", "4/3", "3/2", "16/9", "21/9", "3/4", "2/3", "9/16"].map((r) => <option key={r} value={r}>{r.replace("/", ":")}</option>)}
          </select>)}
      </Section>}

      {inPart("border") && (groups.has("border") || fxOk || hoverOk || has(["border", "radius"])) && <Section title={t.style_border} modified={has(["border", "radius", "shadow"]) || !!(style.hover?.border || style.hover?.shadow || style.hover?.lift)}
        onReset={() => commit({ ...style, border: undefined, radius: undefined, shadow: undefined, hover: style.hover && { ...style.hover, border: undefined, shadow: undefined, lift: undefined } })}
        defaultOpen={has(["border", "radius", "shadow"])}>
        {hoverOk && <StateTabs value={borderState} onChange={setBorderState} />}
        {hoverOk && borderState === "hover" ? <>
          <ColorInput label={t.style_borderColor} value={style.hover?.border?.color} onChange={(v) => setHover({ border: v ? { color: v } : undefined })} />
          <Row label={lt.shadow}>{shadowSelect(style.hover?.shadow, (v) => setHover({ shadow: v }), `${lt.hover} ${lt.shadow}`, false)}</Row>
          <label className="ecx-check"><input type="checkbox" checked={!!style.hover?.lift} onChange={(e) => setHover({ lift: e.target.checked || undefined })} /> {lt.lift}</label>
        </> : <>
          {(groups.has("border") || has(["border", "radius"])) && <>
            <FourInput label={t.style_borderWidth} keys={["top", "right", "bottom", "left"]} keyLabels={{ top: ct.sideTop, right: ct.sideRight, bottom: ct.sideBottom, left: ct.sideLeft }} value={style.border?.width} max={20} units={["px", "em", "rem"]} onChange={(v) => setGroup("border", "width", v)} />
            {row("borderStyle", t.style_borderStyle, <Seg label={t.style_borderStyle} value={style.border?.style} onChange={(v) => setGroup("border", "style", v)}
              options={[["solid", "—", t.border_solid], ["dashed", "- -", t.border_dashed], ["dotted", "···", t.border_dotted]]} />)}
            <ColorInput label={t.style_borderColor} value={style.border?.color} onChange={(v) => setGroup("border", "color", v)} />
            <FourInput label={t.style_radius} corners keys={["topLeft", "topRight", "bottomRight", "bottomLeft"]} keyLabels={{ topLeft: ct.cornerTopLeft, topRight: ct.cornerTopRight, bottomRight: ct.cornerBottomRight, bottomLeft: ct.cornerBottomLeft }} value={style.radius} max={60} units={["px", "%", "em", "rem"]} onReset={has(["radius"]) ? () => reset(["radius"]) : undefined} onChange={(v) => set("radius", v)} />
          </>}
          {fxOk && row("shadow", lt.shadow, shadowSelect(style.shadow, (v) => set("shadow", v), lt.shadow))}
        </>}
      </Section>}

      {part === "advanced" && fxOk && <Section title={lt.sticky} modified={!!style.position} defaultOpen={!!style.position}>
        <label className="ecx-check"><input type="checkbox" checked={!!style.position} onChange={(e) => set("position", e.target.checked ? { type: "sticky" } : undefined)} /> {lt.sticky}</label>
      </Section>}

      {show("motion", ["motion"]) && <MotionPanel type={type} style={raw} onChange={onChange} />}

      {show("visibility", ["hide"]) && <Section title={t.style_visibility} modified={has(["hide"])} onReset={() => reset(["hide"])} defaultOpen={has(["hide"])}>
        {(["desktop", "tablet", "mobile"] as const).map((d) => (
          <label key={d} className="ecx-check"><input type="checkbox" checked={!!style.hide?.includes(d)}
            onChange={(e) => set("hide", e.target.checked ? [...(style.hide ?? []), d] : (style.hide ?? []).filter((x) => x !== d))} /> {t[`hide_${d}`]}</label>
        ))}
      </Section>}
    </div>
  );
}
