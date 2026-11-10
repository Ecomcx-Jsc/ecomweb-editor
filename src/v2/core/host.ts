import type { StylePresets } from "@ecomcx/ecomweb-content";
import type { MediaProvider } from "../../shared/types";
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
  /** Khung soạn: thuộc tính của <html> / <body> trên website (data-theme, class, lang…) — CSS của theme scope theo chúng. */
  canvasDocument?: { html?: Record<string, string>; body?: Record<string, string> };
  /**
   * Khung soạn: chuỗi phần tử bao quanh nội dung như trên website (div.site > main#x > div.content…), từ ngoài vào trong — theme viết CSS
   * theo cấu trúc trang (`#x .content p em`, biến CSS đặt trên div.site) nên canvas phải dựng đúng chuỗi đó.
   */
  canvasWrapper?: Array<{ tag: string; attrs?: Record<string, string> }>;
  /** Class thêm cho vùng nội dung của khung soạn (vd "prose max-w-none") — như phần tử nội dung trên website. */
  canvasContentClass?: string;
  /** Mở nơi sửa menu của một vị trí (khối Menu đang chọn hiện nút "Sửa menu"). Không có → không hiện nút. */
  editMenu?(location: string): void;
  /**
   * Website vẽ giúp một khối (nút nội dung dạng JSON như khi lưu) bằng code + CSS của theme → HTML. null = không vẽ được
   * (trình soạn dùng giao diện của mình). Dùng cho khối có `serverRender` (khối động, khối plugin/theme không có `edit`).
   */
  renderBlock?(node: { type: string; attrs?: Record<string, unknown>; content?: unknown[] }): Promise<string | null>;
  /** Nơi đang soạn: "template" = template / phần dùng chung của theme (chèn được khối riêng của theme); mặc định = nội dung bài. */
  scope?: "template" | "content";
  /** Preset của theme (biến --ecx-*). */
  presets?: StylePresets;
  /** Chữ "%khoá%" của plugin → chữ theo ngôn ngữ. */
  translate?(text: string): string;
  /**
   * "Tạo mẫu" từ các khối đang chọn: ứng dụng hỏi tên / nhóm / đồng bộ rồi lưu. Trả về mẫu đã tạo (đồng bộ → các khối được
   * thay bằng tham chiếu tới mẫu), null = huỷ. Không có → ẩn lệnh.
   */
  /**
   * Lựa chọn cho ô cài đặt của khối (vị trí menu, loại bài, phân loại, chuyên mục / thẻ, phần dùng chung, cỡ ảnh) — dữ liệu
   * thật của website. Không có → ô gõ tay.
   */
  choices?(kind: ChoiceKind, args?: Record<string, string>): Promise<Choice[]> | Choice[];
  /** Bài thật cho "Danh sách bài" theo thiết lập của khối (soạn thấy đúng bài sẽ hiện). Không có → dynamic.posts. */
  queryPosts?(query: QueryArgs): Promise<DynamicPost[]>;
  createPattern?(content: SavedContent): Promise<{ ref: number; synced: boolean } | null>;
  /**
   * Trợ lý AI (ứng dụng gọi nhà cung cấp, trình soạn chỉ gửi chữ và nhận chữ). Không có → không hiện menu AI.
   * `task`: rewrite | shorten | expand | fix | summarize | translate | custom. Lỗi: ném Error có thông báo cho người dùng.
   */
  ai?: { run(task: string, text: string, opts?: { language?: string; instruction?: string }): Promise<string> };
}

/** Nội dung lưu (ContentDoc của @ecomcx/ecomweb-content). */
export interface SavedContent { version: number; blocks: Array<{ type: string; data: unknown; id?: string }> }

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
  /** Lưu một tài liệu lồng (trình soạn gọi cho từng tài liệu có thay đổi khi bấm Lưu). `content` là ContentDoc chuẩn. */
  save?(ref: NestedDocRef, blocks: BNode[], content: SavedContent): Promise<void>;
}

export type DynamicPost = { title?: string; date?: string; author?: string; excerpt?: string; image?: string | null; terms?: string[]; /** Chuyên mục đầu tiên (breadcrumb như website); không có = bài/trang không thuộc chuyên mục nào. */ category?: string; comments?: number; link?: string; /** Nội dung đã lưu của bài (ContentDoc) — khối "Nội dung bài" trong template vẽ nội dung thật thay vì khung giữ chỗ. */ content?: unknown };

/** Thiết lập của khối "Danh sách bài" (attrs của query). */
export interface QueryArgs { inherit: boolean; postType: string; perPage: number; category?: string; tag?: string; orderBy: string; order: "asc" | "desc" }

export type ChoiceKind = "menuLocation" | "postType" | "taxonomy" | "term" | "templatePart" | "imageSize";
export interface Choice { value: string; label: string }

export interface DynamicData {
  site?: { title?: string; tagline?: string; logo?: string | null };
  menus?: Record<string, Array<{ title: string; url?: string }>>;
  post?: DynamicPost;
  /** Trang lưu trữ mẫu (tiêu đề, mô tả chuyên mục) cho khối Tiêu đề trang lưu trữ / Mô tả chuyên mục. */
  archive?: { title?: string; description?: string };
  /** Bài mẫu cho "Danh sách bài" khi không có queryPosts. */
  posts?: DynamicPost[];
  languages?: string[];
}

export const docIdOf = (host: EditorHost, ref: NestedDocRef) => host.documents?.idOf?.(ref) ?? `${ref.kind}:${String(ref.ref)}`;
