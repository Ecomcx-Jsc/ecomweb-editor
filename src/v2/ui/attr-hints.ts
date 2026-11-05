import type { ChoiceKind } from "../core/host";

/**
 * Cách hiện từng thuộc tính của khối lõi trong bảng cài đặt: nhãn của giá trị chọn (không hiện giá trị thô như
 * "horizontal"), ô chọn lấy dữ liệu thật từ ứng dụng (vị trí menu, loại bài, chuyên mục…), thanh kéo, gợi ý,
 * và điều kiện hiện. Khoá: "khối.thuộc_tính" hoặc "*.thuộc_tính" (mọi khối).
 */
export type Opt = [value: string | number, vi: string, en: string];
export interface AttrHint {
  /** Nhãn riêng cho thuộc tính ở khối này (vi, en). */
  label?: [string, string];
  control?: "select" | "segmented" | "range" | "choice" | "newTab" | "suggest" | "code" | "hidden";
  options?: Opt[];
  /** Ô chọn lấy dữ liệu từ ứng dụng (host.choices); tham số tính từ thuộc tính hiện tại. */
  choice?: { kind: ChoiceKind; args?: (attrs: Record<string, unknown>) => Record<string, string> };
  suggestions?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Chỉ hiện khi điều kiện đúng (vd chuyên mục chỉ khi không "theo trang đang xem"). */
  when?: (attrs: Record<string, unknown>) => boolean;
  /** Ghi chú dưới ô. */
  help?: [string, string];
}

const ALIGN: Opt[] = [["left", "Trái", "Left"], ["center", "Giữa", "Center"], ["right", "Phải", "Right"]];
const V_ALIGN: Opt[] = [["top", "Trên", "Top"], ["center", "Giữa", "Middle"], ["bottom", "Dưới", "Bottom"]];
const SIZES: Opt[] = [["small", "Nhỏ", "Small"], ["medium", "Vừa", "Medium"], ["large", "Lớn", "Large"]];
const levels = (from: number, to: number, zero?: [string, string]): Opt[] => [
  ...(zero ? [[0, zero[0], zero[1]] as Opt] : []),
  ...Array.from({ length: to - from + 1 }, (_, i) => [from + i, `Tiêu đề ${from + i} (H${from + i})`, `Heading ${from + i} (H${from + i})`] as Opt),
];
const notInherit = (a: Record<string, unknown>) => a.inherit === false;

export const ATTR_HINTS: Record<string, AttrHint> = {
  "*.textAlign": { control: "segmented", options: [...ALIGN, ["justify", "Đều hai bên", "Justify"]] },
  "*.mime": { control: "hidden" },
  "video.name": { control: "hidden" },
  "video.autoplay": { label: ["Tự phát (sẽ tắt tiếng)", "Autoplay (muted)"] },
  "video.loop": { label: ["Lặp lại", "Loop"] },
  "video.muted": { label: ["Tắt tiếng", "Muted"] },
  "video.controls": { label: ["Hiện thanh điều khiển", "Show controls"] },
  "video.playsInline": { label: ["Phát ngay trong trang (iPhone)", "Play inline (iPhone)"] },
  "video.preload": { control: "select", label: ["Tải trước", "Preload"], options: [["none", "Không", "None"], ["metadata", "Thông tin video", "Metadata"], ["auto", "Cả video", "All"]] },
  "audio.autoplay": { label: ["Tự phát", "Autoplay"] },
  "audio.loop": { label: ["Lặp lại", "Loop"] },
  "audio.preload": { control: "select", label: ["Tải trước", "Preload"], options: [["none", "Không", "None"], ["metadata", "Thông tin", "Metadata"], ["auto", "Cả tệp", "All"]] },
  "file.size": { control: "hidden" },
  "file.name": { label: ["Tên hiển thị", "Display name"] },
  "file.src": { label: ["Tệp", "File"] },
  "video.src": { label: ["Địa chỉ video", "Video URL"] },
  "audio.src": { label: ["Địa chỉ âm thanh", "Audio URL"] },
  "youtube.src": { label: ["Đường dẫn YouTube", "YouTube link"] },
  "youtube.start": { label: ["Bắt đầu từ giây", "Start at second"] },
  "image.src": { label: ["Địa chỉ ảnh", "Image URL"] },
  "cover.src": { label: ["Ảnh nền", "Background image"] },
  "pullquote.citation": { label: ["Nguồn trích dẫn", "Citation"] },
  "audio.name": { control: "hidden" },
  "heading.level": { control: "select", options: levels(1, 6), help: ["Tiêu đề trang / bài đã là H1 — trong nội dung nên bắt đầu từ H2 và không nhảy cấp (SEO).", "The page / post title is already the H1 — start content headings at H2 and don't skip levels (SEO)."] },
  "postTitle.level": { control: "select", options: levels(1, 6) },
  "queryTitle.level": { control: "select", options: levels(1, 6), help: ["Trang lưu trữ / tìm kiếm chỉ nên có đúng một H1 — chính là khối này.", "Archive / search pages should have exactly one H1 — this block."] },
  "breadcrumbs.separator": { control: "segmented", options: [["›", "›", "›"], ["/", "/", "/"], ["»", "»", "»"], ["→", "→", "→"]] },
  "siteTitle.level": { control: "select", options: levels(1, 6, ["Đoạn văn (không phải tiêu đề)", "Paragraph (not a heading)"]) },
  "tableOfContents.maxLevel": { control: "select", options: levels(2, 6) },
  "codeBlock.language": { control: "suggest", suggestions: ["plaintext", "html", "css", "javascript", "typescript", "jsx", "tsx", "json", "php", "python", "bash", "sql", "csharp", "java", "go", "rust", "yaml", "markdown", "xml"] },
  "customHtml.html": { control: "code" },
  "group.padding": { control: "segmented", options: [["none", "Không", "None"], ["small", "Nhỏ", "Small"], ["medium", "Vừa", "Medium"], ["large", "Lớn", "Large"]] },
  "columns.verticalAlign": { control: "segmented", options: V_ALIGN },
  "mediaText.verticalAlign": { control: "segmented", options: V_ALIGN },
  "cover.contentAlign": { control: "segmented", options: V_ALIGN },
  "cover.opacity": { control: "range", min: 0, max: 100, step: 5, unit: "%" },
  "mediaText.position": { control: "segmented", options: [["left", "Ảnh bên trái", "Media left"], ["right", "Ảnh bên phải", "Media right"]] },
  "mediaText.width": { control: "range", min: 15, max: 85, step: 5, unit: "%" },
  "buttons.align": { control: "segmented", options: [...ALIGN, ["space-between", "Dàn đều", "Space between"]] },
  "button.variant": { control: "segmented", options: [["primary", "Chính", "Primary"], ["secondary", "Phụ", "Secondary"], ["outline", "Viền", "Outline"]] },
  "button.target": { control: "newTab" },
  "button.rel": { when: (a) => !!a.href, help: ["Vd: nofollow, sponsored (liên kết quảng cáo)", "e.g. nofollow, sponsored"] },
  "spacer.height": { control: "suggest", suggestions: ["xs", "sm", "md", "lg", "xl", "2xl", "2rem", "4rem", "80px"], help: ["Cỡ có sẵn của theme (xs → 2xl) hoặc độ dài (vd 3rem, 80px)", "Theme size (xs → 2xl) or a length (e.g. 3rem, 80px)"] },
  "callout.tone": { control: "segmented", options: [["info", "Thông tin", "Info"], ["success", "Thành công", "Success"], ["warning", "Cảnh báo", "Warning"], ["danger", "Nguy hiểm", "Danger"]] },
  "image.align": { control: "select", options: [...ALIGN, ["wide", "Rộng", "Wide"], ["full", "Tràn màn hình", "Full width"]] },
  "image.size": { control: "choice", choice: { kind: "imageSize" } },
  "featuredImage.size": { control: "choice", choice: { kind: "imageSize" } },
  "featuredImage.aspect": { control: "select", options: [["auto", "Theo ảnh", "Original"], ["16/9", "16:9", "16:9"], ["4/3", "4:3", "4:3"], ["1/1", "Vuông 1:1", "Square 1:1"], ["3/4", "Dọc 3:4", "Portrait 3:4"]] },
  "socialLinks.size": { control: "segmented", options: SIZES },
  "socialLinks.align": { control: "segmented", options: ALIGN },
  "navigation.location": { control: "choice", choice: { kind: "menuLocation" }, help: ["Menu gán cho vị trí này ở Giao diện › Menu", "The menu assigned to this location in Appearance › Menus"] },
  "navigation.orientation": { control: "segmented", options: [["horizontal", "Ngang", "Horizontal"], ["vertical", "Dọc", "Vertical"]] },
  "postTerms.taxonomy": { control: "choice", choice: { kind: "taxonomy" } },
  "query.postType": { control: "choice", choice: { kind: "postType" }, when: notInherit },
  "query.category": { control: "choice", choice: { kind: "term", args: () => ({ taxonomy: "category" }) }, when: notInherit },
  "query.tag": { control: "choice", choice: { kind: "term", args: () => ({ taxonomy: "post_tag" }) }, when: notInherit },
  "query.perPage": { when: notInherit },
  "query.orderBy": { control: "select", options: [["date", "Ngày đăng", "Date"], ["modified", "Ngày sửa", "Modified"], ["title", "Tiêu đề", "Title"], ["comment_count", "Số bình luận", "Comments"], ["menu_order", "Thứ tự tự đặt", "Custom order"], ["rand", "Ngẫu nhiên", "Random"]], when: notInherit },
  "query.authorId": { label: ["Mã tác giả", "Author ID"], when: notInherit },
  "query.search": { label: ["Từ khoá", "Search keyword"], when: notInherit },
  "query.exclude": { label: ["Loại trừ bài (mã, cách nhau bằng dấu phẩy)", "Exclude posts (IDs, comma-separated)"], when: notInherit },
  "query.sticky": { control: "select", options: [["any", "Tất cả", "All"], ["only", "Chỉ bài ghim", "Sticky only"], ["exclude", "Bỏ bài ghim", "Hide sticky"]], when: notInherit },
  "image.href": { label: ["Liên kết khi bấm vào ảnh", "Link when clicked"] },
  "image.linkTarget": { control: "segmented", label: ["Mở liên kết", "Open link"], options: [["_self", "Cùng tab", "Same tab"], ["_blank", "Tab mới", "New tab"]] },
  "orderedList.reversed": { label: ["Đếm ngược", "Reversed"] },
  "blockquote.citation": { label: ["Nguồn trích dẫn", "Citation"] },
  "postDate.displayType": { control: "segmented", label: ["Hiện ngày", "Show date"], options: [["published", "Đăng", "Published"], ["modified", "Sửa lần cuối", "Last modified"]] },
  "query.paginate": { label: ["Phân trang (?qpage=)", "Paginate (?qpage=)"], help: ["Bật khi khối nằm trong trang thường; trang lưu trữ dùng \"Kế thừa\"", "Use on regular pages; archives use \"Inherit\""], when: notInherit },
  "query.orderByMeta": { label: ["Sắp xếp theo trường tuỳ biến", "Order by custom field"], help: ["Khoá phải khai báo filterable; thay cho \"Sắp xếp theo\"", "Key must be declared filterable; replaces \"Order by\""], when: notInherit },
  "query.order": { control: "segmented", options: [["desc", "Mới → cũ / Z → A", "Descending"], ["asc", "Cũ → mới / A → Z", "Ascending"]], when: notInherit },
  "query.inherit": { help: ["Trang danh mục / tìm kiếm / lưu trữ: hiện đúng bài của trang đó", "On archive / search pages, show that page's posts"] },
  "postTemplate.layout": { control: "segmented", options: [["list", "Danh sách", "List"], ["grid", "Lưới", "Grid"]] },
  "postTemplate.columns": { control: "range", min: 1, max: 6, step: 1, when: (a) => a.layout === "grid" },
  "templatePart.slug": { control: "choice", choice: { kind: "templatePart" } },
  "templatePart.tagName": { control: "select", options: [["div", "Khối thường (div)", "Generic (div)"], ["header", "Đầu trang (header)", "Header"], ["footer", "Chân trang (footer)", "Footer"], ["aside", "Cột phụ (aside)", "Aside"], ["section", "Mục (section)", "Section"]] },
};

/** Nhãn mặc định của giá trị chọn khi chưa có trong ATTR_HINTS. */
const VALUE_LABELS: Record<string, [string, string]> = {
  left: ["Trái", "Left"], center: ["Giữa", "Center"], right: ["Phải", "Right"], justify: ["Đều hai bên", "Justify"], top: ["Trên", "Top"], bottom: ["Dưới", "Bottom"],
  none: ["Không", "None"], small: ["Nhỏ", "Small"], medium: ["Vừa", "Medium"], large: ["Lớn", "Large"], wide: ["Rộng", "Wide"], full: ["Tràn màn hình", "Full width"],
  auto: ["Tự động", "Auto"], horizontal: ["Ngang", "Horizontal"], vertical: ["Dọc", "Vertical"], _self: ["Cùng tab", "Same tab"], _blank: ["Tab mới", "New tab"],
};

export const hintOf = (block: string, attr: string): AttrHint => ATTR_HINTS[`${block}.${attr}`] ?? ATTR_HINTS[`*.${attr}`] ?? {};
export function optionLabel(hint: AttrHint, value: unknown, lang: "vi" | "en", fallback?: string): string {
  const o = hint.options?.find((x) => String(x[0]) === String(value));
  if (o) return lang === "vi" ? o[1] : o[2];
  return fallback ?? VALUE_LABELS[String(value)]?.[lang === "vi" ? 0 : 1] ?? String(value);
}

/** Cỡ ảnh mặc định khi ứng dụng không khai báo. */
export const DEFAULT_IMAGE_SIZES: Opt[] = [["thumbnail", "Nhỏ (thumbnail)", "Thumbnail"], ["medium", "Vừa", "Medium"], ["large", "Lớn", "Large"], ["full", "Gốc", "Full size"]];
