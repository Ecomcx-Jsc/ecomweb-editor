import type { BlockType } from "../core/registry";

/** Nhóm của tab Kiểu dáng. Khối chỉ hiện nhóm nó hỗ trợ (như `supports` trong block.json của WordPress). */
export type StyleGroup = "typography" | "color" | "background" | "spacing" | "border" | "effects" | "hover" | "motion" | "visibility";

export const STYLE_GROUPS: readonly StyleGroup[] = ["typography", "color", "background", "spacing", "border", "effects", "hover", "motion", "visibility"];
const NO_BACKGROUND = STYLE_GROUPS.filter((g) => g !== "background");
const MEDIA: StyleGroup[] = ["spacing", "border", "effects", "hover", "motion", "visibility"];
const MINIMAL: StyleGroup[] = ["spacing", "visibility"];

/** Khối lõi có bộ nhóm riêng; khối khác: khối chứa có đủ (kể cả ảnh nền), khối còn lại có mọi nhóm trừ ảnh nền. */
const CORE: Record<string, StyleGroup[]> = {
  spacer: MINIMAL, pageBreak: ["visibility"], customHtml: MINIMAL, shortcode: MINIMAL, audio: MINIMAL,
  horizontalRule: ["color", "spacing", "border", "visibility"],
  image: MEDIA, gallery: MEDIA, video: MEDIA, youtube: MEDIA, embed: MEDIA, featuredImage: MEDIA, siteLogo: MEDIA, avatar: MEDIA,
  icon: ["color", "spacing", "motion", "visibility"],
  socialLinks: ["color", "spacing", "motion", "visibility"],
  // Màu nút (Thường / Rê chuột) ở mục Nút riêng (core-controls) — không lặp nhóm Màu chung (dữ liệu cũ có màu vẫn hiện để sửa)
  button: NO_BACKGROUND.filter((g) => g !== "color"),
};

/**
 * Nhóm kiểu dáng của một loại khối. Khối plugin khai `supports.style` là mảng nhóm để chọn; `true` / không khai = mặc định như trên.
 * Nhóm khối đã có giá trị vẫn hiện (để sửa / xoá) dù không nằm trong danh sách — xem StyleTab.
 */
export function styleGroups(name: string, type?: BlockType): Set<StyleGroup> {
  const s = type?.supports?.style;
  if (Array.isArray(s)) return new Set(s.filter((g): g is StyleGroup => STYLE_GROUPS.includes(g as StyleGroup)));
  if (CORE[name]) return new Set(CORE[name]);
  return new Set(type?.kind === "container" ? STYLE_GROUPS : NO_BACKGROUND);
}
