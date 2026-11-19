import type { ReactNode } from "react";
import { cx } from "./style-controls";

/**
 * Ô chọn bằng hình (thẻ icon hai lớp): mỗi lựa chọn là một hình nhỏ có nhãn — lớp sau = trạng thái đầu / khung tham chiếu (nét đứt, mờ),
 * lớp trước = kết quả — để người dùng thường nhìn là hiểu (trượt lên, phóng to, bóng đổ, khung tròn…) thay vì đọc tên rồi đoán.
 */
export interface PickOption { id: string; label: string; thumb: ReactNode }

export function PickTiles({ value, options, onChange, label, none }: { value: string | undefined; options: PickOption[]; onChange(v: string | undefined): void; label: string; none?: { label: string } }) {
  const all: PickOption[] = none ? [{ id: "", label: none.label, thumb: <Frame><rect x="20" y="12" width="24" height="20" rx="3" className="is-solid" /></Frame> }, ...options] : options;
  return (
    <div className="ecx-pick-grid" role="radiogroup" aria-label={label}>
      {all.map((o) => {
        const on = (value ?? "") === o.id;
        return (
          <button key={o.id || "none"} type="button" role="radio" aria-checked={on} aria-label={o.label} title={o.label} className={cx("ecx-pick", on && "is-active")} onClick={() => onChange(o.id === "" ? undefined : on ? undefined : o.id)}>
            {o.thumb}
            <span className="ecx-pick-label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const Frame = ({ children }: { children: ReactNode }) => <svg className="ecx-pick-thumb" viewBox="0 0 64 44" aria-hidden="true">{children}</svg>;
/** Hộp tham chiếu (lớp sau, nét đứt) và hộp kết quả (lớp trước, đặc). */
const ghost = (x: number, y: number, w: number, h: number, extra?: Record<string, unknown>) => <rect key={`g${x}${y}${w}`} x={x} y={y} width={w} height={h} rx="3" className="is-ghost" {...extra} />;
const solid = (x: number, y: number, w: number, h: number, extra?: Record<string, unknown>) => <rect key={`s${x}${y}${w}`} x={x} y={y} width={w} height={h} rx="3" className="is-solid" {...extra} />;
const arrow = (d: string) => <path key={`a${d}`} d={d} className="is-arrow" fill="none" />;

/** Hình cho hiệu ứng khi cuộn tới (MOTION_IN). */
export function motionInThumb(id: string): ReactNode {
  const W = 24, H = 18, cx0 = 20, cy0 = 13;
  switch (id) {
    case "fade": return <Frame>{ghost(cx0, cy0, W, H, { opacity: 0.5 })}{solid(cx0, cy0, W, H, { opacity: 0.45 })}</Frame>;
    case "slide-up": return <Frame>{ghost(cx0, cy0 + 9, W, H)}{solid(cx0, cy0 - 3, W, H)}{arrow("M32 40V32M29 35l3-3 3 3")}</Frame>;
    case "slide-down": return <Frame>{ghost(cx0, cy0 - 9, W, H)}{solid(cx0, cy0 + 3, W, H)}{arrow("M32 4v8M29 9l3 3 3-3")}</Frame>;
    case "slide-left": return <Frame>{ghost(cx0 + 12, cy0, W, H)}{solid(cx0 - 6, cy0, W, H)}{arrow("M60 22h-8M55 19l-3 3 3 3")}</Frame>;
    case "slide-right": return <Frame>{ghost(cx0 - 12, cy0, W, H)}{solid(cx0 + 6, cy0, W, H)}{arrow("M4 22h8M9 19l3 3-3 3")}</Frame>;
    case "zoom-in": return <Frame>{ghost(26, 17, 12, 10)}{solid(18, 11, 28, 22)}</Frame>;
    case "zoom-out": return <Frame>{ghost(14, 8, 36, 28)}{solid(24, 15, 16, 14)}</Frame>;
    case "blur-in": return <Frame><g filter="url(#ecx-blur)">{ghost(cx0, cy0, W, H)}</g><defs><filter id="ecx-blur"><feGaussianBlur stdDeviation="2.2" /></filter></defs>{solid(cx0, cy0, W, H)}</Frame>;
    default: return <Frame>{solid(cx0, cy0, W, H)}</Frame>;
  }
}

/** Hình cho hiệu ứng rê chuột (MOTION_HOVER). */
export function motionHoverThumb(id: string): ReactNode {
  switch (id) {
    case "lift": return <Frame>{ghost(20, 17, 24, 18)}{solid(20, 10, 24, 18)}{arrow("M32 38v-3M29 37l3 3 3-3")}</Frame>;
    case "grow": return <Frame>{ghost(22, 14, 20, 16)}{solid(16, 9, 32, 26)}</Frame>;
    case "brighten": return <Frame>{ghost(20, 13, 24, 18, { opacity: 0.35 })}{solid(20, 13, 24, 18, { opacity: 0.9 })}<path d="M50 8l1.5 3 3 1.5-3 1.5L50 17l-1.5-3-3-1.5 3-1.5z" className="is-solid" /></Frame>;
    case "glow": return <Frame>{ghost(15, 8, 34, 28, { opacity: 0.3, rx: 10 })}{ghost(17, 10, 30, 24, { opacity: 0.45, rx: 8 })}{solid(20, 13, 24, 18)}</Frame>;
    default: return <Frame>{solid(20, 13, 24, 18)}</Frame>;
  }
}

/** Hình cho khung icon (không khung / tròn / vuông) và các tuỳ chọn tương tự. */
export function frameThumb(id: string): ReactNode {
  const star = <path d="M32 14l2.4 5 5.4.7-4 3.8 1 5.4L32 26.2l-4.8 2.7 1-5.4-4-3.8 5.4-.7z" className="is-glyph" />;
  switch (id) {
    case "circle": return <Frame><circle cx="32" cy="22" r="15" className="is-solid" />{star}</Frame>;
    case "square": return <Frame><rect x="17" y="7" width="30" height="30" rx="5" className="is-solid" />{star}</Frame>;
    default: return <Frame><rect x="17" y="7" width="30" height="30" rx="5" className="is-ghost" /><path d="M32 14l2.4 5 5.4.7-4 3.8 1 5.4L32 26.2l-4.8 2.7 1-5.4-4-3.8 5.4-.7z" className="is-solid" /></Frame>;
  }
}

/** Hình cho độ đậm của bóng đổ (sm → xl): lớp sau = bóng, lớp trước = hộp. */
export function shadowThumb(id: string): ReactNode {
  const spread = { sm: 1.5, md: 3, lg: 5, xl: 7 }[id] ?? 3;
  return <Frame>{ghost(20 - spread / 2, 13 + spread, 24 + spread, 18 + spread / 2, { opacity: 0.35, rx: 5 })}{solid(20, 12, 24, 18)}</Frame>;
}

/** Hiệu ứng rê chuột của Hộp icon: không / phóng to / lật. */
export function iconHoverThumb(id: string): ReactNode {
  if (id === "grow") return motionHoverThumb("grow");
  if (id === "flip") return <Frame>{ghost(14, 13, 14, 18)}{solid(36, 13, 14, 18)}<path d="M20 8c6-5 18-5 24 0M41 5l3 3-4 2" className="is-arrow" fill="none" /></Frame>;
  return motionHoverThumb("none");
}
