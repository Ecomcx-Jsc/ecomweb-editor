import { messages } from "../i18n";
import type { vi } from "../locales/vi";

/** Chữ giao diện của trình soạn 1.x và bảng Kiểu dáng dùng chung (nhóm "legacy" trong src/locales). */
export type EditorLabels = (typeof vi)["legacy"];

/** Chữ của một ngôn ngữ (khoá thiếu rơi về ngôn ngữ gốc rồi tiếng Anh). */
export const labelsLegacy = (lang?: string | null): EditorLabels => messages("legacy", lang) as EditorLabels;

/** Giữ tên cũ cho ứng dụng đang dùng: `labels={enLabels}`. */
export const viLabels = labelsLegacy("vi");
export const enLabels = labelsLegacy("en");
