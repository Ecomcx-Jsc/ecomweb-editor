import { DOMParser as PMParser, DOMSerializer, type Node as PMNode } from "prosemirror-model";
import { richSchema } from "./schema";

/** Thẻ bị bỏ cả nội dung (không chỉ bỏ thẻ) trước khi đưa vào lược đồ. */
const DROP = "script,style,iframe,object,embed,form,link,meta,noscript,template,svg,math";

/** HTML → tài liệu ProseMirror. Chuỗi trống / chữ trơn (không có thẻ) vẫn thành tài liệu hợp lệ. */
export function parseHtml(html: string): PMNode {
  const dom = new window.DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  dom.body.querySelectorAll(DROP).forEach((el) => el.remove());
  dom.body.querySelectorAll("*").forEach((el) => { for (const a of Array.from(el.attributes)) if (/^on/i.test(a.name)) el.removeAttribute(a.name); });
  return PMParser.fromSchema(richSchema).parse(dom.body);
}

const serializer = DOMSerializer.fromSchema(richSchema);

/** Tài liệu → HTML sạch. Tài liệu chỉ có một đoạn trống → "" (để trường bắt buộc nhận ra là chưa nhập). */
export function toHtml(doc: PMNode): string {
  if (isEmptyDoc(doc)) return "";
  const box = document.createElement("div");
  box.appendChild(serializer.serializeFragment(doc.content));
  return box.innerHTML;
}

export function isEmptyDoc(doc: PMNode): boolean {
  return doc.childCount === 1 && doc.firstChild!.type.name === "paragraph" && doc.firstChild!.content.size === 0;
}

/** Làm sạch một chuỗi HTML (dùng khi lưu / dán từ nơi khác): parse bằng lược đồ rồi ghi lại. */
export const sanitizeHtml = (html: string): string => toHtml(parseHtml(html));
