import { blockShell, embedInfo, isSafeUrl } from "@ecomcx/ecomweb-content";
import { ArrowDown, ArrowUp, Code2, File as FileIcon, Image as ImageIcon, Images, ListTree, Music, Plus, Share2, Video, Play, Globe, X } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useEditor } from "../context";
import type { BlockEditProps, BlockType } from "../core/registry";
import { RichText } from "../text/rich-text";
import { BoundText, useBindingPreview } from "../ui/bindings";
import { ImageHandle } from "./resize";
import { MediaActions, mediaAttrs, useFileDrop } from "./media-actions";
import type { MediaItem, MediaKind } from "../../shared/types";
import { useMsgs } from "../i18n";
import { format } from "../../i18n";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
const safe = (u: unknown) => (typeof u === "string" && isSafeUrl(u) ? u : "");

/** Ô trống của khối media: chọn từ thư viện hoặc dán đường dẫn. */
function MediaPlaceholder({ blockId, kind, icon: Icon, title, blockProps }: { blockId: string; kind: MediaKind; icon: typeof ImageIcon; title: string; blockProps: BlockEditProps["blockProps"] }) {
  const { store, labels } = useEditor();
  const select = (items: MediaItem[]) => store.setAttrs([blockId], mediaAttrs(kind, items));
  const drop = useFileDrop(kind, select);
  return (
    <div {...blockProps} {...drop.props} className={cx(blockProps.className, "ecx-media-placeholder", drop.over && "is-drop-target")}>
      <span className="ecx-placeholder-title"><Icon className="ecx-icon" />{title}</span>
      <p className="ecx-placeholder-hint">{labels.dropHint[kind] ?? labels.dropHint.file}</p>
      <MediaActions kind={kind} onSelect={select} onUrl={kind === "gallery" ? undefined : (url) => store.setAttrs([blockId], { src: url })} />
    </div>
  );
}

function ImageEdit({ block, blockProps, setAttrs, editable, labels, selected }: BlockEditProps) {
  const a = block.attrs;
  const bSrc = useBindingPreview(block, "src"), bAlt = useBindingPreview(block, "alt"), bCap = useBindingPreview(block, "caption");
  const src = bSrc.bound ? safe(bSrc.value) : safe(a.src);
  if (bSrc.bound && !src) return <figure {...blockProps} className={cx(blockProps.className, "ecx-image cms-image")}><BoundText tagName="div" className="ecx-bound-media" preview={bSrc} /></figure>;
  if (!src) return <MediaPlaceholder blockId={block.id} kind="image" icon={ImageIcon} title={labels.image} blockProps={blockProps} />;
  const cls = blockShell("image", a)!.className;
  return (
    <figure {...blockProps} className={cx(blockProps.className, cls)} style={{ ...(blockProps.style ?? {}), position: "relative" }}>
      {selected && editable && <ImageHandle blockId={block.id} />}
      <img src={src} alt={bAlt.bound ? bAlt.value ?? "" : String(a.alt ?? "")} data-ecx-bound={bSrc.bound ? "" : undefined} title={bSrc.bound ? bSrc.label : undefined} width={Number(a.width) || undefined} height={Number(a.height) || undefined} draggable={false} style={Number(a.width) ? { width: Number(a.width), maxWidth: "100%", height: "auto" } : undefined} />
      {bCap.bound ? <BoundText tagName="figcaption" preview={bCap} /> : (a.caption || editable) && (
        <RichText blockId={block.id} field="caption" tagName="figcaption" value={String(a.caption ?? "")} onChange={(v) => setAttrs({ caption: v })} placeholder={labels.caption} editable={editable} />
      )}
    </figure>
  );
}

function GalleryEdit({ block, blockProps, labels }: BlockEditProps) {
  const images = (Array.isArray(block.attrs.images) ? block.attrs.images : []) as Array<{ src: string; alt?: string }>;
  if (!images.length) return <MediaPlaceholder blockId={block.id} kind="gallery" icon={Images} title="Gallery" blockProps={blockProps} />;
  const cols = Math.min(6, Math.max(1, Number(block.attrs.columns) || 3));
  void labels;
  return (
    <figure {...blockProps} className={cx(blockProps.className, blockShell("gallery", block.attrs)!.className)} style={{ ...(blockProps.style ?? {}), ...(blockShell("gallery", block.attrs)!.style as CSSProperties) }}>
      {images.map((im, i) => <figure key={i} className="ecx-gallery-item cms-gallery-item" style={{ margin: 0 }}><img src={safe(im.src)} alt={im.alt ?? ""} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", aspectRatio: "1" }} /></figure>)}
      {block.attrs.caption ? <figcaption className="ecx-gallery-caption cms-gallery-caption" style={{ gridColumn: "1 / -1" }}>{String(block.attrs.caption)}</figcaption> : null}
    </figure>
  );
}

function VideoEdit({ block, blockProps, labels }: BlockEditProps) {
  const src = safe(block.attrs.src);
  if (!src) return <MediaPlaceholder blockId={block.id} kind="video" icon={Video} title="Video" blockProps={blockProps} />;
  void labels;
  return <figure {...blockProps} className={cx(blockProps.className, "ecx-video cms-video")}><video src={src} controls preload="metadata" style={{ width: "100%", pointerEvents: "none" }} /></figure>;
}

function AudioEdit({ block, blockProps }: BlockEditProps) {
  const src = safe(block.attrs.src);
  if (!src) return <MediaPlaceholder blockId={block.id} kind="audio" icon={Music} title="Audio" blockProps={blockProps} />;
  return <figure {...blockProps} className={cx(blockProps.className, "ecx-audio cms-audio")}><audio src={src} controls preload="metadata" style={{ width: "100%", pointerEvents: "none" }} /></figure>;
}

function FileEdit({ block, blockProps }: BlockEditProps) {
  const src = safe(block.attrs.src);
  if (!src) return <MediaPlaceholder blockId={block.id} kind="file" icon={FileIcon} title="File" blockProps={blockProps} />;
  return <div {...blockProps} className={cx(blockProps.className, "ecx-file cms-file")}><span className="ecx-file-link cms-file-link">{String(block.attrs.name || src)}</span></div>;
}

function YoutubeEdit({ block, blockProps, setAttrs, labels }: BlockEditProps) {
  const m = String(block.attrs.src ?? "").match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  const [draft, setDraft] = useState("");
  const t = useMsgs("blocks"); // hook phải gọi trước mọi return sớm (đổi số hook khi dán link → React #300)
  if (!m) {
    return (
      <div {...blockProps} className={cx(blockProps.className, "ecx-media-placeholder")}>
        <span className="ecx-placeholder-title"><Play className="ecx-icon" />YouTube</span>
        <p className="ecx-placeholder-hint">{t.pasteAYoutubeLink}</p>
        <form className="ecx-media-actions" contentEditable={false} onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (/(?:v=|youtu\.be\/|embed\/)[\w-]{11}/.test(draft)) setAttrs({ src: draft.trim() }); }}>
          <input className="ecx-input" type="url" placeholder="https://youtu.be/…" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="YouTube URL" />
          <button type="submit" className="ecx-btn ecx-btn-primary">{t.embed}</button>
        </form>
      </div>
    );
  }
  return (
    <div {...blockProps} className={cx(blockProps.className, "ecx-youtube embed")}>
      {m ? <img src={`https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`} alt="YouTube" draggable={false} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} /> : "YouTube"}
    </div>
  );
}

function EmbedEdit({ block, blockProps, setAttrs, labels }: BlockEditProps) {
  const url = String(block.attrs.url ?? "");
  const info = embedInfo(url);
  const [draft, setDraft] = useState(url);
  if (!url) {
    return (
      <div {...blockProps} className={cx(blockProps.className, "ecx-media-placeholder")}>
        <span className="ecx-placeholder-title"><Globe className="ecx-icon" />{labels.embed}</span>
        <form className="ecx-media-actions" contentEditable={false} onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (isSafeUrl(draft)) setAttrs({ url: draft.trim() }); }}>
          <input className="ecx-input" type="url" placeholder="https://…" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={labels.embed} />
          <button type="submit" className="ecx-btn">{labels.apply}</button>
        </form>
      </div>
    );
  }
  const shell = blockShell("embed", block.attrs); // vỏ dùng chung với website
  return (
    <figure {...blockProps} className={cx(blockProps.className, shell?.className ?? "ecx-embed")} style={{ ...(blockProps.style ?? {}), ...(shell?.style as CSSProperties | undefined) }}>
      <div className="ecx-embed-preview"><Globe className="ecx-icon" /> {info?.provider ?? ""} <span className="ecx-embed-url">{url}</span></div>
      {typeof block.attrs.caption === "string" && block.attrs.caption && <figcaption>{block.attrs.caption}</figcaption>}
    </figure>
  );
}

function HtmlEdit({ block, blockProps, setAttrs, selected, editable }: BlockEditProps) {
  const html = String(block.attrs.html ?? "");
  return (
    <div {...blockProps} className={cx(blockProps.className, blockShell("customHtml", block.attrs)!.className)}>
      {selected && editable
        ? <textarea className="ecx-code-input" value={html} rows={Math.min(20, Math.max(4, html.split("\n").length + 1))} onChange={(e) => setAttrs({ html: e.target.value })} onMouseDown={(e) => e.stopPropagation()} aria-label="HTML" spellCheck={false} />
        // Xem trước trong iframe không cho chạy script (HTML do người khác soạn không chạy được trong trang quản trị)
        : html ? <iframe className="ecx-html-preview" sandbox="" srcDoc={html} title="HTML" /> : <span className="ecx-placeholder-title"><Code2 className="ecx-icon" />HTML</span>}
    </div>
  );
}

/** Mạng xã hội hỗ trợ (cùng danh sách với website — theme-sdk). */
const SOCIAL: Array<[string, string]> = [
  ["facebook", "Facebook"], ["zalo", "Zalo"], ["messenger", "Messenger"], ["youtube", "YouTube"], ["tiktok", "TikTok"], ["instagram", "Instagram"], ["x", "X"],
  ["threads", "Threads"], ["linkedin", "LinkedIn"], ["telegram", "Telegram"], ["pinterest", "Pinterest"], ["github", "GitHub"], ["email", "Email"], ["website", "Website"],
];
const socialName = (s: string) => SOCIAL.find(([v]) => v === s)?.[1] ?? s;
type SocialLink = { service: string; url: string; label?: string };
const linksOf = (a: Record<string, unknown>) => (Array.isArray(a.links) ? a.links : []) as SocialLink[];

function SocialEdit({ block, blockProps, labels }: BlockEditProps) {
  const t = useMsgs("blocks");
  const links = linksOf(block.attrs).filter((l) => l.url);
  const a = block.attrs;
  if (!links.length) {
    return (
      <div {...(blockProps as object)} className={cx(blockProps.className, "ecx-placeholder-block")}>
        <span className="ecx-placeholder-title"><Share2 className="ecx-icon" /> {t.socialLinks}</span>
        <span className="ecx-placeholder-summary">{t.addLinksInThe}</span>
      </div>
    );
  }
  return (
    <ul {...(blockProps as object)} className={cx(blockProps.className, "ecx-social", `is-${a.size ?? "medium"}`, typeof a.align === "string" && `is-${a.align}`, !!a.showLabels && "has-labels")}>
      {links.map((l, i) => <li key={i}><a className={`ecx-social-${l.service}`} title={l.label || socialName(l.service)} onClick={(e) => e.preventDefault()}>{l.label || socialName(l.service)}</a></li>)}
    </ul>
  );
}

/** Danh sách liên kết mạng xã hội trong bảng cài đặt: chọn mạng, dán địa chỉ, đổi thứ tự, xoá. */
function SocialInspector({ attrs, setAttrs, labels }: BlockEditProps) {
  const links = linksOf(attrs);
  const t = useMsgs("blocks");
  const save = (next: SocialLink[]) => setAttrs({ links: next });
  const patch = (i: number, p: Partial<SocialLink>) => save(links.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const move = (i: number, d: -1 | 1) => { const n = [...links]; [n[i], n[i + d]] = [n[i + d], n[i]]; save(n); };
  return (
    <div className="ecx-social-editor" role="group" aria-label={t.socialLinks2}>
      <span className="ecx-field-label">{t.links}</span>
      {links.map((l, i) => (
        <div key={i} className="ecx-social-row" data-social-row={i}>
          <select className="ecx-input" aria-label={format(t.network, { n: i + 1 })} value={l.service} onChange={(e) => patch(i, { service: e.target.value })}>
            {SOCIAL.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
          <input className="ecx-input" type="url" aria-label={format(t.urlN, { n: i + 1 })} placeholder={l.service === "email" ? "mailto:ban@congty.vn" : "https://…"} value={l.url}
            aria-invalid={!!l.url && !isSafeUrl(l.url) || undefined} onChange={(e) => patch(i, { url: e.target.value.trim() })} />
          <span className="ecx-social-row-tools">
            <button type="button" className="ecx-tool" aria-label={t.up} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="ecx-icon ecx-icon-sm" /></button>
            <button type="button" className="ecx-tool" aria-label={t.down} disabled={i === links.length - 1} onClick={() => move(i, 1)}><ArrowDown className="ecx-icon ecx-icon-sm" /></button>
            <button type="button" className="ecx-tool" aria-label={t.removeLink} onClick={() => save(links.filter((_, k) => k !== i))}><X className="ecx-icon ecx-icon-sm" /></button>
          </span>
        </div>
      ))}
      <button type="button" className="ecx-btn" onClick={() => save([...links, { service: SOCIAL.find(([v]) => !links.some((l) => l.service === v))?.[0] ?? "website", url: "" }])}>
        <Plus className="ecx-icon ecx-icon-sm" /> {t.addLink}
      </button>
    </div>
  );
}

function TocEdit({ block, blockProps, labels }: BlockEditProps) {
  const t = useMsgs("blocks");
  return (
    <nav {...(blockProps as object)} className={cx(blockProps.className, "ecx-toc")}>
      <p className="ecx-toc-title">{String(block.attrs.title || (t.contents))}</p>
      <TocItems maxLevel={Math.min(4, Math.max(2, Number(block.attrs.maxLevel) || 3))} />
    </nav>
  );
}

/** Mục lục xem trước: tiêu đề của tài liệu đang soạn. */
function TocItems({ maxLevel }: { maxLevel: number }) {
  const { store } = useEditor();
  const doc = store.getState().docs[store.activeDocId];
  const items: Array<{ level: number; text: string }> = [];
  const walk = (list: typeof doc.blocks) => list.forEach((b) => {
    if (b.type === "heading" && Number(b.attrs.level) >= 2 && Number(b.attrs.level) <= maxLevel) items.push({ level: Number(b.attrs.level), text: (b.inline ?? []).map((n) => n.text ?? "").join("") });
    if (b.content) walk(b.content);
  });
  if (doc) walk(doc.blocks);
  return <ol>{items.map((h, i) => <li key={i} style={h.level > 2 ? { marginLeft: `${h.level - 2}em` } : undefined}>{h.text || "…"}</li>)}</ol>;
}

export function mediaBlocks(): BlockType[] {
  const media = { src: { type: "url" as const, control: "media" as const }, mediaId: { type: "json" as const }, caption: { type: "string" as const } };
  return [
    {
      name: "image", title: "Ảnh", icon: ImageIcon, category: "media", keywords: "anh hinh image photo", kind: "atom", edit: ImageEdit,
      attributes: { ...media, alt: { type: "string", control: "textarea" }, title: { type: "string" }, width: { type: "number" }, height: { type: "number" }, size: { type: "string", default: "large" }, align: { type: "string", enum: ["left", "right", "center", "wide", "full"] }, href: { type: "url" }, linkTarget: { type: "string", enum: ["_self", "_blank"] }, lightbox: { type: "boolean", default: false } },
      supports: { style: true, anchor: true, className: true, blockStyle: true }, summary: (a) => a.alt || a.src,
    },
    { name: "gallery", title: "Gallery", icon: Images, category: "media", keywords: "gallery bo suu tap nhieu anh album", kind: "atom", edit: GalleryEdit, attributes: { images: { type: "json", default: [] }, columns: { type: "integer", default: 3, min: 1, max: 6 }, caption: { type: "string" }, linkTo: { type: "string", enum: ["none", "media"], default: "media" }, imageCrop: { type: "boolean", default: true }, lightbox: { type: "boolean", default: false } }, supports: { style: true, anchor: true, className: true } },
    { name: "video", title: "Video", icon: Video, category: "media", keywords: "video mp4 phim", kind: "atom", edit: VideoEdit, attributes: { ...media, name: { type: "string" }, mime: { type: "string" }, poster: { type: "url", control: "media" }, autoplay: { type: "boolean", default: false }, loop: { type: "boolean", default: false }, muted: { type: "boolean", default: false }, controls: { type: "boolean", default: true }, playsInline: { type: "boolean", default: true }, preload: { type: "string", enum: ["none", "metadata", "auto"], default: "metadata" } }, supports: { style: true, anchor: true } },
    { name: "audio", title: "Âm thanh", icon: Music, category: "media", keywords: "am thanh audio nhac mp3 podcast", kind: "atom", edit: AudioEdit, attributes: { ...media, name: { type: "string" }, mime: { type: "string" }, autoplay: { type: "boolean", default: false }, loop: { type: "boolean", default: false }, preload: { type: "string", enum: ["none", "metadata", "auto"], default: "metadata" } }, supports: { style: true, anchor: true } },
    { name: "file", title: "Tệp", icon: FileIcon, category: "media", keywords: "tep file pdf tai xuong download tai lieu", kind: "atom", edit: FileEdit, attributes: { ...media, name: { type: "string" }, mime: { type: "string" }, size: { type: "number" }, embed: { type: "boolean", default: true }, download: { type: "boolean" } }, supports: { style: true, anchor: true } },
    { name: "youtube", title: "YouTube", icon: Play, category: "embed", keywords: "video youtube", kind: "atom", edit: YoutubeEdit, attributes: { src: { type: "url" }, start: { type: "integer" } }, supports: { style: true, anchor: true } },
    { name: "embed", title: "Nhúng", icon: Globe, category: "embed", keywords: "nhung embed youtube vimeo tiktok facebook twitter x instagram spotify google map", kind: "atom", edit: EmbedEdit, attributes: { url: { type: "url" }, caption: { type: "string" } }, supports: { style: true, anchor: true }, summary: (a) => a.url },
    { name: "customHtml", title: "HTML tuỳ chỉnh", icon: Code2, category: "widgets", keywords: "html tuy chinh custom code", kind: "atom", edit: HtmlEdit, attributes: { html: { type: "string", control: "textarea" } } },
    { name: "socialLinks", title: "Mạng xã hội", icon: Share2, category: "widgets", keywords: "mang xa hoi social facebook zalo youtube tiktok", kind: "atom", edit: SocialEdit, inspector: SocialInspector, attributes: { links: { type: "json", default: [] }, size: { type: "string", enum: ["small", "medium", "large"], default: "medium" }, align: { type: "string", enum: ["left", "center", "right"] }, showLabels: { type: "boolean", default: false } }, supports: { style: true, anchor: true, className: true } },
    { name: "tableOfContents", title: "Mục lục", icon: ListTree, category: "widgets", keywords: "muc luc table of contents toc", kind: "atom", edit: TocEdit, attributes: { title: { type: "string" }, maxLevel: { type: "integer", default: 3, min: 2, max: 4 } }, supports: { style: true, anchor: true } },
  ];
}
