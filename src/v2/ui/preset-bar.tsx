import { Check, ChevronDown, RotateCcw, Save, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { blockControls } from "../../shared/panel-store";
import { applyStyle, ensurePresets, onPresetsChange, pickStyle, presetsSnapshot, sameStyle, setPresets, styleKeys, type BlockPresetMap } from "../core/block-presets";
import type { BNode } from "../core/model";
import { useEditor } from "../context";
import { useMsgs } from "../i18n";
import { cx } from "./style-controls";

/**
 * Hàng "Kiểu" dưới tên khối: chọn kiểu đặt sẵn của loại khối (toàn website), báo "(đã chỉnh)" khi kiểu đang dùng đã bị sửa,
 * lưu kiểu hiện tại thành kiểu mới, đặt làm mặc định khi chèn khối mới, về mặc định. Chỉ đụng thuộc tính kiểu — nội dung giữ nguyên.
 */
export function PresetBar({ block, setAttrs }: { block: BNode; setAttrs(a: Record<string, unknown>): void }) {
  const { host } = useEditor();
  const t = useMsgs("presets");
  const map = useSyncExternalStore(onPresetsChange, presetsSnapshot, presetsSnapshot);
  useEffect(() => ensurePresets(host.blockPresets?.load), [host]);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setOpen(false); setNaming(null); } };
    document.addEventListener("mousedown", out, true);
    return () => document.removeEventListener("mousedown", out, true);
  }, [open]);
  if (!host.blockPresets) return null;
  const keys = styleKeys(block.type, blockControls());
  const cur = pickStyle(block.attrs, keys);
  const entry = map?.[block.type] ?? {};
  const presets = entry.presets ?? [];
  const def = entry.default ?? {};
  const match = presets.find((p) => sameStyle(cur, pickStyle(p.attrs, keys)));
  const isDefault = !match && sameStyle(cur, pickStyle(def, keys));
  const label = match ? match.name : t.default;
  const edited = !match && !isDefault;
  const canSave = !!host.blockPresets.save;

  const save = async (next: BlockPresetMap) => {
    setBusy(true);
    try { setPresets((await host.blockPresets!.save!(next as Record<string, unknown>)) as BlockPresetMap); }
    finally { setBusy(false); }
  };
  const withEntry = (patch: Partial<typeof entry>) => ({ ...(map ?? {}), [block.type]: { ...entry, ...patch } });
  const apply = (style: Record<string, unknown>) => { setAttrs(applyStyle(keys, pickStyle(style, keys))); setOpen(false); };

  return (
    <div className="ecx-preset" ref={ref}>
      <span className="ecx-field-label">{t.label}</span>
      <div className="ecx-preset-row">
        <button type="button" className={cx("ecx-preset-btn", open && "is-open")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>{label}{edited && <em className="ecx-preset-edited"> {t.edited}</em>}</span><ChevronDown className="ecx-icon" />
        </button>
        <button type="button" className="ecx-preset-reset" title={t.toDefault} aria-label={t.toDefault} disabled={isDefault} onClick={() => apply(def)}><RotateCcw className="ecx-icon" /></button>
      </div>
      {open && (
        <div className="ecx-preset-menu" role="menu">
          <div className="ecx-pop-title">{t.presets}</div>
          <button type="button" role="menuitemradio" aria-checked={isDefault} className="ecx-preset-item" onClick={() => apply(def)}>{t.default}{isDefault && <Check className="ecx-icon" />}</button>
          {presets.map((p) => (
            <div key={p.name} className="ecx-preset-line">
              <button type="button" role="menuitemradio" aria-checked={match === p} className="ecx-preset-item" onClick={() => apply(p.attrs)}>{p.name}{match === p && <Check className="ecx-icon" />}</button>
              {canSave && <button type="button" className="ecx-preset-del" title={t.remove} aria-label={`${t.remove}: ${p.name}`} disabled={busy} onClick={() => save(withEntry({ presets: presets.filter((x) => x !== p) }))}><Trash2 className="ecx-icon" /></button>}
            </div>
          ))}
          {canSave && <>
            <hr />
            {naming === null
              ? <button type="button" className="ecx-preset-item" disabled={busy} onClick={() => setNaming("")}><Save className="ecx-icon" />{t.saveNew}</button>
              : <form className="ecx-preset-name" onSubmit={(e) => { e.preventDefault(); const name = naming.trim().slice(0, 60); if (!name) return; save(withEntry({ presets: [...presets.filter((x) => x.name !== name), { name, attrs: cur }] })).then(() => { setNaming(null); setOpen(false); }); }}>
                  <input className="ecx-input" autoFocus value={naming} maxLength={60} placeholder={t.namePlaceholder} onChange={(e) => setNaming(e.target.value)} />
                  <button type="submit" className="ecx-btn ecx-btn-primary" disabled={busy || !naming.trim()}>{t.save}</button>
                </form>}
            <button type="button" className="ecx-preset-item" disabled={busy} onClick={() => save(withEntry({ default: Object.keys(cur).length ? cur : undefined })).then(() => setOpen(false))}><Star className="ecx-icon" />{t.makeDefault}</button>
            <p className="ecx-pop-hint">{t.defaultHint}</p>
          </>}
        </div>
      )}
    </div>
  );
}
