import type { ReactNode } from "react";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { commandMap } from "./commands";

/**
 * Mức dựng sẵn + cấu hình thanh công cụ. Dấu "|" ngăn nhóm nút; nhóm không bị tách khi xuống dòng.
 * "more" là menu "Thêm công cụ": chứa công cụ ít dùng (xem `DEFAULT_MORE`) để thanh chính gọn.
 */
export const TOOLBAR_PRESETS = {
  basic: ["bold", "italic", "|", "bulletList", "orderedList", "|", "link"],
  standard: ["undo", "redo", "|", "blocks", "|", "bold", "italic", "underline", "strike", "|", "bulletList", "orderedList", "|", "link", "image", "|", "clear"],
  full: ["undo", "redo", "|", "blocks", "|", "bold", "italic", "underline", "|", "color", "highlight", "|", "alignLeft", "alignCenter", "alignRight", "|",
    "bulletList", "orderedList", "|", "link", "image", "video", "file", "table", "|", "more", "|", "source", "fullscreen"],
} as const;

/** Công cụ trong menu "Thêm công cụ" khi `toolbar` không tự chọn. Tiêu đề, trích dẫn và khối mã đã có ở ô chọn kiểu đoạn. */
export const DEFAULT_MORE = ["strike", "code", "sub", "sup", "alignJustify", "hr", "audio", "outdent", "indent", "unlink", "clear"];

export type ToolbarPreset = keyof typeof TOOLBAR_PRESETS;
/** Tên mức dựng sẵn · danh sách nút · mức dựng sẵn thêm / bớt nút. */
export type ToolbarSpec = ToolbarPreset | string[] | { preset?: ToolbarPreset; add?: string[]; remove?: string[]; more?: string[] };

/** Các công cụ trong menu "Thêm công cụ" (chỉ những id có thật). */
export const resolveMore = (spec: ToolbarSpec | undefined, known: (id: string) => boolean): string[] =>
  ((spec && typeof spec === "object" && !Array.isArray(spec) && spec.more) || DEFAULT_MORE).filter((id) => id !== "more" && known(id));

export function resolveToolbar(spec: ToolbarSpec | undefined, known: (id: string) => boolean): string[] {
  let ids: string[];
  if (!spec) ids = [...TOOLBAR_PRESETS.standard];
  else if (typeof spec === "string") ids = [...(TOOLBAR_PRESETS[spec] ?? TOOLBAR_PRESETS.standard)];
  else if (Array.isArray(spec)) ids = [...spec];
  else ids = ([...TOOLBAR_PRESETS[spec.preset ?? "standard"]] as string[]).filter((i) => !spec.remove?.includes(i)).concat(spec.add ?? []);
  // bỏ nút lạ, vạch ngăn thừa (đầu, cuối, liền nhau)
  const out: string[] = [];
  for (const id of ids) {
    if (id === "|") { if (out.length && out[out.length - 1] !== "|") out.push(id); continue; }
    if (known(id) && !out.includes(id)) out.push(id);
  }
  while (out[out.length - 1] === "|") out.pop();
  return out;
}

export interface RichButtonContext { view: EditorView; state: EditorState }
/** Nút do plugin thêm: `registerRichButton` rồi đưa id vào `toolbar`. */
export interface RichButton {
  id: string;
  title: string;
  /** Biểu tượng React, hoặc một ký tự / chữ ngắn. */
  icon: ReactNode;
  run(ctx: RichButtonContext): void;
  isActive?(ctx: RichButtonContext): boolean;
  isEnabled?(ctx: RichButtonContext): boolean;
}

const registry = new Map<string, RichButton>();
export function registerRichButton(button: RichButton): () => void {
  registry.set(button.id, button);
  return () => { if (registry.get(button.id) === button) registry.delete(button.id); };
}
export const getRichButton = (id: string) => registry.get(id);

/** Nút do giao diện tự vẽ (có hộp nhập / menu riêng), không chạy thẳng `commandMap`. */
export const UI_TOOL_IDS = ["blocks", "color", "highlight", "link", "image", "video", "audio", "file", "table", "more", "source", "fullscreen"] as const;
/** Id hợp lệ trong `toolbar`: lệnh có sẵn, nút giao diện, hoặc nút plugin đã đăng ký. */
export const isKnownTool = (id: string): boolean => id in commandMap || (UI_TOOL_IDS as readonly string[]).includes(id) || registry.has(id);
