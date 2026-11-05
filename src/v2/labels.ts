import { messages } from "../i18n";
import type { vi } from "../locales/vi";

/** Chữ giao diện của trình soạn v2 (nhóm "v2" trong src/locales) + mã ngôn ngữ đang dùng. */
export type V2Labels = (typeof vi)["v2"] & { lang: string };

/** Chữ của một ngôn ngữ (khoá thiếu rơi về ngôn ngữ gốc rồi tiếng Anh). */
export const labelsV2 = (lang?: string | null): V2Labels => ({ ...messages("v2", lang), lang: (lang ?? "vi").toLowerCase() }) as V2Labels;

/** Giữ tên cũ cho ứng dụng đang dùng: `labels={enV2}`. */
export const viV2 = labelsV2("vi");
export const enV2 = labelsV2("en");
