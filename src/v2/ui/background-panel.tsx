import { normalizeStyle, type BlockBackground, type BlockStyle, type Device } from "@ecomcx/ecomweb-content";
import { useState } from "react";
import { useEditor } from "../context";
import { useMsgs } from "../i18n";
import { ColorInput } from "./color-field";
import { GradientField } from "./layout-panel";
import { Row, Section, Seg, cx } from "./style-controls";

/** Điểm lấy nét chọn nhanh: lưới 3×3 (trên-trái … dưới-phải). */
const POSITIONS = ["0% 0%", "50% 0%", "100% 0%", "0% 50%", "50% 50%", "100% 50%", "0% 100%", "50% 100%", "100% 100%"];
type Kind = "color" | "gradient" | "image";

/**
 * Ô Nền thống nhất (như nhóm Background của Elementor): thẻ Thường / Rê chuột, loại Màu | Chuyển màu | Ảnh.
 * Không có kho riêng — ghi vào trường sẵn có: style.color.background, style.gradient, style.background (ảnh theo khổ, cách phủ,
 * điểm lấy nét, lặp, cố định, lớp phủ), style.hover.color.background. Khối bìa: ảnh / lớp phủ / cố định là attrs của khối
 * (src, overlay, opacity, fixed, focal) — ảnh bìa là <img> phủ kín, chữ nằm trên. Nhóm có màu nền cũ (attrs.background) được
 * hiện và chuyển sang style khi sửa.
 */
export function BackgroundControl({ type, attrs, setAttrs, device }: { type: string; attrs: Record<string, any>; setAttrs(a: Record<string, unknown>): void; device: Device }) {
  const { host } = useEditor();
  const t = useMsgs("background");
  const b = useMsgs("blockStyle");
  const cover = type === "cover";
  const style: BlockStyle = normalizeStyle(attrs.style) ?? {};
  const bg: BlockBackground = style.background ?? {};
  const legacy = type === "group" && typeof attrs.background === "string" ? attrs.background : undefined;
  const hasImage = cover ? !!attrs.src : !!bg.image;
  const [kind, setKind] = useState<Kind>(hasImage ? "image" : style.gradient ? "gradient" : "color");
  const [state, setState] = useState<"normal" | "hover">("normal");
  const [url, setUrl] = useState("");

  const commitStyle = (next: BlockStyle, extra: Record<string, unknown> = {}) => setAttrs({ ...extra, style: normalizeStyle(next) ?? undefined });
  const setBg = (patch: Record<string, unknown>) => commitStyle({ ...style, background: { ...bg, ...patch } as BlockBackground });
  // Ảnh nền chỉ nhận đường dẫn tương đối hoặc https → URL media cùng website (site http) đổi thành "/uploads/…"
  const sameOriginPath = (v: string) => { try { const u = new URL(v, location.href); return u.origin === location.origin ? u.pathname + u.search : v; } catch { return v; } };
  /** Giá trị theo khổ đang chọn (ảnh, cách phủ, điểm lấy nét). */
  const setAt = (k: "image" | "size" | "position", v: string | undefined) => {
    const r: Record<string, string | undefined> = { ...(bg[k] ?? {}) };
    if (v && k === "image") v = sameOriginPath(v);
    if (v) r[device] = v; else delete r[device];
    setBg({ [k]: Object.keys(r).length ? r : undefined });
  };
  const setColor = (v: string | undefined) => {
    const next: BlockStyle = { ...style, color: { ...style.color, background: v } };
    if (legacy === undefined) return commitStyle(next);
    // Màu cũ của nhóm kéo theo khoảng đệm + bo góc trong vỏ → giữ nguyên dáng khi chuyển sang style
    if (!next.radius && attrs.align !== "full") next.radius = "12px";
    commitStyle(next, { background: undefined, ...(attrs.padding ? {} : { padding: "medium" }) });
  };

  const image = cover ? (attrs.src as string | undefined) : bg.image?.[device];
  const inherited = cover ? undefined : device === "mobile" ? bg.image?.tablet ?? bg.image?.base : device === "tablet" ? bg.image?.base : undefined;
  const focal = cover ? (typeof attrs.focal === "string" ? attrs.focal : undefined) : bg.position?.[device];
  const setImage = (src: string | undefined, item?: { alt?: string; id?: unknown }) => cover
    ? setAttrs({ src: src ? sameOriginPath(src) : undefined, ...(item ? { alt: item.alt || undefined, mediaId: item.id } : src ? {} : { mediaId: undefined }) })
    : setAt("image", src);
  const pick = async () => {
    const [item] = (await host.media?.pick({ kind: "image", multiple: false })) ?? [];
    if (item) setImage(item.sizes?.large?.url ?? item.url, item);
  };
  const overlay = cover ? attrs.overlay : bg.overlay;
  const opacity = cover ? Number(attrs.opacity ?? 50) : bg.overlayOpacity ?? 50;
  const setOverlay = (v: string | undefined) => cover ? setAttrs({ overlay: v }) : setBg({ overlay: v, overlayOpacity: v ? bg.overlayOpacity : undefined });
  const setOpacity = (n: number) => cover ? setAttrs({ opacity: n === 50 ? undefined : n }) : setBg({ overlayOpacity: n === 50 ? undefined : n });
  const modified = !!(style.color?.background || style.gradient || style.background || style.hover?.color?.background || legacy || (cover && (attrs.src || attrs.overlay)));
  const reset = () => {
    const next: BlockStyle = { ...style, gradient: undefined, background: undefined, color: { ...style.color, background: undefined }, hover: style.hover && { ...style.hover, color: { ...style.hover.color, background: undefined } } };
    commitStyle(next, { ...(legacy ? { background: undefined } : {}), ...(cover ? { src: undefined, mediaId: undefined, overlay: undefined, opacity: undefined, fixed: undefined, focal: undefined } : {}) });
  };

  return (
    <Section title={b.bg.title} modified={modified} onReset={reset}>
      <div role="tablist" className="ecx-seg is-text ecx-state-tabs">
        {(["normal", "hover"] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={state === s} className={cx("ecx-seg-btn", state === s && "is-active")} onClick={() => setState(s)}>{b[s]}</button>
        ))}
      </div>
      {state === "hover" ? (
        <>
          <Row label={b.bg.hoverColor}>
            <ColorInput label={b.bg.hoverColor} value={style.hover?.color?.background} onChange={(v) => commitStyle({ ...style, hover: { ...style.hover, color: { ...style.hover?.color, background: v } } })} />
          </Row>
          <p className="ecx-muted">{b.bg.hoverNote}</p>
        </>
      ) : (
        <>
          <Row label={b.bg.type}>
            <div role="radiogroup" aria-label={b.bg.type} className="ecx-seg is-text">
              {(["color", "gradient", "image"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} className={cx("ecx-seg-btn", kind === k && "is-active")} onClick={() => setKind(k)}>{b.bg[k]}</button>
              ))}
            </div>
          </Row>
          {kind === "color" && (
            <Row label={b.bg.color}>
              <ColorInput label={b.bg.color} value={style.color?.background ?? legacy} onChange={setColor} />
              {legacy && !style.color?.background && <p className="ecx-muted">{b.bg.legacy}</p>}
            </Row>
          )}
          {kind === "gradient" && <Row label={b.bg.gradient}><GradientField value={style.gradient} onChange={(g) => commitStyle({ ...style, gradient: g })} /></Row>}
          {kind === "image" && (
            <>
              <Row label={t.image} device={cover ? undefined : device}>
                <div className="ecx-bg-image">
                  {(image ?? inherited) && <img src={image ?? inherited} alt="" className={cx("ecx-bg-thumb", !image && "is-inherited")} style={{ objectPosition: focal ?? bg.position?.base ?? "50% 50%" }} />}
                  <div className="ecx-bg-actions">
                    {host.media && <button type="button" className="ecx-btn" onClick={pick}>{image ? t.replace : t.choose}</button>}
                    {image && <button type="button" className="ecx-btn" onClick={() => setImage(undefined)}>{t.remove}</button>}
                  </div>
                  {!host.media && (
                    <input className="ecx-input" value={url} placeholder="https://…" aria-label={t.url}
                      onChange={(e) => setUrl(e.target.value)} onBlur={() => { setImage(url.trim() || undefined); setUrl(""); }} />
                  )}
                  {inherited && !image && <p className="ecx-muted">{t.inherited}</p>}
                </div>
              </Row>
              {hasImage && (
                <>
                  {!cover && (
                    <Row label={t.size} device={device}>
                      <Seg label={t.size} value={bg.size?.[device]} onChange={(v) => setAt("size", v)}
                        options={[["cover", t.cover, t.cover_help], ["contain", t.contain, t.contain_help], ["auto", t.auto, t.auto_help]]} />
                    </Row>
                  )}
                  <Row label={t.focal} device={cover ? undefined : device}>
                    <div role="radiogroup" aria-label={t.focal} className="ecx-bg-focal">
                      {POSITIONS.map((p) => {
                        const on = (focal ?? (cover || device === "base" ? "50% 50%" : undefined)) === p;
                        const v = p === "50% 50%" && (cover || device === "base") ? undefined : p;
                        return <button key={p} type="button" role="radio" aria-checked={on} title={p} aria-label={p} className={cx("ecx-bg-focal-dot", on && "is-active")}
                          onClick={() => (cover ? setAttrs({ focal: v }) : setAt("position", v))} />;
                      })}
                    </div>
                  </Row>
                  {!cover && <label className="ecx-check"><input type="checkbox" checked={!!bg.repeat} onChange={(e) => setBg({ repeat: e.target.checked || undefined })} /> {t.repeat}</label>}
                  <label className="ecx-check"><input type="checkbox" checked={cover ? !!attrs.fixed : !!bg.fixed} onChange={(e) => (cover ? setAttrs({ fixed: e.target.checked || undefined }) : setBg({ fixed: e.target.checked || undefined }))} /> {t.fixed}</label>
                </>
              )}
              <Row label={t.overlay}>
                <ColorInput label={t.overlay} value={overlay} onChange={setOverlay} />
              </Row>
              {(overlay || (cover && attrs.src)) && (
                <Row label={`${t.opacity}: ${opacity}%`}>
                  <input type="range" min={0} max={100} step={5} value={opacity} aria-label={t.opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
                </Row>
              )}
            </>
          )}
        </>
      )}
    </Section>
  );
}
