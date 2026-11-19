import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "../context";
import { useMsgs } from "../i18n";
import { copyStyle, hasCopiedStyle, pastedStyle } from "./block-menu";
import { cx } from "./style-controls";
import { useInsertOptions } from "./inserter";

export interface PaletteActions {
  save(): void;
  toggleList(): void;
  toggleSettings(): void;
  openInserter(query?: string): void;
}
interface Command { id: string; group: string; title: string; hint?: string; keywords?: string; run(): void }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
const plain = (b: { inline?: Array<{ type: string; text?: string }> }) => (b.inline ?? []).map((n) => (n.type === "text" ? n.text ?? "" : "")).join("").trim();

/**
 * Bảng lệnh: một ô tìm cho mọi thứ — thao tác (lưu, hoàn tác, nhân đôi, xoá, chuyển…), chế độ xem (khổ máy, danh sách, cài đặt),
 * chèn khối (theo tên, kể cả tên cũ tiếng Việt) và nhảy tới khối trong trang theo chữ đang có. Mở bằng ⌘⇧P / Ctrl+Shift+P hoặc nút trên thanh.
 */
export function CommandPalette({ open, onClose, actions }: { open: boolean; onClose(): void; actions: PaletteActions }) {
  const ctx = useEditor();
  const { store, ui, labels } = ctx;
  const t = useMsgs("palette");
  const blocks = useInsertOptions();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setActive(0); requestAnimationFrame(() => input.current?.focus()); } }, [open]);

  const commands = useMemo<Command[]>(() => {
    if (!open) return [];
    const sel = store.currentIds;
    const first = sel[0];
    const loc = first ? store.locate(first) : null;
    const act = (title: string, run: () => void, hint?: string, keywords = ""): Command => ({ id: `a:${title}`, group: t.groupActions, title, hint, keywords, run });
    const list: Command[] = [
      act(t.save, actions.save, "⌘S", "luu save"),
      act(t.undo, () => store.undo(), "⌘Z", "hoan tac undo"),
      act(t.redo, () => store.redo(), "⌘⇧Z", "lam lai redo"),
    ];
    if (loc?.parent) list.push(act(t.selectParent, () => store.select([loc.parent!.id], { editing: null }), "", "khoi cha parent"));
    if (first) {
      list.push(
        act(t.duplicate, () => store.duplicate(sel), "", "nhan doi duplicate copy"),
        act(t.remove, () => store.remove(sel), "", "xoa delete remove"),
        act(t.moveUp, () => store.moveBy(sel, -1), "", "len up"),
        act(t.moveDown, () => store.moveBy(sel, 1), "", "xuong down"),
        act(t.copyStyle, () => { const b = store.block(first); if (b) copyStyle(b.attrs); }, "", "chep kieu style"),
      );
      if (hasCopiedStyle()) list.push(act(t.pasteStyle, () => store.setAttrs(sel, pastedStyle()!), "", "dan kieu style paste"));
    }
    const view = (title: string, run: () => void, keywords: string): Command => ({ id: `v:${title}`, group: t.groupView, title, keywords, run });
    list.push(
      view(t.desktop, () => ui.setDevice("desktop"), "may tinh desktop"),
      view(t.tablet, () => ui.setDevice("tablet"), "may tinh bang tablet"),
      view(t.mobile, () => ui.setDevice("mobile"), "dien thoai mobile phone"),
      view(t.listView, actions.toggleList, "danh sach khoi list tree navigator"),
      view(t.settings, actions.toggleSettings, "cai dat settings inspector bang phai"),
      view(t.inserter, () => actions.openInserter(), "chen khoi insert add"),
      view(t.zoomOut, () => ui.setZoomOut(!ui.zoomOut), "thu nho zoom sap xep"),
    );
    return list;
  }, [open, store, ui, actions, t, store.currentIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo<Command[]>(() => {
    const k = norm(q.trim());
    const match = (c: Command) => !k || norm(`${c.title} ${c.keywords ?? ""}`).includes(k) || k.split(/\s+/).every((w) => norm(`${c.title} ${c.keywords ?? ""}`).includes(w));
    const out = commands.filter(match);
    if (k.length >= 2) {
      // Chèn khối: tên khối (kể cả tên cũ) khớp ô tìm → chạy thì mở bảng chèn đúng từ khoá đó để chèn vào chỗ đang chọn
      const ins = blocks.filter((o) => norm(`${o.title} ${o.keywords} ${(o.aliases ?? []).join(" ")}`).includes(k)).slice(0, 8);
      for (const o of ins) out.push({ id: `i:${o.key}`, group: t.groupInsert, title: `${t.insert}: ${o.title}`, run: () => actions.openInserter(o.title) });
      // Đi tới khối theo chữ đang có trong trang
      let n = 0;
      const docs = store.getState().docs;
      const walk = (docId: string, list: Array<{ id: string; type: string; inline?: Array<{ type: string; text?: string }>; content?: unknown[]; attrs: Record<string, unknown> }>) => {
        for (const b of list) {
          if (n >= 8) return;
          const text = plain(b) || String(b.attrs.title ?? b.attrs.text ?? b.attrs.summary ?? b.attrs.label ?? "");
          if (text && norm(text).includes(k)) { n++; out.push({ id: `g:${b.id}`, group: t.groupGoto, title: `${t.goto}: ${text.slice(0, 60)}`, hint: ctx.registry.get(b.type)?.title ?? b.type, run: () => { store.select([b.id], { editing: null }); requestAnimationFrame(() => ui.blockEl(b.id)?.scrollIntoView({ block: "center", behavior: "smooth" })); } }); }
          if (Array.isArray(b.content)) walk(docId, b.content as never);
        }
      };
      for (const [id, d] of Object.entries(docs)) walk(id, (d as unknown as { blocks: never[] }).blocks);
    }
    return out.slice(0, 40);
  }, [q, commands, blocks, store, ui, ctx.registry, actions, t]);

  useEffect(() => setActive(0), [q]);
  if (!open) return null;
  const run = (c?: Command) => { if (!c) return; onClose(); setTimeout(() => c.run(), 0); };
  const groups: Array<[string, Command[]]> = [];
  for (const c of results) { const g = groups.find((x) => x[0] === c.group); if (g) g[1].push(c); else groups.push([c.group, [c]]); }
  return (
    <div className="ecx-palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ecx-palette" role="dialog" aria-modal="true" aria-label={t.title}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
          else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); run(results[active]); }
        }}>
        <div className="ecx-palette-input"><Search className="ecx-icon" aria-hidden /><input ref={input} role="combobox" aria-expanded aria-controls="ecx-palette-list" aria-activedescendant={results[active] ? `ecx-pal-${active}` : undefined} placeholder={t.placeholder} aria-label={t.title} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="ecx-palette-list" id="ecx-palette-list" role="listbox">
          {groups.map(([g, list]) => (
            <div key={g} role="presentation">
              <div className="ecx-palette-group">{g}</div>
              {list.map((c) => { const i = results.indexOf(c); return (
                <button key={c.id} id={`ecx-pal-${i}`} type="button" role="option" aria-selected={i === active} className={cx("ecx-palette-item", i === active && "is-active")} onMouseMove={() => setActive(i)} onClick={() => run(c)}>
                  <span>{c.title}</span>{c.hint && <kbd>{c.hint}</kbd>}
                </button>
              ); })}
            </div>
          ))}
          {!results.length && <p className="ecx-palette-empty">{t.empty}</p>}
        </div>
        <div className="ecx-palette-foot">{t.hint}{labels ? "" : ""}</div>
      </div>
    </div>
  );
}
