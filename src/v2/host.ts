import type { StylePresets } from "@ecomcx/ecomweb-content";
import type { MediaProvider } from "../types";
import type { BNode } from "./model";

/**
 * Mọi thứ trình soạn cần từ ứng dụng nhúng — trình soạn không gọi API của CMS nào.
 * Dự án khác chỉ cần viết lại lớp này (thư viện ảnh, chỗ lưu tài liệu lồng nhau…).
 */
export interface EditorHost {
  /** Thư viện media (không có → nhập URL). */
  media?: MediaProvider;
  /**
   * Tài liệu lồng trong tài liệu đang sửa: phần dùng chung (header/footer), mẫu đồng bộ, nội dung bài trong template.
   * `kind` + `ref` lấy từ thuộc tính khối (templatePart.slug, syncedPattern.ref…).
   */
  documents?: DocumentHost;
  /** Dữ liệu thật cho khối động (tên website, menu, bài mẫu…) — không có thì khối động hiện tên khối. */
  dynamic?: DynamicData;
  /** Khung soạn: CSS của website (đường dẫn hoặc nội dung CSS) để soạn trông giống hệt trang thật. */
  canvasStyles?: Array<string | { css: string }>;
  /** Preset của theme (biến --ecx-*). */
  presets?: StylePresets;
  /** Chữ "%khoá%" của plugin → chữ theo ngôn ngữ. */
  translate?(text: string): string;
}

export interface NestedDocRef {
  kind: string;
  ref: unknown;
}
export interface LoadedDoc {
  title?: string;
  /** Cây `doc` của định dạng lưu (RichNode) hoặc ContentDoc. */
  content: unknown;
  /** Người dùng không có quyền sửa → chỉ xem. */
  readOnly?: boolean;
}
export interface DocumentHost {
  /** Định danh tài liệu trong store (mặc định `${kind}:${ref}`). */
  idOf?(ref: NestedDocRef): string;
  load(ref: NestedDocRef): Promise<LoadedDoc | null>;
  /** Lưu một tài liệu lồng (trình soạn gọi cho từng tài liệu có thay đổi khi bấm Lưu). */
  save?(ref: NestedDocRef, blocks: BNode[], content: unknown): Promise<void>;
}

export interface DynamicData {
  site?: { title?: string; tagline?: string; logo?: string | null };
  menus?: Record<string, Array<{ title: string; url?: string }>>;
  post?: { title?: string; date?: string; author?: string; excerpt?: string; image?: string | null; terms?: string[]; comments?: number };
  posts?: Array<{ title: string; date?: string; excerpt?: string; image?: string | null }>;
  languages?: string[];
}

export const docIdOf = (host: EditorHost, ref: NestedDocRef) => host.documents?.idOf?.(ref) ?? `${ref.kind}:${String(ref.ref)}`;
