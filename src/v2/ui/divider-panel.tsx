import { DIVIDER_PATHS, DIVIDER_SHAPES, normalizeStyle, type BlockDivider, type BlockStyle } from "@ecomcx/ecomweb-content";
import { useMsgs } from "../i18n";
import { ColorInput } from "./color-field";
import { Row, Section, cx } from "./style-controls";

type Side = "top" | "bottom";

/**
 * Đường chia trên / dưới của Nhóm (tab Cài đặt): hình tự vẽ (sóng, vòm, vát, tam giác, răng cưa) tô màu của khối kế bên.
 * Ghi vào style.divider; chọn hình là bật, "Không" là tắt.
 */
export function DividerSection({ attrs, setAttrs }: { attrs: Record<string, unknown>; setAttrs(a: Record<string, unknown>): void }) {
  const t = useMsgs("layout") as Record<string, string>;
  const style = (normalizeStyle(attrs.style) ?? {}) as BlockStyle;
  const div = style.divider ?? {};
  const commit = (next: BlockStyle["divider"]) => setAttrs({ style: normalizeStyle({ ...style, divider: next }) ?? undefined });
  const patch = (side: Side, p: Partial<BlockDivider> | null) => {
    const cur = div[side];
    const nextSide = p === null ? undefined : ({ color: "white", ...cur, ...p } as BlockDivider);
    const next = { ...div, [side]: nextSide };
    if (!next.top) delete next.top;
    if (!next.bottom) delete next.bottom;
    commit(Object.keys(next).length ? next : undefined);
  };
  const side = (s: Side) => {
    const d = div[s];
    return (
      <div className="ecx-divider-side" data-ecx-divider={s} key={s}>
        <Row label={s === "top" ? t.dividerTop : t.dividerBottom}>
          <div role="radiogroup" aria-label={s === "top" ? t.dividerTop : t.dividerBottom} className="ecx-divider-shapes">
            <button type="button" role="radio" aria-checked={!d} className={cx("ecx-divider-shape", !d && "is-active")} onClick={() => patch(s, null)}>{t.dividerNone}</button>
            {DIVIDER_SHAPES.map((shape) => (
              <button key={shape} type="button" role="radio" aria-checked={d?.shape === shape} aria-label={t[`divider_${shape}`]} title={t[`divider_${shape}`]} className={cx("ecx-divider-shape", d?.shape === shape && "is-active")} onClick={() => patch(s, { shape })}>
                <svg viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true"><path d={DIVIDER_PATHS[shape]} fill="currentColor" transform={s === "top" ? "matrix(1 0 0 -1 0 100)" : undefined} /></svg>
              </button>
            ))}
          </div>
        </Row>
        {d && (
          <>
            <ColorInput label={t.dividerColor} value={d.color} onChange={(c) => patch(s, { color: c ?? "white" })} />
            <Row label={`${t.dividerHeight}: ${d.height ?? 80}px`}>
              <input type="range" className="ecx-range" min={10} max={300} step={5} aria-label={t.dividerHeight} value={d.height ?? 80} onChange={(e) => patch(s, { height: Number(e.target.value) })} />
            </Row>
            <label className="ecx-check"><input type="checkbox" checked={!!d.flip} onChange={(e) => patch(s, { flip: e.target.checked ? true : undefined })} /> {t.dividerFlip}</label>
          </>
        )}
      </div>
    );
  };
  return (
    <Section title={t.dividerTitle} modified={!!(div.top || div.bottom)} onReset={() => commit(undefined)} defaultOpen={div.top || div.bottom ? true : undefined}>
      {side("top")}
      {side("bottom")}
      <p className="ecx-muted">{t.dividerHelp}</p>
    </Section>
  );
}
