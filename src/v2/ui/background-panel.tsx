import { normalizeStyle, type BlockBackground, type BlockStyle, type Device } from "@ecomcx/ecomweb-content";
import { useState } from "react";
import { useEditor } from "../context";
import { useMsgs } from "../i18n";
import { ColorInput } from "./color-field";
import { Row, Section, Seg, cx } from "./style-controls";

/** Điểm lấy nét chọn nhanh: lưới 3×3 (trên-trái … dưới-phải). */
const POSITIONS = ["0% 0%", "50% 0%", "100% 0%", "0% 50%", "50% 50%", "100% 50%", "0% 100%", "50% 100%", "100% 100%"];

/**
 * Mục "Ảnh nền" của tab Kiểu dáng (attrs.style.background, @ecomcx/ecomweb-content 1.22): ảnh từ thư viện media (hoặc dán URL),
 * ảnh / cách phủ / điểm lấy nét riêng theo khổ màn hình đang chọn, lặp, cố định khi cuộn, lớp phủ màu + độ mờ.
 */
export function BackgroundPanel({ style: raw, onChange, device }: { style: unknown; onChange(style: BlockStyle | null): void; device: Device }) {
  const { host } = useEditor();
  const t = useMsgs("background");
  // Ảnh nền chỉ nhận đường dẫn tương đối hoặc https → URL media cùng website (site http) đổi thành "/uploads/…"
  const sameOriginPath = (v: string) => {
    try { const u = new URL(v, location.href); return u.origin === location.origin ? u.pathname + u.search : v; } catch { return v; }
  };
  const style: BlockStyle = normalizeStyle(raw) ?? {};
  const bg: BlockBackground = style.background ?? {};
  const [url, setUrl] = useState("");

  const commit = (next: Record<string, unknown> | undefined) => onChange(normalizeStyle({ ...style, background: next }) ?? null);
  const set = (patch: Record<string, unknown>) => commit({ ...bg, ...patch });
  /** Giá trị theo khổ đang chọn (ảnh, cách phủ, điểm lấy nét). */
  const setAt = (k: "image" | "size" | "position", v: string | undefined) => {
    const r: Record<string, string | undefined> = { ...(bg[k] ?? {}) };
    if (v && k === "image") v = sameOriginPath(v);
    if (v) r[device] = v; else delete r[device];
    set({ [k]: Object.keys(r).length ? r : undefined });
  };
  const image = bg.image?.[device];
  const inherited = device === "mobile" ? bg.image?.tablet ?? bg.image?.base : device === "tablet" ? bg.image?.base : undefined;
  const pick = async () => {
    const [item] = (await host.media?.pick({ kind: "image", multiple: false })) ?? [];
    if (item) setAt("image", item.sizes?.large?.url ?? item.url);
  };

  return (
    <Section title={t.title} modified={!!style.background} onReset={() => commit(undefined)} defaultOpen={!!style.background}>
      <Row label={t.image} device={device}>
        <div className="ecx-bg-image">
          {(image ?? inherited) && <img src={image ?? inherited} alt="" className={cx("ecx-bg-thumb", !image && "is-inherited")} style={{ objectPosition: bg.position?.[device] ?? bg.position?.base ?? "50% 50%" }} />}
          <div className="ecx-bg-actions">
            {host.media && <button type="button" className="ecx-btn" onClick={pick}>{image ? t.replace : t.choose}</button>}
            {image && <button type="button" className="ecx-btn" onClick={() => setAt("image", undefined)}>{t.remove}</button>}
          </div>
          {!host.media && (
            <input className="ecx-input" value={url} placeholder="https://…" aria-label={t.url}
              onChange={(e) => setUrl(e.target.value)} onBlur={() => { setAt("image", url.trim() || undefined); setUrl(""); }} />
          )}
          {inherited && !image && <p className="ecx-muted">{t.inherited}</p>}
        </div>
      </Row>
      {bg.image && (
        <>
          <Row label={t.size} device={device}>
            <Seg label={t.size} value={bg.size?.[device]} onChange={(v) => setAt("size", v)}
              options={[["cover", t.cover, t.cover_help], ["contain", t.contain, t.contain_help], ["auto", t.auto, t.auto_help]]} />
          </Row>
          <Row label={t.focal} device={device}>
            <div role="radiogroup" aria-label={t.focal} className="ecx-bg-focal">
              {POSITIONS.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={(bg.position?.[device] ?? (device === "base" ? "50% 50%" : undefined)) === p} title={p} aria-label={p}
                  className={cx("ecx-bg-focal-dot", (bg.position?.[device] ?? (device === "base" ? "50% 50%" : undefined)) === p && "is-active")}
                  onClick={() => setAt("position", p === "50% 50%" && device === "base" ? undefined : p)} />
              ))}
            </div>
          </Row>
          <label className="ecx-check"><input type="checkbox" checked={!!bg.repeat} onChange={(e) => set({ repeat: e.target.checked || undefined })} /> {t.repeat}</label>
          <label className="ecx-check"><input type="checkbox" checked={!!bg.fixed} onChange={(e) => set({ fixed: e.target.checked || undefined })} /> {t.fixed}</label>
        </>
      )}
      <Row label={t.overlay}>
        <ColorInput label={t.overlay} value={bg.overlay} onChange={(v) => set({ overlay: v, overlayOpacity: v ? bg.overlayOpacity : undefined })} />
      </Row>
      {bg.overlay && (
        <Row label={`${t.opacity}: ${bg.overlayOpacity ?? 50}%`}>
          <input type="range" min={0} max={100} step={5} value={bg.overlayOpacity ?? 50} aria-label={t.opacity}
            onChange={(e) => set({ overlayOpacity: Number(e.target.value) === 50 ? undefined : Number(e.target.value) })} />
        </Row>
      )}
    </Section>
  );
}
