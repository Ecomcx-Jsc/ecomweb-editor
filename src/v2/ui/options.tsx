import { normalizeContent } from "@ecomcx/ecomweb-content";
import { Check, ChevronRight, Code2, Copy, Keyboard, MoreVertical, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { serializeBlocks } from "../core/clipboard";
import { useEditor, useEditorState } from "../context";
import { useMsgs } from "../i18n";
import { blocksFromDoc, type BNode } from "../core/model";
import { usePrefs, type EditorPrefs } from "../prefs";
import { blockLabel } from "./list-view";
import { Dropdown, MenuItem } from "./toolbar";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

type BoolPref = { [K in keyof EditorPrefs]: EditorPrefs[K] extends boolean ? K : never }[keyof EditorPrefs];

/** Mục bật/tắt trong menu (dấu ✓ khi bật). */
function PrefItem({ name, label, hint, close }: { name: BoolPref; label: string; hint?: string; close(): void }) {
  const { prefs } = useEditor();
  const on = usePrefs(prefs)[name];
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} className="ecx-menu-item ecx-menu-pref" title={hint}
      onMouseDown={(e) => e.preventDefault()} onClick={() => { prefs.toggle(name); close(); }}>
      <span className="ecx-icon">{on && <Check className="ecx-icon" />}</span>
      <span className="ecx-menu-text"><span>{label}</span>{hint && <small>{hint}</small>}</span>
    </button>
  );
}

/** Menu ⋮ "Tuỳ chọn": cách xem, chế độ soạn, công cụ, hộp tuỳ chọn. `extra` = mục riêng của ứng dụng (lịch sử, thùng rác…). */
export function MoreMenu({ extra }: { extra?: (close: () => void) => ReactNode }) {
  const { prefs, labels, store, ui } = useEditor();
  const p = usePrefs(prefs);
  const [modal, setModal] = useState<"prefs" | "shortcuts" | null>(null);
  const copyAll = async () => {
    const root = store.getState().docs[store.getState().rootId].blocks;
    const s = serializeBlocks(root);
    try { await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([s.text], { type: "text/plain" }), "text/html": new Blob([s.html], { type: "text/html" }) })]); }
    catch { try { await navigator.clipboard.writeText(s.text); } catch { /* trình duyệt chặn */ } }
    ui.announce(labels.copiedAll);
  };
  return (
    <>
      <Dropdown label={labels.options} className="ecx-more-menu" trigger={<MoreVertical className="ecx-icon" />}>
        {(close) => (
          <div className="ecx-menu-wide">
            <div className="ecx-menu-group-label">{labels.view}</div>
            <PrefItem name="fixedToolbar" label={labels.fixedToolbar} hint={labels.fixedToolbarHint} close={close} />
            <PrefItem name="distractionFree" label={labels.distractionFree} hint={labels.distractionFreeHint} close={close} />
            <PrefItem name="spotlight" label={labels.spotlight} hint={labels.spotlightHint} close={close} />
            <PrefItem name="fullscreen" label={labels.fullscreen} hint={labels.fullscreenHint} close={close} />
            <div className="ecx-menu-sep" />
            <div className="ecx-menu-group-label">{labels.editorMode}</div>
            {(["visual", "code"] as const).map((m) => (
              <button key={m} type="button" role="menuitemradio" aria-checked={p.mode === m} className="ecx-menu-item" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { prefs.set({ mode: m }); close(); }}>
                <span className="ecx-icon">{p.mode === m && <Check className="ecx-icon" />}</span><span>{m === "visual" ? labels.visualEditor : labels.codeEditor}</span><kbd>{m === "code" ? `${MOD}⇧⌥M` : ""}</kbd>
              </button>
            ))}
            <div className="ecx-menu-sep" />
            <div className="ecx-menu-group-label">{labels.tools}</div>
            <MenuItem icon={Keyboard} label={labels.shortcuts} shortcut={isMac ? "⌃⌥H" : "Shift+Alt+H"} onClick={() => { close(); setModal("shortcuts"); }} />
            <MenuItem icon={Copy} label={labels.copyAll} onClick={() => { close(); void copyAll(); }} />
            {extra?.(close)}
            <div className="ecx-menu-sep" />
            <MenuItem icon={SlidersHorizontal} label={`${labels.preferences}…`} onClick={() => { close(); setModal("prefs"); }} />
          </div>
        )}
      </Dropdown>
      {modal === "prefs" && <PreferencesModal onClose={() => setModal(null)} />}
      {modal === "shortcuts" && <ShortcutsModal onClose={() => setModal(null)} />}
    </>
  );
}

/** Hộp thoại dùng chung (Esc / bấm nền để đóng, giữ focus trong hộp). */
export function Modal({ title, onClose, children, wide }: { title: string; onClose(): void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { labels } = useEditor();
  // onClose qua ref: người gọi hay truyền hàm mới mỗi lần vẽ — chạy lại effect mỗi phím gõ sẽ trả focus về chỗ cũ (ô nhập trong hộp mất focus)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("textarea, input, button, [tabindex]")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeRef.current(); } };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); prev?.focus?.(); };
  }, []);
  return (
    <div className="ecx-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={cx("ecx-modal", wide && "is-wide")} role="dialog" aria-modal="true" aria-label={title}>
        <header className="ecx-modal-header"><h2>{title}</h2><button type="button" className="ecx-tool" aria-label={labels.close} onClick={onClose}><X className="ecx-icon" /></button></header>
        {children}
      </div>
    </div>
  );
}

function Toggle({ name, label, hint }: { name: BoolPref; label: string; hint?: string }) {
  const { prefs } = useEditor();
  const on = usePrefs(prefs)[name];
  return (
    <label className="ecx-pref-row">
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" className="ecx-switch" checked={on} onChange={() => prefs.toggle(name)} />
    </label>
  );
}

/** Hộp "Tuỳ chọn trình soạn": Chung, Giao diện, Trợ năng, Khối (ẩn bớt loại khối khỏi thư viện). */
export function PreferencesModal({ onClose }: { onClose(): void }) {
  const { labels, registry, prefs } = useEditor();
  const p = usePrefs(prefs);
  const [tab, setTab] = useState<"general" | "appearance" | "accessibility" | "blocks">("general");
  const tabs = [["general", labels.general], ["appearance", labels.appearance], ["accessibility", labels.accessibility], ["blocks", labels.blocks]] as const;
  const types = registry.all().filter((t) => !t.hidden);
  const cats = [...new Set(types.map((t) => t.category ?? "other"))];
  const catLabel: Record<string, string> = { text: labels.catText, media: labels.catMedia, design: labels.catDesign, widgets: labels.catWidgets, theme: labels.catTheme, embed: labels.catEmbed };
  const hidden = new Set(p.hiddenBlockTypes);
  const setHidden = (names: string[], hide: boolean) => {
    const next = new Set(hidden);
    for (const n of names) if (hide) next.add(n); else next.delete(n);
    prefs.set({ hiddenBlockTypes: [...next] });
  };
  return (
    <Modal title={labels.preferences} onClose={onClose} wide>
      <div className="ecx-prefs">
        <nav className="ecx-prefs-tabs" role="tablist" aria-orientation="vertical">
          {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={cx(tab === k && "is-active")} onClick={() => setTab(k)}>{l}<ChevronRight className="ecx-icon-sm" /></button>)}
        </nav>
        <section className="ecx-prefs-body" role="tabpanel">
          {tab === "general" && <>
            <Toggle name="showListView" label={labels.showListView} hint={labels.showListViewHint} />
            <Toggle name="showBreadcrumbs" label={labels.showBreadcrumbs} hint={labels.showBreadcrumbsHint} />
          </>}
          {tab === "appearance" && <>
            <Toggle name="fixedToolbar" label={labels.fixedToolbar} hint={labels.fixedToolbarHint} />
            <Toggle name="distractionFree" label={labels.distractionFree} hint={labels.distractionFreeHint} />
            <Toggle name="spotlight" label={labels.spotlight} hint={labels.spotlightHint} />
            <Toggle name="fullscreen" label={labels.fullscreen} hint={labels.fullscreenHint} />
          </>}
          {tab === "accessibility" && <>
            <Toggle name="keepCaretInsideBlock" label={labels.keepCaret} hint={labels.keepCaretHint} />
            <Toggle name="showIconLabels" label={labels.iconLabels} hint={labels.iconLabelsHint} />
          </>}
          {tab === "blocks" && <>
            <Toggle name="mostUsedBlocks" label={labels.mostUsed} hint={labels.mostUsedHint} />
            <h3 className="ecx-panel-heading">{labels.blockVisibility}</h3>
            <p className="ecx-muted">{labels.blockVisibilityHint}</p>
            {cats.map((c) => {
              const list = types.filter((t) => (t.category ?? "other") === c);
              const allOn = list.every((t) => !hidden.has(t.name));
              return (
                <fieldset key={c} className="ecx-block-visibility">
                  <legend><label className="ecx-check"><input type="checkbox" checked={allOn} onChange={() => setHidden(list.map((t) => t.name), allOn)} /> <strong>{catLabel[c] ?? c}</strong></label></legend>
                  {list.map((t) => (
                    <label key={t.name} className="ecx-check" data-block-type={t.name}>
                      <input type="checkbox" checked={!hidden.has(t.name)} onChange={(e) => setHidden([t.name], !e.target.checked)} /> {t.icon && <t.icon className="ecx-icon" />} {t.title}
                    </label>
                  ))}
                </fieldset>
              );
            })}
          </>}
        </section>
      </div>
    </Modal>
  );
}

/** Bảng phím tắt. */
export function ShortcutsModal({ onClose }: { onClose(): void }) {
  const { labels } = useEditor();
  const t = useMsgs("shortcuts");
  const rows: Array<[string, string]> = [
    [`${MOD}+Z / ${MOD}+⇧+Z`, t.undo], [`${MOD}+S`, t.save], ["/", t.insert], ["Enter / ⇧+Enter", t.split], ["Tab / ⇧+Tab", t.indent], ["Esc", t.esc],
    [`${MOD}+A ×2`, t.selectAll], [`${MOD}+⇧+D`, t.duplicate], ["⇧+⌥+Z", t.remove], [`${MOD}+⌥+T / Y`, t.around], [`${MOD}+⇧+⌥+T / Y`, t.move],
    ["Alt+F10", t.toolbar], [`${MOD}+B / I / U`, t.marks], [`${MOD}+K`, t.link], [`${MOD}+E`, t.code], ["## · - · 1. · > · ``` · ---", t.markdown],
  ];
  return (
    <Modal title={labels.shortcuts} onClose={onClose}>
      <dl className="ecx-shortcuts">{rows.map(([k, d]) => <div key={k}><dt>{d}</dt><dd><kbd>{k}</kbd></dd></div>)}</dl>
    </Modal>
  );
}

/** Soạn mã: nội dung dạng JSON (định dạng lưu) — áp dụng khi rời ô / bấm nút; sai cấu trúc thì báo, không ghi. */
export function CodeEditor() {
  const { store, labels, prefs } = useEditor();
  const rootId = useEditorState((s) => s.rootId);
  const blocks = useEditorState((s) => s.docs[s.rootId].blocks);
  const text = useMemo(() => JSON.stringify(JSON.parse(serializeBlocks(blocks).json), null, 2), [blocks]);
  const [draft, setDraft] = useState(text);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setDraft(text); setError(null); }, [text]);
  const apply = () => {
    if (draft === text) return true;
    try {
      const parsed = JSON.parse(draft);
      const { doc } = normalizeContent(Array.isArray(parsed) ? { type: "doc", content: parsed } : parsed);
      const rich = doc.blocks.find((b) => b.type === "richtext")?.data as Parameters<typeof blocksFromDoc>[0];
      store.commit(rootId, blocksFromDoc(rich));
      setError(null);
      return true;
    } catch (e) { setError(`${labels.invalidCode}: ${(e as Error).message}`); return false; }
  };
  return (
    <div className="ecx-code-editor">
      <div className="ecx-code-bar"><Code2 className="ecx-icon" /><span>{labels.codeEditorHint}</span><span className="ecx-flex" />
        <button type="button" className="ecx-btn" onClick={() => { if (apply()) prefs.set({ mode: "visual" }); }}>{labels.exitCode}</button></div>
      {error && <div className="ecx-notice is-error" role="alert">{error}</div>}
      <textarea className="ecx-code-input" aria-label={labels.codeEditor} spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={apply} />
    </div>
  );
}

/** Đường dẫn khối ở đáy: Tài liệu › Nhóm › Cột › Đoạn văn — bấm để chọn khối cha. */
export function Breadcrumbs() {
  const { store, registry, labels } = useEditor();
  const sel = useEditorState((s) => s.selection);
  useEditorState((s) => s.revision);
  const id = sel.ids[0] ?? sel.editing;
  const loc = id ? store.locate(id) : null;
  const chain: BNode[] = loc ? [...loc.ancestors.map((a) => store.block(a)!).filter(Boolean), loc.block] : [];
  const doc = loc ? store.doc(loc.docId) : null;
  return (
    <nav className="ecx-breadcrumbs" aria-label={labels.showBreadcrumbs}>
      <button type="button" onClick={() => store.clearSelection()}>{doc?.title ?? labels.documentRoot}</button>
      {chain.map((b, i) => (
        <span key={b.id} className="ecx-crumb"><ChevronRight className="ecx-icon-sm" />
          <button type="button" aria-current={i === chain.length - 1 ? "true" : undefined} onClick={() => store.select([b.id], { editing: null })}>{blockLabel(b, registry.get(b.type)).split(" · ")[0]}</button>
        </span>
      ))}
    </nav>
  );
}
