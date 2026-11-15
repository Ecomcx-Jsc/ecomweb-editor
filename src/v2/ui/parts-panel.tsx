import { normalizeParts, normalizeStyle, partsFor, type BlockStyle, type Device, type PartProp, type PartSpec, type PartValue } from "@ecomcx/ecomweb-content";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { useState } from "react";
import { blockControls } from "../../shared/panel-store";
import { useEditor } from "../context";
import { useMsgs } from "../i18n";
import { ColorInput } from "./color-field";
import { Row, Section, Seg, cx } from "./style-controls";
import { byStep } from "./style-tab";
import { SpacingControl, UnitInput } from "./unit-controls";

type Style = BlockStyle & Record<string, any>;
const RESPONSIVE = new Set(["padding", "margin", "fontSize", "lineHeight", "textAlign", "width", "minHeight"]);
const WEIGHTS = ["400", "500", "600", "700", "800"];
const SHADOWS = ["sm", "md", "lg", "xl"];

/** Nhãn phần: "%part.box%" → chữ theo ngôn ngữ của trình soạn; nhãn của plugin dịch qua host.translate. */
function usePartLabel() {
  const { host } = useEditor();
  const t = useMsgs("parts") as Record<string, string>;
  return (label: string) => { const m = /^%part\.(\w+)%$/.exec(label); return m ? t[m[1]] ?? m[1] : host.translate ? host.translate(label) : label; };
}

/** Phần tử của phần trong khung soạn (để tô vùng đệm / lề đúng phần đó). */
const partEl = (blockEl: HTMLElement | null, spec: PartSpec) => {
  if (!blockEl) return null;
  const suffix = spec.selector.slice(11).trim();
  if (!suffix) return blockEl;
  try { return blockEl.querySelector<HTMLElement>(suffix.startsWith(">") ? `:scope ${suffix}` : suffix); } catch { return null; }
};

/**
 * Các mục của tab Kiểu dáng theo PHẦN của khối (content PartSpec): Khung, Icon, Tiêu đề… — mỗi phần một bộ kiểu dáng đầy đủ,
 * công tắc "Hiện", thẻ Thường / Rê chuột (rê lên cả khối). Lưu ở attrs.parts; CSS sinh bằng controlsCss (khung soạn = website).
 */
export function PartsSections({ blockId, type, attrs, setAttrs, device }: { blockId: string; type: string; attrs: Record<string, unknown>; setAttrs(a: Record<string, unknown>): void; device: Device }) {
  const parts = partsFor(blockControls(), type);
  const label = usePartLabel();
  if (!parts.length) return null;
  const values = normalizeParts(attrs.parts) ?? {};
  const write = (name: string, v: PartValue | undefined) => {
    const next = { ...values };
    if (v && Object.keys(v).length) next[name] = v; else delete next[name];
    setAttrs({ parts: Object.keys(next).length ? next : undefined });
  };
  return <>{parts.map(([name, spec]) => <PartSection key={name} blockId={blockId} name={name} spec={spec} title={label(spec.label)} value={values[name] ?? {}} onChange={(v) => write(name, v)} device={device} />)}</>;
}

function PartSection({ blockId, spec, title, value, onChange, device }: { blockId: string; name: string; spec: PartSpec; title: string; value: PartValue; onChange(v: PartValue | undefined): void; device: Device }) {
  const { ui } = useEditor();
  const t = useMsgs("parts") as Record<string, string>;
  const [state, setState] = useState<"normal" | "hover" | "active">("normal");
  const states = (["normal", ...(spec.hover ? ["hover"] : []), ...(spec.active ? ["active"] : [])] as Array<"normal" | "hover" | "active">);
  const shown = !value.hidden;
  const modified = !!(value.style || value.hover || value.active || value.hidden);
  const toggle = spec.toggle ? (
    <input type="checkbox" role="switch" className="ecx-switch" checked={shown} title={t.show} aria-label={`${t.show}: ${title}`}
      onChange={() => onChange({ ...value, hidden: shown ? true : undefined })} />
  ) : undefined;
  const key = state === "normal" ? "style" : state;
  const style = (value[key] ?? {}) as Style;
  const setStyle = (next: Style) => onChange({ ...value, [key]: normalizeStyle(next) });
  return (
    <Section title={title} head={toggle} modified={modified} onReset={() => onChange(value.hidden ? { hidden: true } : undefined)} defaultOpen={undefined}>
      {!shown ? <p className="ecx-muted">{t.hiddenNote}</p> : <>
        {states.length > 1 && (
          <div className="ecx-seg is-text ecx-state-tabs" role="tablist">
            {states.map((s) => <button key={s} type="button" role="tab" aria-selected={state === s} className={cx("ecx-seg-btn", state === s && "is-active")} onClick={() => setState(s)}>{t[s]}</button>)}
          </div>
        )}
        <PartControls props={spec.props} style={style} onChange={setStyle} device={device} hover={state !== "normal"} target={() => partEl(ui.blockEl(blockId), spec)} />
      </>}
    </Section>
  );
}

/** Ô của một phần theo nhóm thuộc tính khai (typography, color, background, border, radius, shadow, padding, margin, size, iconSize). */
function PartControls({ props, style, onChange, device, hover, target }: { props: readonly PartProp[]; style: Style; onChange(s: Style): void; device: Device; hover: boolean; target(): HTMLElement | null }) {
  const { host } = useEditor();
  const t = useMsgs("parts") as Record<string, string>;
  const ct = useMsgs("controls");
  const sizes = host.presets?.fontSizes ? byStep(Object.keys(host.presets.fontSizes)) : ["sm", "md", "lg", "xl", "2xl"];
  const spaces = host.presets?.spacing ? ["0", ...byStep(Object.keys(host.presets.spacing))] : ["0", "xs", "sm", "md", "lg", "xl", "2xl"];
  const get = (k: string): any => (RESPONSIVE.has(k) ? style[k]?.[device] : style[k]);
  const set = (k: string, v: unknown) => {
    const next: Style = { ...style };
    if (RESPONSIVE.has(k)) { const r = { ...(style[k] ?? {}) }; if (v === undefined || v === null || v === "") delete r[device]; else r[device] = v; next[k] = Object.keys(r).length ? r : undefined; }
    else next[k] = v === "" ? undefined : v;
    onChange(next);
  };
  const reset = (k: string) => () => set(k, undefined);
  const has = (k: string) => get(k) !== undefined;
  const dev = (k: string) => (RESPONSIVE.has(k) ? device : undefined);
  // Rê chuột: chỉ nhóm đổi được khi rê (màu, nền, viền, bóng)
  const p = hover ? props.filter((x) => ["color", "background", "border", "shadow"].includes(x)) : props;
  const labels = { vertical: ct.vertical, horizontal: ct.horizontal, top: ct.sideTop, right: ct.sideRight, bottom: ct.sideBottom, left: ct.sideLeft, link: ct.linkSides, unlink: ct.unlinkSides };
  return (
    <>
      {p.includes("typography") && <>
        <Row label={t.fontSize} device={dev("fontSize")} onReset={has("fontSize") ? reset("fontSize") : undefined}>
          <Seg label={t.fontSize} value={get("fontSize")} onChange={(v) => set("fontSize", v)} options={sizes.map((v) => [v, v.toUpperCase(), v] as [string, string, string])} />
          <UnitInput label={t.fontSize} value={sizes.includes(get("fontSize")) ? undefined : get("fontSize")} units={["px", "rem", "em"]} max={96} onChange={(v) => set("fontSize", v)} />
        </Row>
        <Row label={t.weight} onReset={has("fontWeight") ? reset("fontWeight") : undefined}>
          <Seg label={t.weight} value={style.fontWeight} onChange={(v) => set("fontWeight", v)} options={WEIGHTS.map((w) => [w, w, w] as [string, string, string])} />
        </Row>
        <Row label={t.align} device={dev("textAlign")} onReset={has("textAlign") ? reset("textAlign") : undefined}>
          <Seg label={t.align} value={get("textAlign")} onChange={(v) => set("textAlign", v)} options={[["left", AlignLeft, t.left], ["center", AlignCenter, t.center], ["right", AlignRight, t.right]]} />
        </Row>
      </>}
      {p.includes("iconSize") && <Row label={t.iconSize} device={dev("fontSize")} onReset={has("fontSize") ? reset("fontSize") : undefined}>
        <UnitInput label={t.iconSize} value={get("fontSize")} units={["px", "rem", "em"]} max={160} onChange={(v) => set("fontSize", v)} />
      </Row>}
      {p.includes("color") && <ColorInput label={t.color} value={style.color?.text} onChange={(v) => set("color", { ...style.color, text: v })} />}
      {p.includes("background") && <ColorInput label={t.background} value={style.color?.background} onChange={(v) => set("color", { ...style.color, background: v })} />}
      {p.includes("border") && <>
        <Row label={t.borderWidth} onReset={style.border?.width ? () => set("border", { ...style.border, width: undefined }) : undefined}>
          <UnitInput label={t.borderWidth} value={style.border?.width} units={["px"]} max={20} onChange={(v) => set("border", { style: "solid", ...style.border, width: v })} />
        </Row>
        <ColorInput label={t.borderColor} value={style.border?.color} onChange={(v) => set("border", { ...style.border, color: v })} />
      </>}
      {p.includes("radius") && <Row label={t.radius} onReset={has("radius") ? reset("radius") : undefined}>
        <UnitInput label={t.radius} value={typeof style.radius === "string" ? style.radius : undefined} units={["px", "%", "rem"]} max={80} onChange={(v) => set("radius", v)} />
      </Row>}
      {p.includes("shadow") && <Row label={t.shadow} onReset={has("shadow") ? reset("shadow") : undefined}>
        <Seg label={t.shadow} value={style.shadow} onChange={(v) => set("shadow", v)} options={[["none", "0", t.none], ...SHADOWS.map((s) => [s, s.toUpperCase(), s] as [string, string, string])]} />
      </Row>}
      {p.includes("size") && <>
        <Row label={t.width} device={dev("width")} onReset={has("width") ? reset("width") : undefined}><UnitInput label={t.width} value={get("width")} units={["px", "%", "rem"]} max={600} onChange={(v) => set("width", v)} /></Row>
        <Row label={t.height} device={dev("minHeight")} onReset={has("minHeight") ? reset("minHeight") : undefined}><UnitInput label={t.height} value={get("minHeight")} units={["px", "rem"]} max={600} onChange={(v) => set("minHeight", v)} /></Row>
      </>}
      {p.includes("padding") && <SpacingControl kind="padding" device={device} label={t.padding} steps={spaces} value={get("padding")} onChange={(v) => set("padding", v)} onReset={has("padding") ? reset("padding") : undefined} labels={labels} vizTarget={target} />}
      {p.includes("margin") && <SpacingControl kind="margin" device={device} label={t.margin} steps={spaces} value={get("margin")} onChange={(v) => set("margin", v)} onReset={has("margin") ? reset("margin") : undefined} labels={labels} vizTarget={target} />}
    </>
  );
}
