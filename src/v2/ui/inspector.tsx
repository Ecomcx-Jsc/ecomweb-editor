import type { Device } from "@ecomcx/ecomweb-content";
import { CORE_BLOCK_STYLES, controlValue, optionValue } from "@ecomcx/ecomweb-content";
import { Blocks, Info, LayoutPanelTop, Paintbrush, SlidersHorizontal } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { blockPanelsFor, onBlockPanelsChange, type BlockPanel } from "../../shared/panel-store";
import { useEditor, useEditorState, useUiTick } from "../context";
import type { BNode } from "../core/model";
import { AttrForm, Field, attrName, cx } from "./attr-form";
import { BindingsPanel, CORE_BINDABLE } from "./bindings";
import { StyleTab } from "./style-tab";
import { Section, SectionGroup } from "./style-controls";
import { BackgroundControl } from "./background-panel";
import { BlockStyleSections } from "./block-style-panel";
import { PartsSections } from "./parts-panel";
import { PresetBar } from "./preset-bar";
import { blockControls } from "../../shared/panel-store";
import { styleGroups } from "./style-supports";
import { ColorInput } from "./color-field";
import { UnitInput } from "./unit-controls";
import { useMsgs } from "../i18n";

/** Khối "khung" (như Container / Section của Elementor): ô Nền đặt ngay tab Cài đặt — chỗ người dùng tìm đầu tiên. */
const BG_IN_SETTINGS = new Set(["group", "column", "cover"]);

/**
 * Bảng cài đặt của khối đang chọn (như Elementor): thẻ khối, tab Cài đặt (nội dung: form + phần riêng của khối), tab Kiểu dáng
 * (mục riêng của khối từ core-controls + ô Nền + chữ / màu) và tab Nâng cao (khoảng cách, viền, hiệu ứng, chuyển động, ẩn hiện, neo / class).
 */
export function Inspector({ blockStyles }: { blockStyles?: Record<string, Array<{ name: string; label: string }>> }) {
  const { store, registry, labels, ui } = useEditor();
  useUiTick();
  const t = useMsgs("controls");
  const sel = useEditorState((s) => s.selection);
  useEditorState((s) => s.revision);
  const [tab, setTab] = useState<"settings" | "style" | "advanced">("settings");
  // Khổ dùng chung với khung soạn: chọn "Điện thoại" ở đây thì khung soạn cũng thu về khổ điện thoại
  const device: Device = ui.device === "desktop" ? "base" : ui.device;
  const setDevice = (d: Device) => ui.setDevice(d === "base" ? "desktop" : d);
  const ids = sel.ids.length ? sel.ids : sel.editing ? [sel.editing] : [];
  const nodes = ids.map((id) => store.block(id)).filter(Boolean) as BNode[];
  if (!nodes.length) return <div className="ecx-inspector is-empty"><p className="ecx-muted">{labels.noSelection}</p></div>;
  const first = nodes[0];
  const type = registry.get(first.type);
  const same = nodes.every((n) => n.type === first.type);
  const Icon = type?.icon ?? Blocks;
  const disabled = store.modeOf(first.id) === "disabled";
  const setAttrs = (a: Record<string, unknown>) => store.setAttrs(ids, a);
  const single = same && nodes.length === 1;
  // Phần thay hẳn Kiểu chữ / Màu chung (khối ghép) — khối chỉ có phần phụ (tiêu đề: chữ tô sáng, liên kết) vẫn giữ mục chung
  const hasParts = single && blockControls().some((c) => c.partsOnly && c.parts && (c.blocks === "*" || c.blocks.includes(first.type)));
  const Custom = single ? type?.inspector : undefined;
  const styled = type?.supports?.style !== false && !store.isContentOnly(first.id);
  const bindable = type?.bindable ?? CORE_BINDABLE[first.type];
  const variants = [...(CORE_BLOCK_STYLES[first.type] ?? []).map((name) => ({ name, label: (t.blockStyle as Record<string, string>)[name] ?? name })), ...(blockStyles?.[first.type] ?? [])];
  return (
    <div className="ecx-inspector">
      <div className="ecx-block-card">
        <Icon className="ecx-icon ecx-card-icon" />
        <strong>{nodes.length > 1 ? `${nodes.length} ${labels.blocks}` : type?.title ?? first.type}</strong>
        {/* Mô tả khối: nút ⓘ (rê / bấm) thay cho 2–3 dòng chữ chiếm chỗ đầu bảng */}
        {type?.description && nodes.length === 1 && <span className="ecx-card-info" tabIndex={0} role="note" aria-label={type.description} title={type.description}><Info className="ecx-icon" /><span className="ecx-card-tip">{type.description}</span></span>}
      </div>
      {single && styled && !disabled && <PresetBar block={first} setAttrs={setAttrs} />}
      {disabled ? <p className="ecx-muted">{labels.readOnly}</p> : (
        <>
          <div className="ecx-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "settings"} className={cx(tab === "settings" && "is-active")} onClick={() => setTab("settings")}><LayoutPanelTop className="ecx-icon" />{labels.settings}</button>
            {styled && <button type="button" role="tab" aria-selected={tab === "style"} className={cx(tab === "style" && "is-active")} onClick={() => setTab("style")}><Paintbrush className="ecx-icon" />{t.styles}</button>}
            {(styled || nodes.length === 1) && <button type="button" role="tab" aria-selected={tab === "advanced"} className={cx(tab === "advanced" && "is-active")} onClick={() => setTab("advanced")}><SlidersHorizontal className="ecx-icon" />{t.advanced}</button>}
          </div>
          <SectionGroup key={`${first.id}:${tab}`}>
          {tab === "settings" || (tab === "style" && !styled) ? (
            <div className="ecx-panel">
              {same && type && <AttrForm type={type} attrs={first.attrs} onChange={setAttrs} />}
              {styled && single && BG_IN_SETTINGS.has(first.type) && <BackgroundControl key={first.id} type={first.type} attrs={first.attrs} setAttrs={setAttrs} device={device} />}
              {Custom && <Custom block={first} attrs={first.attrs} setAttrs={setAttrs} blockProps={null as never} selected editable labels={labels} />}
              {same && nodes.length === 1 && <PluginPanels type={first.type} attrs={first.attrs} setAttrs={setAttrs} />}
              {nodes.length === 1 && bindable?.length && <BindingsPanel block={first} bindable={bindable} onChange={(b) => setAttrs({ bindings: b })} />}
            </div>
          ) : tab === "style" ? (
            <div className="ecx-panel">
              <StyleTab type={first.type} style={first.attrs.style} onChange={(st) => setAttrs({ style: st ?? undefined })} device={device} onDeviceChange={setDevice} part="style"
                variants={variants.length ? variants : undefined} variant={(first.attrs.blockStyle as string) ?? null} onVariantChange={(v) => setAttrs({ blockStyle: v ?? undefined })}
                parts={hasParts}
                lead={single && <>
                  <PartsSections blockId={first.id} type={first.type} attrs={first.attrs} setAttrs={setAttrs} device={device} />
                  <BlockStyleSections type={first.type} attrs={first.attrs} setAttrs={setAttrs} device={device} legacyOnly={hasParts} />
                  {!BG_IN_SETTINGS.has(first.type) && (styleGroups(first.type, type).has("background") || !!(first.attrs.style as { background?: unknown } | undefined)?.background) && <BackgroundControl key={first.id} type={first.type} attrs={first.attrs} setAttrs={setAttrs} device={device} />}
                </>} />
              {single && <PluginPanels type={first.type} attrs={first.attrs} setAttrs={setAttrs} tab="style" />}
            </div>
          ) : (
            <div className="ecx-panel">
              {styled && <StyleTab type={first.type} style={first.attrs.style} onChange={(st) => setAttrs({ style: st ?? undefined })} device={device} onDeviceChange={setDevice} part="advanced" />}
              {nodes.length === 1 && (
                <div className="ecx-form">
                  <Field label={attrName("anchor", labels.lang) ?? "anchor"}><input className="ecx-input" value={String(first.attrs.anchor ?? "")} onChange={(e) => setAttrs({ anchor: e.target.value.replace(/[^\w-]/g, "") || undefined })} /></Field>
                  <Field label={attrName("className", labels.lang) ?? "className"}><input className="ecx-input" value={String(first.attrs.className ?? "")} onChange={(e) => setAttrs({ className: e.target.value || undefined })} /></Field>
                </div>
              )}
              {nodes.length === 1 && <PluginPanels type={first.type} attrs={first.attrs} setAttrs={setAttrs} tab="advanced" />}
            </div>
          )}
          </SectionGroup>
        </>
      )}
    </div>
  );
}

/** Panel của plugin (registerBlockPanel) cho loại khối đang chọn. */
function PluginPanels({ type, attrs, setAttrs, tab = "block" }: { type: string; attrs: Record<string, any>; setAttrs(a: Record<string, unknown>): void; tab?: "block" | "style" | "advanced" }) {
  const { host } = useEditor();
  useSyncExternalStore(onBlockPanelsChange, () => blockPanelsFor(type, tab).length, () => 0);
  const panels = blockPanelsFor(type, tab);
  if (!panels.length) return null;
  return (
    <>
      {panels.map((p) => (
        <Section key={p.id} title={host.translate ? host.translate(p.title) : p.title} defaultOpen={false}>
          {p.component ? <p.component type={type} attrs={attrs} setAttrs={setAttrs} /> : <ControlFields panel={p} attrs={attrs} setAttrs={setAttrs} />}
        </Section>
      ))}
    </>
  );
}

/** Giá trị ISO → ô datetime-local (giờ của máy người soạn); lưu lại bằng toISOString (UTC). */
const toLocal = (iso: unknown) => {
  const d = typeof iso === "string" ? new Date(iso) : null;
  return !d || Number.isNaN(d.getTime()) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** Ô tự vẽ cho thuộc tính khai `type` của panel không có component riêng. */
function ControlFields({ panel, attrs, setAttrs }: { panel: BlockPanel; attrs: Record<string, any>; setAttrs(a: Record<string, unknown>): void }) {
  const { host } = useEditor();
  const tr = (s?: string) => (s && host.translate ? host.translate(s) : s);
  return (
    <>
      {Object.entries(panel.attributes ?? {}).map(([name, spec]) => {
        if (!("type" in spec)) return null;
        const label = tr(spec.label) ?? name;
        const v = attrs[name];
        const set = (x: unknown) => setAttrs({ [name]: x === "" ? undefined : x });
        if (spec.type === "color") return <ColorInput key={name} label={label} value={v} onChange={set} />;
        if (spec.type === "length") return <UnitInput key={name} label={label} value={v} onChange={set} />;
        if (spec.type === "enum") return (
          <Field key={name} label={label}>
            <select className="ecx-input" value={v ?? ""} onChange={(e) => set(e.target.value)}>
              <option value="">—</option>
              {spec.options?.map((o) => { const val = optionValue(o); return <option key={val} value={val}>{(typeof o === "object" && tr(o.label)) || val}</option>; })}
            </select>
          </Field>
        );
        // Kiểu chỉ có ô (content 1.23): giá trị không hợp lệ (controlValue) được báo, vẫn giữ để người soạn sửa
        const invalid = v !== undefined && v !== "" && controlValue(spec, v) === undefined;
        if (spec.type === "boolean") return (
          <label key={name} className="ecx-check"><input type="checkbox" checked={v === true} onChange={(e) => set(e.target.checked || undefined)} /> {label}</label>
        );
        if (spec.type === "string" || spec.type === "url" || spec.type === "textarea" || spec.type === "datetime") return (
          <Field key={name} label={label}>
            {spec.type === "textarea"
              ? <textarea className="ecx-input" rows={4} maxLength={spec.maxLength ?? 5000} value={typeof v === "string" ? v : ""} aria-invalid={invalid || undefined} onChange={(e) => set(e.target.value)} />
              : spec.type === "datetime"
                ? <input className="ecx-input" type="datetime-local" value={toLocal(v)} aria-invalid={invalid || undefined} onChange={(e) => set(e.target.value ? new Date(e.target.value).toISOString() : undefined)} />
                : <input className="ecx-input" type={spec.type === "url" ? "url" : "text"} maxLength={spec.type === "string" ? spec.maxLength ?? 200 : 2048} value={typeof v === "string" ? v : ""} aria-invalid={invalid || undefined} onChange={(e) => set(e.target.value)} />}
          </Field>
        );
        return (
          <Field key={name} label={label}>
            <input className="ecx-input" type="number" min={spec.min} max={spec.max} value={v ?? ""} onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))} />
          </Field>
        );
      })}
    </>
  );
}
