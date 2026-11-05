/**
 * Khung bao nội dung trong khung soạn (host.canvasWrapper): chuỗi phần tử như trên website (div.site > main#x > div.content…) để
 * selector theo cấu trúc trang của theme khớp. Dữ liệu đến từ website → chỉ nhận khối bố cục, class / id / data-* / style đơn giản.
 */
export interface WrapperEl { tag: string; attrs?: Record<string, string> }
export interface WrapperNode { tag: string; props: Record<string, unknown> }

const BOX = new Set(["div", "main", "section", "article", "aside", "span"]);
const SAFE_VALUE = /^[^<>"'`\\]{0,500}$/;
export const MAX_WRAPPER_DEPTH = 12;

const camel = (p: string) => (p.startsWith("--") ? p : p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));

/** "--a:1;font-size:14px" → { "--a": "1", fontSize: "14px" }; khai báo nguy hiểm (url(), expression…) → bỏ cả style. */
export function parseStyle(css: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const decl of css.split(";").map((d) => d.trim()).filter(Boolean)) {
    const i = decl.indexOf(":");
    const name = decl.slice(0, i).trim(), value = decl.slice(i + 1).trim();
    if (i < 1 || !/^(--[\w-]+|[a-z-]+)$/i.test(name) || /[{}<>"'`\\]|url\s*\(|expression|@import|javascript:/i.test(value)) return null;
    out[camel(name)] = value;
  }
  return Object.keys(out).length ? out : null;
}

/** Chuỗi đã lọc, từ ngoài vào trong. */
export function wrapperNodes(chain: WrapperEl[] | undefined): WrapperNode[] {
  const nodes: WrapperNode[] = [];
  for (const el of (chain ?? []).slice(0, MAX_WRAPPER_DEPTH)) {
    const props: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(el.attrs ?? {})) {
      if (typeof value !== "string") continue;
      if (name === "style") { const s = parseStyle(value); if (s) props.style = s; }
      else if (name === "class" && SAFE_VALUE.test(value)) props.className = value;
      else if ((name === "id" || /^data-[a-z0-9-]+$/.test(name)) && SAFE_VALUE.test(value)) props[name] = value;
    }
    nodes.push({ tag: BOX.has(el.tag) ? el.tag : "div", props });
  }
  return nodes;
}
