import type { CSSProperties } from "react";

/** Ô "chưa chọn màu": nền trắng gạch chéo đỏ (không phải màu đen của ô chọn màu trình duyệt). */
const EMPTY: CSSProperties = { background: "linear-gradient(to top right, transparent calc(50% - 1px), #d92d20 calc(50% - 1px), #d92d20 calc(50% + 1px), transparent calc(50% + 1px)), #fff" };

/**
 * Ô màu tự chọn: hiện đúng màu đang đặt, chưa đặt thì hiện ô gạch chéo; bấm mở bảng chọn màu của trình duyệt.
 * (`<input type=color>` không có trạng thái "trống" — luôn hiện đen #000000 làm người dùng tưởng đã đặt màu đen.)
 */
export function ColorSwatchInput({ value, onChange, label, className, size = 26 }: { value?: string; onChange(hex: string): void; label: string; className?: string; size?: number }) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
  return (
    <label className={className} title={hex ?? label} data-empty={hex ? undefined : ""}
      style={{ position: "relative", display: "inline-block", width: size, height: size, flex: "none", borderRadius: 6, border: "1px solid rgb(0 0 0 / .18)", cursor: "pointer", overflow: "hidden", ...(hex ? { background: hex } : EMPTY) }}>
      <input type="color" aria-label={label} value={hex ?? "#ffffff"} onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: 0, padding: 0 }} />
    </label>
  );
}
