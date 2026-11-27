/**
 * Trình soạn văn bản HTML (ProseMirror), phần KHÔNG có giao diện: lược đồ, chuyển HTML, lệnh, cấu hình thanh công cụ, bộ điều khiển.
 * Giao diện (thanh công cụ, menu, hộp liên kết) do ứng dụng chủ dựng bằng bộ UI của nó — admin CMS: `RichTextEditor` trong bộ UI của admin.
 */
export { RichController, type RichControllerOptions } from "./controller";
export {
  alignOfSelection, blockKind, clearFormat, commandMap, insertAudio, insertFile, insertHr, insertImage, insertTable, insertVideo, linkAt, markActive, markAttrAt, removeLink, setAlign, setBlock, setLink, setMarkAttr, toggleList,
  type BlockKind, type CommandDef,
} from "./commands";
export { DEFAULT_MORE, TOOLBAR_PRESETS, UI_TOOL_IDS, getRichButton, isKnownTool, registerRichButton, resolveMore, resolveToolbar, type RichButton, type RichButtonContext, type ToolbarPreset, type ToolbarSpec } from "./toolbar-config";
export { fmt, richLabels, type RichLabels } from "./labels";
export { isEmptyDoc, parseHtml, sanitizeHtml, toHtml } from "./html";
export { ALIGNS, richSchema, safeColor, type Align } from "./schema";
