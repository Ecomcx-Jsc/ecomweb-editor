import assert from "node:assert/strict";
import { test } from "node:test";
import { mediaSrcsets } from "../src/v2/core/media";
import { mediaAttrs } from "../src/v2/ui/media-actions";

const img = { id: 1, url: "/u/a.webp", mimeType: "image/webp", fileName: "a.webp", width: 1200, height: 800, avifUrl: "/u/a.avif",
  sizes: { medium: { url: "/u/a-300x200.webp", width: 300, height: 200, avifUrl: "/u/a-300x200.avif" } } };

test("ảnh: avifSrcset chỉ khi mọi cỡ đã có AVIF", () => {
  assert.equal(mediaSrcsets(img).avifSrcset, "/u/a-300x200.avif 300w, /u/a.avif 1200w");
  assert.equal(mediaSrcsets({ ...img, avifUrl: null }).avifSrcset, undefined);
});

test("video: chèn kèm poster và kích thước; gallery có srcset từng ảnh", () => {
  const v = mediaAttrs("video", [{ id: 2, url: "/u/v.mp4", mimeType: "video/mp4", fileName: "v.mp4", width: 1920, height: 1080, posterUrl: "/u/v-poster-ab12cd.webp" }]);
  assert.deepEqual([v.poster, v.width, v.height], ["/u/v-poster-ab12cd.webp", 1920, 1080]);
  const g = mediaAttrs("gallery", [img]) as { images: Array<Record<string, unknown>> };
  assert.equal(g.images[0].avifSrcset, "/u/a-300x200.avif 300w, /u/a.avif 1200w");
});
