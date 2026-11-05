/** Hàm dựng khối dùng chung cho mẫu của lõi (patterns.ts, patterns-library.ts). */
export const text = (s: string, marks?: Array<{ type: string }>) => (marks ? { type: "text", text: s, marks } : { type: "text", text: s });
export const p = (s: string, attrs?: Record<string, unknown>) => ({ type: "paragraph", ...(attrs ? { attrs } : {}), content: [text(s)] });
export const h = (level: number, s: string, attrs: Record<string, unknown> = {}) => ({ type: "heading", attrs: { level, ...attrs }, content: [text(s)] });
export const btn = (s: string, variant = "primary") => ({ type: "button", attrs: { text: s, href: "#", variant } });
export const buttons = (align: string, ...list: object[]) => ({ type: "buttons", attrs: { align }, content: list });

