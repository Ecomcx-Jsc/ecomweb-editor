import { normalizeStyle, type BlockStyle, type Device } from "@ecomcx/ecomweb-content";
import { AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalSpaceBetween, AlignStartHorizontal, ArrowDown, ArrowRight, StretchHorizontal } from "lucide-react";
import type { CSSProperties } from "react";
import { useEditor } from "../context";
import type { BNode } from "../core/model";
import type { BlockEditProps } from "../core/registry";
import { useMsgs } from "../i18n";
import { Row, Seg, cx } from "../ui/style-controls";
import { byStep } from "../ui/style-tab";
import { UnitInput } from "../ui/unit-controls";
import { makeBlock } from "../core/model";

type Responsive<T> = T | Partial<Record<Device, T>>;
/** Đọc / ghi giá trị theo khổ (một giá trị trần = base). */
const atDevice = <T,>(v: Responsive<T> | undefined, d: Device): T | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<Record<Device, T>>)[d] : d === "base" ? (v as T | undefined) : undefined);
function withDevice<T>(v: Responsive<T> | undefined, d: Device, x: T | undefined): Responsive<T> | undefined {
  const map: Partial<Record<Device, T>> = v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Partial<Record<Device, T>>) } : v !== undefined ? { base: v as T } : {};
  if (x === undefined) delete map[d]; else map[d] = x;
  const keys = Object.keys(map);
  return !keys.length ? undefined : keys.length === 1 && keys[0] === "base" ? map.base : map;
}
/** Như withDevice nhưng luôn trả dạng { base, tablet, mobile } (kiểu Responsive của style). */
function mapDevice<T>(v: Responsive<T> | undefined, d: Device, x: T | undefined): Partial<Record<Device, T>> | undefined {
  const r = withDevice(v, d, x);
  return r === undefined ? undefined : r && typeof r === "object" && !Array.isArray(r) ? (r as Partial<Record<Device, T>>) : { base: r as T };
}

/** Bố cục có sẵn theo số cột (tỉ lệ %, tổng 100); "equal" = chia đều (không lưu độ rộng). */
export const LAYOUTS: Record<number, number[][]> = {
  1: [[100]],
  2: [[50, 50], [67, 33], [33, 67], [75, 25], [25, 75]],
  3: [[33, 33, 34], [50, 25, 25], [25, 25, 50], [25, 50, 25], [20, 60, 20], [15, 70, 15]],
  4: [[25, 25, 25, 25], [40, 20, 20, 20], [20, 20, 20, 40]],
  5: [[20, 20, 20, 20, 20]],
  6: [[17, 17, 17, 17, 16, 16]],
};
const equalOf = (w: number[]) => w.every((x) => Math.abs(x - w[0]) <= 1);
/** Độ rộng hiện tại của các cột (cột không đặt = chia đều phần còn lại). */
export function widthsOf(cols: BNode[]): number[] {
  const set = cols.map((c) => Number(c.attrs.width) || 0);
  const free = cols.filter((_, i) => !set[i]).length;
  const rest = Math.max(0, 100 - set.reduce((a, b) => a + b, 0));
  return set.map((w) => w || (free ? rest / free : 0));
}
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= 1.5);

function Thumb({ widths, stack, active, onClick, title }: { widths: number[]; stack?: "column" | "column-reverse"; active: boolean; onClick(): void; title: string }) {
  return (
    <button type="button" className={cx("ecx-layout-thumb", stack && "is-stack", active && "is-active")} title={title} aria-label={title} aria-pressed={active} onClick={onClick}>
      {(stack === "column-reverse" ? [...widths].reverse() : widths).map((w, i) => <i key={i} style={{ flex: stack ? undefined : w } as CSSProperties} data-n={stack === "column-reverse" ? widths.length - i : i + 1} />)}
    </button>
  );
}

/**
 * Tab Cài đặt của Bộ cột (như khối Hàng của bộ khối lớn): số cột, bố cục theo khổ màn hình (máy tính: tỉ lệ cột; máy tính bảng / điện thoại:
 * như khổ lớn hơn, hàng ngang, xếp dọc, xếp dọc đảo), khe cột / khe hàng theo bậc, căn dọc các cột.
 */
export function ColumnsInspector({ block, attrs, setAttrs }: BlockEditProps) {
  const { store, ui, host } = useEditor();
  const t = useMsgs("columns");
  const device: Device = ui.device === "desktop" ? "base" : ui.device;
  const cols = block.content ?? [];
  const n = cols.length;
  const widths = widthsOf(cols);
  const spaces = host.presets?.spacing ? ["0", ...byStep(Object.keys(host.presets.spacing))] : ["0", "xs", "sm", "md", "lg", "xl"];

  const setCount = (k: number) => {
    if (k > n) {
      // Thêm cột từ bảng: chia đều lại, giữ Bộ cột đang chọn (không nhảy con trỏ vào cột mới như nút + trên khối)
      const added = Array.from({ length: k - n }, () => makeBlock("column", {}, [makeBlock("paragraph")]));
      store.replace(block.id, [{ ...block, content: [...cols.map((c) => ({ ...c, attrs: { ...c.attrs, width: undefined } })), ...added] }], { select: { ids: [block.id], editing: null } });
      return;
    }
    if (k < 1 || k === n) return;
    // Bớt cột: nội dung của các cột bị bỏ dồn vào cột cuối còn lại (không mất chữ)
    const keep = cols.slice(0, k).map((c) => ({ ...c, attrs: { ...c.attrs, width: undefined } }));
    const moved = cols.slice(k).flatMap((c) => c.content ?? []);
    keep[k - 1] = { ...keep[k - 1], content: [...(keep[k - 1].content ?? []), ...moved] };
    store.replace(block.id, [{ ...block, content: keep }], { select: { ids: [block.id], editing: null } });
  };
  const setWidths = (w: number[]) => {
    const eq = equalOf(w);
    store.batch(() => cols.forEach((c, i) => store.setAttrs([c.id], { width: eq ? undefined : w[i] })));
  };
  const dir = atDevice<string>(attrs.columnsDirection as Responsive<string>, device);
  const setDir = (v: string | undefined) => setAttrs({ columnsDirection: withDevice(attrs.columnsDirection as Responsive<string>, device, v) });
  const gap = (k: "columnsGap" | "columnsRowGap") => atDevice<string>(attrs[k] as Responsive<string>, device);
  const setGap = (k: "columnsGap" | "columnsRowGap", v: string | undefined) => setAttrs({ [k]: withDevice(attrs[k] as Responsive<string>, device, v) });
  const valign = (attrs.verticalAlign as string | undefined) ?? "top";

  return (
    <div className="ecx-form">
      <Row label={t.count}>
        <div className="ecx-stepper">
          <button type="button" aria-label={t.fewer} disabled={n <= 1} onClick={() => setCount(n - 1)}>−</button>
          <output aria-live="polite">{n}</output>
          <button type="button" aria-label={t.more} disabled={n >= 6} onClick={() => setCount(n + 1)}>+</button>
        </div>
      </Row>
      <Row label={<>{t.layout}<em className="ecx-device-tag">{device === "base" ? t.desktop : device === "tablet" ? t.tablet : t.mobile}</em></>} device={device}
        onReset={device !== "base" && dir ? () => setDir(undefined) : device === "base" && !equalOf(widths) ? () => setWidths(widths.map(() => 100 / n)) : undefined}>
        <div className="ecx-layout-thumbs">
          {device === "base"
            ? (LAYOUTS[n] ?? [Array(n).fill(100 / n)]).map((w) => <Thumb key={w.join("-")} widths={w} active={same(widths, w) || (equalOf(w) && equalOf(widths))} title={w.map((x) => `${x}%`).join(" / ")} onClick={() => setWidths(w)} />)
            : <>
                <Thumb widths={widths} active={!dir} title={t.inherit} onClick={() => setDir(undefined)} />
                <Thumb widths={widths} stack="column" active={dir === "column"} title={t.stack} onClick={() => setDir("column")} />
                <Thumb widths={widths} stack="column-reverse" active={dir === "column-reverse"} title={t.stackReverse} onClick={() => setDir("column-reverse")} />
              </>}
        </div>
        {device === "base" && !LAYOUTS[n]?.some((w) => same(widths, w)) && <p className="ecx-field-help">{t.custom}: {widths.map((x) => `${Math.round(x)}%`).join(" / ")}</p>}
      </Row>
      {(["columnsGap", "columnsRowGap"] as const).map((k) => (
        <Row key={k} label={k === "columnsGap" ? t.gap : t.rowGap} device={device} onReset={gap(k) !== undefined ? () => setGap(k, undefined) : undefined}>
          <Seg label={k === "columnsGap" ? t.gap : t.rowGap} value={spaces.includes(gap(k) ?? "") ? gap(k) : undefined} onChange={(v) => setGap(k, v)}
            options={spaces.map((s) => [s, s === "0" ? "0" : s.toUpperCase(), s] as [string, string, string])} />
          <UnitInput label={`${k === "columnsGap" ? t.gap : t.rowGap}: px`} value={gap(k) && !spaces.includes(gap(k)!) ? gap(k) : undefined} units={["px", "rem", "%"]} max={160} onChange={(v) => setGap(k, v)} />
        </Row>
      ))}
      <Row label={t.valign}>
        <Seg label={t.valign} value={valign} onChange={(v) => setAttrs({ verticalAlign: v === "top" ? undefined : v })}
          options={[["top", AlignStartHorizontal, t.top], ["center", AlignCenterHorizontal, t.middle], ["bottom", AlignEndHorizontal, t.bottom], ["stretch", StretchHorizontal, t.stretch]]} />
      </Row>
    </div>
  );
}

/** Tab Cài đặt của một Cột: cách xếp các khối bên trong (hướng, căn ngang, căn dọc, khe) — style.layout flex, theo khổ. */
export function ColumnInspector({ attrs, setAttrs }: BlockEditProps) {
  const { ui, host } = useEditor();
  const t = useMsgs("columns");
  const device: Device = ui.device === "desktop" ? "base" : ui.device;
  const style = (normalizeStyle(attrs.style) ?? {}) as BlockStyle;
  const layout: NonNullable<BlockStyle["layout"]> = style.layout ?? { type: "flex", direction: { base: "column" } };
  const spaces = host.presets?.spacing ? ["0", ...byStep(Object.keys(host.presets.spacing))] : ["0", "xs", "sm", "md", "lg", "xl"];
  const put = (patch: Partial<NonNullable<BlockStyle["layout"]>>) => setAttrs({ style: normalizeStyle({ ...style, layout: { ...layout, ...patch, type: "flex" } }) });
  const field = <K extends "direction" | "justify" | "align">(k: K) => atDevice<string>(layout[k] as Responsive<string>, device);
  const setField = (k: "direction" | "justify" | "align", v: string | undefined) => put({ [k]: mapDevice(layout[k] as Responsive<string>, device, v) } as never);
  const vertical = (field("direction") ?? atDevice<string>(layout.direction as Responsive<string>, "base") ?? "column") === "column";
  const gap = atDevice<string>(style.gap as Responsive<string>, device);
  return (
    <div className="ecx-form">
      <Row label={t.direction} device={device} onReset={field("direction") && device !== "base" ? () => setField("direction", undefined) : undefined}>
        <Seg label={t.direction} value={field("direction") ?? (device === "base" ? "column" : undefined)} onChange={(v) => setField("direction", v ?? "column")}
          options={[["column", ArrowDown, t.vertical], ["row", ArrowRight, t.horizontal]]} />
      </Row>
      {/* Căn theo trục: dọc → căn ngang là align, căn dọc là justify; ngang thì ngược lại */}
      <Row label={t.halign} device={device} onReset={field(vertical ? "align" : "justify") ? () => setField(vertical ? "align" : "justify", undefined) : undefined}>
        <Seg label={t.halign} value={field(vertical ? "align" : "justify")} onChange={(v) => setField(vertical ? "align" : "justify", v)}
          options={vertical
            ? [["start", AlignStartHorizontal, t.left], ["center", AlignCenterHorizontal, t.center], ["end", AlignEndHorizontal, t.right], ["stretch", StretchHorizontal, t.fill]]
            : [["start", AlignStartHorizontal, t.left], ["center", AlignCenterHorizontal, t.center], ["end", AlignEndHorizontal, t.right], ["between", AlignHorizontalSpaceBetween, t.between]]} />
      </Row>
      <Row label={t.valign} device={device} onReset={field(vertical ? "justify" : "align") ? () => setField(vertical ? "justify" : "align", undefined) : undefined}>
        <Seg label={t.valign} value={field(vertical ? "justify" : "align")} onChange={(v) => setField(vertical ? "justify" : "align", v)}
          options={vertical
            ? [["start", AlignStartHorizontal, t.top], ["center", AlignCenterHorizontal, t.middle], ["end", AlignEndHorizontal, t.bottom], ["between", AlignHorizontalSpaceBetween, t.between]]
            : [["start", AlignStartHorizontal, t.top], ["center", AlignCenterHorizontal, t.middle], ["end", AlignEndHorizontal, t.bottom], ["stretch", StretchHorizontal, t.fill]]} />
      </Row>
      <Row label={t.innerGap} device={device} onReset={gap !== undefined ? () => setAttrs({ style: normalizeStyle({ ...style, gap: mapDevice(style.gap as Responsive<string>, device, undefined) }) }) : undefined}>
        <Seg label={t.innerGap} value={gap} onChange={(v) => setAttrs({ style: normalizeStyle({ ...style, gap: mapDevice(style.gap as Responsive<string>, device, v), layout }) })}
          options={spaces.map((s) => [s, s === "0" ? "0" : s.toUpperCase(), s] as [string, string, string])} />
      </Row>
    </div>
  );
}
