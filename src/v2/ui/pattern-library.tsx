import { CONTENT_VERSION } from "@ecomcx/ecomweb-content";
import { LayoutTemplate, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { norm } from "../../shared/util";
import { labelsLegacy } from "../../shared/labels";
import { useEditor } from "../context";
import { fromRich, type BNode } from "../core/model";
import { onPatternsChange, registeredPatterns, type Pattern } from "../core/patterns";
import { patternNodes } from "../../shared/patterns";
import { useMsgs } from "../i18n";
import { cx } from "./attr-form";

type Scheme = "light" | "dark" | "brand";
type RichNode = Record<string, unknown> & { type: string; attrs?: Record<string, unknown>; content?: RichNode[]; text?: string };

/** Trang dựng sẵn = chuỗi mẫu của thư viện (tên mẫu thiếu thì bỏ qua). */
const PAGES: Array<{ id: string; patterns: string[] }> = [
  { id: "home", patterns: ["core/hero-split", "core/logos", "core/feat-grid6", "core/stats-band", "core/test3", "core/cta-band"] },
  { id: "home2", patterns: ["core/hero-gradient", "core/feat-cards4", "core/steps3", "core/price2", "core/faq2", "core/cta-split"] },
  { id: "about", patterns: ["core/hero-minimal", "core/text-cols", "core/stats4", "core/team4", "core/cta-band"] },
  { id: "services", patterns: ["core/hero-badge", "core/feat-alt", "core/steps-v", "core/price-table", "core/faq5", "core/cta-contact"] },
  { id: "contact", patterns: ["core/hero-minimal", "core/contact-split", "core/contact-cards", "core/faq2"] },
  { id: "team", patterns: ["core/team-intro", "core/team4", "core/test-big", "core/cta-band"] },
];

/** Kiểu màu: bọc mỗi mẫu trong một Nhóm có nền / chữ (sáng = giữ nguyên). */
function withScheme(nodes: RichNode[], scheme: Scheme): RichNode[] {
  if (scheme === "light" || !nodes.length) return nodes;
  const color = scheme === "dark" ? { background: "#0f1b24", text: "#ffffff" } : { background: "primary", text: "#ffffff" };
  return [{ type: "group", attrs: { align: "full", style: { color, padding: { base: { top: "xl", bottom: "xl" } } } }, content: nodes }];
}

// ---------------------------------------------------------------------------------------------------- chữ do AI viết
const TEXT_ATTRS = ["text", "title", "summary", "label", "quote", "name", "role", "subtitle", "buttonText", "placeholder"];
/** Chữ của mẫu theo thứ tự đọc (nút văn bản + thuộc tính chữ) — để AI viết lại cùng số lượng. */
export function patternTexts(nodes: RichNode[]): string[] {
  const out: string[] = [];
  const walk = (n: RichNode) => {
    if (n.type === "text" && typeof n.text === "string" && n.text.trim()) out.push(n.text);
    for (const k of TEXT_ATTRS) { const v = n.attrs?.[k]; if (typeof v === "string" && v.trim()) out.push(v); }
    n.content?.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}
/** Thay chữ theo đúng thứ tự `patternTexts` (thiếu phần tử thì giữ chữ cũ). */
export function replaceTexts(nodes: RichNode[], next: string[]): RichNode[] {
  let i = 0;
  const take = (old: string) => { const v = next[i++]; return typeof v === "string" && v.trim() ? v.slice(0, 400) : old; };
  const walk = (n: RichNode): RichNode => {
    const copy: RichNode = { ...n };
    if (n.type === "text" && typeof n.text === "string" && n.text.trim()) copy.text = take(n.text);
    if (n.attrs) { copy.attrs = { ...n.attrs }; for (const k of TEXT_ATTRS) { const v = n.attrs[k]; if (typeof v === "string" && v.trim()) copy.attrs[k] = take(v); } }
    if (n.content) copy.content = n.content.map(walk);
    return copy;
  };
  return nodes.map(walk);
}

interface Business { name: string; industry: string; about: string; tone: string }
const BIZ_KEY = "ecx-pattern-ai";
const loadBiz = (): Business => { try { return { name: "", industry: "", about: "", tone: "friendly", ...JSON.parse(localStorage.getItem(BIZ_KEY) ?? "{}") }; } catch { return { name: "", industry: "", about: "", tone: "friendly" }; } };

// ---------------------------------------------------------------------------------------------------- xem trước
/** Vẽ nội dung (định dạng lưu) bằng khung soạn ở chế độ chỉ xem — tầng editor truyền xuống (ui không import editor). */
export type RenderPreview = (value: { version: number; blocks: unknown[] }) => ReactNode;

/** Xem trước thật: vẽ mẫu bằng chính khung soạn (chỉ xem), rộng 1200px rồi thu nhỏ vừa thẻ; chỉ vẽ khi thẻ cuộn tới. */
function Preview({ nodes, height, render }: { nodes: RichNode[]; height: number; render: RenderPreview }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [scale, setScale] = useState(0.25);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1200));
    ro.observe(el);
    return () => { io.disconnect(); ro.disconnect(); };
  }, []);
  const value = useMemo(() => ({ version: CONTENT_VERSION, blocks: [{ type: "richtext", data: { type: "doc", content: nodes } }] }), [nodes]);
  return (
    <div ref={box} className="ecx-lib-preview" style={{ height }} aria-hidden="true">
      {seen && (
        <div className="ecx-lib-preview-inner" style={{ width: 1200, transform: `scale(${scale})`, height: height / scale }}>
          {render(value)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------- hộp thư viện
export function PatternLibraryButton({ renderPreview }: { renderPreview: RenderPreview }) {
  const t = useMsgs("library");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ecx-btn ecx-lib-open" onClick={() => setOpen(true)} aria-haspopup="dialog"><LayoutTemplate className="ecx-icon" />{t.open}</button>
      {open && <PatternLibrary renderPreview={renderPreview} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PatternLibrary({ onClose, renderPreview }: { onClose(): void; renderPreview: RenderPreview }) {
  const ctx = useEditor();
  const { store, labels, host } = ctx;
  const t = useMsgs("library") as Record<string, string>;
  const legacy = labelsLegacy(labels.lang) as unknown as Record<string, string>;
  const all = useSyncExternalStore(onPatternsChange, registeredPatterns, registeredPatterns);
  const [mode, setMode] = useState<"design" | "ai">("design");
  const [tab, setTab] = useState<"patterns" | "pages">("patterns");
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [scheme, setScheme] = useState<Scheme>("light");
  const [biz, setBiz] = useState<Business>(loadBiz);
  const [filled, setFilled] = useState<Record<string, RichNode[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { dialog.current?.querySelector<HTMLElement>("input, button")?.focus(); }, []);

  const byName = useMemo(() => new Map(all.map((p) => [p.name, p])), [all]);
  const nodesOf = (p: Pattern): RichNode[] => filled[p.name] ?? (patternNodes(p) as RichNode[]);
  const cats = useMemo(() => [...new Set(all.map((p) => p.category))], [all]);
  const q = norm(query.trim());
  const patterns = all.filter((p) => (cat === "all" || p.category === cat) && (!q || norm(`${p.title} ${p.keywords ?? ""} ${p.category}`).includes(q)));
  const pages = PAGES.map((pg) => ({ ...pg, list: pg.patterns.map((n) => byName.get(n)).filter(Boolean) as Pattern[] })).filter((pg) => pg.list.length && (cat === "all" || pg.id === cat) && (!q || norm(t[`page_${pg.id}`] ?? pg.id).includes(q)));
  const catName = (c: string) => legacy[`cat_${c}`] ?? c;

  const insert = (nodes: RichNode[]) => {
    const blocks: BNode[] = withScheme(nodes, scheme).map((n) => fromRich(n as never));
    if (!blocks.length) return;
    const cur = store.currentIds[store.currentIds.length - 1];
    const docId = store.activeDocId;
    if (cur && store.locate(cur)) store.insertAfter(cur, blocks, { focus: false });
    else store.insert(docId, null, store.getState().docs[docId].blocks.length, blocks, { focus: false });
    store.select([blocks[0].id]);
    onClose();
  };

  /** AI viết chữ cho các mẫu đang hiện (tối đa 8 mẫu một lần, chạy song song), giữ nguyên bố cục. */
  const fill = async () => {
    if (!host.ai) return;
    try { localStorage.setItem(BIZ_KEY, JSON.stringify(biz)); } catch { /* chế độ riêng tư */ }
    setBusy(true); setError(null);
    const list = (tab === "pages" ? pages.flatMap((pg) => pg.list) : patterns).filter((p, i, a) => a.indexOf(p) === i).slice(0, 8);
    const brief = `${t.aiBrief}\n- ${t.aiName}: ${biz.name}\n- ${t.aiIndustry}: ${biz.industry}\n- ${t.aiAbout}: ${biz.about}\n- ${t.aiTone}: ${t[`tone_${biz.tone}`] ?? biz.tone}`;
    const results = await Promise.allSettled(list.map(async (p) => {
      const base = patternNodes(p) as RichNode[];
      const texts = patternTexts(base);
      if (!texts.length) return [p.name, base] as const;
      const out = await host.ai!.run("custom", JSON.stringify(texts), { language: labels.lang, instruction: brief });
      const json = out.slice(out.indexOf("["), out.lastIndexOf("]") + 1);
      const next = JSON.parse(json);
      if (!Array.isArray(next)) throw new Error("bad");
      return [p.name, replaceTexts(base, next.map(String))] as const;
    }));
    const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    setFilled((f) => ({ ...f, ...Object.fromEntries(ok) }));
    if (ok.length < list.length) setError(t.aiFailed);
    setBusy(false);
  };

  return (
    <div className="ecx-modal-backdrop ecx-lib-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <div ref={dialog} className="ecx-lib" role="dialog" aria-modal="true" aria-label={t.title}>
        <aside className="ecx-lib-side">
          <div className="ecx-lib-mode" role="radiogroup" aria-label={t.title}>
            <button type="button" role="radio" aria-checked={mode === "design"} className={cx(mode === "design" && "is-active")} onClick={() => setMode("design")}>{t.byDesign}</button>
            {host.ai && <button type="button" role="radio" aria-checked={mode === "ai"} className={cx(mode === "ai" && "is-active")} onClick={() => setMode("ai")}><Sparkles className="ecx-icon" />{t.withAi}</button>}
          </div>
          <div className="ecx-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "patterns"} className={cx(tab === "patterns" && "is-active")} onClick={() => { setTab("patterns"); setCat("all"); }}>{t.patterns}</button>
            <button type="button" role="tab" aria-selected={tab === "pages"} className={cx(tab === "pages" && "is-active")} onClick={() => { setTab("pages"); setCat("all"); }}>{t.pages}</button>
          </div>
          <nav className="ecx-lib-cats" aria-label={t.categories}>
            <button type="button" aria-current={cat === "all" || undefined} onClick={() => setCat("all")}>{t.all}</button>
            {(tab === "patterns" ? cats.map((c) => [c, catName(c)] as const) : PAGES.map((pg) => [pg.id, t[`page_${pg.id}`] ?? pg.id] as const)).map(([id, name]) => (
              <button key={id} type="button" aria-current={cat === id || undefined} onClick={() => setCat(id)}>{name}</button>
            ))}
          </nav>
          <div className="ecx-lib-scheme">
            <span>{t.scheme}</span>
            <div role="radiogroup" aria-label={t.scheme}>
              {(["light", "dark", "brand"] as const).map((s) => <button key={s} type="button" role="radio" aria-checked={scheme === s} aria-label={t[`scheme_${s}`]} title={t[`scheme_${s}`]} className={cx(`is-${s}`, scheme === s && "is-active")} onClick={() => setScheme(s)} />)}
            </div>
          </div>
        </aside>
        <section className="ecx-lib-main">
          <header className="ecx-lib-bar">
            <label className="ecx-lib-search"><Search className="ecx-icon" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === "patterns" ? t.searchPatterns : t.searchPages} aria-label={tab === "patterns" ? t.searchPatterns : t.searchPages} /></label>
            <span className="ecx-muted">{(tab === "patterns" ? patterns.length : pages.length)} {tab === "patterns" ? t.countPatterns : t.countPages}</span>
            <button type="button" className="ecx-lib-close" aria-label={labels.close} onClick={onClose}><X className="ecx-icon" /></button>
          </header>
          {mode === "ai" && (
            <form className="ecx-lib-ai" onSubmit={(e) => { e.preventDefault(); void fill(); }}>
              <label>{t.aiName}<input className="ecx-input" value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} required maxLength={80} /></label>
              <label>{t.aiIndustry}<input className="ecx-input" value={biz.industry} onChange={(e) => setBiz({ ...biz, industry: e.target.value })} maxLength={80} /></label>
              <label className="is-wide">{t.aiAbout}<textarea className="ecx-input" rows={2} value={biz.about} onChange={(e) => setBiz({ ...biz, about: e.target.value })} maxLength={500} /></label>
              <label>{t.aiTone}<select className="ecx-input" value={biz.tone} onChange={(e) => setBiz({ ...biz, tone: e.target.value })}>{["friendly", "professional", "luxury", "youthful"].map((x) => <option key={x} value={x}>{t[`tone_${x}`]}</option>)}</select></label>
              <button type="submit" className="ecx-btn ecx-btn-primary" disabled={busy}><Sparkles className="ecx-icon" />{busy ? t.aiWorking : t.aiRun}</button>
              {error && <p className="ecx-lib-error" role="alert">{error}</p>}
            </form>
          )}
          <div className={cx("ecx-lib-grid", tab === "pages" && "is-pages")}>
            {tab === "patterns" ? patterns.map((p) => (
              <div key={p.name} role="button" tabIndex={0} className="ecx-lib-card" data-pattern={p.name} aria-label={p.title} onClick={() => insert(nodesOf(p))} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); insert(nodesOf(p)); } }}>
                <Preview nodes={withScheme(nodesOf(p), scheme)} height={200} render={renderPreview} />
                <span className="ecx-lib-card-name">{p.title}<em>{catName(p.category)}</em></span>
              </div>
            )) : pages.map((pg) => {
              const nodes = pg.list.flatMap(nodesOf);
              return (
                <div key={pg.id} role="button" tabIndex={0} className="ecx-lib-card" data-page={pg.id} aria-label={t[`page_${pg.id}`] ?? pg.id} onClick={() => insert(nodes)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); insert(nodes); } }}>
                  <Preview nodes={withScheme(nodes, scheme)} height={420} render={renderPreview} />
                  <span className="ecx-lib-card-name">{t[`page_${pg.id}`] ?? pg.id}<em>{pg.list.length} {t.sections}</em></span>
                </div>
              );
            })}
            {(tab === "patterns" ? !patterns.length : !pages.length) && <p className="ecx-muted">{labels.noResults}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

