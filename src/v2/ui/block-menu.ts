/** Chép / dán kiểu dáng (chỉ `attrs.style`) + vị trí menu chuột phải. */

// shortcut: chỉ nhớ trong phiên (bộ nhớ của trang admin, giữ khi chuyển bài trong SPA), mất khi tải lại — cần chép giữa tab thì chuyển sang localStorage.
let copied: { style?: Record<string, unknown> } | null = null;

export function copyStyle(attrs: Record<string, unknown>) {
  const s = attrs.style;
  copied = { style: s && typeof s === "object" ? structuredClone(s as Record<string, unknown>) : undefined };
}
export const hasCopiedStyle = () => copied !== null;
/** Thuộc tính để dán (bản sao mới mỗi lần); khối nguồn không có kiểu dáng → dán = bỏ kiểu dáng. null = chưa chép. */
export const pastedStyle = (): { style: Record<string, unknown> | undefined } | null => copied && { style: copied.style && structuredClone(copied.style) };

/** Góc trên-trái của menu (w×h) mở tại (x, y): sát mép phải / dưới thì lật sang trái / lên trên, luôn cách mép 8px. */
export function menuPosition(x: number, y: number, w: number, h: number, vw: number, vh: number) {
  const left = x + w > vw - 8 ? x - w : x;
  const top = y + h > vh - 8 ? y - h : y;
  return { left: Math.round(Math.max(8, Math.min(left, vw - 8 - w))), top: Math.round(Math.max(8, Math.min(top, vh - 8 - h))) };
}
