import { isSafeUrl } from "@ecomcx/ecomweb-content";
import { Link2, Upload } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import type { MediaItem, MediaKind } from "../../shared/types";
import { useEditor } from "../context";
import { mediaSrcsets } from "../core/media";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
const ACCEPT: Record<MediaKind, string> = { image: "image/*", gallery: "image/*", video: "video/*", audio: "audio/*", file: "" };

/** Thuộc tính ghi vào khối từ tệp media đã chọn / tải lên. */
export function mediaAttrs(kind: MediaKind, items: MediaItem[]): Record<string, unknown> {
  if (kind === "gallery") return { images: items.map((m) => ({ src: m.url, alt: m.alt, width: m.width ?? undefined, height: m.height ?? undefined, id: m.id })) };
  const m = items[0];
  return { src: m.url, alt: kind === "image" ? m.alt || undefined : undefined, name: kind !== "image" ? m.fileName : undefined, mime: m.mimeType, mediaId: m.id, ...(kind === "image" ? mediaSrcsets(m) : {}), width: kind === "image" ? m.width ?? undefined : undefined, height: kind === "image" ? m.height ?? undefined : undefined };
}

/**
 * Chọn media ngay trên khối: Tải lên (có thể kéo thả tệp vào cả vùng), Thư viện, Chèn từ URL. Dùng cho ảnh, gallery,
 * video, âm thanh, tệp, ảnh bìa, ảnh + chữ.
 */
export function MediaActions({ kind, onSelect, onUrl, compact, extra, accept }: { kind: MediaKind; onSelect(items: MediaItem[]): void; onUrl?(url: string): void; compact?: boolean; extra?: ReactNode; accept?: string }) {
  const { host, labels } = useEditor();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [showUrl, setShowUrl] = useState(!host.media);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const upload = async (files: File[]) => {
    if (!files.length || !host.media?.upload) return;
    setBusy(true); setError(null);
    try { const items = await host.media.upload(kind === "gallery" ? files : files.slice(0, 1)); if (items.length) onSelect(items); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const pick = async () => { const items = await host.media!.pick({ kind, multiple: kind === "gallery" }); if (items.length) onSelect(items); };
  return (
    <div className={cx("ecx-media-actions", compact && "is-compact")} contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
      <div className="ecx-media-buttons">
        {host.media?.upload && <button type="button" className="ecx-btn ecx-btn-primary" disabled={busy} onClick={() => file.current?.click()}><Upload className="ecx-icon ecx-icon-sm" />{busy ? labels.uploading : labels.upload}</button>}
        {host.media && <button type="button" className="ecx-btn" onClick={pick}>{labels.mediaLibrary}</button>}
        {onUrl && host.media && <button type="button" className="ecx-btn ecx-btn-ghost" aria-expanded={showUrl} onClick={() => setShowUrl(!showUrl)}><Link2 className="ecx-icon ecx-icon-sm" />{labels.insertFromUrl}</button>}
        {extra}
      </div>
      {onUrl && showUrl && (
        <form onSubmit={(e) => { e.preventDefault(); if (isSafeUrl(url.trim())) onUrl(url.trim()); }}>
          <input className="ecx-input" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label={labels.imageUrl} />
          <button type="submit" className="ecx-btn">{labels.apply}</button>
        </form>
      )}
      {error && <p className="ecx-media-error" role="alert">{error}</p>}
      <input ref={file} type="file" hidden accept={accept ?? (ACCEPT[kind] || undefined)} multiple={kind === "gallery"} onChange={(e) => { void upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
    </div>
  );
}

/** Kéo thả tệp từ máy vào vùng của khối → tải lên. */
export function useFileDrop(kind: MediaKind, onSelect: (items: MediaItem[]) => void) {
  const { host } = useEditor();
  const [over, setOver] = useState(false);
  if (!host.media?.upload) return { over: false, props: {} };
  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes("Files");
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); setOver(true); },
      // Rời sang phần tử con vẫn ở trong vùng: giữ trạng thái (không nhấp nháy)
      onDragLeave: (e: DragEvent) => { if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null)) setOver(false); },
      onDrop: async (e: DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault(); setOver(false);
        const files = [...e.dataTransfer.files];
        const items = await host.media!.upload!(kind === "gallery" ? files : files.slice(0, 1));
        if (items.length) onSelect(items);
      },
    },
  };
}
