import type { ReactElement } from "react";
import type { BlockLayout } from "../core/registry";
import { bar, box, Thumb } from "../canvas/variation-picker";

/**
 * Bố cục chọn sẵn của các khối có nhiều kiểu bố trí (thẻ có hình thu nhỏ): hiện ngay sau khi chèn và ở đầu bảng phải.
 * Mỗi bố cục chỉ đặt vài thuộc tính cấu trúc — nội dung giữ nguyên khi đổi bố cục.
 */
type M = Record<string, string>;

const lines = (x: number, y: number, w: number) => [bar(x, y, w), bar(x, y + 9, w - 10), bar(x, y + 18, w - 4)];

export function tabsLayouts(m: M): BlockLayout[] {
  const strip = (xs: number[], w: number) => xs.map((x, i) => bar(x, 9, w, 6, i === 0));
  return [
    { id: "left", label: m.layoutTabsLeft, attrs: { orientation: "horizontal", tabsAlign: "flex-start" }, thumb: <Thumb>{strip([8, 30, 52], 18)}{bar(8, 17, 80, 1)}{lines(8, 26, 80)}</Thumb> },
    { id: "center", label: m.layoutTabsCenter, attrs: { orientation: "horizontal", tabsAlign: "center" }, thumb: <Thumb>{strip([19, 41, 63], 14)}{bar(8, 17, 80, 1)}{lines(8, 26, 80)}</Thumb> },
    { id: "spread", label: m.layoutTabsSpread, attrs: { orientation: "horizontal", tabsAlign: "space-between" }, thumb: <Thumb>{strip([8, 35, 62], 26)}{bar(8, 17, 80, 1)}{lines(8, 26, 80)}</Thumb> },
    { id: "vertical", label: m.layoutTabsVertical, attrs: { orientation: "vertical" }, thumb: <Thumb>{[10, 22, 34].map((y, i) => bar(8, y, 22, 8, i === 0))}{bar(33, 8, 1, 40)}{lines(39, 10, 49)}</Thumb> },
  ];
}

const chevron = (x: number, y: number) => <path key={`c${x},${y}`} d={`M${x} ${y} l3 3 l3 -3`} className="is-line" />;
const plus = (x: number, y: number) => <path key={`p${x},${y}`} d={`M${x} ${y + 3} h6 M${x + 3} ${y} v6`} className="is-line" />;

export function accordionLayouts(m: M): BlockLayout[] {
  const rows = (mark: (x: number, y: number) => ReactElement, side: "left" | "right") => [8, 26, 44].map((y) => [box(8, y, 80, 14), bar(side === "left" ? 22 : 14, y + 5, 40), mark(side === "left" ? 13 : 76, y + 5)]);
  return [
    { id: "arrow", label: m.layoutAcc1, attrs: { columns: 1, icon: "arrow", iconSide: "right" }, thumb: <Thumb>{rows(chevron, "right")}</Thumb> },
    { id: "plus", label: m.layoutAccPlus, attrs: { columns: 1, icon: "plus", iconSide: "right" }, thumb: <Thumb>{rows(plus, "right")}</Thumb> },
    { id: "two", label: m.layoutAcc2, attrs: { columns: 2, icon: "arrow", iconSide: "right" }, thumb: <Thumb>{[8, 36].flatMap((y) => [8, 50].map((x) => [box(x, y, 38, 22), bar(x + 6, y + 8, 18), chevron(x + 28, y + 8)]))}</Thumb> },
    { id: "left", label: m.layoutAccLeft, attrs: { columns: 1, icon: "arrow", iconSide: "left" }, thumb: <Thumb>{rows(chevron, "left")}</Thumb> },
  ];
}

const dot = (x: number, y: number, round = false) => <rect key={`d${x},${y}`} x={x} y={y} width={7} height={7} rx={round ? 3.5 : 1.5} className="is-accent" />;

export function iconListLayouts(m: M): BlockLayout[] {
  return [
    { id: "list", label: m.layoutListV, attrs: { layout: "list", columns: 1, iconStyle: "plain" }, thumb: <Thumb>{[10, 25, 40].flatMap((y) => [dot(10, y), bar(23, y + 1.5, 50)])}</Thumb> },
    { id: "inline", label: m.layoutListInline, attrs: { layout: "inline" }, thumb: <Thumb>{[6, 36, 66].flatMap((x) => [dot(x, 28), bar(x + 10, 29.5, 14)])}</Thumb> },
    { id: "two", label: m.layoutList2, attrs: { layout: "list", columns: 2, iconStyle: "plain" }, thumb: <Thumb>{[10, 25, 40].flatMap((y) => [8, 52].flatMap((x) => [dot(x, y), bar(x + 12, y + 1.5, 24)]))}</Thumb> },
    { id: "circle", label: m.layoutListCircle, attrs: { layout: "list", columns: 1, iconStyle: "circle" }, thumb: <Thumb>{[10, 25, 40].flatMap((y) => [dot(10, y, true), bar(23, y + 1.5, 50)])}</Thumb> },
  ];
}

export function testimonialLayouts(m: M): BlockLayout[] {
  const quote = [bar(18, 16, 60), bar(18, 25, 52), bar(18, 34, 56)];
  const who = [<circle key="a" cx={24} cy={48} r={4} className="is-accent" />, bar(32, 46, 24, 3)];
  return [
    { id: "card", label: m.layoutTestCard, attrs: { variant: "card" }, thumb: <Thumb>{box(8, 6, 80, 52)}{quote}{who}</Thumb> },
    { id: "plain", label: m.layoutTestPlain, attrs: { variant: "plain" }, thumb: <Thumb>{quote}{who}</Thumb> },
    { id: "bubble", label: m.layoutTestBubble, attrs: { variant: "bubble" }, thumb: <Thumb>{box(8, 6, 80, 38)}<polygon key="t" points="22,44 30,44 24,52" className="is-box" />{[bar(18, 14, 60), bar(18, 23, 52), bar(18, 32, 56)]}<circle key="a" cx={36} cy={56} r={3} className="is-accent" /></Thumb> },
  ];
}

export function carouselLayouts(m: M): BlockLayout[] {
  const slides = (n: number) => Array.from({ length: n }, (_, i) => { const w = (84 - (n - 1) * 6) / n; const x = 6 + i * (w + 6); return [box(x, 8, w, 38, i === 0), bar(x + 5, 20, Math.max(8, w - 10)), bar(x + 5, 29, Math.max(6, w - 16))]; });
  const dots = [<circle key="d1" cx={42} cy={56} r={2.4} className="is-accent" />, <circle key="d2" cx={48} cy={56} r={2.4} />, <circle key="d3" cx={54} cy={56} r={2.4} />];
  return [1, 2, 3].map((n) => ({ id: `s${n}`, label: m[`layoutSlides${n}`], attrs: { slidesPerView: n }, thumb: <Thumb>{slides(n)}{dots}</Thumb> }));
}

export function iconBoxLayouts(m: M): BlockLayout[] {
  const text = (x: number, y: number, w: number) => [bar(x, y, w, 5), bar(x, y + 9, w - 6), bar(x, y + 17, w - 12)];
  return [
    { id: "top", label: m.layoutBoxTop, attrs: { position: "top", iconStyle: "plain" }, thumb: <Thumb>{dot(44, 8)}{text(22, 26, 52)}</Thumb> },
    { id: "circle", label: m.layoutBoxCircle, attrs: { position: "top", iconStyle: "circle" }, thumb: <Thumb><circle key="c" cx={48} cy={15} r={8} className="is-accent" />{text(22, 28, 52)}</Thumb> },
    { id: "left", label: m.layoutBoxLeft, attrs: { position: "left" }, thumb: <Thumb>{dot(8, 12)}{text(24, 12, 62)}</Thumb> },
    { id: "right", label: m.layoutBoxRight, attrs: { position: "right" }, thumb: <Thumb>{dot(81, 12)}{text(8, 12, 62)}</Thumb> },
  ];
}

export function mediaTextLayouts(m: M): BlockLayout[] {
  const pic = (x: number, w: number) => [box(x, 8, w, 46, true)];
  const txt = (x: number, w: number) => [bar(x, 16, w), bar(x, 25, w - 8), bar(x, 34, w - 4)];
  return [
    { id: "l50", label: m.layoutMedia1, attrs: { position: "left", width: 50 }, thumb: <Thumb>{pic(8, 38)}{txt(54, 34)}</Thumb> },
    { id: "l33", label: m.layoutMedia2, attrs: { position: "left", width: 33 }, thumb: <Thumb>{pic(8, 26)}{txt(42, 46)}</Thumb> },
    { id: "r50", label: m.layoutMedia3, attrs: { position: "right", width: 50 }, thumb: <Thumb>{pic(50, 38)}{txt(8, 34)}</Thumb> },
    { id: "r33", label: m.layoutMedia4, attrs: { position: "right", width: 33 }, thumb: <Thumb>{pic(62, 26)}{txt(8, 46)}</Thumb> },
  ];
}

export function progressLayouts(m: M): BlockLayout[] {
  const track = (y: number, h = 6) => [<rect key={`t${y}`} x={8} y={y} width={80} height={h} rx={h / 2} />, <rect key={`f${y}`} x={8} y={y} width={56} height={h} rx={h / 2} className="is-accent" />];
  return [
    { id: "above", label: m.layoutBarAbove, attrs: { textPosition: "above" }, thumb: <Thumb>{bar(8, 14, 30)}{bar(76, 14, 12)}{track(26)}</Thumb> },
    { id: "inside", label: m.layoutBarInside, attrs: { textPosition: "inside" }, thumb: <Thumb>{track(22, 16)}{bar(14, 28, 20, 3)}</Thumb> },
    { id: "below", label: m.layoutBarBelow, attrs: { textPosition: "below" }, thumb: <Thumb>{track(16)}{bar(8, 30, 30)}{bar(76, 30, 12)}</Thumb> },
  ];
}
