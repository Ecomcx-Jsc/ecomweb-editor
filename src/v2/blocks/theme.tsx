import { Star, AlignLeft, ArrowLeftRight, CalendarDays, ChevronsRight, Heading1, Copyright, FileText, Globe2, Image as ImageIcon, LayoutTemplate, ListOrdered, Menu, MessageSquare, PanelTop, Repeat2, Rows3, Search, SquareDashed, Tag, Type, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Block, DocBlocks, InnerBlocks, NestedDoc } from "../canvas/block-list";
import { DocScopeProvider, LoopPostContext, useDocScope, useDynamicData, useEditor, useEditorState } from "../context";
import type { DynamicPost, QueryArgs } from "../core/host";
import type { BNode } from "../core/model";
import { makeBlock } from "../core/model";
import type { BlockEditProps, BlockType } from "../core/registry";
import { useMsgs } from "../i18n";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
const align = (a: Record<string, unknown>): CSSProperties | undefined => (typeof a.textAlign === "string" ? { textAlign: a.textAlign as CSSProperties["textAlign"] } : undefined);
const merge = (bp: BlockEditProps["blockProps"], className: string, style?: CSSProperties) => ({ ...bp, className: cx(bp.className, "ecx-dynamic", className), style: { ...(bp.style ?? {}), ...style } });
const TEXT_ALIGN = { type: "string" as const, enum: ["left", "center", "right", "justify"] };

/** Khối động: hiện dữ liệu thật do ứng dụng cung cấp (host.dynamic), không có thì hiện tên khối. */
const useDynamic = useDynamicData;

function SiteTitleEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  const level = Number(block.attrs.level) || 0;
  const Tag = (level ? `h${Math.min(6, level)}` : "p") as "p";
  return <Tag {...merge(blockProps, "ecx-site-title", align(block.attrs))}>{d.site?.title || "Site Title"}</Tag>;
}
function SiteTaglineEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <p {...merge(blockProps, "ecx-site-tagline", align(block.attrs))}>{d.site?.tagline || "Tagline"}</p>;
}
function SiteLogoEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  const w = Number(block.attrs.width) || 120;
  return <div {...merge(blockProps, "ecx-site-logo")}>{d.site?.logo ? <img src={d.site.logo} alt="" width={w} draggable={false} /> : <span className="ecx-logo-placeholder" style={{ width: w }}><ImageIcon className="ecx-icon" /></span>}</div>;
}
/** Menu: cùng markup với website (theme-sdk) — nav.ecx-navigation-menu > ul > li > a, nút ☰ cho điện thoại. */
function NavigationEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  const { labels } = useEditor();
  const location = String(block.attrs.location ?? "primary");
  const items = d.menus?.[location];
  const mobile = block.attrs.mobile !== false;
  const t = useMsgs("blocks");
  if (!items?.length) {
    return (
      <div {...merge(blockProps, "ecx-navigation ecx-placeholder-block")}>
        <span className="ecx-placeholder-title"><Menu className="ecx-icon" /> {t.menu} · {location}</span>
        <span className="ecx-placeholder-summary">{t.noMenuIsAssigned}</span>
      </div>
    );
  }
  const menu = <nav className="ecx-navigation-menu" aria-label={location}><ul>{items.map((it, i) => <li key={i}><a href={it.url} onClick={(e) => e.preventDefault()}>{it.title}</a></li>)}</ul></nav>;
  return (
    <div {...merge(blockProps, cx("ecx-navigation", `ecx-navigation-${block.attrs.orientation ?? "horizontal"}`, mobile && "has-mobile"))}>
      <div className="ecx-navigation-items">{menu}</div>
      {mobile && <details className="ecx-navigation-toggle"><summary aria-label={t.menu}>☰</summary>{menu}</details>}
    </div>
  );
}
function SearchEdit({ block, blockProps }: BlockEditProps) {
  return (
    <div {...merge(blockProps, "ecx-search")}>
      <form onSubmit={(e) => e.preventDefault()}><input type="search" placeholder={String(block.attrs.placeholder || "…")} readOnly tabIndex={-1} /> <button type="button" tabIndex={-1}>{String(block.attrs.buttonText || "🔍")}</button></form>
    </div>
  );
}
function CopyrightEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <p {...merge(blockProps, "ecx-copyright", align(block.attrs))}>© {new Date().getFullYear()} {String(block.attrs.text || d.site?.title || "")}</p>;
}
function LanguageEdit({ blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <div {...merge(blockProps, "ecx-language-switcher")}>{(d.languages?.length ? d.languages : ["vi", "en"]).join(" · ")}</div>;
}
function PostTitleEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  const Tag = `h${Math.min(6, Math.max(1, Number(block.attrs.level) || 1))}` as "h1";
  return <Tag {...merge(blockProps, "ecx-post-title", align(block.attrs))}>{d.post?.title || "Post Title"}</Tag>;
}
function PostExcerptEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <p {...merge(blockProps, "ecx-post-excerpt")}>{d.post?.excerpt || "Lorem ipsum dolor sit amet…"}{block.attrs.moreText ? <> <a className="ecx-more-link">{String(block.attrs.moreText)}</a></> : null}</p>;
}
function FeaturedImageEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  const ratio = block.attrs.aspect && block.attrs.aspect !== "auto" ? String(block.attrs.aspect) : undefined;
  return (
    <div {...merge(blockProps, "ecx-featured-image", { aspectRatio: ratio ?? (d.post?.image ? undefined : "16/9"), overflow: "hidden" })}>
      {d.post?.image ? <img src={d.post.image} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="ecx-image-placeholder"><ImageIcon className="ecx-icon" /></span>}
    </div>
  );
}
function PostDateEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <p {...merge(blockProps, "ecx-post-date", align(block.attrs))}>{d.post?.date || new Date().toLocaleDateString()}</p>;
}
function PostAuthorEdit({ blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <p {...merge(blockProps, "ecx-post-author")}>{d.post?.author || "Admin"}</p>;
}
function PostTermsEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <p {...merge(blockProps, "ecx-post-terms")}>{(d.post?.terms?.length ? d.post.terms : block.attrs.taxonomy === "post_tag" ? ["Thẻ A", "Thẻ B"] : ["Chuyên mục A", "Chuyên mục B"]).join(String(block.attrs.separator ?? ", "))}</p>;
}
function ReadMoreEdit({ block, blockProps }: BlockEditProps) {
  return <p {...merge(blockProps, "ecx-read-more", align(block.attrs))}><a href="#" onClick={(e) => e.preventDefault()}>{String(block.attrs.text || "Đọc tiếp")}</a></p>;
}
function CommentsCountEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <p {...merge(blockProps, "ecx-comments-count", align(block.attrs))}>{d.post?.comments ?? 0}</p>;
}
function AvatarEdit({ block, blockProps }: BlockEditProps) {
  const size = Math.min(256, Math.max(16, Number(block.attrs.size) || 48));
  return <span {...merge(blockProps, "ecx-avatar")}><span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: "rgba(127,127,127,.3)" }} /></span>;
}
function QueryTotalEdit({ blockProps, block }: BlockEditProps) {
  return <p {...merge(blockProps, "ecx-query-total", align(block.attrs))}>0</p>;
}
function TermListEdit({ block, blockProps }: BlockEditProps) {
  const cloud = block.attrs.display === "cloud";
  const sample = block.attrs.taxonomy === "post_tag" ? ["Thẻ A", "Thẻ B", "Thẻ C"] : ["Chuyên mục A", "Chuyên mục B", "Chuyên mục C"];
  const n = (i: number) => (block.attrs.showCount ? ` (${3 - i})` : "");
  return cloud
    ? <p {...merge(blockProps, "ecx-term-list is-cloud")}>{sample.map((x, i) => <span key={x} style={{ marginRight: "0.5em", fontSize: `${1.3 - i * 0.2}em` }}>{x}{n(i)}</span>)}</p>
    : <ul {...merge(blockProps, "ecx-term-list")}>{sample.map((x, i) => <li key={x}>{x}{n(i)}</li>)}</ul>;
}
function LoginOutEdit({ block, blockProps }: BlockEditProps) {
  return <p {...merge(blockProps, "ecx-loginout", align(block.attrs))}><a href="#" onClick={(e) => e.preventDefault()}>{String(block.attrs.loginText || "Đăng nhập")}</a></p>;
}
function IconEdit({ block, blockProps }: BlockEditProps) {
  const size = Math.min(128, Math.max(12, Number(block.attrs.size) || 24));
  return <div {...merge(blockProps, "ecx-icon-block", align(block.attrs))}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Star width={size} height={size} />{String(block.attrs.name ?? "star")}</span></div>;
}
function FootnotesEdit({ block, blockProps }: BlockEditProps) {
  return <aside {...merge(blockProps, "ecx-footnotes")}>{block.attrs.title ? <p className="ecx-footnotes-title">{String(block.attrs.title)}</p> : null}<ol><li>Chú thích 1</li><li>Chú thích 2</li></ol></aside>;
}
function PageBreakEdit({ blockProps }: BlockEditProps) {
  return <div {...merge(blockProps, "ecx-page-break")} style={{ ...(blockProps.style ?? {}), borderTop: "2px dashed currentColor", opacity: 0.5, textAlign: "center", fontSize: 12 }}>Ngắt trang</div>;
}
function PageListEdit({ blockProps }: BlockEditProps) {
  return <nav {...merge(blockProps, "ecx-page-list")}><ul><li>Trang A<ul><li>Trang con</li></ul></li><li>Trang B</li></ul></nav>;
}
function ArchivesEdit({ block, blockProps }: BlockEditProps) {
  return <ul {...merge(blockProps, "ecx-archives")}>{["11/2026", "10/2026"].map((m, i) => <li key={m}>{m}{block.attrs.showCount === false ? "" : ` (${4 - i})`}</li>)}</ul>;
}
function CommentsEdit({ blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <div {...merge(blockProps, "ecx-comments")}><MessageSquare className="ecx-icon" /> {d.post?.comments ?? 0}</div>;
}
/** Tiêu đề trang lưu trữ / tìm kiếm (H1 của trang chuyên mục, thẻ, tác giả…). */
function QueryTitleEdit({ block, blockProps, labels }: BlockEditProps) {
  const d = useDynamic();
  const t = useMsgs("blocks");
  const Tag = `h${Math.min(6, Math.max(1, Number(block.attrs.level) || 1))}` as "h1";
  const name = d.archive?.title ?? (t.categoryName);
  return <Tag {...merge(blockProps, "ecx-query-title", align(block.attrs))}>{block.attrs.prefix ? (t.category) : ""}{name}</Tag>;
}
function TermDescriptionEdit({ block, blockProps, labels }: BlockEditProps) {
  const t = useMsgs("blocks");
  const d = useDynamic();
  return <div {...merge(blockProps, "ecx-term-description", align(block.attrs))}>{d.archive?.description || (t.theDescriptionOfThe)}</div>;
}
function BreadcrumbsEdit({ block, blockProps, labels }: BlockEditProps) {
  const d = useDynamic();
  const t = useMsgs("blocks");
  const sep = String(block.attrs.separator ?? "›");
  const items = [...(block.attrs.showHome !== false ? [t.home] : []), t.category2, ...(block.attrs.showCurrent !== false ? [d.post?.title || (t.currentPage)] : [])];
  return (
    <nav {...(merge(blockProps, "ecx-breadcrumbs") as object)}>
      <ol>{items.map((t, i) => <li key={i}>{i > 0 && <span className="ecx-breadcrumbs-sep" aria-hidden="true">{sep}</span>}{i < items.length - 1 ? <a>{t}</a> : <span>{t}</span>}</li>)}</ol>
    </nav>
  );
}
function PostNavigationEdit({ block, blockProps, labels }: BlockEditProps) {
  const t = useMsgs("blocks");
  const titles = block.attrs.showTitle !== false;
  return (
    <nav {...(merge(blockProps, "ecx-post-navigation") as object)}>
      <a className="ecx-post-navigation-prev"><span>{t.previous}</span>{titles && <strong>{t.previousPostTitle}</strong>}</a>
      <a className="ecx-post-navigation-next"><span>{t.next}</span>{titles && <strong>{t.nextPostTitle}</strong>}</a>
    </nav>
  );
}

function PostContentEdit({ blockProps }: BlockEditProps) {
  const { labels } = useEditor();
  const t = useMsgs("blocks");
  const scope = useDocScope();
  const frameId = useEditorState((s) => s.frameId);
  const rootId = useEditorState((s) => s.rootId);
  // Trong template đang bao quanh trang: đây là chỗ sửa nội dung trang (tài liệu gốc, sửa được)
  if (frameId && scope.docId === frameId) {
    return (
      <div {...merge(blockProps, "ecx-post-content ecx-frame-content")} data-ecx-editable-doc="">
        <DocScopeProvider value={{ docId: rootId, mode: "default", depth: scope.depth + 1, chain: [...(scope.chain ?? []), rootId] }}><DocBlocks docId={rootId} /></DocScopeProvider>
      </div>
    );
  }
  return <div {...merge(blockProps, "ecx-post-content ecx-content-placeholder")}><FileText className="ecx-icon" /> {t.postContent}</div>;
}

function QueryEdit({ block, blockProps }: BlockEditProps) {
  return <div {...merge(blockProps, "ecx-query")}><InnerBlocks parent={block} /></div>;
}
/** Thiết lập của khối query (mặc định giống website). */
export function queryArgs(a: Record<string, unknown>): QueryArgs {
  return {
    inherit: a.inherit !== false, postType: typeof a.postType === "string" && a.postType ? a.postType : "post",
    perPage: Math.min(100, Math.max(1, Number(a.perPage) || 10)),
    category: typeof a.category === "string" && a.category ? a.category : undefined, tag: typeof a.tag === "string" && a.tag ? a.tag : undefined,
    orderBy: typeof a.orderBy === "string" ? a.orderBy : "date", order: a.order === "asc" ? "asc" : "desc",
  };
}
/** Bài của danh sách: host.queryPosts theo thiết lập, không có thì bài mẫu (dynamic.posts). */
function useQueryPosts(q: QueryArgs): DynamicPost[] | undefined {
  const { host } = useEditor();
  const key = JSON.stringify(q);
  const [posts, setPosts] = useState<{ key: string; list: DynamicPost[] } | null>(null);
  useEffect(() => {
    if (!host.queryPosts) return;
    let alive = true;
    const t = setTimeout(() => host.queryPosts!(q).then((list) => { if (alive) setPosts({ key, list }); }, () => { if (alive) setPosts({ key, list: [] }); }), 150);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, host]);
  if (host.queryPosts) return posts?.list;
  return host.dynamic?.posts;
}
/** Bản sao chỉ xem của khuôn (id riêng cho mỗi mục: không trùng ô gõ, không chọn được). */
const previewClone = (n: BNode, tag: string): BNode => ({ ...n, id: `${n.id}~${tag}`, content: n.content?.map((c) => previewClone(c, tag)) });
function PreviewBlocks({ nodes, tag }: { nodes: BNode[]; tag: string }) {
  const scope = useDocScope();
  const clones = useMemo(() => nodes.map((n) => previewClone(n, tag)), [nodes, tag]);
  return <DocScopeProvider value={{ ...scope, mode: "disabled" }}>{clones.map((n) => <Block key={n.id} node={n} />)}</DocScopeProvider>;
}
/**
 * Khuôn mỗi bài: mỗi mục là một bài thật của danh sách; mục đang chọn sửa được (khối bài hiện dữ liệu của bài đó),
 * các mục khác là bản xem trước — bấm vào để sửa khuôn ngay trên bài đó.
 */
function PostTemplateEdit({ block, blockProps, editable, labels }: BlockEditProps) {
  const { store, ui } = useEditor();
  // Khối cha (query) đổi thiết lập → vẽ lại (khối này không đổi tham chiếu)
  const queryAttrs = useEditorState(useCallback(() => store.locate(block.id)?.parent?.attrs, [block.id, store])) ?? {};
  const q = queryArgs(queryAttrs);
  const posts = useQueryPosts(q);
  const [active, setActive] = useState(0);
  const grid = block.attrs.layout === "grid";
  const cols = Math.min(6, Math.max(1, Number(block.attrs.columns) || 3));
  const count = posts ? Math.max(1, Math.min(posts.length, q.perPage, 6)) : 3;
  const current = Math.min(active, count - 1);
  const t = useMsgs("blocks");
  return (
    <ul {...(merge(blockProps, cx("ecx-post-template", grid && "is-grid"), grid ? { display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: "1.5rem" } : undefined) as object)} data-ecx-posts={posts ? posts.length : ""}>
      {posts && !posts.length && <li className="ecx-post ecx-post-none">{t.noPostsMatchThese}</li>}
      {Array.from({ length: count }, (_, i) => {
        const post = posts?.[i] ?? null;
        if (i === current) return <li key="edit" className={cx("ecx-post", count > 1 && "is-active")}><LoopPostContext.Provider value={post}><InnerBlocks parent={block} /></LoopPostContext.Provider></li>;
        return (
          <li key={i} className="ecx-post ecx-post-preview" data-ecx-post-index={i} title={t.clickToEditThe}
            onMouseDownCapture={(e) => { if (!editable || ui.zoomOut || e.button !== 0) return; e.preventDefault(); e.stopPropagation(); setActive(i); }}>
            <LoopPostContext.Provider value={post}><PreviewBlocks nodes={block.content ?? []} tag={`p${i}`} /></LoopPostContext.Provider>
          </li>
        );
      })}
    </ul>
  );
}
function PaginationEdit({ blockProps }: BlockEditProps) {
  return <nav {...(merge(blockProps, "ecx-pagination") as object)}>‹ 1 2 3 ›</nav>;
}
function QueryEmptyEdit({ block, blockProps }: BlockEditProps) {
  return <div {...merge(blockProps, "ecx-query-empty")}><InnerBlocks parent={block} /></div>;
}

/** Vỏ của tài liệu lồng (header/footer, mẫu đồng bộ): viền tím + nhãn, bấm đúp để sửa riêng. */
function NestedShell({ blockProps, className, tag = "div", label, docRef, onFocusEdit, children }: { blockProps: BlockEditProps["blockProps"]; className: string; tag?: string; label: ReactNode; docRef: { kind: string; ref: unknown }; onFocusEdit(docId: string): void; children?: ReactNode }) {
  const Tag = tag as "div";
  return (
    <NestedDoc docRef={docRef} render={(content, state) => (
      <Tag {...(blockProps as object)} className={cx(blockProps.className, "ecx-nested", className, state.status !== "ready" && "is-pending")} data-ecx-nested={state.docId}
        onDoubleClick={(e) => { e.stopPropagation(); onFocusEdit(state.docId); }}>
        <span className="ecx-nested-label" contentEditable={false}>{label}{state.title && state.title !== String(docRef.ref) ? ` · ${state.title}` : ""}</span>
        {content}
        {children}
      </Tag>
    )} />
  );
}

function TemplatePartEdit({ block, blockProps, labels }: BlockEditProps) {
  const { store } = useEditor();
  const slug = String(block.attrs.slug ?? "");
  const tag = ["header", "footer", "aside", "section"].includes(String(block.attrs.tagName)) ? String(block.attrs.tagName) : "div";
  if (!slug) return <div {...merge(blockProps, "ecx-placeholder-block")}><span className="ecx-placeholder-title"><PanelTop className="ecx-icon" />{labels.templatePart}</span></div>;
  return <NestedShell blockProps={blockProps} className={cx("ecx-template-part", `ecx-template-part-${slug}`)} tag={tag} label={<><PanelTop className="ecx-icon" />{slug}</>} docRef={{ kind: "part", ref: slug }} onFocusEdit={(id) => store.enterFocus(id)} />;
}

function SyncedPatternEdit({ block, blockProps, labels }: BlockEditProps) {
  const { store } = useEditor();
  const ref = Number(block.attrs.ref);
  if (!ref) return <div {...merge(blockProps, "ecx-placeholder-block")}><span className="ecx-placeholder-title"><Repeat2 className="ecx-icon" />{labels.syncedPattern}</span></div>;
  return <NestedShell blockProps={blockProps} className="ecx-synced-pattern" label={<><Repeat2 className="ecx-icon" />{labels.syncedPattern}</>} docRef={{ kind: "pattern", ref }} onFocusEdit={(id) => store.enterFocus(id)} />;
}

export function themeBlocks(): BlockType[] {
  const theme = "theme";
  return [
    { name: "siteTitle", title: "Tên website", icon: Type, category: theme, keywords: "ten website site title", kind: "atom", edit: SiteTitleEdit, attributes: { level: { type: "integer", default: 0, min: 0, max: 6 }, link: { type: "boolean", default: true }, textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "siteLogo", title: "Logo", icon: ImageIcon, category: theme, keywords: "logo", kind: "atom", edit: SiteLogoEdit, attributes: { width: { type: "number", default: 120 }, link: { type: "boolean", default: true } }, supports: { style: true, className: true } },
    { name: "siteTagline", title: "Khẩu hiệu", icon: Type, category: theme, keywords: "khau hieu tagline mo ta", kind: "atom", edit: SiteTaglineEdit, attributes: { textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "navigation", title: "Menu", icon: Menu, category: theme, keywords: "menu dieu huong navigation", kind: "atom", edit: NavigationEdit, attributes: { location: { type: "string", default: "primary" }, orientation: { type: "string", enum: ["horizontal", "vertical"], default: "horizontal" }, mobile: { type: "boolean", default: true }, overlayMenu: { type: "string", enum: ["never", "mobile", "always"], default: "mobile" } }, supports: { style: true, className: true }, summary: (a) => a.location },
    { name: "search", title: "Tìm kiếm", icon: Search, category: theme, keywords: "tim kiem search", kind: "atom", edit: SearchEdit, attributes: { placeholder: { type: "string" }, buttonText: { type: "string" }, postType: { type: "string" }, showLabel: { type: "boolean", default: false }, buttonPosition: { type: "string", enum: ["right", "left", "below"], default: "right" } }, supports: { style: true, className: true } },
    { name: "languageSwitcher", title: "Chọn ngôn ngữ", icon: Globe2, category: theme, keywords: "ngon ngu language", kind: "atom", edit: LanguageEdit, attributes: { display: { type: "string", enum: ["inline", "dropdown"], default: "inline" } }, supports: { style: true, className: true } },
    { name: "copyright", title: "Bản quyền", icon: Copyright, category: theme, keywords: "ban quyen copyright", kind: "atom", edit: CopyrightEdit, attributes: { text: { type: "string" }, textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "postTitle", title: "Tiêu đề bài", icon: Type, category: theme, keywords: "tieu de bai post title", kind: "atom", edit: PostTitleEdit, attributes: { level: { type: "integer", default: 1, min: 1, max: 6 }, link: { type: "boolean", default: false }, textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "postContent", title: "Nội dung bài", icon: FileText, category: theme, keywords: "noi dung bai post content", kind: "atom", edit: PostContentEdit },
    { name: "postExcerpt", title: "Tóm tắt bài", icon: FileText, category: theme, keywords: "tom tat excerpt", kind: "atom", edit: PostExcerptEdit, attributes: { moreText: { type: "string" } }, supports: { style: true, className: true } },
    { name: "featuredImage", title: "Ảnh đại diện", icon: ImageIcon, category: theme, keywords: "anh dai dien featured image thumbnail", kind: "atom", edit: FeaturedImageEdit, attributes: { size: { type: "string", default: "large" }, link: { type: "boolean", default: false }, aspect: { type: "string", enum: ["auto", "16/9", "4/3", "1/1", "3/4"], default: "auto" } }, supports: { style: true, className: true } },
    { name: "postDate", title: "Ngày đăng", icon: CalendarDays, category: theme, keywords: "ngay dang date", kind: "atom", edit: PostDateEdit, attributes: { textAlign: TEXT_ALIGN, displayType: { type: "string", enum: ["published", "modified"], default: "published" } }, supports: { style: true, className: true } },
    { name: "postAuthor", title: "Tác giả", icon: User, category: theme, keywords: "tac gia author", kind: "atom", edit: PostAuthorEdit, attributes: { avatar: { type: "boolean", default: false }, showName: { type: "boolean", default: true }, showBio: { type: "boolean", default: false }, avatarSize: { type: "integer", default: 32, min: 16, max: 128 }, link: { type: "boolean", default: true } }, supports: { style: true, className: true } },
    { name: "postTerms", title: "Chuyên mục / thẻ", icon: Tag, category: theme, keywords: "chuyen muc the category tag terms", kind: "atom", edit: PostTermsEdit, attributes: { taxonomy: { type: "string", default: "category" }, separator: { type: "string", default: ", " } }, supports: { style: true, className: true } },
    { name: "comments", title: "Bình luận", icon: MessageSquare, category: theme, keywords: "binh luan comments", kind: "atom", edit: CommentsEdit, attributes: { title: { type: "string" }, perPage: { type: "integer", min: 1, max: 50 }, order: { type: "string", enum: ["asc", "desc"] }, avatarSize: { type: "integer", default: 40, min: 16, max: 128 }, showDate: { type: "boolean", default: true } } },
    { name: "readMore", title: "Đọc tiếp", icon: ChevronsRight, category: theme, keywords: "doc tiep read more", kind: "atom", edit: ReadMoreEdit, attributes: { text: { type: "string" }, textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "commentsCount", title: "Số bình luận", icon: MessageSquare, category: theme, keywords: "so binh luan comments count", kind: "atom", edit: CommentsCountEdit, attributes: { textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "avatar", title: "Ảnh đại diện tác giả", icon: ImageIcon, category: theme, keywords: "avatar anh dai dien tac gia", kind: "atom", edit: AvatarEdit, attributes: { size: { type: "integer", default: 48, min: 16, max: 256 }, link: { type: "boolean", default: true } }, supports: { style: true, className: true } },
    { name: "queryTotal", title: "Tổng số bài", icon: ListOrdered, category: theme, keywords: "tong so bai total", kind: "atom", edit: QueryTotalEdit, attributes: { textAlign: TEXT_ALIGN }, supports: { style: true, className: true }, structure: { parents: ["query"] } },
    { name: "termList", title: "Danh sách chuyên mục / thẻ", icon: Tag, category: theme, keywords: "danh sach chuyen muc the category tag cloud term list", kind: "atom", edit: TermListEdit, attributes: { taxonomy: { type: "string", default: "category" }, display: { type: "string", enum: ["list", "cloud"], default: "list" }, showCount: { type: "boolean", default: false }, hierarchical: { type: "boolean", default: false }, hideEmpty: { type: "boolean", default: true } }, supports: { style: true, className: true }, summary: (a) => a.taxonomy },
    { name: "loginout", title: "Đăng nhập / Đăng xuất", icon: User, category: theme, keywords: "dang nhap dang xuat login logout", kind: "atom", edit: LoginOutEdit, attributes: { loginText: { type: "string" }, logoutText: { type: "string" }, textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "icon", title: "Icon", icon: Star, category: theme, keywords: "icon bieu tuong", kind: "atom", edit: IconEdit, attributes: { name: { type: "string", enum: ["check", "x", "star", "heart", "arrowRight", "phone", "mail", "mapPin", "clock", "info", "alert", "externalLink"], default: "star" }, size: { type: "integer", default: 24, min: 12, max: 128 }, label: { type: "string" }, textAlign: TEXT_ALIGN }, supports: { style: true, className: true }, summary: (a) => a.name },
    { name: "footnotes", title: "Chú thích cuối bài", icon: ListOrdered, category: theme, keywords: "chu thich cuoi bai footnotes", kind: "atom", edit: FootnotesEdit, attributes: { title: { type: "string" } }, supports: { style: true, className: true } },
    { name: "pageBreak", title: "Ngắt trang", icon: PanelTop, category: theme, keywords: "ngat trang page break nextpage", kind: "atom", edit: PageBreakEdit, supports: { className: true } },
    { name: "pageList", title: "Danh sách trang", icon: ListOrdered, category: theme, keywords: "danh sach trang page list sitemap", kind: "atom", edit: PageListEdit, attributes: { parentId: { type: "integer", min: 1 }, depth: { type: "integer", default: 2, min: 1, max: 3 } }, supports: { style: true, className: true } },
    { name: "archives", title: "Lưu trữ theo tháng", icon: CalendarDays, category: theme, keywords: "luu tru thang archives", kind: "atom", edit: ArchivesEdit, attributes: { showCount: { type: "boolean", default: true }, limit: { type: "integer", default: 12, min: 1, max: 60 } }, supports: { style: true, className: true } },
    { name: "queryTitle", title: "Tiêu đề trang lưu trữ", icon: Heading1, category: theme, keywords: "tieu de luu tru chuyen muc archive query title h1", kind: "atom", edit: QueryTitleEdit, attributes: { level: { type: "integer", default: 1, min: 1, max: 6 }, prefix: { type: "boolean", default: false }, textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "termDescription", title: "Mô tả chuyên mục", icon: AlignLeft, category: theme, keywords: "mo ta chuyen muc term description", kind: "atom", edit: TermDescriptionEdit, attributes: { textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "breadcrumbs", title: "Breadcrumb", icon: ChevronsRight, category: theme, keywords: "breadcrumb duong dan dieu huong", kind: "atom", edit: BreadcrumbsEdit, attributes: { separator: { type: "string", default: "›" }, showHome: { type: "boolean", default: true }, showCurrent: { type: "boolean", default: true } }, supports: { style: true, className: true } },
    { name: "postNavigation", title: "Bài trước / bài sau", icon: ArrowLeftRight, category: theme, keywords: "bai truoc bai sau dieu huong post navigation", kind: "atom", edit: PostNavigationEdit, attributes: { showTitle: { type: "boolean", default: true } }, supports: { style: true, className: true } },
    {
      name: "query", title: "Danh sách bài", icon: Rows3, category: theme, keywords: "danh sach bai query loop tin tuc", kind: "container", edit: QueryEdit,
      attributes: { inherit: { type: "boolean", default: true }, postType: { type: "string", default: "post" }, perPage: { type: "integer", default: 10, min: 1, max: 100 }, category: { type: "string" }, tag: { type: "string" }, orderBy: { type: "string", enum: ["date", "title", "modified", "menu_order", "comment_count", "rand"], default: "date" }, order: { type: "string", enum: ["desc", "asc"], default: "desc" }, authorId: { type: "integer", min: 1 }, search: { type: "string" }, exclude: { type: "string" }, sticky: { type: "string", enum: ["any", "only", "exclude"], default: "any" }, orderByMeta: { type: "string" }, paginate: { type: "boolean", default: false } },
      create: () => makeBlock("query", { inherit: true }, [makeBlock("postTemplate", { layout: "list" }, [makeBlock("postTitle", { level: 2, link: true }), makeBlock("postExcerpt")]), makeBlock("pagination")]),
      supports: { style: true, className: true },
    },
    { name: "postTemplate", title: "Khuôn mỗi bài", icon: LayoutTemplate, kind: "container", edit: PostTemplateEdit, hidden: true, attributes: { layout: { type: "string", enum: ["list", "grid"], default: "list" }, columns: { type: "integer", default: 3, min: 1, max: 6 } }, structure: { parents: ["query"] } },
    { name: "pagination", title: "Phân trang", icon: ListOrdered, kind: "atom", edit: PaginationEdit, attributes: { type: { type: "string", enum: ["numbers", "prevNext", "both"], default: "both" }, midSize: { type: "integer", default: 2, min: 0, max: 5 } }, hidden: true, structure: { parents: ["query"] } },
    { name: "queryEmpty", title: "Khi không có bài", icon: SquareDashed, kind: "container", edit: QueryEmptyEdit, hidden: true, structure: { parents: ["query"] } },
    { name: "templatePart", title: "Phần dùng chung", icon: PanelTop, category: theme, keywords: "phan dung chung template part header footer", kind: "atom", edit: TemplatePartEdit, attributes: { slug: { type: "string" }, tagName: { type: "string", enum: ["div", "header", "footer", "aside", "section"], default: "div" } }, summary: (a) => a.slug },
    { name: "syncedPattern", title: "Mẫu đồng bộ", icon: Repeat2, category: "widgets", keywords: "mau dong bo synced pattern reusable", kind: "atom", edit: SyncedPatternEdit, attributes: { ref: { type: "integer" } }, hidden: true },
  ];
}
