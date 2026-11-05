import { messages } from "../../i18n";

/** Mô tả ngắn của khối lõi (thẻ xem trước khi rê chuột trong thư viện khối). Chữ nằm ở src/locales/<ngôn ngữ>/blockDesc.ts, khoá = tên khối. */
export const blockDescription = (type: string, lang: string): string | undefined => {
  const d = messages("blockDesc", lang)[type];
  return typeof d === "string" ? d : undefined;
};
