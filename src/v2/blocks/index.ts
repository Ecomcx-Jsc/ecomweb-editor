import type { V2Labels } from "../labels";
import type { BlockType, BlockTypeRegistry } from "../core/registry";
import { layoutBlocks } from "./layout";
import { mediaBlocks } from "./media";
import { textBlocks } from "./text";
import { themeBlocks } from "./theme";

/** Tên khối theo ngôn ngữ giao diện (khối có nhãn trong bộ chữ). */
const TITLE_KEYS: Partial<Record<string, keyof V2Labels>> = {
  paragraph: "paragraph", heading: "heading", bulletList: "list", orderedList: "orderedList", blockquote: "quote", codeBlock: "codeBlock",
  preformatted: "preformatted", horizontalRule: "separator", image: "image", group: "groupBlock", columns: "columns", column: "column", buttons: "buttons",
  button: "button", spacer: "spacer", callout: "callout", details: "details", table: "table", templatePart: "templatePart", syncedPattern: "syncedPattern",
  pullquote: "pullquote", cover: "cover", customHtml: "html", embed: "embed",
};

const EN_TITLES: Record<string, string> = {
  taskList: "To-do list", taskItem: "To-do", listItem: "List item", mediaText: "Media & text", tableRow: "Row", tableCell: "Cell", tableHeader: "Header cell",
  gallery: "Gallery", video: "Video", audio: "Audio", file: "File", youtube: "YouTube", socialLinks: "Social links", tableOfContents: "Table of contents",
  siteTitle: "Site title", siteLogo: "Site logo", siteTagline: "Tagline", navigation: "Navigation", search: "Search", languageSwitcher: "Language switcher",
  copyright: "Copyright", postTitle: "Post title", postContent: "Post content", postExcerpt: "Excerpt", featuredImage: "Featured image", postDate: "Date",
  postAuthor: "Author", postTerms: "Terms", comments: "Comments", query: "Query loop", postTemplate: "Post template", pagination: "Pagination", queryEmpty: "No results",
};

export function coreBlockTypes(labels: V2Labels): BlockType[] {
  return [...textBlocks(), ...layoutBlocks(), ...mediaBlocks(), ...themeBlocks()].map((t) => {
    const key = TITLE_KEYS[t.name];
    const title = key ? String(labels[key]) : labels.lang === "en" ? EN_TITLES[t.name] ?? t.title : t.title;
    // Biến thể đứng riêng (Hàng ngang / Xếp dọc / Lưới) theo ngôn ngữ
    const VAR_EN: Record<string, string> = { "group/row": "Row", "group/stack": "Stack", "group/grid": "Grid" };
    const variations = labels.lang === "en" && t.variations ? t.variations.map((v) => (VAR_EN[`${t.name}/${v.name}`] ? { ...v, title: VAR_EN[`${t.name}/${v.name}`] } : v)) : t.variations;
    return { ...t, title, variations };
  });
}

/** Đăng ký bộ khối lõi (ứng dụng có thể bỏ bớt khối không dùng bằng registry.unregister). */
export function registerCoreBlocks(registry: BlockTypeRegistry, labels: V2Labels, opts: { dynamic?: boolean } = {}) {
  const dynamicNames = new Set(themeBlocks().map((t) => t.name));
  for (const t of coreBlockTypes(labels)) {
    // Khối giao diện chỉ hiện trong trình chèn khi soạn template / trang dựng bằng khối (vẫn vẽ được nếu nội dung có sẵn)
    registry.register(dynamicNames.has(t.name) && !opts.dynamic ? { ...t, hidden: true } : t);
  }
}
