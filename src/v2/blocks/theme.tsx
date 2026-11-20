import { ListFilter, Star, AlignLeft, ArrowLeftRight, CalendarDays, ChevronsRight, Heading1, Copyright, FileText, Globe2, Image as ImageIcon, LayoutTemplate, ListOrdered, Menu, MessageSquare, PanelTop, Repeat2, Rows3, Search, SquareDashed, Tag, Type, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SEARCH_ICON_PATH, clipExcerpt, resolveIcon, spacingValue } from "@ecomcx/ecomweb-content";
import { IconSvg } from "../ui/icon-svg";
import { useChoices } from "../ui/attr-form";
import { Block, DocBlocks, InnerBlocks, NestedDoc } from "../canvas/block-list";
import { DocScopeProvider, LoopPostContext, useDocScope, useDynamicData, useEditor, useEditorState } from "../context";
import type { DynamicPost, QueryArgs } from "../core/host";
import type { BNode } from "../core/model";
import { blocksFromDoc, makeBlock } from "../core/model";
import type { BlockEditProps, BlockType } from "../core/registry";
import { useMsgs } from "../i18n";
import { MediaPlaceholder } from "../ui/placeholders";

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
  const title = d.site?.title || "Site Title";
  // Website bọc tên trong liên kết về trang chủ (trừ khi tắt "link") → màu / gạch chân của theme cho <a> áp đúng
  return <Tag {...merge(blockProps, "ecx-site-title", align(block.attrs))}>{block.attrs.link === false ? title : <a href="#" rel="home" onClick={(e) => e.preventDefault()}>{title}</a>}</Tag>;
}
function SiteTaglineEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <p {...merge(blockProps, "ecx-site-tagline", align(block.attrs))}>{d.site?.tagline || "Tagline"}</p>;
}
/** Nhãn của ô giữ chỗ khối giao diện: cam = thiếu dữ liệu (kèm nút đi tới chỗ nhập). */
function Missing({ children }: { children: ReactNode }) {
  return <span className="ecx-ph-badge is-missing" contentEditable={false}>{children}</span>;
}
/** Nút đi tới trang quản trị nhập dữ liệu còn thiếu (host.openAdmin). */
function AdminButton({ target, args, children, primary }: { target: Parameters<NonNullable<ReturnType<typeof useEditor>["host"]["openAdmin"]>>[0]; args?: Record<string, string>; children: ReactNode; primary?: boolean }) {
  const { host } = useEditor();
  if (!host.openAdmin) return null;
  return <button type="button" className={cx("ecx-btn", primary && "ecx-btn-primary")} contentEditable={false} onMouseDown={(e) => e.stopPropagation()} onClick={() => host.openAdmin!(target, args)}>{children}</button>;
}

function SiteLogoEdit({ block, blockProps, editable }: BlockEditProps) {
  const d = useDynamic();
  const { host } = useEditor();
  const tp = useMsgs("placeholders");
  const [saved, setSaved] = useState<string | null>(null);
  const w = Number(block.attrs.width) || 120;
  const logo = d.site?.logo || saved;
  if (logo || !editable) return <div {...merge(blockProps, "ecx-site-logo")}>{logo ? <img src={logo} alt="" width={w} draggable={false} /> : <span className="ecx-logo-placeholder" style={{ width: w }}><ImageIcon className="ecx-icon" /></span>}</div>;
  // Chưa có logo: ô thả logo — chọn xong là đổi logo cho cả website (host.setSiteLogo); không có thì nút mở Tuỳ biến
  return (
    <div {...merge(blockProps, "ecx-site-logo ecx-ph-theme is-missing")} data-ecx-placeholder="logo">
      <Missing>{tp.noLogo}</Missing>
      {host.setSiteLogo
        ? <MediaPlaceholder kind="image" compact title={tp.dropLogo} onSelect={(items) => { host.setSiteLogo!(items[0]).then(() => setSaved(items[0].url), () => {}); }} />
        : <AdminButton target="customize" primary>{tp.openSettings}</AdminButton>}
      <p className="ecx-placeholder-hint">{tp.logoAll}</p>
    </div>
  );
}
/** Menu: cùng markup với website (theme-sdk) — nav.ecx-navigation-menu > ul > li > a, nút ☰ cho điện thoại. */
/** Nút nhỏ trên khối Menu đang chọn: mở nơi sửa menu của ứng dụng nhúng. */
function EditMenuButton({ location, selected }: { location: string; selected: boolean }) {
  const { host, labels } = useEditor();
  if (!selected || !host.editMenu) return null;
  return <button type="button" className="ecx-edit-link" contentEditable={false} onMouseDown={(e) => e.stopPropagation()} onClick={() => host.editMenu!(location)}>{labels.editMenu} ↗</button>;
}

function NavigationEdit({ block, blockProps, selected }: BlockEditProps) {
  const d = useDynamic();
  const { labels } = useEditor();
  const location = String(block.attrs.location ?? "primary");
  const items = d.menus?.[location];
  const overlay = ["never", "mobile", "tablet", "always"].includes(String(block.attrs.overlayMenu)) ? String(block.attrs.overlayMenu) : block.attrs.mobile === false ? "never" : "mobile";
  const mobile = overlay !== "never";
  const t = useMsgs("blocks");
  const tp = useMsgs("placeholders");
  const { host } = useEditor();
  if (!items?.length) {
    // Vị trí chưa có menu: nhãn cam + nút tạo / chọn menu (thay cho cột liên kết trống)
    return (
      <div {...merge(blockProps, "ecx-navigation ecx-media-placeholder ecx-ph-theme is-missing")} data-ecx-placeholder="menu">
        <span className="ecx-placeholder-title"><Menu className="ecx-icon" /> {t.menu}</span>
        <Missing>{tp.menuEmpty.replace("{location}", location)}</Missing>
        {host.editMenu && (
          <span className="ecx-ph-row" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="ecx-btn ecx-btn-primary" onClick={() => host.editMenu!(location)}>{tp.createMenu}</button>
            <button type="button" className="ecx-btn" onClick={() => host.editMenu!(location)}>{tp.pickMenu}</button>
          </span>
        )}
      </div>
    );
  }
  const menu = <nav className="ecx-navigation-menu" aria-label={location}><ul>{items.map((it, i) => <li key={i}><a href={it.url} onClick={(e) => e.preventDefault()}>{it.title}</a></li>)}</ul></nav>;
  return (
    <div {...merge(blockProps, cx("ecx-navigation", `ecx-navigation-${block.attrs.orientation ?? "horizontal"}`, mobile && "has-mobile", overlay === "tablet" && "bp-tablet", overlay === "always" && "overlay-always"))}>
      {overlay !== "always" && <div className="ecx-navigation-items">{menu}</div>}
      {mobile && <div className="ecx-nav-drawer"><button type="button" className="ecx-nav-burger" tabIndex={-1} aria-label={t.menu}><svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button></div>}
      <EditMenuButton location={location} selected={selected} />
    </div>
  );
}
/** Giống hệt website (SearchFormClient trong theme-sdk): cùng class `search-form` / `search-button-*`, nhãn, vị trí nút — để CSS của theme và các thuộc tính "Hiện nhãn", "Vị trí nút" thấy ngay trong khung soạn. */
function SearchEdit({ block, blockProps }: BlockEditProps) {
  const t = useMsgs("blocks");
  const pos = String(block.attrs.buttonPosition ?? "right");
  const label = String(block.attrs.buttonText || t.searchButton);
  const button = block.attrs.buttonStyle === "icon"
    ? <button type="button" tabIndex={-1} aria-label={label} title={label}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={SEARCH_ICON_PATH} /></svg></button>
    : <button type="button" tabIndex={-1}>{label}</button>;
  const collapse = block.attrs.collapse === "tablet" || block.attrs.collapse === "mobile" ? String(block.attrs.collapse) : undefined;
  const form = (
      <form role="search" data-ecx-inert="" onSubmit={(e) => e.preventDefault()} style={pos === "below" ? { display: "flex", flexDirection: "column", gap: 8 } : undefined}
        className={`search-form${pos !== "right" ? ` search-button-${pos}` : ""}`}>
        {block.attrs.showLabel === true && <label className="search-label">{t.searchLabel}</label>}
        {pos === "left" && button}
        <input type="search" placeholder={String(block.attrs.placeholder || t.searchPlaceholder)} aria-label={t.searchLabel} readOnly tabIndex={-1} />
        {block.attrs.scopeSelect === true && (
          <select className="search-scope" aria-label={t.searchScope} tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
            <option>{t.searchAll}</option>
            {String(block.attrs.scopes ?? "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const [v, ...r] = x.split(":"); return <option key={x}>{r.join(":").trim() || v}</option>; })}
          </select>
        )}
        {pos !== "left" && button}
      </form>
  );
  return (
    <div {...merge(blockProps, "ecx-search")}>
      {collapse ? (
        <div className={`ecx-search-collapse collapse-${collapse}`}>
          <button type="button" className="ecx-search-toggle" tabIndex={-1} aria-label={label}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={SEARCH_ICON_PATH} /></svg></button>
          <div className="ecx-search-panel">{form}</div>
        </div>
      ) : form}
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
  const title = d.post?.title || "Post Title";
  // Website bọc tiêu đề trong liên kết tới bài khi bật "link" (danh sách bài) — màu / gạch chân của theme cho <a>
  return <Tag {...merge(blockProps, "ecx-post-title", align(block.attrs))}>{block.attrs.link ? <a href="#" onClick={(e) => e.preventDefault()}>{title}</a> : title}</Tag>;
}
function PostExcerptEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  return <p {...merge(blockProps, "ecx-post-excerpt")}>{clipExcerpt(d.post?.excerpt || "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.", block.attrs.length)}{block.attrs.moreText ? <> <a className="ecx-more-link">{String(block.attrs.moreText)}</a></> : null}</p>;
}
function FeaturedImageEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  const tp = useMsgs("placeholders");
  const ratio = block.attrs.aspect && block.attrs.aspect !== "auto" ? String(block.attrs.aspect) : undefined;
  return (
    <div {...merge(blockProps, "ecx-featured-image", { aspectRatio: ratio ?? (d.post?.image ? undefined : "16/9"), overflow: "hidden" })}>
      {d.post?.image ? <img src={d.post.image} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (
        // Giải thích thay vì khung trống
        <span className="ecx-image-placeholder ecx-ph-theme" data-ecx-placeholder="featured"><ImageIcon className="ecx-icon" /><Missing>{tp.noFeatured}</Missing><span className="ecx-placeholder-hint">{tp.noFeaturedHint}</span></span>
      )}
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
  const names = d.post?.terms?.length ? d.post.terms : block.attrs.taxonomy === "post_tag" ? ["Thẻ A", "Thẻ B"] : ["Chuyên mục A", "Chuyên mục B"];
  const sep = String(block.attrs.separator ?? ", ");
  // website dựng mỗi mục là <a rel="tag"> (TermLinks) → canvas cũng là liên kết để ăn đúng kiểu liên kết của theme
  return <p {...merge(blockProps, "ecx-post-terms")}>{names.map((n, i) => <span key={i}>{i > 0 && sep}<a href="#" rel="tag" onClick={(e) => e.preventDefault()}>{n}</a></span>)}</p>;
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
  const stroke = Math.min(4, Math.max(0.5, Number(block.attrs.stroke) || 2));
  const shape = block.attrs.iconStyle === "circle" || block.attrs.iconStyle === "square" ? block.attrs.iconStyle : undefined;
  return <div {...merge(blockProps, "ecx-icon-block", align(block.attrs))}><span className={`ecx-icon-shape${shape ? ` is-${shape}` : ""}`} data-ecx-tip={typeof block.attrs.tooltip === "string" && block.attrs.tooltip.trim() ? block.attrs.tooltip.trim().slice(0, 120) : undefined} style={shape ? ({ "--ecx-icon-pad-auto": `${Math.round(size * 0.4)}px` } as CSSProperties) : undefined}><IconSvg name={resolveIcon(block.attrs.name) ? block.attrs.name : "star"} size={size} stroke={stroke} /></span></div>;
}function PageListEdit({ blockProps }: BlockEditProps) {
  return <nav {...merge(blockProps, "ecx-page-list")}><ul><li>Trang A<ul><li>Trang con</li></ul></li><li>Trang B</li></ul></nav>;
}
function ArchivesEdit({ block, blockProps }: BlockEditProps) {
  return <ul {...merge(blockProps, "ecx-archives")}>{["11/2026", "10/2026"].map((m, i) => <li key={m}>{m}{block.attrs.showCount === false ? "" : ` (${4 - i})`}</li>)}</ul>;
}
/** Cùng markup / class với khu bình luận của website (theme-sdk Comments) → CSS của theme tô canvas như website: 1 bình luận mẫu + form. */
function CommentsEdit({ block, blockProps }: BlockEditProps) {
  const d = useDynamic();
  const size = Math.min(128, Math.max(16, Number(block.attrs.avatarSize) || 40));
  const field = { readOnly: true, tabIndex: -1 } as const;
  return (
    <section {...merge(blockProps, "comments-area")}>
      <h2 className="comments-title">{String(block.attrs.title || "Bình luận")} ({d.post?.comments ?? 0})</h2>
      <ol className="comment-list">
        <li className="comment">
          <article>
            <header className="comment-meta">
              <span className="comment-avatar avatar" style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: "rgba(127,127,127,.3)", verticalAlign: "middle" }} />
              <b className="comment-author">Người đọc</b>
              {block.attrs.showDate === false ? null : <>{" · "}<time>01/11/2026</time></>}
            </header>
            <div className="comment-content"><p>Bình luận mẫu — website hiện bình luận thật của bài.</p></div>
          </article>
        </li>
      </ol>
      <form className="comment-form" onSubmit={(e) => e.preventDefault()}>
        <h3>Để lại bình luận</h3>
        <p><label>Bình luận *<textarea rows={5} {...field} /></label></p>
        <p className="comment-form-row"><label>Tên *<input {...field} /></label><label>Email *<input type="email" {...field} /></label></p>
        <p><label>Website<input type="url" {...field} /></label></p>
        <p><button type="button" tabIndex={-1}>Gửi bình luận</button></p>
      </form>
    </section>
  );
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
  // Như website: giữa = chuyên mục đầu tiên của bài (trang không có thì bỏ), cuối = tiêu đề bài / trang lưu trữ. Chưa có mẫu → chữ giữ chỗ.
  // Host cũ chưa gửi `category` → term đầu tiên (thường là chuyên mục)
  const middle = d.post ? ("category" in d.post ? d.post.category : d.post.terms?.[0]) : d.archive ? undefined : t.category2;
  const current = d.post?.title || d.archive?.title || t.currentPage;
  const items = [...(block.attrs.showHome !== false ? [t.home] : []), ...(middle ? [middle] : []), ...(block.attrs.showCurrent !== false ? [current] : [])];
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

/** Nội dung đã lưu của bài mẫu → khối chỉ xem (chỉ phần soạn được "richtext"; khối khác của ContentDoc bỏ qua khi xem). */
function sampleContentNodes(content: unknown): BNode[] | null {
  const blocks = (content as { blocks?: Array<{ type?: string; data?: unknown }> } | null)?.blocks;
  if (!Array.isArray(blocks)) return null;
  const nodes = blocks.filter((b) => b?.type === "richtext" && b.data).flatMap((b) => blocksFromDoc(b.data as never));
  return nodes.length ? nodes : null;
}
function PostContentEdit({ blockProps }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const sample = sampleContentNodes(useDynamicData().post?.content);
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
  // Có bài mẫu → nội dung thật của bài (chỉ xem; sửa nội dung ở trình soạn bài); chưa có → khung giữ chỗ
  if (sample) return <div {...merge(blockProps, "ecx-post-content ecx-content")}><PreviewBlocks nodes={sample} tag="sample-content" /></div>;
  return <div {...merge(blockProps, "ecx-post-content ecx-content-placeholder")} data-ecx-placeholder="post-content"><FileText className="ecx-icon" /> <span><strong>{t.postContent}</strong><br /><span className="ecx-placeholder-hint">{tp.postContentHint}</span></span></div>;
}

/** Kiểu hiển thị của danh sách bài khi chèn (như Query Loop của WordPress: chọn mẫu trước rồi hiện bài thật). */
const QUERY_LAYOUTS = {
  // Mô tả có giới hạn ký tự sẵn (không đổ cả bài vào thẻ); mọi phần bật / tắt được ở bảng "Hiển thị trong mỗi bài"
  list: () => [makeBlock("postTemplate", { layout: "list" }, [makeBlock("postTitle", { level: 2, link: true }), makeBlock("postDate"), makeBlock("postExcerpt", { length: 160 }), makeBlock("readMore")]), makeBlock("pagination")],
  grid: () => [makeBlock("postTemplate", { layout: "grid", columns: 3 }, [makeBlock("featuredImage", { link: true, aspect: "16/9" }), makeBlock("postTitle", { level: 3, link: true }), makeBlock("postExcerpt", { length: 100 })]), makeBlock("pagination")],
  cards: () => [makeBlock("postTemplate", { layout: "grid", columns: 3 }, [makeBlock("featuredImage", { link: true, aspect: "16/9" }), makeBlock("postTitle", { level: 3, link: true }), makeBlock("postDate"), makeBlock("postExcerpt", { length: 100 }), makeBlock("readMore")]), makeBlock("pagination")],
};
/**
 * Bảng "Hiển thị trong mỗi bài" của khối Danh sách bài: bật / tắt từng phần (ảnh, tiêu đề, ngày, tác giả, mô tả, nút xem thêm, phân trang)
 * và chỉnh riêng từng phần (tỉ lệ ảnh, cỡ tiêu đề, giới hạn ký tự mô tả, chữ nút). Bật / tắt = thêm / bỏ khối con trong "Khuôn mỗi bài" — vẫn kéo thả, sửa tay được như khối thường.
 */
const QUERY_PARTS = [
  { type: "featuredImage", label: "queryShowImage", make: () => makeBlock("featuredImage", { link: true, aspect: "16/9" }) },
  { type: "postTitle", label: "queryShowName", make: () => makeBlock("postTitle", { level: 3, link: true }) },
  { type: "postDate", label: "queryShowDate", make: () => makeBlock("postDate") },
  { type: "postAuthor", label: "queryShowAuthor", make: () => makeBlock("postAuthor") },
  { type: "postExcerpt", label: "queryShowExcerpt", make: () => makeBlock("postExcerpt", { length: 120 }) },
  { type: "readMore", label: "queryShowMore", make: () => makeBlock("readMore") },
] as const;
function QueryInspector({ block }: BlockEditProps) {
  const t = useMsgs("blocks") as Record<string, string>;
  const { store } = useEditor();
  useEditorState((s) => s.docs);
  const live = store.block(block.id);
  const tpl = live?.content?.find((c) => c.type === "postTemplate");
  const pagination = live?.content?.find((c) => c.type === "pagination");
  const docId = store.locate(block.id)?.docId;
  if (!live || !tpl || !docId) return null;
  const kids = tpl.content ?? [];
  const find = (type: string) => kids.find((c) => c.type === type);
  const toggle = (part: (typeof QUERY_PARTS)[number]) => {
    const cur = find(part.type);
    if (cur) { store.remove([cur.id], { focusNeighbor: false }); store.select([block.id], { editing: null }); return; }
    // Chèn đúng thứ tự chuẩn của các phần (ảnh → tiêu đề → ngày → tác giả → mô tả → xem thêm), giữ khối khác người dùng tự thêm
    const order = QUERY_PARTS.map((p) => p.type as string);
    const rank = order.indexOf(part.type);
    let at = kids.length;
    for (let i = 0; i < kids.length; i++) { const r = order.indexOf(kids[i].type); if (r > rank) { at = i; break; } }
    store.insert(docId, tpl.id, at, [part.make()], { select: false, focus: false });
    // Nút "Đọc tiếp" riêng thì bỏ chữ "đọc tiếp" gắn sau đoạn mô tả (tránh hai nút trùng nhau)
    if (part.type === "readMore") { const ex = find("postExcerpt"); if (ex?.attrs.moreText) store.setAttrs([ex.id], { moreText: undefined }); }
    store.select([block.id], { editing: null });   // bảng này không đóng sau mỗi lần bật / tắt
  };
  const togglePagination = () => {
    if (pagination) store.remove([pagination.id], { focusNeighbor: false });
    else store.insert(docId, block.id, (live.content ?? []).length, [makeBlock("pagination")], { select: false, focus: false });
    store.select([block.id], { editing: null });
  };
  const img = find("featuredImage"), title = find("postTitle"), excerpt = find("postExcerpt"), more = find("readMore");
  return (
    <div className="ecx-query-parts" role="group" aria-label={t.queryShowTitle}>
      <span className="ecx-field-label">{t.queryShowTitle}</span>
      {QUERY_PARTS.map((p) => <label key={p.type} className="ecx-check"><input type="checkbox" checked={!!find(p.type)} onChange={() => toggle(p)} /> {t[p.label]}</label>)}
      <label className="ecx-check"><input type="checkbox" checked={!!pagination} onChange={togglePagination} /> {t.queryShowPagination}</label>
      {img && (
        <label className="ecx-field"><span className="ecx-field-label">{t.queryAspect}</span>
          <select className="ecx-input" value={String(img.attrs.aspect ?? "auto")} onChange={(e) => store.setAttrs([img.id], { aspect: e.target.value })}>
            {["auto", "16/9", "4/3", "1/1", "3/4"].map((a) => <option key={a} value={a}>{a}</option>)}
          </select></label>
      )}
      {title && (
        <label className="ecx-field"><span className="ecx-field-label">{t.queryTitleLevel}</span>
          <select className="ecx-input" value={String(title.attrs.level ?? 3)} onChange={(e) => store.setAttrs([title.id], { level: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>H{n}</option>)}
          </select></label>
      )}
      {excerpt && (
        <label className="ecx-field"><span className="ecx-field-label">{t.queryExcerptLimit}</span>
          <input className="ecx-input" type="number" min={0} max={2000} value={Number(excerpt.attrs.length ?? 0)} onChange={(e) => store.setAttrs([excerpt.id], { length: Math.max(0, Number(e.target.value) || 0) || undefined })} /></label>
      )}
      {more && (
        <label className="ecx-field"><span className="ecx-field-label">{t.queryMoreText}</span>
          <input className="ecx-input" value={String(more.attrs.text ?? "")} placeholder="Đọc tiếp" onChange={(e) => store.setAttrs([more.id], { text: e.target.value || undefined })} /></label>
      )}
    </div>
  );
}

function QueryEdit({ block, blockProps, editable }: BlockEditProps) {
  const { store } = useEditor();
  const tp = useMsgs("placeholders");
  if (editable && !block.content?.length) {
    const items: Array<[keyof typeof QUERY_LAYOUTS, typeof Rows3, string]> = [["list", Rows3, tp.queryList], ["grid", LayoutTemplate, tp.queryGrid], ["cards", ImageIcon, tp.queryCards]];
    return (
      <div {...merge(blockProps, "ecx-query")} data-ecx-placeholder="query">
        <div className="ecx-media-placeholder ecx-ph-choose" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
          <p className="ecx-ph-title">{tp.queryChoose}</p>
          <div className="ecx-ph-choices">
            {items.map(([k, I, label]) => <button key={k} type="button" className="ecx-ph-choice" onClick={() => store.replace(block.id, [{ ...block, content: QUERY_LAYOUTS[k]() }])}><I className="ecx-icon" aria-hidden />{label}</button>)}
          </div>
        </div>
      </div>
    );
  }
  return <div {...merge(blockProps, "ecx-query")}><InnerBlocks parent={block} /></div>;
}
/** Thiết lập của khối query (mặc định giống website). */
export function queryArgs(a: Record<string, unknown>): QueryArgs {
  return {
    inherit: a.inherit !== false, postType: typeof a.postType === "string" && a.postType ? a.postType : "post",
    perPage: Math.min(100, Math.max(1, Number(a.perPage) || 10)),
    category: typeof a.category === "string" && a.category ? a.category : undefined, tag: typeof a.tag === "string" && a.tag ? a.tag : undefined,
    taxonomy: typeof a.taxonomy === "string" && a.taxonomy && (a.term || a.terms) ? a.taxonomy : undefined, term: typeof a.term === "string" && a.term ? a.term : typeof a.terms === "string" && a.terms ? a.terms.split(",")[0].trim() : undefined,
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
  const grid = block.attrs.layout === "grid" || block.attrs.layout === "carousel";
  const carousel = block.attrs.layout === "carousel";
  const responsive = block.attrs.layout === "grid" && (Number(block.attrs.columnsTablet) > 0 || Number(block.attrs.columnsMobile) > 0);
  const cols = Math.min(6, Math.max(1, Number(block.attrs.columns) || 3));
  const gap = spacingValue(block.attrs.gap) ?? "1.5rem";
  const count = posts ? Math.max(1, Math.min(posts.length, q.perPage, carousel ? cols : 6)) : 3;
  const current = Math.min(active, count - 1);
  const t = useMsgs("blocks");
  const tp = useMsgs("placeholders");
  return (
    <ul {...(merge(blockProps, cx("ecx-post-template", grid && "is-grid", responsive && "is-responsive"), responsive ? { "--per": cols, "--per-tablet": Number(block.attrs.columnsTablet) || Math.min(cols, 3), "--per-mobile": Number(block.attrs.columnsMobile) || Math.min(cols, 2), "--gap": gap } as CSSProperties : grid ? { display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap } : undefined) as object)} data-ecx-posts={posts ? posts.length : ""}>
      {posts && !posts.length && <li className="ecx-post ecx-post-none ecx-ph-theme is-missing" data-ecx-placeholder="no-posts"><Missing>{tp.noPosts}</Missing> <span className="ecx-placeholder-hint">{tp.noPostsHint}</span> <AdminButton target="newPost" args={{ postType: q.postType }}>+ {tp.writeFirst}</AdminButton></li>}
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
/** Bài thật của khối query cha (cùng thiết lập) — để phân trang / "không có bài" phản ánh đúng dữ liệu thay vì mẫu cố định. */
function useParentQueryPosts(block: BNode): { posts: DynamicPost[] | undefined; perPage: number } {
  const { store } = useEditor();
  const parentAttrs = useEditorState(useCallback(() => store.locate(block.id)?.parent?.attrs, [block.id, store])) ?? {};
  const q = queryArgs(parentAttrs);
  return { posts: useQueryPosts(q), perPage: q.perPage };
}
function PaginationEdit({ block, blockProps }: BlockEditProps) {
  const { posts, perPage } = useParentQueryPosts(block);
  // Ít bài hơn một trang → website không hiện phân trang: vẽ mờ một trang duy nhất
  const single = posts !== undefined && posts.length < perPage;
  return <nav {...(merge(blockProps, cx("ecx-pagination", single && "is-single")) as object)} style={single ? { opacity: 0.45 } : undefined}>{single ? "‹ 1 ›" : "‹ 1 2 3 ›"}</nav>;
}
/** Thanh lọc: cùng markup với website (QueryFilterBar) — mục phân loại thật lấy từ ứng dụng, không có thì mục mẫu. */
function QueryFilterEdit({ block, blockProps }: BlockEditProps) {
  const t = useMsgs("blocks");
  const a = block.attrs;
  const style = ["none", "links", "chips", "select", "checks"].includes(String(a.termStyle)) ? String(a.termStyle) : "links";
  const choices = useChoices("term", { taxonomy: String(a.taxonomy ?? "") });
  const names = (a.taxonomy ? choices : null)?.map((c) => c.label).slice(0, 8) ?? ["Danh mục 1", "Danh mục 2", "Danh mục 3"];
  return (
    <div {...merge(blockProps, "ecx-query-filter")}>
      {style === "select" && <select tabIndex={-1} aria-label={String(a.taxonomy ?? "")}><option>{String(a.allLabel || t.filterAll)}</option></select>}
      {(style === "links" || style === "chips" || style === "checks") && <nav className="ecx-filter-terms"><a className="is-active">{String(a.allLabel || t.filterAll)}</a>{names.map((n) => <a key={n}>{n}</a>)}</nav>}
      {a.showSearch === true && <input type="search" readOnly tabIndex={-1} placeholder={String(a.placeholder || t.filterSearch)} />}
      {a.showSort === true && <select tabIndex={-1} aria-label={t.filterSort}><option>{t.filterNewest}</option></select>}
      {a.showRange === true && <span className="ecx-filter-range"><input type="number" readOnly tabIndex={-1} placeholder="Từ" /> – <input type="number" readOnly tabIndex={-1} placeholder="Đến" /></span>}
      {a.showYear === true && <select tabIndex={-1} aria-label={t.filterYear}><option>{t.filterYear}</option></select>}
      {a.showReset === true && <a className="ecx-filter-reset">{t.filterReset}</a>}
      {style === "none" && !a.showSearch && !a.showSort && !a.showYear && !a.showReset && <span className="ecx-muted">{t.filterEmpty}</span>}
    </div>
  );
}
function QueryEmptyEdit({ block, blockProps, labels }: BlockEditProps) {
  const { posts } = useParentQueryPosts(block);
  // Danh sách đang có bài → khối "không có bài" không hiện trên website: thu gọn thành nhãn mờ (vẫn chọn / sửa được khi bấm vào)
  const [open, setOpen] = useState(false);
  const hidden = !!posts?.length && !open;
  return (
    <div {...merge(blockProps, cx("ecx-query-empty", hidden && "is-collapsed"))} style={hidden ? { opacity: 0.55 } : undefined}>
      {hidden && <button type="button" contentEditable={false} className="ecx-edit-link" onClick={() => setOpen(true)}>{labels.queryEmptyCollapsed}</button>}
      {!hidden && <InnerBlocks parent={block} />}
    </div>
  );
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
    { name: "navigation", title: "Menu", icon: Menu, category: theme, keywords: "menu dieu huong navigation", kind: "atom", edit: NavigationEdit, attributes: { location: { type: "string", default: "primary" }, orientation: { type: "string", enum: ["horizontal", "vertical"], default: "horizontal" }, mobile: { type: "boolean", default: true }, overlayMenu: { type: "string", enum: ["never", "mobile", "tablet", "always"], default: "mobile" } }, supports: { style: true, className: true }, summary: (a) => a.location },
    { name: "search", title: "Tìm kiếm", icon: Search, category: theme, keywords: "tim kiem search", kind: "atom", edit: SearchEdit, attributes: { placeholder: { type: "string" }, buttonText: { type: "string" }, postType: { type: "string" }, showLabel: { type: "boolean", default: false }, buttonPosition: { type: "string", enum: ["right", "left", "below"], default: "right" }, buttonStyle: { type: "string", enum: ["text", "icon"], default: "text" }, scopeSelect: { type: "boolean", default: false }, scopes: { type: "string" }, collapse: { type: "string", enum: ["never", "tablet", "mobile"], default: "never" } }, supports: { style: true, className: true } },
    { name: "languageSwitcher", title: "Chọn ngôn ngữ", icon: Globe2, category: theme, keywords: "ngon ngu language", kind: "atom", edit: LanguageEdit, attributes: { display: { type: "string", enum: ["inline", "dropdown"], default: "inline" } }, supports: { style: true, className: true } },
    { name: "copyright", title: "Bản quyền", icon: Copyright, category: theme, keywords: "ban quyen copyright", kind: "atom", edit: CopyrightEdit, attributes: { text: { type: "string" }, textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "postTitle", title: "Tiêu đề bài", icon: Type, category: theme, keywords: "tieu de bai post title", kind: "atom", edit: PostTitleEdit, attributes: { level: { type: "integer", default: 1, min: 1, max: 6 }, link: { type: "boolean", default: false }, textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "postContent", title: "Nội dung bài", icon: FileText, category: theme, keywords: "noi dung bai post content", kind: "atom", edit: PostContentEdit },
    { name: "postExcerpt", title: "Tóm tắt bài", icon: FileText, category: theme, keywords: "tom tat excerpt", kind: "atom", edit: PostExcerptEdit, attributes: { length: { type: "integer", default: 0, min: 0, max: 2000 }, moreText: { type: "string" } }, supports: { style: true, className: true } },
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
    { name: "icon", title: "Icon", icon: Star, category: theme, keywords: "icon bieu tuong", kind: "atom", edit: IconEdit, attributes: { tooltip: { type: "string" }, name: { type: "string", default: "star" }, size: { type: "integer", default: 24, min: 12, max: 128 }, label: { type: "string" }, textAlign: TEXT_ALIGN, stroke: { type: "number", default: 2, min: 0.5, max: 4 }, iconStyle: { type: "string", enum: ["plain", "circle", "square"], default: "plain" }, href: { type: "url" }, linkTarget: { type: "string", enum: ["_self", "_blank"] } }, supports: { style: true, className: true }, summary: (a) => a.name },
    { name: "pageList", title: "Danh sách trang", icon: ListOrdered, category: theme, keywords: "danh sach trang page list sitemap", kind: "atom", edit: PageListEdit, attributes: { parentId: { type: "integer", min: 1 }, depth: { type: "integer", default: 2, min: 1, max: 3 } }, supports: { style: true, className: true } },
    { name: "archives", title: "Lưu trữ theo tháng", icon: CalendarDays, category: theme, keywords: "luu tru thang archives", kind: "atom", edit: ArchivesEdit, attributes: { showCount: { type: "boolean", default: true }, limit: { type: "integer", default: 12, min: 1, max: 60 } }, supports: { style: true, className: true } },
    { name: "queryTitle", title: "Tiêu đề trang lưu trữ", icon: Heading1, category: theme, keywords: "tieu de luu tru chuyen muc archive query title h1", kind: "atom", edit: QueryTitleEdit, attributes: { level: { type: "integer", default: 1, min: 1, max: 6 }, prefix: { type: "boolean", default: false }, textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "termDescription", title: "Mô tả chuyên mục", icon: AlignLeft, category: theme, keywords: "mo ta chuyen muc term description", kind: "atom", edit: TermDescriptionEdit, attributes: { textAlign: TEXT_ALIGN }, supports: { style: true, className: true } },
    { name: "breadcrumbs", title: "Breadcrumb", icon: ChevronsRight, category: theme, keywords: "breadcrumb duong dan dieu huong", kind: "atom", edit: BreadcrumbsEdit, attributes: { separator: { type: "string", default: "›" }, showHome: { type: "boolean", default: true }, showCurrent: { type: "boolean", default: true } }, supports: { style: true, className: true } },
    { name: "postNavigation", title: "Bài trước / bài sau", icon: ArrowLeftRight, category: theme, keywords: "bai truoc bai sau dieu huong post navigation", kind: "atom", edit: PostNavigationEdit, attributes: { showTitle: { type: "boolean", default: true } }, supports: { style: true, className: true } },
    {
      name: "query", title: "Danh sách bài", icon: Rows3, category: theme, keywords: "danh sach bai query loop tin tuc", kind: "container", edit: QueryEdit, inspector: QueryInspector,
      attributes: { inherit: { type: "boolean", default: true }, postType: { type: "string", default: "post" }, perPage: { type: "integer", default: 10, min: 1, max: 100 }, category: { type: "string" }, tag: { type: "string" }, taxonomy: { type: "string" }, term: { type: "string" }, terms: { type: "string" }, termMode: { type: "string", enum: ["any", "all", "none"], default: "any" }, source: { type: "string", enum: ["latest", "manual", "related"], default: "latest" }, include: { type: "string" }, metaKey: { type: "string" }, metaCompare: { type: "string", enum: ["=", "!=", ">", ">=", "<", "<=", "LIKE", "EXISTS", "NOT EXISTS"], default: "=" }, metaValue: { type: "string" }, dateRange: { type: "string", enum: ["any", "7", "30", "90", "365"], default: "any" }, after: { type: "string" }, before: { type: "string" }, parent: { type: "integer", min: 1 }, offset: { type: "integer", min: 0, max: 1000 }, excludeCurrent: { type: "boolean", default: true }, authorCurrent: { type: "boolean", default: false }, urlFilters: { type: "boolean", default: false }, orderBy: { type: "string", enum: ["date", "title", "modified", "menu_order", "comment_count", "rand"], default: "date" }, order: { type: "string", enum: ["desc", "asc"], default: "desc" }, authorId: { type: "integer", min: 1 }, search: { type: "string" }, exclude: { type: "string" }, sticky: { type: "string", enum: ["any", "only", "exclude"], default: "any" }, orderByMeta: { type: "string" }, paginate: { type: "boolean", default: false } },
      // Mới chèn: chưa có khuôn → hỏi kiểu hiển thị trước (Danh sách / Lưới / Thẻ có ảnh)
      create: () => makeBlock("query", { inherit: true }, []),
      supports: { style: true, className: true },
    },
    { name: "postTemplate", title: "Khuôn mỗi bài", icon: LayoutTemplate, kind: "container", edit: PostTemplateEdit, hidden: true, attributes: { layout: { type: "string", enum: ["list", "grid", "carousel"], default: "list" }, columns: { type: "integer", default: 3, min: 1, max: 6 }, columnsTablet: { type: "integer", min: 1, max: 6 }, columnsMobile: { type: "integer", min: 1, max: 4 }, gap: { type: "string" }, arrows: { type: "boolean", default: true } }, structure: { parents: ["query"] } },
    { name: "pagination", title: "Phân trang", icon: ListOrdered, kind: "atom", edit: PaginationEdit, attributes: { type: { type: "string", enum: ["numbers", "prevNext", "both"], default: "both" }, midSize: { type: "integer", default: 2, min: 0, max: 5 } }, structure: { parents: ["query"] } },
    { name: "queryFilter", title: "Thanh lọc", icon: ListFilter, category: theme, keywords: "loc bo loc thanh loc filter danh muc sap xep tim", kind: "atom", edit: QueryFilterEdit, attributes: { taxonomy: { type: "string" }, termStyle: { type: "string", enum: ["none", "links", "chips", "select", "checks"], default: "links" }, showRange: { type: "boolean", default: false }, rangeParam: { type: "string" }, rangeLabel: { type: "string" }, rangeMax: { type: "number" }, allLabel: { type: "string" }, showSearch: { type: "boolean", default: false }, showSort: { type: "boolean", default: false }, showYear: { type: "boolean", default: false }, showReset: { type: "boolean", default: false }, sortOptions: { type: "string" }, placeholder: { type: "string" }, submitText: { type: "string" }, action: { type: "string" } }, supports: { style: true, className: true, align: true } },
    { name: "queryEmpty", title: "Khi không có bài", icon: SquareDashed, kind: "container", edit: QueryEmptyEdit, structure: { parents: ["query"] } },
    { name: "templatePart", title: "Phần dùng chung", icon: PanelTop, category: theme, keywords: "phan dung chung template part header footer", kind: "atom", edit: TemplatePartEdit, attributes: { slug: { type: "string" }, tagName: { type: "string", enum: ["div", "header", "footer", "aside", "section"], default: "div" } }, summary: (a) => a.slug },
    { name: "syncedPattern", title: "Mẫu đồng bộ", icon: Repeat2, category: "widgets", keywords: "mau dong bo synced pattern reusable", kind: "atom", edit: SyncedPatternEdit, attributes: { ref: { type: "integer" } }, hidden: true },
  ];
}
