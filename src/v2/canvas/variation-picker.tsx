import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { BlockType, BlockLayout } from "../core/registry";
import { useMsgs } from "../i18n";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

/** Bản vẽ thu nhỏ của bố cục: nền xám nhạt cho chữ / khung, màu nhấn của trình soạn cho phần đang nổi bật. */
export function Thumb({ children }: { children: ReactNode }) {
  return <svg className="ecx-vthumb" viewBox="0 0 96 64" aria-hidden="true" focusable="false">{children}</svg>;
}
export const bar = (x: number, y: number, w: number, h = 4, accent = false) => <rect key={`${x},${y},${w}`} x={x} y={y} width={w} height={h} rx={1.5} className={accent ? "is-accent" : undefined} />;
export const box = (x: number, y: number, w: number, h: number, accent = false) => <rect key={`b${x},${y},${w},${h}`} x={x} y={y} width={w} height={h} rx={3} className={cx("is-box", accent && "is-accent")} />;

/** Giá trị đang dùng (hoặc mặc định của thuộc tính) có khớp hết thuộc tính của bố cục không. */
export function variationMatches(type: BlockType | undefined, attrs: Record<string, unknown>, v: BlockLayout): boolean {
  return Object.entries(v.attrs).every(([k, want]) => (attrs[k] ?? type?.attributes?.[k]?.default) === want);
}

/** Lưới thẻ bố cục: bấm một thẻ → áp thuộc tính của bố cục lên khối. Dùng cả ở bảng phải (đổi sau) lẫn ô chọn lúc vừa chèn. */
export function VariationGrid({ type, attrs, onPick, className }: { type?: BlockType; attrs: Record<string, unknown>; onPick(v: BlockLayout): void; className?: string }) {
  const vs = type?.layouts ?? [];
  if (!vs.length) return null;
  /** Mũi tên di chuyển giữa các thẻ (như nhóm nút chọn chuẩn): thẻ đang được tick giữ tabindex 0, các thẻ còn lại -1. */
  const arrows = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button[role=radio]")];
    const i = btns.indexOf(e.target as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length;
    btns[next]?.focus();
  };
  const onIdx = vs.findIndex((v) => variationMatches(type, attrs, v));
  return (
    <div className={cx("ecx-variations", className)} role="radiogroup" onKeyDown={arrows}>
      {vs.map((v, i) => {
        const on = variationMatches(type, attrs, v);
        return (
          <button key={v.id} type="button" role="radio" aria-checked={on} tabIndex={i === Math.max(0, onIdx) ? 0 : -1} className={cx("ecx-variation", on && "is-active")} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(v)}>
            {v.thumb}<span>{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Ô chọn bố cục đứng thế chỗ khối ngay sau khi chèn (như Kadence): chọn một thẻ hoặc "Bỏ qua" để dùng bố cục mặc định. */
export function VariationChooser({ type, attrs, onPick, onSkip, blockProps }: { type: BlockType; attrs: Record<string, unknown>; onPick(v: BlockLayout): void; onSkip(): void; blockProps: Record<string, unknown> }) {
  const t = useMsgs("blocks") as Record<string, string>;
  const box = useRef<HTMLDivElement | null>(null);
  // Bàn phím: thẻ đầu nhận focus ngay khi ô chọn hiện (Enter / Space chọn, Esc bỏ qua)
  useEffect(() => { box.current?.querySelector<HTMLButtonElement>("button[role=radio]")?.focus({ preventScroll: true }); }, []);
  const ref = (el: HTMLDivElement | null) => { box.current = el; const r = (blockProps as { ref?: unknown }).ref; if (typeof r === "function") (r as (n: HTMLDivElement | null) => void)(el); else if (r && typeof r === "object") (r as { current: unknown }).current = el; };
  return (
    <div {...blockProps} ref={ref} onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onSkip(); } }} className={cx((blockProps as { className?: string }).className, "ecx-variation-chooser")} contentEditable={false}>
      <strong className="ecx-variation-title">{t.chooseLayout}</strong>
      <VariationGrid type={type} attrs={attrs} onPick={onPick} />
      <button type="button" className="ecx-variation-skip" onMouseDown={(e) => e.preventDefault()} onClick={onSkip}>{t.skipLayout}</button>
    </div>
  );
}
