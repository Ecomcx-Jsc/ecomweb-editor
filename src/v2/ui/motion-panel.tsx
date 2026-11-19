import { MOTION_EASE, MOTION_HOVER, MOTION_IN, MOTION_LOOP, MOTION_PARALLAX, normalizeStyle, type BlockStyle } from "@ecomcx/ecomweb-content";
import { PickTiles, motionHoverThumb, motionInThumb } from "./option-thumbs";
import { Play } from "lucide-react";
import { useSyncExternalStore } from "react";
import { onAnimationsChange, pluginAnimations } from "../../shared/animation-store";
import { useEditor, useEditorState } from "../context";
import { useMsgs } from "../i18n";
import { Row, Section, Seg, cx } from "./style-controls";

/**
 * Mục "Chuyển động" của tab Kiểu dáng (attrs.style.motion, @ecomcx/ecomweb-content 1.16): hiệu ứng khi cuộn tới và khi rê chuột,
 * chọn bằng một cú bấm. Hiệu ứng lõi hiện thành chip; hiệu ứng của plugin (registerAnimation) nằm trong danh sách "Hiệu ứng khác".
 * Chọn xong tự chạy thử ngay trong khung soạn; nút "Xem thử" chạy lại. Khung soạn không bao giờ ẩn khối (chỉ website mới ẩn trước khi cuộn tới).
 */
type Motion = NonNullable<BlockStyle["motion"]>;


const DELAYS = [0, 100, 200, 300, 500, 800, 1200];
const DURATION_MS = { fast: 300, normal: 600, slow: 1000 } as const;

/** Chạy lại hiệu ứng cuộn của một khối trong khung soạn: gỡ rồi đặt lại `is-in` (CSS của khối gắn animation vào `.is-in`). */
export function previewMotion(el: HTMLElement | null, m: Motion | undefined) {
  if (!el || !m?.in) return;
  el.classList.remove("is-in");
  void el.offsetWidth; // đo lại để trình duyệt khởi động lại animation
  el.classList.add("is-in");
  const total = DURATION_MS[m.duration ?? "normal"] + (m.delay ?? 0) + (m.stagger ? 12 * 80 : 0) + 100;
  window.setTimeout(() => el.classList.remove("is-in"), total);
}

export function MotionPanel({ type, style: raw, onChange }: { type: string; style: unknown; onChange(style: BlockStyle | null): void }) {
  const { labels, registry, ui } = useEditor();
  const t = useMsgs("motion");
  const plugin = useSyncExternalStore(onAnimationsChange, pluginAnimations, pluginAnimations);
  const sel = useEditorState((s) => s.selection);
  const blockId = sel.ids[0] ?? sel.editing;
  const style: BlockStyle = normalizeStyle(raw) ?? {};
  const m: Motion = style.motion ?? {};
  const container = registry.get(type)?.kind === "container";

  const set = (patch: Partial<Motion>, preview = false) => {
    const next: Record<string, unknown> = { ...m, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === false) delete next[k];
    const merged = normalizeStyle({ ...style, motion: Object.keys(next).length ? next : undefined }) ?? null;
    onChange(merged);
    // Chờ khung soạn nhận CSS mới của khối rồi mới chạy thử
    if (preview) window.setTimeout(() => previewMotion(blockId ? ui.blockEl(blockId) : null, merged?.motion), 120);
  };

  const ct = useMsgs("controls");
  const coreIn = MOTION_IN as readonly string[];
  const isPlugin = !!m.in && !coreIn.includes(m.in);
  const groups = new Map<string, typeof plugin>();
  for (const e of plugin) groups.set(e.group ?? t.plugin, [...(groups.get(e.group ?? t.plugin) ?? []), e]);

  return (
    <Section title={t.title} defaultOpen={false} modified={!!style.motion} summary={m.in ? (t.in as Record<string, string>)[m.in] ?? m.in : ct.noMotion} onReset={() => onChange(normalizeStyle({ ...style, motion: undefined }) ?? null)}>
      <Row label={t.scroll}>
        <PickTiles label={t.scroll} value={m.in && (MOTION_IN as readonly string[]).includes(m.in) ? m.in : undefined} none={{ label: t.none }}
          options={MOTION_IN.map((id) => ({ id, label: t.in[id], thumb: motionInThumb(id) }))}
          onChange={(v) => (v === undefined ? set({ in: undefined, duration: undefined, delay: undefined, repeat: undefined, stagger: undefined }) : set({ in: v }, true))} />
        {plugin.length > 0 && (
          <select className="ecx-input" aria-label={t.more} value={isPlugin ? m.in : ""} onChange={(e) => e.target.value && set({ in: e.target.value }, true)}>
            <option value="">{t.more}…</option>
            {[...groups].map(([g, list]) => <optgroup key={g} label={g}>{list.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</optgroup>)}
          </select>
        )}
        {isPlugin && !plugin.some((e) => e.id === m.in) && <p className="ecx-muted">{m.in}</p>}
      </Row>

      {m.in && (
        <>
          <Row label={t.speed}>
            <Seg label={t.speed} value={m.duration ?? "normal"} onChange={(v) => set({ duration: !v || v === "normal" ? undefined : v }, true)}
              options={[["fast", t.fast, t.fast], ["normal", t.normal, t.normal], ["slow", t.slow, t.slow]]} />
          </Row>
          <Row label={t.ease}>
            <select className="ecx-input" aria-label={t.ease} value={m.ease ?? "smooth"} onChange={(e) => set({ ease: e.target.value === "smooth" ? undefined : (e.target.value as Motion["ease"]) }, true)}>
              {MOTION_EASE.map((id) => <option key={id} value={id}>{t.eases[id]}</option>)}
            </select>
          </Row>
          <Row label={t.delay}>
            <select className="ecx-input" aria-label={t.delay} value={m.delay ?? 0} onChange={(e) => set({ delay: Number(e.target.value) || undefined }, true)}>
              {[...new Set([...DELAYS, m.delay ?? 0])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{d} ms</option>)}
            </select>
          </Row>
          {container && <label className="ecx-check"><input type="checkbox" checked={!!m.stagger} onChange={(e) => set({ stagger: e.target.checked || undefined }, true)} /> {t.stagger}</label>}
          <label className="ecx-check"><input type="checkbox" checked={!!m.repeat} onChange={(e) => set({ repeat: e.target.checked || undefined })} /> {t.repeat}</label>
          <button type="button" className="ecx-link-btn" onClick={() => previewMotion(blockId ? ui.blockEl(blockId) : null, m)}><Play className="ecx-icon ecx-icon-sm" aria-hidden /> {t.preview}</button>
        </>
      )}

      <Row label={t.loop}>
        <PickTiles label={t.loop} value={m.loop} none={{ label: t.none }} options={MOTION_LOOP.map((id) => ({ id, label: t.loops[id], thumb: motionHoverThumb("grow") }))} onChange={(v) => set({ loop: v as Motion["loop"], parallax: v ? undefined : m.parallax })} />
      </Row>
      {!m.in && !m.loop && (
        <Row label={t.parallax}>
          <select className="ecx-input" aria-label={t.parallax} value={m.parallax ?? ""} onChange={(e) => set({ parallax: (e.target.value || undefined) as Motion["parallax"] })}>
            <option value="">{t.none}</option>
            {MOTION_PARALLAX.map((id) => <option key={id} value={id}>{t.parallaxes[id]}</option>)}
          </select>
        </Row>
      )}
      <Row label={t.hover}>
        <PickTiles label={t.hover} value={m.hover} none={{ label: t.none }} options={MOTION_HOVER.map((id) => ({ id, label: t.hv[id], thumb: motionHoverThumb(id) }))} onChange={(v) => set({ hover: v as (typeof MOTION_HOVER)[number] | undefined })} />
      </Row>
    </Section>
  );
}
