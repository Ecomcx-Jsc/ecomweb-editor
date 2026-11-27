/** Chữ giao diện của trình soạn HTML (tự chứa, không phụ thuộc hệ i18n của trình soạn khối). `labels` truyền vào ghi đè từng khoá. */
const vi = {
  undo: "Hoàn tác", redo: "Làm lại", blocks: "Kiểu đoạn", paragraph: "Đoạn văn", heading: "Tiêu đề {n}", quote: "Trích dẫn", codeBlock: "Khối mã",
  bold: "Đậm", italic: "Nghiêng", underline: "Gạch chân", strike: "Gạch ngang", code: "Mã trong dòng", sub: "Chỉ số dưới", sup: "Chỉ số trên",
  color: "Màu chữ", highlight: "Màu nền chữ", noColor: "Bỏ màu", customColor: "Màu tuỳ chọn",
  alignLeft: "Căn trái", alignCenter: "Căn giữa", alignRight: "Căn phải", alignJustify: "Căn đều hai bên",
  bulletList: "Danh sách chấm", orderedList: "Danh sách số", indent: "Thụt vào", outdent: "Thụt ra",
  link: "Liên kết", unlink: "Gỡ liên kết", linkUrl: "Địa chỉ liên kết", linkNewTab: "Mở tab mới", apply: "Áp dụng", cancel: "Huỷ",
  image: "Chèn ảnh", imageUrl: "Địa chỉ ảnh", imageAlt: "Mô tả ảnh", insert: "Chèn",
  video: "Chèn video", audio: "Chèn âm thanh", file: "Chèn tệp tải xuống", mediaUrl: "Địa chỉ tệp", fileName: "Tên hiển thị",
  table: "Bảng", tableInsert: "Chèn bảng 3×3", rowAfter: "Thêm hàng dưới", colAfter: "Thêm cột phải", rowDelete: "Xoá hàng", colDelete: "Xoá cột", tableDelete: "Xoá bảng", headerRow: "Hàng tiêu đề", mergeCells: "Gộp ô", splitCell: "Tách ô",
  hr: "Đường kẻ ngang", clear: "Xoá định dạng", source: "Mã HTML", visual: "Soạn thường", fullscreen: "Toàn màn hình", exitFullscreen: "Thoát toàn màn hình",
  more: "Thêm công cụ", words: "{n} từ", chars: "{n} ký tự", placeholder: "Nhập nội dung…", editor: "Trình soạn văn bản", toolbar: "Thanh công cụ định dạng",
};
const en: typeof vi = {
  undo: "Undo", redo: "Redo", blocks: "Block style", paragraph: "Paragraph", heading: "Heading {n}", quote: "Quote", codeBlock: "Code block",
  bold: "Bold", italic: "Italic", underline: "Underline", strike: "Strikethrough", code: "Inline code", sub: "Subscript", sup: "Superscript",
  color: "Text colour", highlight: "Highlight colour", noColor: "No colour", customColor: "Custom colour",
  alignLeft: "Align left", alignCenter: "Align centre", alignRight: "Align right", alignJustify: "Justify",
  bulletList: "Bulleted list", orderedList: "Numbered list", indent: "Indent", outdent: "Outdent",
  link: "Link", unlink: "Remove link", linkUrl: "Link address", linkNewTab: "Open in new tab", apply: "Apply", cancel: "Cancel",
  image: "Insert image", imageUrl: "Image address", imageAlt: "Image description", insert: "Insert",
  video: "Insert video", audio: "Insert audio", file: "Insert download file", mediaUrl: "File address", fileName: "Display name",
  table: "Table", tableInsert: "Insert 3×3 table", rowAfter: "Add row below", colAfter: "Add column right", rowDelete: "Delete row", colDelete: "Delete column", tableDelete: "Delete table", headerRow: "Header row", mergeCells: "Merge cells", splitCell: "Split cell",
  hr: "Horizontal rule", clear: "Clear formatting", source: "HTML source", visual: "Visual editor", fullscreen: "Fullscreen", exitFullscreen: "Exit fullscreen",
  more: "More tools", words: "{n} words", chars: "{n} characters", placeholder: "Type here…", editor: "Text editor", toolbar: "Formatting toolbar",
};
export type RichLabels = typeof vi;
const bundles: Record<string, RichLabels> = { vi, en };

export function richLabels(locale = "vi", override?: Partial<RichLabels>): RichLabels {
  return { ...(bundles[locale.split("-")[0]] ?? en), ...override };
}
export const fmt = (s: string, n: number | string) => s.replace("{n}", String(n));
