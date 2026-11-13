import { messages } from "../../i18n";
import type { V2Labels } from "../labels";
import type { BlockType, BlockTypeRegistry } from "../core/registry";
import { layoutBlocks } from "./layout";
import { mediaBlocks } from "./media";
import { textBlocks } from "./text";
import { themeBlocks } from "./theme";
import { formBlocks } from "./form";

/** Tên khối theo ngôn ngữ giao diện (khối có nhãn trong bộ chữ). */
const TITLE_KEYS: Partial<Record<string, keyof V2Labels>> = {
  paragraph: "paragraph", heading: "heading", bulletList: "list", orderedList: "orderedList", blockquote: "quote", codeBlock: "codeBlock",
  preformatted: "preformatted", horizontalRule: "separator", image: "image", group: "groupBlock", columns: "columns", column: "column", buttons: "buttons",
  button: "button", spacer: "spacer", callout: "callout", details: "details", table: "table", templatePart: "templatePart", syncedPattern: "syncedPattern",
  pullquote: "pullquote", cover: "cover", customHtml: "html", embed: "embed",
};

export function coreBlockTypes(labels: V2Labels): BlockType[] {
  const names = messages("blockTitles", labels.lang);
  return [...textBlocks(), ...layoutBlocks(), ...mediaBlocks(), ...formBlocks(labels.lang), ...themeBlocks()].map((t) => {
    const key = TITLE_KEYS[t.name];
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const title = key ? String(labels[key]) : str(names[t.name]) ?? t.title;
    // Biến thể đứng riêng (Hàng ngang / Xếp dọc / Lưới) theo ngôn ngữ
    const variations = t.variations?.map((v) => { const vt = str(names[`${t.name}/${v.name}`]); return vt ? { ...v, title: vt } : v; });
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
