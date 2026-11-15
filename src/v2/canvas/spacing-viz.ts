/**
 * Tô vùng đệm (padding — bên trong khối) hoặc lề (margin — bên ngoài khối) của một khối trên khung soạn, kèm giá trị:
 * rê chuột lên ô cạnh ở bảng bên phải → thấy ngay vùng đó trên khối. Lớp phủ riêng (position: fixed trong iframe), không đổi HTML của khối.
 */
export type SpacingKind = "padding" | "margin";
export type Side = "top" | "right" | "bottom" | "left";
const SIDES: Side[] = ["top", "right", "bottom", "left"];
const CLS = "ecx-spacing-viz";

export function hideSpacingViz(doc: Document | null | undefined) {
  doc?.querySelectorAll(`.${CLS}`).forEach((n) => n.remove());
}

/** Hình chữ nhật của từng cạnh (toạ độ khung nhìn của iframe). */
export function spacingRects(r: { left: number; top: number; right: number; bottom: number; width: number; height: number }, px: Record<Side, number>, kind: SpacingKind) {
  const out: Record<Side, { left: number; top: number; width: number; height: number }> = {} as never;
  if (kind === "padding") {
    out.top = { left: r.left, top: r.top, width: r.width, height: px.top };
    out.bottom = { left: r.left, top: r.bottom - px.bottom, width: r.width, height: px.bottom };
    out.left = { left: r.left, top: r.top + px.top, width: px.left, height: Math.max(0, r.height - px.top - px.bottom) };
    out.right = { left: r.right - px.right, top: r.top + px.top, width: px.right, height: Math.max(0, r.height - px.top - px.bottom) };
  } else {
    out.top = { left: r.left - px.left, top: r.top - px.top, width: r.width + px.left + px.right, height: px.top };
    out.bottom = { left: r.left - px.left, top: r.bottom, width: r.width + px.left + px.right, height: px.bottom };
    out.left = { left: r.left - px.left, top: r.top, width: px.left, height: r.height };
    out.right = { left: r.right, top: r.top, width: px.right, height: r.height };
  }
  return out;
}

/** Vẽ lớp tô cho các cạnh `sides` (rỗng = cả 4). `names`: tên bậc hiện cạnh giá trị px (vd "MD · 20px"). */
export function showSpacingViz(el: HTMLElement | null, kind: SpacingKind, sides: Side[] = SIDES, names: Partial<Record<Side, string>> = {}) {
  if (!el) return;
  const doc = el.ownerDocument;
  hideSpacingViz(doc);
  const cs = doc.defaultView!.getComputedStyle(el);
  const px = Object.fromEntries(SIDES.map((s) => [s, parseFloat(cs.getPropertyValue(`${kind}-${s}`)) || 0])) as Record<Side, number>;
  const rects = spacingRects(el.getBoundingClientRect(), px, kind);
  for (const s of sides.length ? sides : SIDES) {
    const r = rects[s];
    const box = doc.createElement("div");
    box.className = `${CLS} is-${kind}`;
    Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${Math.max(0, r.width)}px`, height: `${Math.max(0, r.height)}px` });
    if (px[s] >= 1) {
      const tag = doc.createElement("span");
      tag.textContent = names[s] ? `${names[s]} · ${Math.round(px[s])}px` : `${Math.round(px[s])}px`;
      box.appendChild(tag);
    }
    doc.body.appendChild(box);
  }
}
