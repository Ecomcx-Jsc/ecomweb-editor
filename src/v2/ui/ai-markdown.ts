import type { RichNode } from "@ecomcx/ecomweb-content";

/**
 * Chữ AI trả về → khối dạng lưu. AI hay trả markdown nhẹ (## tiêu đề, - danh sách, **đậm**) dù được dặn trả chữ thuần:
 * thay vì chèn nguyên ký hiệu `##` / `**` vào trang, ta đọc chúng thành tiêu đề, danh sách, chữ đậm / nghiêng thật.
 * Chỉ nhận các dấu đơn giản; mọi thứ khác (bảng, mã, ảnh, HTML) giữ là chữ thường — không bao giờ sinh khối nguy hiểm.
 */
const text = (t: string, marks?: Array<{ type: string }>): RichNode => ({ type: "text", text: t, ...(marks ? { marks } : {}) });

/** Chữ đậm / nghiêng trong một dòng: **đậm**, *nghiêng*; dấu lẻ loi giữ nguyên (không đọc `_` để khỏi phá tên_có_gạch_dưới). */
export function inlineNodes(src: string): RichNode[] {
  const out: RichNode[] = [];
  const re = /\*\*(?=\S)([\s\S]*?\S)\*\*|\*(?=\S)([^*]*?\S)\*/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push(text(src.slice(last, m.index)));
    out.push(m[1] != null ? text(m[1], [{ type: "bold" }]) : text(m[2], [{ type: "italic" }]));
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(text(src.slice(last)));
  return out.filter((n) => n.text !== "");
}

const para = (s: string): RichNode => ({ type: "paragraph", content: inlineNodes(s) });
const item = (s: string): RichNode => ({ type: "listItem", content: [para(s)] });

export function markdownToNodes(raw: string): RichNode[] {
  const nodes: RichNode[] = [];
  let list: RichNode | null = null;
  let buf: string[] = [];
  const flush = () => { if (buf.length) { nodes.push(para(buf.join(" "))); buf = []; } };
  const closeList = () => { list = null; };
  for (const line0 of raw.replace(/\r/g, "").split("\n")) {
    const line = line0.trim();
    if (!line) { flush(); closeList(); continue; }
    const h = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (h) { flush(); closeList(); nodes.push({ type: "heading", attrs: { level: Math.min(4, Math.max(2, h[1].length)) }, content: inlineNodes(h[2]) }); continue; }
    const ul = /^(?:[-*•+])\s+(.+)$/.exec(line);
    const ol = /^\d{1,3}[.)]\s+(.+)$/.exec(line);
    if (ul || ol) {
      flush();
      const type = ul ? "bulletList" : "orderedList";
      if (!list || (list as RichNode).type !== type) { list = { type, content: [] }; nodes.push(list); }
      (list as RichNode).content!.push(item((ul ?? ol)![1]));
      continue;
    }
    closeList();
    buf.push(line);
  }
  flush();
  return nodes;
}
