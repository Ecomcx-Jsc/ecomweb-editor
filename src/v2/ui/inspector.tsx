import type { Device } from "@ecomcx/ecomweb-content";
import { CORE_BLOCK_STYLES } from "@ecomcx/ecomweb-content";
import { Blocks } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { blockPanelsFor, onBlockPanelsChange } from "../../shared/panel-store";
import { useEditor, useEditorState } from "../context";
import type { BNode } from "../core/model";
import { AttrForm, Field, attrName, cx } from "./attr-form";
import { BindingsPanel, CORE_BINDABLE } from "./bindings";
import { StyleTab } from "./style-tab";
import { useMsgs } from "../i18n";

/** Bảng cài đặt của khối đang chọn: thẻ khối, tab Cài đặt (form + phần riêng của khối), tab Kiểu dáng. */
export function Inspector({ blockStyles }: { blockStyles?: Record<string, Array<{ name: string; label: string }>> }) {
  const { store, registry, labels } = useEditor();
  const t = useMsgs("controls");
  const sel = useEditorState((s) => s.selection);
  useEditorState((s) => s.revision);
  const [tab, setTab] = useState<"settings" | "style">("settings");
  const [device, setDevice] = useState<Device>("base");
  const ids = sel.ids.length ? sel.ids : sel.editing ? [sel.editing] : [];
  const nodes = ids.map((id) => store.block(id)).filter(Boolean) as BNode[];
  if (!nodes.length) return <div className="ecx-inspector is-empty"><p className="ecx-muted">{labels.noSelection}</p></div>;
  const first = nodes[0];
  const type = registry.get(first.type);
  const same = nodes.every((n) => n.type === first.type);
  const Icon = type?.icon ?? Blocks;
  const disabled = store.modeOf(first.id) === "disabled";
  const setAttrs = (a: Record<string, unknown>) => store.setAttrs(ids, a);
  const Custom = same && nodes.length === 1 ? type?.inspector : undefined;
  const bindable = type?.bindable ?? CORE_BINDABLE[first.type];
  const variants = [...(CORE_BLOCK_STYLES[first.type] ?? []).map((name) => ({ name, label: name })), ...(blockStyles?.[first.type] ?? [])];
  return (
    <div className="ecx-inspector">
      <div className="ecx-block-card">
        <Icon className="ecx-icon ecx-card-icon" />
        <div><strong>{nodes.length > 1 ? `${nodes.length} ${labels.blocks}` : type?.title ?? first.type}</strong>{type?.description && nodes.length === 1 && <p className="ecx-muted">{type.description}</p>}</div>
      </div>
      {disabled ? <p className="ecx-muted">{labels.readOnly}</p> : (
        <>
          <div className="ecx-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "settings"} className={cx(tab === "settings" && "is-active")} onClick={() => setTab("settings")}>{labels.settings}</button>
            {type?.supports?.style !== false && !store.isContentOnly(first.id) && <button type="button" role="tab" aria-selected={tab === "style"} className={cx(tab === "style" && "is-active")} onClick={() => setTab("style")}>{t.styles}</button>}
          </div>
          {tab === "settings" ? (
            <div className="ecx-panel">
              {same && type && <AttrForm type={type} attrs={first.attrs} onChange={setAttrs} />}
              {Custom && <Custom block={first} attrs={first.attrs} setAttrs={setAttrs} blockProps={null as never} selected editable labels={labels} />}
              {same && nodes.length === 1 && <PluginPanels type={first.type} attrs={first.attrs} setAttrs={setAttrs} />}
              {nodes.length === 1 && bindable?.length && <BindingsPanel block={first} bindable={bindable} onChange={(b) => setAttrs({ bindings: b })} />}
              {nodes.length === 1 && (
                <details className="ecx-advanced">
                  <summary>{t.advanced}</summary>
                  <Field label={attrName("anchor", labels.lang) ?? "anchor"}><input className="ecx-input" value={String(first.attrs.anchor ?? "")} onChange={(e) => setAttrs({ anchor: e.target.value.replace(/[^\w-]/g, "") || undefined })} /></Field>
                  <Field label={attrName("className", labels.lang) ?? "className"}><input className="ecx-input" value={String(first.attrs.className ?? "")} onChange={(e) => setAttrs({ className: e.target.value || undefined })} /></Field>
                </details>
              )}
            </div>
          ) : (
            <div className="ecx-panel">
              <StyleTab type={first.type} style={first.attrs.style} onChange={(st) => setAttrs({ style: st ?? undefined })} device={device} onDeviceChange={setDevice}
                variants={variants.length ? variants : undefined} variant={(first.attrs.blockStyle as string) ?? null} onVariantChange={(v) => setAttrs({ blockStyle: v ?? undefined })} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Panel của plugin (registerBlockPanel) cho loại khối đang chọn. */
function PluginPanels({ type, attrs, setAttrs }: { type: string; attrs: Record<string, any>; setAttrs(a: Record<string, unknown>): void }) {
  const { host } = useEditor();
  useSyncExternalStore(onBlockPanelsChange, () => blockPanelsFor(type).length, () => 0);
  const panels = blockPanelsFor(type);
  if (!panels.length) return null;
  return (
    <>
      {panels.map((p) => (
        <details key={p.id} className="ecx-advanced" open>
          <summary>{host.translate ? host.translate(p.title) : p.title}</summary>
          <p.component type={type} attrs={attrs} setAttrs={setAttrs} />
        </details>
      ))}
    </>
  );
}
