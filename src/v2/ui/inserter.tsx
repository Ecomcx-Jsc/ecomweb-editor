import { blockDescription } from "./block-descriptions";
import { Blocks } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { norm } from "../../shared/util";
import { useEditor, useUiTick, type InserterRequest } from "../context";
import { cloneBlock, inlineLength, type BNode } from "../core/model";
import type { BlockType } from "../core/registry";
import { canContain } from "../core/structure";
import { startDragNew } from "../canvas/dnd";
import { usePrefs } from "../prefs";
import { onPatternsChange, patternBlocks, registeredPatterns, type Pattern } from "../core/patterns";
import { useSyncExternalStore } from "react";
import { enLabels, viLabels } from "../../shared/labels";

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
  const { registry, prefs } = useEditor();
  const hidden = usePrefs(prefs).hiddenBlockTypes;
  const [version, setVersion] = useState(registry.getVersion());
  useEffect(() => registry.subscribe(() => setVersion(registry.getVersion())), [registry]);
  return useMemo(() => {
    void version;
    const out: InsertOption[] = [];
    const hide = new Set(hidden);
    for (const t of registry.all()) {
      if (t.hidden || hide.has(t.name)) continue;
      out.push({ key: t.name, title: t.title, description: t.description, icon: t.icon, keywords: t.keywords ?? "", category: t.category ?? "other", type: t.name, create: () => registry.create(t.name) });
      for (const v of t.variations ?? []) {
        if (!v.create) continue;
        out.push({ key: `${t.name}/${v.name}`, title: v.standalone ? v.title : `${t.title} ${v.title}`, description: v.description, icon: v.icon ?? t.icon, keywords: `${t.keywords ?? ""} ${v.keywords ?? ""}`, category: t.category ?? "other", type: t.name, create: v.create });
      }
    }
    return out;
  }, [registry, version, hidden]);
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
  const { store, ui, prefs } = ctx;
  const node = opt.create();
  prefs.countInsert(opt.type);
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
  // Bấm "+": chưa gõ tìm → 6 khối gợi ý (hay dùng nhất, không thì khối cơ bản) + "Xem tất cả"
  const quick = req.mode !== "slash" && !query ? suggestions(options, ctx.prefs.get().insertCounts) : null;
  // Toạ độ nguyên: đặt ở nửa điểm ảnh thì chữ bị nhoè
  const top = Math.round(Math.min(req.rect.bottom + 6, window.innerHeight - 320));
  const left = Math.round(Math.min(req.rect.left, window.innerWidth - 320));
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
      {quick ? (
        <>
          <div className="ecx-quick-grid" role="listbox" aria-label={labels.blocks}>
            {quick.map((o, i) => (
              <button key={o.key} type="button" role="option" aria-selected={false} className="ecx-block-tile" data-key={o.key} data-index={i}
                onMouseDown={(e) => e.preventDefault()} onClick={() => applyInsert(ctx, req, o)}>
                {o.icon ? <o.icon className="ecx-icon" /> : <Blocks className="ecx-icon" />}<span>{o.title}</span>
              </button>
            ))}
          </div>
          {ui.browseAll && <button type="button" className="ecx-quick-all" onClick={() => { ui.openInserter(null); ui.browseAll?.(); }}>{labels.browseAll}</button>}
        </>
      ) : (
      <div ref={listRef} className="ecx-inserter-list" role="listbox" aria-label={labels.blocks}>
        {results.length ? results.map((o, i) => (
          <button key={o.key} type="button" role="option" aria-selected={i === active} data-index={i} data-key={o.key} className={i === active ? "is-active" : undefined}
            onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => applyInsert(ctx, req, o)}>
            {o.icon ? <o.icon className="ecx-icon" /> : <Blocks className="ecx-icon" />}<span>{o.title}</span>
          </button>
        )) : <p className="ecx-muted">{labels.noResults}</p>}
      </div>
      )}
    </div>
  );
}

const SUGGESTED = ["paragraph", "heading", "image", "columns", "buttons", "group"];
/** 6 khối gợi ý của chèn nhanh: hay dùng nhất trước, đủ 6 bằng khối cơ bản. */
function suggestions(options: InsertOption[], counts: Record<string, number>): InsertOption[] {
  const base = options.filter((o) => !o.key.includes("/"));
  const used = base.filter((o) => (counts[o.type] ?? 0) > 0).sort((a, b) => (counts[b.type] ?? 0) - (counts[a.type] ?? 0));
  const out: InsertOption[] = [];
  for (const o of [...used, ...SUGGESTED.map((t) => base.find((x) => x.type === t)).filter(Boolean) as InsertOption[]]) if (!out.some((x) => x.type === o.type) && out.length < 6) out.push(o);
  return out;
}

const CATEGORY_ORDER = ["text", "media", "design", "widgets", "theme", "embed"];
/** Thư viện khối (cột trái): tìm, theo nhóm; bấm để chèn sau khối đang chọn, kéo thả vào khung soạn. */
export function InserterPanel({ onInserted }: { onInserted?(): void }) {
  const ctx = useEditor();
  const { store, labels } = ctx;
  const options = useInsertOptions();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"blocks" | "patterns">("blocks");
  const [hover, setHover] = useState<{ o: InsertOption; rect: DOMRect; y: number } | null>(null);
  const results = rankOptions(options, query);
  const catLabel: Record<string, string> = { text: labels.catText, media: labels.catMedia, design: labels.catDesign, widgets: labels.catWidgets, theme: labels.catTheme, embed: labels.catEmbed };
  const p = usePrefs(ctx.prefs);
  const mostUsed = p.mostUsedBlocks && !query ? options.filter((o) => !o.key.includes("/") && (p.insertCounts[o.type] ?? 0) > 0).sort((a, b) => (p.insertCounts[b.type] ?? 0) - (p.insertCounts[a.type] ?? 0)).slice(0, 6) : [];
  const groups = query ? [["", results] as const] : [...CATEGORY_ORDER, ...new Set(results.map((r) => r.category).filter((c) => !CATEGORY_ORDER.includes(c)))].map((c) => [c, results.filter((r) => r.category === c)] as const).filter(([, l]) => l.length);
  const insert = (o: InsertOption) => {
    const node = o.create();
    ctx.prefs.countInsert(o.type);
    const cur = store.currentIds[store.currentIds.length - 1];
    if (cur && store.locate(cur)) store.insertAfter(cur, [node]);
    else {
      const docId = store.activeDocId;
      store.insert(docId, null, store.getState().docs[docId].blocks.length, [node]);
    }
    onInserted?.();
  };
  return (
    <div className="ecx-inserter-panel" onMouseLeave={() => setHover(null)}>
      {hover && (
        // Thẻ xem trước khi rê chuột: biểu tượng, tên, mô tả của khối
        <div className="ecx-block-preview" role="tooltip" style={{ left: Math.round(hover.rect.right + 8), top: Math.round(Math.min(hover.y, window.innerHeight - 160)) }}>
          {hover.o.icon ? <hover.o.icon className="ecx-icon" /> : <Blocks className="ecx-icon" />}
          <strong>{hover.o.title}</strong>
          <p>{hover.o.description ?? blockDescription(hover.o.type, labels.lang) ?? ""}</p>
        </div>
      )}
      <div className="ecx-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "blocks"} className={tab === "blocks" ? "is-active" : undefined} onClick={() => setTab("blocks")}>{labels.blocks}</button>
        <button type="button" role="tab" aria-selected={tab === "patterns"} className={tab === "patterns" ? "is-active" : undefined} onClick={() => setTab("patterns")}>{labels.patterns}</button>
      </div>
      <input className="ecx-search" placeholder={labels.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={labels.search} />
      {tab === "patterns" ? <PatternList query={query} onInserted={onInserted} /> : <>
      {mostUsed.length > 0 && (
        <section data-section="most-used">
          <h3 className="ecx-panel-heading">{labels.mostUsedTitle}</h3>
          <div className="ecx-block-grid">
            {mostUsed.map((o) => (
              <button key={o.key} type="button" className="ecx-block-tile" data-key={o.key} onPointerDown={(e) => startDragNew(ctx, e, o)} onClick={() => insert(o)}>
                {o.icon ? <o.icon className="ecx-icon" /> : <Blocks className="ecx-icon" />}<span>{o.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {groups.map(([cat, list]) => (
        <section key={cat || "all"}>
          {cat && <h3 className="ecx-panel-heading">{catLabel[cat] ?? cat}</h3>}
          <div className="ecx-block-grid">
            {list.map((o) => (
              <button key={o.key} type="button" className="ecx-block-tile" data-key={o.key}
                onMouseEnter={(e) => setHover({ o, rect: (e.currentTarget.closest(".ecx-inserter-panel") as HTMLElement).getBoundingClientRect(), y: e.currentTarget.getBoundingClientRect().top })} onMouseLeave={() => setHover(null)}
                onPointerDown={(e) => startDragNew(ctx, e, o)} onClick={() => insert(o)}>
                {o.icon ? <o.icon className="ecx-icon" /> : <Blocks className="ecx-icon" />}<span>{o.title}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {!results.length && <p className="ecx-muted">{labels.noResults}</p>}
      </>}
    </div>
  );
}

/** Mẫu (lõi, theme, plugin, người dùng tạo): bấm chèn sau khối đang chọn; mẫu đồng bộ chèn thành tham chiếu. */
function PatternList({ query, onInserted }: { query: string; onInserted?(): void }) {
  const { store, labels } = useEditor();
  const all = useSyncExternalStore(onPatternsChange, registeredPatterns, registeredPatterns);
  const q = norm(query.trim());
  const list = q ? all.filter((p) => norm(`${p.title} ${p.keywords ?? ""} ${p.category}`).includes(q)) : all;
  const cats = [...new Set(list.map((p) => p.category))];
  const v1 = labels.lang === "vi" ? viLabels : enLabels;
  const catName = (c: string) => String((v1 as Record<string, unknown>)[`cat_${c}`] ?? c);
  const insert = (p: Pattern) => {
    const nodes = patternBlocks(p);
    if (!nodes.length) return;
    const cur = store.currentIds[store.currentIds.length - 1];
    if (cur && store.locate(cur)) store.insertAfter(cur, nodes, { focus: false });
    else { const docId = store.activeDocId; store.insert(docId, null, store.getState().docs[docId].blocks.length, nodes, { focus: false }); }
    onInserted?.();
  };
  if (!list.length) return <p className="ecx-muted">{labels.noResults}</p>;
  return (
    <>
      {cats.map((c) => (
        <section key={c}>
          <h3 className="ecx-panel-heading">{catName(c)}</h3>
          {list.filter((p) => p.category === c).map((p) => (
            <button key={p.name} type="button" className="ecx-pattern-card" data-pattern={p.name} onClick={() => insert(p)}>
              <strong>{p.title}</strong>{p.description && <span className="ecx-muted">{p.description}</span>}
            </button>
          ))}
        </section>
      ))}
    </>
  );
}

export const cloneNode = cloneBlock;
export type { BlockType };
