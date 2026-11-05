import { DYNAMIC_NODES, defineBlock, type BlockAttrSpec, type BlockDefinition } from "@ecomcx/ecomweb-content";
import {
  AlignLeft, ArrowLeftRight, Calendar, ChevronsRight, Copyright, FileText, Globe, Heading1, Image, Languages, LayoutTemplate, List, ListX, Menu, MessageSquare, MoreHorizontal,
  PanelTop, Repeat, Search, Tags, Text, Type, User, type LucideIcon,
} from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import type { BlockEditProps } from "./blocks";
import { messages } from "../i18n";
import { registerBlock } from "./blocks";

/** Khối động (lấy dữ liệu lúc hiển thị) — dùng trong Trình dựng và trang dựng bằng khối. */
export const DYNAMIC_BLOCKS = new Set<string>(DYNAMIC_NODES);




const s = (label: string, extra: Partial<BlockAttrSpec> = {}): BlockAttrSpec => ({ type: "string", label, ...extra });
const i = (label: string, extra: Partial<BlockAttrSpec> = {}): BlockAttrSpec => ({ type: "integer", label, ...extra });
const b = (label: string, extra: Partial<BlockAttrSpec> = {}): BlockAttrSpec => ({ type: "boolean", label, ...extra });
const align = s("textAlign", { enum: ["left", "center", "right", "justify"], enumLabels: ["left", "center", "right", "justify"], default: "left" });

const SPECS: Array<[string, LucideIcon, "none" | "blocks", Record<string, BlockAttrSpec>]> = [
  ["siteTitle", Type, "none", { level: i("level", { min: 0, max: 6, default: 0 }), link: b("link", { default: true }), textAlign: align }],
  ["siteLogo", Image, "none", { width: i("width", { min: 16, max: 600, default: 120 }), link: b("link", { default: true }) }],
  ["siteTagline", Text, "none", { textAlign: align }],
  ["navigation", Menu, "none", { location: s("location", { default: "primary" }), orientation: s("orientation", { enum: ["horizontal", "vertical"], enumLabels: ["horizontal", "vertical"], default: "horizontal" }), mobile: b("mobile", { default: true }) }],
  ["search", Search, "none", { placeholder: s("placeholder"), buttonText: s("buttonText") }],
  ["languageSwitcher", Languages, "none", {}],
  ["copyright", Copyright, "none", { text: s("text"), textAlign: align }],
  ["postTitle", Heading1, "none", { level: i("level", { min: 1, max: 6, default: 1 }), link: b("link", { default: false }), textAlign: align }],
  ["postContent", FileText, "none", {}],
  ["postExcerpt", AlignLeft, "none", { moreText: s("moreText") }],
  ["featuredImage", Image, "none", { size: s("size", { enum: ["medium", "medium_large", "large", "full"], default: "large" }), aspect: s("aspect", { enum: ["auto", "16/9", "4/3", "1/1", "3/4"], default: "auto" }), link: b("link", { default: false }) }],
  ["postDate", Calendar, "none", { textAlign: align }],
  ["postAuthor", User, "none", { avatar: b("avatar", { default: false }) }],
  ["postTerms", Tags, "none", { taxonomy: s("taxonomy", { default: "category" }), separator: s("separator", { default: ", " }) }],
  ["comments", MessageSquare, "none", {}],
  ["queryTitle", Heading1, "none", { level: i("level", { min: 1, max: 6, default: 1 }), prefix: b("prefix", { default: false }), textAlign: align }],
  ["termDescription", AlignLeft, "none", { textAlign: align }],
  ["breadcrumbs", ChevronsRight, "none", { separator: s("separator", { default: "›" }), showHome: b("showHome", { default: true }), showCurrent: b("showCurrent", { default: true }) }],
  ["postNavigation", ArrowLeftRight, "none", { showTitle: b("showTitle", { default: true }) }],
  ["query", List, "blocks", {
    inherit: b("inherit", { default: true }), postType: s("postType", { default: "post" }), perPage: i("perPage", { min: 1, max: 50, default: 10 }),
    category: s("category"), tag: s("tag"),
    orderBy: s("orderBy", { enum: ["date", "title", "menu_order"], enumLabels: ["date", "title", "menu_order"], default: "date" }),
    order: s("order", { enum: ["desc", "asc"], enumLabels: ["desc", "asc"], default: "desc" }),
  }],
  ["postTemplate", Repeat, "blocks", { layout: s("layout", { enum: ["list", "grid"], enumLabels: ["list", "grid"], default: "list" }), columns: i("columns", { min: 1, max: 6, default: 3 }) }],
  ["pagination", MoreHorizontal, "none", {}],
  ["queryEmpty", ListX, "blocks", {}],
  ["templatePart", PanelTop, "none", { slug: s("slug"), tagName: s("tagName", { enum: ["div", "header", "footer", "aside", "section"], default: "div" }) }],
];

/** Dữ liệu thật của website để khối động hiện đúng nội dung trong trình soạn (Trình dựng nạp vào — không có thì chỉ hiện tên khối). */
export interface DynamicPreviewData {
  site?: { title?: string; tagline?: string; logo?: string | null };
  /** Tên các mục menu theo vị trí ("primary" → ["Trang chủ", "Giới thiệu"]). */
  menus?: Record<string, string[]>;
  /** Bài / trang mẫu đang xem trong khung website. */
  post?: { title?: string; date?: string; author?: string; excerpt?: string; content?: string; image?: string | null; terms?: string[]; comments?: number };
  languages?: string[];
}
let previewData: DynamicPreviewData = {};
const previewListeners = new Set<() => void>();
/** Nạp dữ liệu xem trước cho khối động (mọi trình soạn đang mở vẽ lại ngay). */
export function setDynamicPreview(data: DynamicPreviewData) { previewData = data; previewListeners.forEach((f) => f()); }
const usePreviewData = () => useSyncExternalStore((cb) => { previewListeners.add(cb); return () => { previewListeners.delete(cb); }; }, () => previewData);

/** Nội dung thật của khối động (như trên website, gọn) — null khi chưa có dữ liệu. */
function DynamicPreview({ name, attrs, t }: { name: string; attrs: Record<string, any>; t: (k: string) => string }) {
  const d = usePreviewData();
  const fill = (k: string, v: unknown) => t(k).replace("{v}", String(v ?? ""));
  const align = attrs.textAlign ? { textAlign: attrs.textAlign as "left" } : undefined;
  const heading = (level: number | undefined, text: string) => {
    const size = [15, 26, 22, 19, 17, 15, 14][Math.max(0, Math.min(6, level ?? 0))];
    return <div className="cms-ed-dp-heading" style={{ fontSize: size, fontWeight: level ? 700 : 500, ...align }}>{text}</div>;
  };
  let el: ReactNode = null;
  switch (name) {
    case "siteTitle": if (d.site?.title) el = heading(attrs.level ?? 0, d.site.title); break;
    case "siteTagline": if (d.site?.tagline) el = <div style={align}>{d.site.tagline}</div>; break;
    case "siteLogo": if (d.site) el = d.site.logo ? <img src={d.site.logo} alt="" style={{ maxHeight: 40, width: attrs.width ? Number(attrs.width) : undefined }} /> : heading(1, d.site.title ?? ""); break;
    case "navigation": {
      if (!d.menus) break;
      const items = d.menus[attrs.location ?? "primary"];
      el = items?.length
        ? <ul className={`cms-ed-dp-menu is-${attrs.orientation === "vertical" ? "vertical" : "horizontal"}`}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
        : <div className="cms-ed-dp-muted">{t("noMenu")}</div>;
      break;
    }
    case "search": el = <div className="cms-ed-dp-search"><span>{attrs.placeholder || t("searchPlaceholder")}</span><b>{attrs.buttonText || t("search")}</b></div>; break;
    case "languageSwitcher": if (d.languages?.length) el = <div className="cms-ed-dp-muted">{d.languages.join(" · ")}</div>; break;
    case "copyright": if (d.site) el = <div style={align}>© {new Date().getFullYear()} {attrs.text || d.site.title}</div>; break;
    case "postTitle": if (d.post?.title) el = heading(attrs.level ?? 1, d.post.title); break;
    case "postExcerpt": if (d.post?.excerpt) el = <div className="cms-ed-dp-muted" style={align}>{d.post.excerpt}</div>; break;
    case "postDate": if (d.post?.date) el = <div className="cms-ed-dp-muted" style={align}>{d.post.date}</div>; break;
    case "postAuthor": if (d.post?.author) el = <div className="cms-ed-dp-muted" style={align}>{d.post.author}</div>; break;
    case "postTerms": if (d.post?.terms?.length) el = <div className="cms-ed-dp-muted" style={align}>{d.post.terms.join(attrs.separator ?? ", ")}</div>; break;
    case "featuredImage": if (d.post?.image) el = <img src={d.post.image} alt="" className="cms-ed-dp-image" />; break;
    case "postContent": if (d.post?.content) el = <div className="cms-ed-dp-content">{d.post.content}</div>; break;
    case "comments": if (d.post) el = <div className="cms-ed-dp-muted">{fill("commentsCount", d.post.comments ?? 0)}</div>; break;
    case "pagination": el = <div className="cms-ed-dp-muted">« 1 2 3 »</div>; break;
  }
  return el ? <div className="cms-ed-dynamic-preview" contentEditable={false}>{el}</div> : null;
}

/** Dòng tóm tắt cạnh tên khối (thuộc tính quan trọng nhất) — để nhìn là biết khối đang lấy gì. */
function summary(name: string, t: (k: string) => string) {
  return function Summary({ attrs, children }: BlockEditProps) {
    const fill = (k: string, v: unknown) => t(k).replace("{v}", String(v ?? ""));
    const text = name === "navigation" ? fill("menuSummary", attrs.location ?? "primary")
      : name === "templatePart" ? (attrs.slug ? fill("partSummary", attrs.slug) : "")
      : name === "query" ? (attrs.inherit !== false ? t("inheritSummary") : `${attrs.postType ?? "post"} · ${attrs.perPage ?? 10}`)
      : "";
    return <>{text && <div className="cms-ed-dynamic-summary" contentEditable={false}>{text}</div>}<DynamicPreview name={name} attrs={attrs} t={t} />{children}</>;
  };
}

let registered: string | null = null;

/** Đăng ký khối động cho mọi trình soạn (gọi một lần; đổi ngôn ngữ → gọi lại). Mục chèn chỉ hiện khi Editor có `dynamicBlocks`. */
export function registerDynamicBlocks(locale = "vi") {
  if (registered === locale) return;
  registered = locale;
  const dict = messages("legacyDynamic", locale);
  const t = (k: string) => { const v = dict[k]; return typeof v === "string" ? v : k; };
  for (const [name, icon, content, attributes] of SPECS) {
    const def: BlockDefinition = defineBlock({ name, title: name, keywords: [...new Set(["vi", "en", locale].map((l) => String(messages("legacyDynamic", l)[name] ?? "")))].join(" "), content, attributes });
    const initialContent = name === "query"
      ? () => [{ type: "postTemplate", attrs: { layout: "list", columns: 3 }, content: [{ type: "postTitle", attrs: { level: 2, link: true } }, { type: "postExcerpt" }] }, { type: "pagination" }]
      : undefined;
    registerBlock(def, { icon, translate: t, edit: summary(name, t), initialContent });
  }
}

export const DYNAMIC_ICON: LucideIcon = LayoutTemplate;
export const dynamicIcon = (name: string): LucideIcon | undefined => SPECS.find(([n]) => n === name)?.[1] ?? (DYNAMIC_BLOCKS.has(name) ? Globe : undefined);
