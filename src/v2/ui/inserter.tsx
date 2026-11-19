import { LiveBlockPreview } from "./block-live-preview";
import { freshWithDefaults } from "../core/block-presets";
import { leavesItem } from "../core/structure";
import { blockDescription } from "./block-descriptions";
import { Blocks, Sparkles, X } from "lucide-react";
import { mediaAttrs } from "./media-actions";
import { cx } from "./attr-form";
import type { MediaItem } from "../../shared/types";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { norm } from "../../shared/util";
import { useEditor, useEditorState, useUiTick, type InserterRequest } from "../context";
import { cloneBlock, inlineLength, makeBlock, type BNode } from "../core/model";
import type { BlockType } from "../core/registry";
import { canContain } from "../core/structure";
import { startDragBlocks, startDragNew } from "../canvas/dnd";
import { usePrefs } from "../prefs";
import { onPatternsChange, patternBlocks, registeredPatterns, type Pattern } from "../core/patterns";
import { useSyncExternalStore } from "react";
import { labelsLegacy } from "../../shared/labels";

export interface InsertOption {
  key: string;
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  keywords: string;
  aliases?: string[];
  category: string;
  /** Loại khối gốc (kiểm tra chỗ đặt được). */
  type: string;
  create(): BNode;
  /** Lệnh riêng thay vì chèn khối (vd "ai-write" mở hộp Viết bằng AI). */
  action?: "ai-write";
}

/** Các lựa chọn chèn: khối + biến thể có hàm tạo riêng (cột 30/70…). */
const LEGACY_BLOCKS = new Set(["taskList", "preformatted", "pullquote", "rating", "footnotes", "pageBreak", "details", "youtube", "testimonial", "horizontalRule", "mediaText", "callout"]);
const PAGE_THEME_BLOCKS = new Set(["search", "query", "icon"]);

export function useInsertOptions(): InsertOption[] {
  const { registry, prefs, host, labels } = useEditor();
  const hidden = usePrefs(prefs).hiddenBlockTypes;
  const [version, setVersion] = useState(registry.getVersion());
  useEffect(() => registry.subscribe(() => setVersion(registry.getVersion())), [registry]);
  return useMemo(() => {
    void version;
    const out: InsertOption[] = [];
    const hide = new Set(hidden);
    for (const t of registry.all()) {
      // Bộ khối gọn: khối cũ đã gộp vào khối khác và khối giao diện (tên website, bài, bình luận…) chỉ hiện khi sửa template; nội dung cũ vẫn hiển thị
      const tpl = t.templateOnly || (t.category === "theme" && !PAGE_THEME_BLOCKS.has(t.name));
      if (t.hidden || hide.has(t.name)) continue;
      if (!host.showAllBlocks && (LEGACY_BLOCKS.has(t.name) || (tpl && host.scope !== "template"))) continue;
      out.push({ key: t.name, title: t.title, description: t.description, icon: t.icon, keywords: t.keywords ?? "", aliases: t.aliases, category: t.category ?? "other", type: t.name, create: () => registry.create(t.name) });
      for (const v of t.variations ?? []) {
        if (!v.create || (v.legacy && !host.showAllBlocks)) continue;
        out.push({ key: `${t.name}/${v.name}`, title: v.standalone ? v.title : `${t.title} ${v.title}`, description: v.description, icon: v.icon ?? t.icon, keywords: `${t.keywords ?? ""} ${v.keywords ?? ""}`, category: t.category ?? "other", type: t.name, create: v.create });
      }
    }
    if (host.ai) out.push({ key: "ai-write", title: labels.aiWrite, description: labels.aiWriteHint, icon: Sparkles, keywords: "ai viet write gpt claude tro ly", category: "text", type: "paragraph", create: () => makeBlock("paragraph"), action: "ai-write" });
    return out;
  }, [registry, version, hidden, host.scope, host.showAllBlocks, host.ai, labels]);
}

/** Lọc + xếp hạng: tên trùng hẳn > tên bắt đầu bằng chữ gõ > một từ trong tên > từ khoá; tiếng Việt không dấu. */
export function rankOptions(list: InsertOption[], query: string): InsertOption[] {
  const q = norm(query.trim());
  if (!q) return list;
  const scoreTitle = (raw: string, i: InsertOption) => {
    const title = norm(raw);
    if (title === q) return 4; // "/anh" → Ảnh trước Ảnh bìa, Ảnh + chữ
    if (title.startsWith(q)) return 3;
    if (title.split(/\s+/).some((w) => w.startsWith(q))) return 2;
    const words = [...title.split(/\s+/), ...norm(i.keywords).split(/\s+/)];
    if (words.some((w) => w.startsWith(q)) || i.key.toLowerCase().startsWith(q)) return 1;
    const parts = q.split(/\s+/);
    return parts.length > 1 && parts.every((p) => words.some((w) => w.startsWith(p))) ? 0.5 : 0;
  };
  const score = (i: InsertOption) => Math.max(scoreTitle(i.title, i), ...(i.aliases ?? []).map((a) => scoreTitle(a, i)));
  return list.map((i) => [i, score(i)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([i]) => i);
}

/** Chèn một lựa chọn theo yêu cầu (slash: thay đoạn "/…"; nút "+": vào vị trí). */
export function applyInsert(ctx: ReturnType<typeof useEditor>, req: InserterRequest, opt: InsertOption) {
  const { store, ui, prefs } = ctx;
  if (opt.action === "ai-write") {
    ui.openInserter(null);
    ui.openAiWrite?.({ blockId: req.mode === "slash" ? req.blockId : undefined, docId: req.docId, parentId: req.parentId ?? null, index: req.index ?? 0 });
    return;
  }
  const node = freshWithDefaults(opt.create());
  prefs.countInsert(opt.type);
  if (req.mode === "slash" && req.blockId) {
    const b = store.block(req.blockId);
    const topId = node.attrs.align === "full" ? store.locate(req.blockId)?.ancestors[0] : undefined;
    if (b && topId) {
      // Khối rộng hết trang (Phần…) gõ "/" trong khối khác: đặt sau khối cấp cao nhất, bỏ đoạn "/từ khoá"
      store.insertAfter(topId, [node], { replaceEmpty: false });
      if (inlineLength(b.inline) <= (req.query?.length ?? 0) + 1) store.remove([req.blockId], { focusNeighbor: false });
      ui.openInserter(null);
      afterInsert(ctx, node, opt.key.includes("/"));
      return;
    }
    // Đoạn chỉ còn "/từ khoá" → thay cả đoạn bằng khối mới
    const parentType = store.locate(req.blockId)?.parent?.type;
    if (b && leavesItem(parentType, node.type)) {
      // trong mục danh sách: khối mới ra sau danh sách, bỏ đoạn "/từ khoá" (mục còn lại tự có đoạn trống)
      store.insertAfter(req.blockId, [node], { replaceEmpty: false });
      store.remove([req.blockId], { focusNeighbor: false });
    } else if (b && inlineLength(b.inline) <= (req.query?.length ?? 0) + 1) store.replace(req.blockId, [node], focusOpts(node));
    else store.insertAfter(req.blockId, [node]);
  } else store.insert(req.docId, req.parentId, req.index, [node]);
  ui.openInserter(null);
  afterInsert(ctx, node, opt.key.includes("/"));
}
/** Việc sau mọi lần chèn khối (bảng chèn, gõ "/", rê thả): đánh dấu chữ mẫu chưa sửa, bật ô chọn bố cục nếu khối có, rồi đưa con trỏ vào ô chữ đầu tiên. */
function afterInsert(ctx: ReturnType<typeof useEditor>, node: BNode, variation = false) {
  const mark = (n: BNode) => { ctx.ui.fresh.add(n.id); if (Array.isArray(n.content)) n.content.forEach(mark); };
  mark(node);
  const t = ctx.registry.get(node.type);
  // Ô biến thể (Slider ảnh bìa…) đã chọn sẵn kiểu: không hỏi bố cục nữa
  if (!variation && t?.layouts?.length && t.layoutsOnInsert !== false) ctx.ui.requestPick(node.id);
  ctx.ui.focusFirstField(node.id);
  ctx.ui.markInsertAnchor(node.id);
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
  // Giữa hai section cấp trên cùng (nút "+ Thêm section"): có thêm tab Mẫu để chèn cả section tại chỗ
  const [patternTab, setPatternTab] = useState(false);
  useEffect(() => { setPatternTab(false); }, [req]);
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

  // Bấm ra ngoài: đóng. Pha capture vì nhiều khối chặn mousedown (stopPropagation) trước khi tới document.
  useEffect(() => {
    if (!req || req.mode === "slash") return;
    const close = (e: MouseEvent) => { if (!(e.target as Element).closest?.(".ecx-inserter-popover")) ui.openInserter(null); };
    const frameDoc = ui.canvasDoc;
    document.addEventListener("mousedown", close, true);
    frameDoc?.addEventListener("mousedown", close, true);
    return () => { document.removeEventListener("mousedown", close, true); frameDoc?.removeEventListener("mousedown", close, true); };
  }, [req, ui]);
  // Chọn khối khác bằng đường không bấm chuột (danh sách khối, phím tắt…): đóng
  const selKey = useEditorState((s) => (s.selection.ids.length ? s.selection.ids : [s.selection.editing ?? ""]).join(","));
  const openSel = useRef<string | null>(null);
  useEffect(() => { openSel.current = req && req.mode !== "slash" ? selKey : null; }, [req]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (openSel.current !== null && selKey !== openSel.current) ui.openInserter(null); }, [selKey, ui]);

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
      {req.mode === "between" && !req.parentId && (
        <div className="ecx-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!patternTab} className={!patternTab ? "is-active" : undefined} onClick={() => setPatternTab(false)}>{labels.blocks}</button>
          <button type="button" role="tab" aria-selected={patternTab} className={patternTab ? "is-active" : undefined} onClick={() => setPatternTab(true)}>{labels.patterns}</button>
        </div>
      )}
      {patternTab ? (
        <div className="ecx-inserter-list ecx-inserter-patterns"><PatternList query={query} at={req} onInserted={() => ui.openInserter(null)} /></div>
      ) : quick ? (
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
export function InserterPanel({ onInserted, onClose, initialQuery }: { onInserted?(): void; onClose?(): void; initialQuery?: string }) {
  const ctx = useEditor();
  const { store, labels } = ctx;
  useUiTick();
  const all = useInsertOptions();
  // Khối có luật vị trí (vd "Tổng số bài" chỉ trong Query): ẩn khi từ chỗ đang chọn đi lên tới gốc không có cấp nào nhận
  const cur = store.currentIds[store.currentIds.length - 1];
  const loc = cur ? store.locate(cur) : null;
  // Chèn vào đúng cấp của khối đang chọn (anh em của nó) → chỉ xét cha trực tiếp; xét cả tổ tiên thì khối như "Tổng số bài" hiện ra nhưng bị loại lặng lẽ khi chèn
  const parentType = loc?.ancestors.length ? store.block(loc.ancestors[loc.ancestors.length - 1])?.type ?? null : null;
  const options = all.filter((o) => canContain(parentType, o.type));
  const panelRef = useRef<HTMLDivElement>(null);
  // Mở bảng (nút Thêm khối) → focus vào ô tìm của bảng như WordPress; người dùng bàn phím gõ tìm ngay, Tab đi trong bảng
  useEffect(() => { panelRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }); }, []);
  // Escape đóng bảng (khi focus đang ở bảng hoặc chưa ở đâu cả; đang gõ trong khung soạn thì Escape thuộc về khung soạn)
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || ctx.ui.inserter) return;
      const a = document.activeElement as HTMLElement | null;
      if (a && !panelRef.current?.contains(a) && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
      onClose();
    };
    // Nút "Thêm khối" giữ focus trong khung soạn (iframe) nên phím Esc có thể rơi vào tài liệu của khung soạn, không phải trang ngoài
    const frameDoc = ctx.ui.canvasDoc;
    document.addEventListener("keydown", onKey);
    frameDoc?.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); frameDoc?.removeEventListener("keydown", onKey); };
  }, [onClose, ctx.ui]);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [tab, setTab] = useState<"blocks" | "patterns" | "media">("blocks");
  const [hover, setHover] = useState<{ o: InsertOption; rect: DOMRect; y: number } | null>(null);
  const results = rankOptions(options, query);
  const catLabel: Record<string, string> = { text: labels.catText, media: labels.catMedia, design: labels.catDesign, widgets: labels.catWidgets, theme: labels.catTheme, embed: labels.catEmbed };
  const p = usePrefs(ctx.prefs);
  // "Đã dùng nhiều" tính một lần lúc mở bảng: chèn xong mà mục này hiện/đổi thì cả lưới khối nhảy xuống, bấm nhanh liên tiếp dễ trượt sang khối khác
  const counts = useRef(p.insertCounts).current;
  const mostUsed = p.mostUsedBlocks && !query ? options.filter((o) => !o.key.includes("/") && (counts[o.type] ?? 0) > 0).sort((a, b) => (counts[b.type] ?? 0) - (counts[a.type] ?? 0)).slice(0, 6) : [];
  const lastInserted = useRef<string | null>(null);
  const groups = query ? [["", results] as const] : [...CATEGORY_ORDER, ...new Set(results.map((r) => r.category).filter((c) => !CATEGORY_ORDER.includes(c)))].map((c) => [c, results.filter((r) => r.category === c)] as const).filter(([, l]) => l.length);
  const insert = (o: InsertOption) => {
    // Lệnh riêng (Viết bằng AI): mở hộp thay vì chèn một đoạn trống — trước đây bấm ở bảng này chỉ ra đoạn văn rỗng, hộp AI không hiện
    if (o.action === "ai-write") {
      setHover(null);
      const curId = store.currentIds[store.currentIds.length - 1];
      const loc = curId ? store.locate(curId) : null;
      const empty = !!loc && loc.block.type === "paragraph" && !loc.block.inline?.length;
      const docId = loc?.docId ?? store.activeDocId;
      ctx.ui.openAiWrite?.({ blockId: empty ? curId : undefined, docId, parentId: loc?.parent?.id ?? null, index: loc ? loc.index + (empty ? 0 : 1) : store.getState().docs[docId].blocks.length });
      onInserted?.();
      return;
    }
    const node = freshWithDefaults(o.create());
    setHover(null);
    ctx.prefs.countInsert(o.type);
    const cur = store.currentIds[store.currentIds.length - 1];
    // Đoạn trống đang chọn mà chính lần chèn trước vừa tạo thì giữ lại (chèn tiếp ra sau nó); đoạn trống của người dùng thì thay như WordPress
    const curLoc0 = cur ? store.locate(cur) : null;
    // Khối rộng hết trang (Phần, Ảnh bìa hết trang) không nằm trong khối khác: đặt ngay sau khối cấp cao nhất đang chứa vùng chọn
    const top = node.attrs.align === "full" && curLoc0?.ancestors.length ? curLoc0.ancestors[0] : null;
    const curLoc = top ? store.locate(top) : curLoc0;
    const curBlock = top ? store.block(top) : cur ? store.block(cur) : null;
    // Vừa chèn một khối từ bảng này và vùng chọn vẫn là chỗ con trỏ tự vào (người dùng chưa bấm đi đâu): chèn tiếp NGAY SAU khối đó, cùng cấp — không lồng vào trong nó
    const anchor = ctx.ui.insertAnchor;
    const sameSel = !!anchor && !!store.block(anchor.id) && store.currentIds.join(",") === anchor.sel && cur !== anchor.id;
    // Đang chọn khối chứa còn trống (Nhóm, Cột… vừa tạo): chèn VÀO trong nó — chèn ra sau thì phải kéo vào thêm một bước
    if (curLoc && curBlock && Array.isArray(curBlock.content) && curBlock.content.length === 0 && canContain(curBlock.type, node.type)) store.insert(curLoc.docId, cur, 0, [node]);
    else if (sameSel && anchor && store.locate(anchor.id)) store.insertAfter(node.attrs.align === "full" && store.locate(anchor.id)!.ancestors.length ? store.locate(anchor.id)!.ancestors[0] : anchor.id, [node], { replaceEmpty: false });
    else if (cur && curLoc) store.insertAfter(top ?? cur, [node], { replaceEmpty: !top && cur !== lastInserted.current });
    else {
      const docId = store.activeDocId;
      store.insert(docId, null, store.getState().docs[docId].blocks.length, [node]);
    }
    lastInserted.current = node.id;
    afterInsert(ctx, node, o.key.includes("/"));
    onInserted?.();
  };
  return (
    <div ref={panelRef} className="ecx-inserter-panel" role="dialog" aria-label={labels.addBlock} onMouseLeave={() => setHover(null)}>
      {hover && (
        // Thẻ xem trước khi rê chuột: biểu tượng, tên, mô tả của khối
        <div className="ecx-block-preview" role="tooltip" style={{ left: Math.round(hover.rect.right + 8), top: Math.round(Math.min(hover.y, window.innerHeight - 330)) }}>
          {hover.o.icon ? <hover.o.icon className="ecx-icon" /> : <Blocks className="ecx-icon" />}
          <strong>{hover.o.title}</strong>
          <LiveBlockPreview id={hover.o.key} create={hover.o.create} />
          <p>{hover.o.description ?? blockDescription(hover.o.type, labels.lang) ?? ""}</p>
        </div>
      )}
      <div className="ecx-tabs">
        <div className="ecx-tablist" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "blocks"} className={tab === "blocks" ? "is-active" : undefined} onClick={() => setTab("blocks")}>{labels.blocks}</button>
        <button type="button" role="tab" aria-selected={tab === "patterns"} className={tab === "patterns" ? "is-active" : undefined} onClick={() => setTab("patterns")}>{labels.patterns}</button>
        {ctx.host.media?.list && <button type="button" role="tab" aria-selected={tab === "media"} className={tab === "media" ? "is-active" : undefined} onClick={() => setTab("media")}>{labels.mediaTab}</button>}
        </div>
        {onClose && <button type="button" className="ecx-left-close" aria-label={labels.close} title={labels.close} onClick={onClose}><X className="ecx-icon" /></button>}
      </div>
      <input className="ecx-search" placeholder={tab === "media" ? labels.searchMedia : labels.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={tab === "media" ? labels.searchMedia : labels.search} />
      {tab === "media" ? <MediaList query={query} onPick={(kind, m) => insert({ key: kind, title: kind, keywords: "", category: "media", type: kind, create: () => makeBlock(kind, { ...ctx.registry.create(kind).attrs, ...mediaAttrs(kind, [m]) }) })} />
      : tab === "patterns" ? <PatternList query={query} onInserted={onInserted} /> : <>
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

type MediaTabKind = "image" | "video" | "audio";
/** Tab Media: tệp mới nhất của thư viện theo loại; bấm = chèn khối Ảnh / Video / Âm thanh sau khối đang chọn. */
function MediaList({ query, onPick }: { query: string; onPick(kind: MediaTabKind, m: MediaItem): void }) {
  const { host, labels } = useEditor();
  const [kind, setKind] = useState<MediaTabKind>("image");
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setItems(null); setFailed(false);
    // Gõ tìm: chờ ngừng gõ rồi mới hỏi thư viện
    const t = setTimeout(() => {
      host.media!.list!({ kind, search: query.trim() || undefined }).then((l) => { if (live) setItems(l); }, () => { if (live) setFailed(true); });
    }, query ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [host.media, kind, query]);
  const kinds: Array<[MediaTabKind, string]> = [["image", labels.image], ["video", "Video"], ["audio", labels.audio]];
  return (
    <>
      <div className="ecx-seg is-text ecx-media-kinds" role="radiogroup" aria-label={labels.mediaTab}>
        {kinds.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={cx("ecx-seg-btn", kind === k && "is-active")} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {failed ? <p className="ecx-muted">{labels.loadFailed}</p> : !items ? <p className="ecx-muted">{labels.loading}</p> : !items.length ? <p className="ecx-muted">{labels.noResults}</p> : (
        <div className={cx("ecx-media-grid", kind !== "image" && "is-files")}>
          {items.map((m) => (
            <button key={m.id} type="button" className="ecx-media-item" title={m.title || m.fileName} onClick={() => onPick(kind, m)}>
              {kind === "image" ? <img src={m.sizes?.thumbnail?.url ?? m.sizes?.medium?.url ?? m.url} alt={m.alt || m.fileName} loading="lazy" /> : <span>{m.title || m.fileName}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Mẫu (lõi, theme, plugin, người dùng tạo): bấm chèn sau khối đang chọn; mẫu đồng bộ chèn thành tham chiếu. */
function PatternList({ query, onInserted, at }: { query: string; onInserted?(): void; at?: { docId: string; parentId: string | null; index: number } }) {
  const ctx = useEditor();
  const { store, labels } = ctx;
  const all = useSyncExternalStore(onPatternsChange, registeredPatterns, registeredPatterns);
  const q = norm(query.trim());
  const list = q ? all.filter((p) => norm(`${p.title} ${p.keywords ?? ""} ${p.category}`).includes(q)) : all;
  const cats = [...new Set(list.map((p) => p.category))];
  const v1 = labelsLegacy(labels.lang);
  const catName = (c: string) => String((v1 as Record<string, unknown>)[`cat_${c}`] ?? c);
  const insert = (p: Pattern) => {
    const nodes = patternBlocks(p);
    if (!nodes.length) return;
    const cur = store.currentIds[store.currentIds.length - 1];
    if (at) store.insert(at.docId, at.parentId, at.index, nodes, { focus: false });
    else if (cur && store.locate(cur)) store.insertAfter(cur, nodes, { focus: false });
    else { const docId = store.activeDocId; store.insert(docId, null, store.getState().docs[docId].blocks.length, nodes, { focus: false }); }
    // Mẫu nhiều khối: chọn khối đầu (không chọn cả nhóm → tab Cài đặt có nội dung, không chồng nhãn)
    if (nodes.length > 1) store.select([nodes[0].id]);
    onInserted?.();
  };
  if (!list.length) return <p className="ecx-muted">{labels.noResults}</p>;
  return (
    <>
      {cats.map((c) => (
        <section key={c}>
          <h3 className="ecx-panel-heading">{catName(c)}</h3>
          {list.filter((p) => p.category === c).map((p) => (
            <button key={p.name} type="button" className="ecx-pattern-card" data-pattern={p.name} onPointerDown={(e) => startDragBlocks(ctx, e, () => patternBlocks(p))} onClick={() => insert(p)}>
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
