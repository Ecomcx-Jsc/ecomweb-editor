import { Node } from "@tiptap/core";
import { colorCss, defineBlock, spacingValue, type BlockAttrSpec } from "@ecomcx/ecomweb-content";
import {
  ChevronRight, Code2, Image as ImageIcon, LayoutPanelLeft, ListTree, MoveVertical, Plus, Quote, RectangleHorizontal, Share2, Trash2, Type, type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import type { BlockEditProps } from "./blocks";
import { messages } from "../i18n";
import { registerBlock } from "./blocks";
import { registerEditorExtension } from "./registry";




export const SOCIAL_SERVICES = ["facebook", "x", "instagram", "youtube", "tiktok", "linkedin", "zalo", "github", "threads", "pinterest", "telegram", "messenger", "email", "website"];

const s = (label: string, extra: Partial<BlockAttrSpec> = {}): BlockAttrSpec => ({ type: "string", label, ...extra });
const i = (label: string, extra: Partial<BlockAttrSpec> = {}): BlockAttrSpec => ({ type: "integer", label, ...extra });
const b = (label: string, extra: Partial<BlockAttrSpec> = {}): BlockAttrSpec => ({ type: "boolean", label, ...extra });
const enumOf = (label: string, values: string[], def?: string) => s(label, { enum: values, enumLabels: values, default: def });
const image = { src: { type: "url", label: "image", control: "media" } as BlockAttrSpec, mediaId: { type: "json", control: "hidden" } as BlockAttrSpec, alt: s("alt") };

function SpacerEdit({ attrs }: BlockEditProps) {
  return <div className="cms-ed-spacer" style={{ height: spacingValue(attrs.height ?? "lg") ?? "1.5rem" }} contentEditable={false} />;
}
function CoverEdit({ attrs, children }: BlockEditProps) {
  const overlay = colorCss(attrs.overlay) ?? (attrs.src ? "#000" : undefined);
  return (
    <div className="cms-ed-cover" style={{ minHeight: spacingValue(attrs.minHeight ?? "400px"), backgroundImage: attrs.src ? `url("${String(attrs.src).replace(/["\\()]/g, encodeURIComponent)}")` : undefined }}>
      {overlay && <span className="cms-ed-cover-overlay" style={{ background: overlay, opacity: Math.min(100, Math.max(0, Number(attrs.opacity ?? 50))) / 100 }} contentEditable={false} />}
      <div className="cms-ed-cover-inner">{children}</div>
    </div>
  );
}
function MediaTextEdit({ attrs, children }: BlockEditProps) {
  const w = Math.min(80, Math.max(20, Number(attrs.width) || 50));
  return (
    <div className="cms-ed-media-text" style={{ gridTemplateColumns: attrs.position === "right" ? `1fr ${w}%` : `${w}% 1fr` }}>
      <div className="cms-ed-media-text-media" style={{ order: attrs.position === "right" ? 2 : 0 }} contentEditable={false}>
        {attrs.src ? <img src={attrs.src} alt={attrs.alt ?? ""} /> : <ImageIcon size={28} />}
      </div>
      <div>{children}</div>
    </div>
  );
}
const PullquoteEdit = ({ attrs, children }: BlockEditProps) => (
  <figure className="cms-ed-pullquote"><div>{children}</div>{attrs.citation && <figcaption contentEditable={false}>{attrs.citation}</figcaption>}</figure>
);
const detailsEdit = (t: (k: string) => string) => function DetailsEdit({ attrs, children }: BlockEditProps) {
  return <div className="cms-ed-details"><div className="cms-ed-details-summary" contentEditable={false}><ChevronRight size={14} /> {attrs.summary || t("summaryPlaceholder")}</div>{children}</div>;
};
const htmlEdit = (t: (k: string) => string) => function HtmlEdit({ attrs }: BlockEditProps) {
  // Không chạy HTML trong trang quản trị (cùng tên miền với phiên đăng nhập) — chỉ hiện mã nguồn
  return <div contentEditable={false}><pre className="cms-ed-html-src">{attrs.html || "<!-- HTML -->"}</pre><small className="cms-ed-hint-text">{t("htmlHint")}</small></div>;
};
const tocEdit = (t: (k: string) => string) => function TocEdit({ attrs }: BlockEditProps) {
  return <div className="cms-ed-toc" contentEditable={false}><strong>{attrs.title || t("tableOfContents")}</strong> <small>{t("tocHint")} (H2–H{attrs.maxLevel ?? 3})</small></div>;
};
const socialEdit = (t: (k: string) => string) => function SocialEdit({ attrs, setAttrs }: BlockEditProps) {
  const links: Array<{ service: string; url: string }> = Array.isArray(attrs.links) ? attrs.links : [];
  const update = (next: typeof links) => setAttrs({ links: next });
  return (
    <div className="cms-ed-social" contentEditable={false}>
      {links.map((l, idx) => (
        <div key={idx} className="cms-ed-social-row">
          <select aria-label={t("service")} value={l.service} onChange={(e) => update(links.map((x, j) => (j === idx ? { ...x, service: e.target.value } : x)))}>
            {SOCIAL_SERVICES.map((sv) => <option key={sv} value={sv}>{sv}</option>)}
          </select>
          <input type="url" aria-label={t("url")} placeholder="https://" value={l.url} onChange={(e) => update(links.map((x, j) => (j === idx ? { ...x, url: e.target.value } : x)))} />
          <button type="button" aria-label={t("removeImage").replace(/ảnh|image/i, "").trim() || "×"} title="×" onClick={() => update(links.filter((_, j) => j !== idx))}><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" className="cms-ed-text-btn" onClick={() => update([...links, { service: "facebook", url: "" }])}><Plus size={12} /> {t("addLink")}</button>
    </div>
  );
};

/** Văn bản định dạng sẵn: giữ nguyên khoảng trắng và xuống dòng (Enter = xuống dòng trong khối). */
export const Preformatted = Node.create({
  name: "preformatted",
  group: "block",
  content: "inline*",
  marks: "_",
  whitespace: "pre",
  defining: true,
  parseHTML: () => [{ tag: "pre.ecx-pre" }],
  renderHTML: () => ["pre", { class: "ecx-pre cms-ed-pre" }, 0],
  addKeyboardShortcuts() {
    return { Enter: () => (this.editor.isActive("preformatted") ? this.editor.commands.insertContent("\n") : false) };
  },
});

let registered: string | null = null;

/** Bộ khối cơ bản (@ecomcx/ecomweb-content 1.9) cho mọi trình soạn — gọi lại với ngôn ngữ khác để đổi nhãn. */
export function registerBasicBlocks(locale = "vi") {
  if (registered === locale) return;
  registered = locale;
  const dict = messages("legacyBasic", locale);
  const t = (k: string) => { const v = dict[k]; return typeof v === "string" ? v : k; };
  type Spec = [string, LucideIcon, "none" | "blocks" | "inline", Record<string, BlockAttrSpec>, ComponentType<BlockEditProps> | undefined, (() => Array<Record<string, unknown>>) | undefined];
  const specs: Spec[] = [
    ["spacer", MoveVertical, "none", { height: s("height", { default: "lg" }) }, SpacerEdit, undefined],
    ["buttons", RectangleHorizontal, "blocks", { align: enumOf("align", ["left", "center", "right", "space-between"]) }, undefined,
      () => [{ type: "button", attrs: { text: t("initialButton"), variant: "primary" } }, { type: "button", attrs: { text: t("initialButton2"), variant: "outline" } }]],
    ["cover", ImageIcon, "blocks", { ...image, overlay: s("overlay", { control: "color" }), opacity: i("opacity", { min: 0, max: 100, default: 50 }),
      minHeight: s("minHeight", { default: "400px" }), contentAlign: enumOf("contentAlign", ["top", "center", "bottom"], "center"), fixed: b("fixed", { default: false }) }, CoverEdit,
      () => [{ type: "heading", attrs: { level: 2, textAlign: "center" } }]],
    ["mediaText", LayoutPanelLeft, "blocks", { ...image, position: enumOf("position", ["left", "right"], "left"), width: i("width", { min: 20, max: 80, default: 50 }),
      verticalAlign: enumOf("verticalAlign", ["top", "center", "bottom"], "center"), stack: b("stack", { default: true }) }, MediaTextEdit, undefined],
    ["pullquote", Quote, "inline", { citation: s("citation") }, PullquoteEdit, undefined],
    ["details", ChevronRight, "blocks", { summary: s("summary"), open: b("open", { default: false }) }, detailsEdit(t), undefined],
    ["customHtml", Code2, "none", { html: s("html", { control: "textarea" }) }, htmlEdit(t), undefined],
    ["socialLinks", Share2, "none", { links: { type: "json", default: [], control: "hidden" }, size: enumOf("size", ["small", "medium", "large"], "medium"), align: enumOf("align", ["left", "center", "right"]), showLabels: b("showLabels", { default: false }) }, socialEdit(t), undefined],
    ["tableOfContents", ListTree, "none", { title: s("title"), maxLevel: i("maxLevel", { min: 2, max: 4, default: 3 }) }, tocEdit(t), undefined],
  ];
  for (const [name, icon, content, attributes, edit, initialContent] of specs) {
    const def = defineBlock({ name, title: name, keywords: [...new Set(["vi", "en", locale].map((l) => String(messages("legacyBasic", l)[name] ?? "")))].join(" "), content, attributes });
    registerBlock(def, { icon, translate: t, edit, initialContent });
  }
  registerEditorExtension({
    name: "basic:preformatted",
    extensions: [Preformatted],
    insertItems: [{ key: "preformatted", title: t("preformatted"), hint: "pre", icon: Type, keywords: "dinh dang san preformatted pre van ban",
      run: (editor, range) => { const c = range ? editor.chain().focus().deleteRange(range) : editor.chain().focus(); c.setNode("preformatted").run(); } }],
  });
}
