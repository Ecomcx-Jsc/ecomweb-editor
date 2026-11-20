import type { MediaItem } from "../../shared/types";

/**
 * srcset (gốc + các cỡ đã tạo) và bản WebP / AVIF của ảnh thư viện → trình duyệt chọn file vừa khung (điện thoại không tải ảnh gốc). Dưới 2 cỡ thì không cần.
 * AVIF chỉ ghi khi MỌI cỡ đã có (máy chủ tạo nền; chưa xong thì máy chủ tự ghi avifSrcset vào bài khi xong).
 */
export function mediaSrcsets(m: MediaItem): { srcset?: string; webpSrcset?: string; avifSrcset?: string } {
  const cands = Object.values(m.sizes ?? {}).filter((s) => s?.url && s.width > 0).map((s) => ({ w: s.width, url: s.url, webp: s.webpUrl, avif: s.avifUrl }));
  if (m.width && m.width > 0) cands.push({ w: m.width, url: m.url, webp: m.webpUrl, avif: m.avifUrl });
  const uniq = [...new Map(cands.map((c) => [c.w, c])).values()].sort((a, b) => a.w - b.w);
  if (uniq.length < 2) return {};
  const webp = uniq.filter((c) => c.webp);
  return {
    srcset: uniq.map((c) => `${c.url} ${c.w}w`).join(", "),
    webpSrcset: webp.length > 1 ? webp.map((c) => `${c.webp} ${c.w}w`).join(", ") : undefined,
    avifSrcset: uniq.every((c) => c.avif) ? uniq.map((c) => `${c.avif} ${c.w}w`).join(", ") : undefined,
  };
}
