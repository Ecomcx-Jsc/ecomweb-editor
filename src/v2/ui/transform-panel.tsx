import { PLACE_TYPES, TRANSFORM_ORIGINS, normalizeStyle, type BlockStyle, type Device } from "@ecomcx/ecomweb-content";
import { useMsgs } from "../i18n";
import { Row, Section, Seg } from "./style-controls";
import { UnitInput } from "./unit-controls";

type Style = BlockStyle & Record<string, any>;
type Resp<T> = Partial<Record<Device, T>> | undefined;

/** Giá trị của khổ đang xem; chưa đặt thì hiện giá trị kế thừa (khổ lớn hơn) để người dùng biết đang thừa hưởng gì. */
const own = <T,>(r: Resp<T>, d: Device): T | undefined => r?.[d];
const inherit = <T,>(r: Resp<T>, d: Device): T | undefined => (d === "base" ? undefined : d === "mobile" ? r?.tablet ?? r?.base : r?.base);
const put = <T,>(r: Resp<T>, d: Device, v: T | undefined): Resp<T> => {
  const next = { ...(r ?? {}) };
  if (v === undefined) delete next[d]; else next[d] = v;
  return Object.keys(next).length ? next : undefined;
};

/**
 * Hai mục của tab Nâng cao: "Vị trí" (relative / absolute / fixed + lệch trên / phải / dưới / trái) và "Biến đổi" (xoay, phóng, nghiêng, dịch, điểm gốc).
 * Mọi giá trị theo khổ màn hình đang chọn (ở đầu tab); khổ nhỏ chưa đặt thì kế thừa khổ lớn — như Elementor.
 */
export function PlaceTransformPanels({ style, device, commit }: { style: Style; device: Device; commit(next: Style): void }) {
  const t = useMsgs("layout");
  const place = style.place as Style["place"];
  const tr = style.transform as Style["transform"];
  const setPlace = (patch: Partial<NonNullable<Style["place"]>> | null) => commit({ ...style, place: patch === null ? undefined : { ...(place ?? { type: "relative" }), ...patch } as never });
  const setTr = (patch: Partial<NonNullable<Style["transform"]>>) => {
    const next = { ...(tr ?? {}), ...patch } as NonNullable<Style["transform"]>;
    for (const k of Object.keys(next) as Array<keyof typeof next>) if (next[k] === undefined) delete next[k];
    commit({ ...style, transform: Object.keys(next).length ? next : undefined } as never);
  };
  const num = (key: "rotate" | "scale" | "skewX" | "skewY", label: string, min: number, max: number, step: number, unit: string) => {
    const v = own(tr?.[key], device), inh = inherit(tr?.[key], device);
    const shown = v ?? inh ?? (key === "scale" ? 1 : 0);
    return (
      <Row key={key} label={label} device={device} onReset={v !== undefined ? () => setTr({ [key]: put(tr?.[key], device, undefined) }) : undefined}>
        <div className="ecx-unit-row">
          <input type="range" className="ecx-range" min={min} max={max} step={step} aria-label={label} value={shown} onChange={(e) => setTr({ [key]: put(tr?.[key], device, Number(e.target.value)) })} />
          <span className="ecx-range-value">{shown}{unit}{v === undefined && inh !== undefined ? ` (${t.inheritedValue})` : ""}</span>
        </div>
      </Row>
    );
  };
  const len = (key: "x" | "y", label: string) => (
    <Row key={key} label={label} device={device}>
      <UnitInput label={label} value={own(tr?.[key], device)} placeholder={inherit(tr?.[key], device)} max={300} onChange={(v) => setTr({ [key]: put(tr?.[key], device, v) })} />
    </Row>
  );
  const side = (k: "top" | "right" | "bottom" | "left", label: string) => (
    <Row key={k} label={label} device={device}>
      <UnitInput label={`${t.placeTitle}: ${label}`} value={own(place?.[k], device)} placeholder={inherit(place?.[k], device)} max={400} onChange={(v) => setPlace({ [k]: put(place?.[k], device, v) })} />
    </Row>
  );
  return (
    <>
      <Section title={t.placeTitle} modified={!!place} defaultOpen={!!place} onReset={() => setPlace(null)} summary={place ? (t as Record<string, string>)[`placeType${place.type[0].toUpperCase()}${place.type.slice(1)}`] : undefined}>
        <Row label={t.placeType}>
          <Seg label={t.placeType} value={place?.type} options={[...PLACE_TYPES.map((p): [typeof p, string, string] => { const l = (t as Record<string, string>)[`placeType${p[0].toUpperCase()}${p.slice(1)}`]; return [p, l, l]; })]} onChange={(v) => (v ? setPlace({ type: v }) : setPlace(null))} />
        </Row>
        {place && <>{side("top", t.placeTop)}{side("right", t.placeRight)}{side("bottom", t.placeBottom)}{side("left", t.placeLeft)}<p className="ecx-field-help">{place.type === "absolute" ? t.placeHelpAbsolute : place.type === "fixed" ? t.placeHelpFixed : t.placeHelpRelative}</p></>}
      </Section>
      <Section title={t.transformTitle} modified={!!tr} defaultOpen={!!tr} onReset={() => commit({ ...style, transform: undefined } as never)}>
        {num("rotate", t.rotate, -180, 180, 1, "°")}
        {num("scale", t.scale, 0.1, 3, 0.05, "×")}
        {num("skewX", t.skewX, -45, 45, 1, "°")}
        {num("skewY", t.skewY, -45, 45, 1, "°")}
        {len("x", t.moveX)}
        {len("y", t.moveY)}
        <Row label={t.origin}>
          <select className="ecx-input" aria-label={t.origin} value={tr?.origin ?? "center"} onChange={(e) => setTr({ origin: e.target.value === "center" ? undefined : e.target.value })}>
            {TRANSFORM_ORIGINS.map((o) => <option key={o} value={o}>{(t as Record<string, string>)[`origin_${o.replace(" ", "_")}`]}</option>)}
          </select>
        </Row>
      </Section>
    </>
  );
}
