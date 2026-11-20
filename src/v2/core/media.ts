import type { MediaItem } from "../../shared/types";

/** srcset (gốc + các cỡ đã tạo) và bản WebP của ảnh thư viện → trình duyệt chọn file vừa khung (điện thoại không tải ảnh gốc). Dưới 2 cỡ thì không cần. */
export function mediaSrcsets(m: MediaItem): { srcset?: string; webpSrcset?: string } {
  const cands = Object.values(m.sizes ?? {}).filter((s) => s?.url && s.width > 0).map((s) => ({ w: s.width, url: s.url, webp: s.webpUrl }));
  if (m.width && m.width > 0) cands.push({ w: m.width, url: m.url, webp: m.webpUrl });
  const uniq = [...new Map(cands.map((c) => [c.w, c])).values()].sort((a, b) => a.w - b.w);
  if (uniq.length < 2) return {};
  const webp = uniq.filter((c) => c.webp);
  return { srcset: uniq.map((c) => `${c.url} ${c.w}w`).join(", "), webpSrcset: webp.length > 1 ? webp.map((c) => `${c.webp} ${c.w}w`).join(", ") : undefined };
}
