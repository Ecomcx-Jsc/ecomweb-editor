import { CORE_BINDABLE, OVERRIDE_KEY, patternOverridables } from "@ecomcx/ecomweb-content";
import { Repeat2 } from "lucide-react";
import { useEditor, useEditorState } from "../context";
import { docFromBlocks, type BNode } from "../core/model";
import { useMsgs } from "../i18n";
import { Field, cx } from "./attr-form";
import { Section } from "./style-controls";

const ATTR_LABEL = (t: Record<string, string>, attr: string) => t[`attr${attr[0].toUpperCase()}${attr.slice(1)}`] ?? attr;

/** Trong tài liệu của mẫu: bật "cho phép sửa riêng" cho khối → chỗ dùng mẫu đặt được chữ / ảnh / liên kết riêng cho khối này (tab Nâng cao). */
export function OverrideKeySection({ block, setAttrs }: { block: BNode; setAttrs(a: Record<string, unknown>): void }) {
  const { store } = useEditor();
  const t = useMsgs("patternOverrides");
  const loc = store.locate(block.id);
  if (!loc || !loc.docId.startsWith("pattern:") || !CORE_BINDABLE[block.type]) return null;
  const key = typeof block.attrs.overrideKey === "string" ? block.attrs.overrideKey : "";
  return (
    <Section title={t.allowTitle} defaultOpen={!!key}>
      <label className="ecx-check">
        <input type="checkbox" checked={!!key} onChange={(e) => setAttrs({ overrideKey: e.target.checked ? `o-${block.id.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-8)}` : undefined })} /> {t.allow}
      </label>
      <p className="ecx-muted">{t.allowHelp}</p>
      {key && (
        <Field label={t.key}>
          <input className="ecx-input" value={key} aria-label={t.key} onChange={(e) => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40); if (OVERRIDE_KEY.test(v)) setAttrs({ overrideKey: v }); }} />
        </Field>
      )}
    </Section>
  );
}

/** Khối "Mẫu đồng bộ": liệt kê các ô mẫu cho sửa riêng — nhập giá trị riêng cho chỗ dùng này; để trống = theo mẫu. */
export function PatternOverridesSection({ block, setAttrs }: { block: BNode; setAttrs(a: Record<string, unknown>): void }) {
  const { store, host, registry } = useEditor();
  useEditorState((s) => s.docs);
  const t = useMsgs("patternOverrides");
  const ref = Number(block.attrs.ref);
  const docId = host.documents?.idOf?.({ kind: "pattern", ref }) ?? `pattern:${ref}`;
  const blocks = store.getState().docs[docId]?.blocks;
  if (!ref || !blocks) return null;
  const list = patternOverridables({ version: 2, blocks: [{ type: "richtext", data: docFromBlocks(blocks) }] });
  const current = (block.attrs.overrides as Record<string, Record<string, string>> | undefined) ?? {};
  const set = (key: string, attr: string, v: string) => {
    const next: Record<string, Record<string, string>> = { ...current, [key]: { ...(current[key] ?? {}) } };
    if (v) next[key][attr] = v; else delete next[key][attr];
    if (!Object.keys(next[key]).length) delete next[key];
    setAttrs({ overrides: Object.keys(next).length ? next : undefined });
  };
  return (
    <Section title={t.title} defaultOpen>
      {list.length === 0 && <p className="ecx-muted"><Repeat2 className="ecx-icon ecx-icon-sm" /> {t.none}</p>}
      {list.map((o) => (
        <div key={o.key} className="ecx-binding-row" data-override={o.key}>
          <span className="ecx-field-label">{registry.get(o.type)?.title ?? o.type}</span>
          {o.attrs.filter((a) => a in o.values || a === "content").map((attr) => (
            <Field key={attr} label={ATTR_LABEL(t as unknown as Record<string, string>, attr)}>
              <input className={cx("ecx-input")} value={current[o.key]?.[attr] ?? ""} placeholder={o.values[attr] || t.followPattern} aria-label={`${o.key}: ${attr}`}
                onChange={(e) => set(o.key, attr, e.target.value.slice(0, 2000))} />
            </Field>
          ))}
        </div>
      ))}
      <p className="ecx-muted">{t.help}</p>
    </Section>
  );
}
