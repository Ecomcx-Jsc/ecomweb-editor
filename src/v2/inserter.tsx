import { Blocks } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { norm } from "../util";
import { useEditor, useUiTick, type InserterRequest } from "./context";
import { cloneBlock, inlineLength, type BNode } from "./model";
import type { BlockType } from "./registry";
import { canContain } from "./structure";
import { startDragNew } from "./dnd";

export interface InsertOption {
  key: string;
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  keywords: string;
  category: string;
  /** Loại khối gốc (kiểm tra chỗ đặt được). */
  type: string;
  create(): BNode;
}

/** Các lựa chọn chèn: khối + biến thể có hàm tạo riêng (cột 30/70…). */
export function useInsertOptions(): InsertOption[] {
  const { registry } = useEditor();
  const [version, setVersion] = useState(registry.getVersion());
  useEffect(() => registry.subscribe(() => setVersion(registry.getVersion())), [registry]);
  return useMemo(() => {
    void version;
    const out: InsertOption[] = [];
    for (const t of registry.all()) {
      if (t.hidden) continue;
      out.push({ key: t.name, title: t.title, description: t.description, icon: t.icon, keywords: t.keywords ?? "", category: t.category ?? "other", type: t.name, create: () => registry.create(t.name) });
      for (const v of t.variations ?? []) {
        if (!v.create) continue;
        out.push({ key: `${t.name}/${v.name}`, title: `${t.title} ${v.title}`, description: v.description, icon: v.icon ?? t.icon, keywords: `${t.keywords ?? ""} ${v.keywords ?? ""}`, category: t.category ?? "other", type: t.name, create: v.create });
      }
    }
    return out;
  }, [registry, version]);
}

/** Lọc + xếp hạng: tên bắt đầu bằng chữ gõ > một từ trong tên > từ khoá; tiếng Việt không dấu. */
export function rankOptions(list: InsertOption[], query: string): InsertOption[] {
  const q = norm(query.trim());
  if (!q) return list;
  const score = (i: InsertOption) => {
    const title = norm(i.title);
    if (title.startsWith(q)) return 3;
    if (title.split(/\s+/).some((w) => w.startsWith(q))) return 2;
    const words = [...title.split(/\s+/), ...norm(i.keywords).split(/\s+/)];
    if (words.some((w) => w.startsWith(q)) || i.key.toLowerCase().startsWith(q)) return 1;
    const parts = q.split(/\s+/);
    return parts.length > 1 && parts.every((p) => words.some((w) => w.startsWith(p))) ? 0.5 : 0;
  };
  return list.map((i) => [i, score(i)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([i]) => i);
}

/** Chèn một lựa chọn theo yêu cầu (slash: thay đoạn "/…"; nút "+": vào vị trí). */
export function applyInsert(ctx: ReturnType<typeof useEditor>, req: InserterRequest, opt: InsertOption) {
  const { store, ui } = ctx;
  const node = opt.create();
  if (req.mode === "slash" && req.blockId) {
    const b = store.block(req.blockId);
    // Đoạn chỉ còn "/từ khoá" → thay cả đoạn bằng khối mới
    if (b && inlineLength(b.inline) <= (req.query?.length ?? 0) + 1) store.replace(req.blockId, [node], focusOpts(node));
    else store.insertAfter(req.blockId, [node]);
  } else store.insert(req.docId, req.parentId, req.index, [node]);
  ui.openInserter(null);
}
function focusOpts(node: BNode) {
  const text = firstTextId(node);
  return text ? { select: { ids: [], editing: text }, caret: { id: text, offset: 0 } } : { select: { ids: [node.id], editing: null }, caret: null };
}
const firstTextId = (b: BNode): string | null => (b.inline ? b.id : (b.content ?? []).map(firstTextId).find(Boolean) ?? null);

/** Các lựa chọn đặt được ở vị trí yêu cầu. */
function useAllowed(req: InserterRequest | null, options: InsertOption[]) {
  const { store } = useEditor();
  return useMemo(() => {
    if (!req) return options;
    const parentType = req.parentId ? store.block(req.parentId)?.type ?? null : null;
    return options.filter((o) => canContain(parentType, o.type));
  }, [req, options, store]);
}

/** Popover chèn khối: gõ "/" trong đoạn trống hoặc bấm nút "+". */
export function InserterPopover() {
  const ctx = useEditor();
  const { ui, labels } = ctx;
  useUiTick();
  const req = ui.inserter;
  const options = useAllowed(req, useInsertOptions());
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const q = req?.mode === "slash" ? req.query ?? "" : query;
  const results = useMemo(() => rankOptions(options, q).slice(0, req?.mode === "slash" ? 12 : 60), [options, q, req?.mode]);

  useEffect(() => { setActive(0); }, [q, req?.mode, req?.blockId]);
  useEffect(() => { if (req && req.mode !== "slash") { setQuery(""); setTimeout(() => inputRef.current?.focus(), 0); } }, [req?.mode, req?.parentId, req?.index, req]);

  // Bàn phím khi đang gõ "/" (khối chữ chuyển phím sang)
  const state = useRef({ results, active, req });
  state.current = { results, active, req };
  useEffect(() => {
    ui.inserterKey = (key) => {
      const s = state.current;
      if (!s.req) return false;
      if (key === "ArrowDown") { setActive((a) => Math.min(s.results.length - 1, a + 1)); return true; }
      if (key === "ArrowUp") { setActive((a) => Math.max(0, a - 1)); return true; }
      if (key === "Enter") { const o = s.results[s.active]; if (!o) return false; applyInsert(ctx, s.req, o); return true; }
      if (key === "Escape") { ui.openInserter(null); return true; }
      return false;
    };
    return () => { ui.inserterKey = null; };
  }, [ctx, ui]);
  useLayoutEffect(() => { listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  // Bấm ra ngoài: đóng
  useEffect(() => {
    if (!req || req.mode === "slash") return;
    const close = (e: MouseEvent) => { if (!(e.target as Element).closest?.(".ecx-inserter-popover")) ui.openInserter(null); };
    const frameDoc = ui.canvasDoc;
    document.addEventListener("mousedown", close);
    frameDoc?.addEventListener("mousedown", close);
    return () => { document.removeEventListener("mousedown", close); frameDoc?.removeEventListener("mousedown", close); };
  }, [req, ui]);

  if (!req) return null;
  if (req.mode === "slash" && !results.length) return null;
  const top = Math.min(req.rect.bottom + 6, window.innerHeight - 320);
  const left = Math.min(req.rect.left, window.innerWidth - 320);
  return (
    <div className="ecx-popover ecx-inserter-popover" style={{ top, left }} role="dialog" aria-label={labels.addBlock} onMouseDown={(e) => { if (req.mode === "slash") e.preventDefault(); }}>
      {req.mode !== "slash" && (
        <input ref={inputRef} className="ecx-search" placeholder={labels.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={labels.search}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); const o = results[active]; if (o) applyInsert(ctx, req, o); }
            else if (e.key === "Escape") { e.preventDefault(); ui.openInserter(null); }
          }} />
      )}
      <div ref={listRef} className="ecx-inserter-list" role="listbox" aria-label={labels.blocks}>
        {results.length ? results.map((o, i) => (
          <button key={o.key} type="button" role="option" aria-selected={i === active} data-index={i} data-key={o.key} className={i === active ? "is-active" : undefined}
            onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => applyInsert(ctx, req, o)}>
            {o.icon ? <o.icon className="ecx-icon" /> : <Blocks className="ecx-icon" />}<span>{o.title}</span>
          </button>
        )) : <p className="ecx-muted">{labels.noResults}</p>}
      </div>
    </div>
  );
}

const CATEGORY_ORDER = ["text", "media", "design", "widgets", "theme", "embed"];
/** Thư viện khối (cột trái): tìm, theo nhóm; bấm để chèn sau khối đang chọn, kéo thả vào khung soạn. */
export function InserterPanel({ onInserted }: { onInserted?(): void }) {
  const ctx = useEditor();
  const { store, labels } = ctx;
  const options = useInsertOptions();
  const [query, setQuery] = useState("");
  const results = rankOptions(options, query);
  const catLabel: Record<string, string> = { text: labels.catText, media: labels.catMedia, design: labels.catDesign, widgets: labels.catWidgets, theme: labels.catTheme, embed: labels.catEmbed };
  const groups = query ? [["", results] as const] : [...CATEGORY_ORDER, ...new Set(results.map((r) => r.category).filter((c) => !CATEGORY_ORDER.includes(c)))].map((c) => [c, results.filter((r) => r.category === c)] as const).filter(([, l]) => l.length);
  const insert = (o: InsertOption) => {
    const node = o.create();
    const cur = store.currentIds[store.currentIds.length - 1];
    if (cur && store.locate(cur)) store.insertAfter(cur, [node]);
    else {
      const docId = store.activeDocId;
      store.insert(docId, null, store.getState().docs[docId].blocks.length, [node]);
    }
    onInserted?.();
  };
  return (
    <div className="ecx-inserter-panel">
      <input className="ecx-search" placeholder={labels.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={labels.search} />
      {groups.map(([cat, list]) => (
        <section key={cat || "all"}>
          {cat && <h3 className="ecx-panel-heading">{catLabel[cat] ?? cat}</h3>}
          <div className="ecx-block-grid">
            {list.map((o) => (
              <button key={o.key} type="button" className="ecx-block-tile" data-key={o.key} title={o.description ?? o.title}
                onPointerDown={(e) => startDragNew(ctx, e, o)} onClick={() => insert(o)}>
                {o.icon ? <o.icon className="ecx-icon" /> : <Blocks className="ecx-icon" />}<span>{o.title}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {!results.length && <p className="ecx-muted">{labels.noResults}</p>}
    </div>
  );
}

export const cloneNode = cloneBlock;
export type { BlockType };
