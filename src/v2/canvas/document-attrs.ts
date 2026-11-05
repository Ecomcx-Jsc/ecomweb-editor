/**
 * Thuộc tính của <html> / <body> trên website (data-theme, class, lang…) áp vào khung soạn: CSS của theme được scope theo
 * `html[data-theme~="slug"]` và các class của body — thiếu chúng thì CSS có tải vẫn không khớp.
 * Chỉ nhận những thuộc tính an toàn (không style, không on*, không src/href): ứng dụng nhúng có thể truyền dữ liệu từ website.
 */
export interface CanvasDocumentSpec {
  html?: Record<string, string>;
  body?: Record<string, string>;
}

export interface AttrOp { target: "html" | "body"; name: string; value: string }

const SAFE_NAME = /^(class|lang|dir|data-[a-z0-9-]+)$/;
const SAFE_VALUE = /^[^<>"'`\\]{0,500}$/;

/** Danh sách thao tác đặt thuộc tính đã lọc (thuần — kiểm thử không cần DOM). */
export function attrOps(spec: CanvasDocumentSpec | undefined): AttrOp[] {
  const ops: AttrOp[] = [];
  for (const target of ["html", "body"] as const)
    for (const [name, value] of Object.entries(spec?.[target] ?? {}))
      if (SAFE_NAME.test(name) && typeof value === "string" && SAFE_VALUE.test(value)) ops.push({ target, name, value });
  return ops;
}

/** Áp lên tài liệu của khung soạn; trả hàm hoàn tác. `class` được thêm vào (giữ class của khung soạn), thuộc tính khác ghi đè. */
export function applyDocumentAttrs(doc: Document, spec: CanvasDocumentSpec | undefined): () => void {
  const undo: Array<() => void> = [];
  for (const { target, name, value } of attrOps(spec)) {
    const el = target === "html" ? doc.documentElement : doc.body;
    if (name === "class") {
      const added = value.split(/\s+/).filter((c) => c && !el.classList.contains(c));
      el.classList.add(...added);
      undo.push(() => el.classList.remove(...added));
    } else {
      const prev = el.getAttribute(name);
      el.setAttribute(name, value);
      undo.push(() => (prev === null ? el.removeAttribute(name) : el.setAttribute(name, prev)));
    }
  }
  return () => undo.forEach((f) => f());
}
