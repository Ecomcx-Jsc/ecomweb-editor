import { coreControlsFor, optionValue, type ControlSpec, type Device } from "@ecomcx/ecomweb-content";
import { useState } from "react";
import { useMsgs } from "../i18n";
import { ColorInput } from "./color-field";
import { Row, Section, cx } from "./style-controls";
import { UnitInput } from "./unit-controls";

type State = "normal" | "hover" | "active";

/**
 * Mục Kiểu dáng riêng của khối lõi (như tab Style của từng widget Elementor: Danh sách › khoảng cách, đường kẻ; Icon › màu, cỡ…).
 * Ô khai ở @ecomcx/ecomweb-content core-controls → website và khung soạn sinh cùng CSS (controlsCss). Ô `responsive` sửa theo khổ
 * đang chọn ở đầu tab; ô có `state` nằm trong thẻ Rê chuột / Đang mở của mục.
 */
export function BlockStyleSections({ type, attrs, setAttrs, device }: { type: string; attrs: Record<string, any>; setAttrs(a: Record<string, unknown>): void; device: Device }) {
  const t = useMsgs("blockStyle");
  const sections = new Map<string, Array<[string, ControlSpec]>>();
  for (const [name, spec] of Object.entries(coreControlsFor(type))) {
    const k = spec.section ?? "text";
    sections.set(k, [...(sections.get(k) ?? []), [name, spec]]);
  }
  if (!sections.size) return null;
  return <>{[...sections].map(([key, list]) => <ControlSection key={key} title={(t.section as Record<string, string>)[key] ?? key} list={list} attrs={attrs} setAttrs={setAttrs} device={device} />)}</>;
}

function ControlSection({ title, list, attrs, setAttrs, device }: { title: string; list: Array<[string, ControlSpec]>; attrs: Record<string, any>; setAttrs(a: Record<string, unknown>): void; device: Device }) {
  const t = useMsgs("blockStyle");
  const states = [...new Set(list.map(([, s]) => s.state ?? "normal"))] as State[];
  const [state, setState] = useState<State>("normal");
  const modified = list.some(([k]) => attrs[k] !== undefined);
  const shown = list.filter(([, s]) => (s.state ?? "normal") === state);
  return (
    <Section title={title} modified={modified} onReset={() => setAttrs(Object.fromEntries(list.map(([k]) => [k, undefined])))}>
      {states.length > 1 && (
        <div role="tablist" className="ecx-seg is-text ecx-state-tabs">
          {(["normal", "hover", "active"] as const).filter((s) => states.includes(s)).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={state === s} className={cx("ecx-seg-btn", state === s && "is-active")} onClick={() => setState(s)}>{t[s]}</button>
          ))}
        </div>
      )}
      {shown.map(([name, spec]) => <ControlField key={name} name={name} spec={spec} value={attrs[name]} device={device} onChange={(v) => setAttrs({ [name]: v })} />)}
    </Section>
  );
}

/** Một ô: giá trị theo khổ (`responsive`) lưu `{ base, tablet, mobile }`, khổ chưa đặt hiện giá trị kế thừa làm gợi ý. */
function ControlField({ name, spec, value, device, onChange }: { name: string; spec: ControlSpec; value: unknown; device: Device; onChange(v: unknown): void }) {
  const t = useMsgs("blockStyle");
  const label = (t.attr as Record<string, string>)[name] ?? name;
  const map = spec.responsive ? (value && typeof value === "object" ? value as Record<string, unknown> : value === undefined ? {} : { base: value }) : null;
  const v = map ? map[device] : value;
  const inherited = map && device !== "base" && v === undefined ? (device === "mobile" ? map.tablet ?? map.base : map.base) : undefined;
  const set = (x: unknown) => {
    if (!map) return onChange(x === "" ? undefined : x);
    const next = { ...map };
    if (x === undefined || x === "") delete next[device]; else next[device] = x;
    const keys = Object.keys(next);
    onChange(!keys.length ? undefined : keys.length === 1 && keys[0] === "base" ? next.base : next);
  };
  const dev = spec.responsive ? device : undefined;
  if (spec.type === "color") return <Row label={label} device={dev}><ColorInput label={label} value={typeof v === "string" ? v : undefined} onChange={set} /></Row>;
  if (spec.type === "length") return <Row label={label} device={dev}><UnitInput label={label} value={typeof v === "string" ? v : undefined} placeholder={typeof inherited === "string" ? inherited : undefined} units={["px", "rem", "em", "%"]} onChange={set} /></Row>;
  if (spec.type === "number") return (
    <Row label={`${label}${typeof v === "number" ? `: ${v}` : ""}`} device={dev}>
      <input type="range" className="ecx-range" min={spec.min} max={spec.max} step={spec.step ?? 1} value={typeof v === "number" ? v : spec.max ?? 1} aria-label={label}
        onChange={(e) => set(Number(e.target.value) === spec.max ? undefined : Number(e.target.value))} />
    </Row>
  );
  const opts = t.opt as Record<string, string>;
  return (
    <Row label={label} device={dev}>
      <select className="ecx-input" aria-label={label} value={typeof v === "string" ? v : ""} onChange={(e) => set(e.target.value || undefined)}>
        <option value="">{typeof inherited === "string" ? `↳ ${opts[inherited] ?? inherited}` : "—"}</option>
        {spec.options?.map((o) => { const x = optionValue(o); return <option key={x} value={x}>{opts[x] ?? x}</option>; })}
      </select>
    </Row>
  );
}
