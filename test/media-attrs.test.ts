import assert from "node:assert/strict";
import { test } from "node:test";
import { mediaAttrs } from "../src/v2/ui/media-actions";

test("video: chèn kèm poster và kích thước; gallery có srcset từng ảnh", () => {
  const v = mediaAttrs("video", [{ id: 2, url: "/u/v.mp4", mimeType: "video/mp4", fileName: "v.mp4", width: 1920, height: 1080, posterUrl: "/u/v-poster-ab12cd.webp" }]);
  assert.deepEqual([v.poster, v.width, v.height], ["/u/v-poster-ab12cd.webp", 1920, 1080]);
  const img = { id: 1, url: "/u/a.jpg", mimeType: "image/jpeg", fileName: "a.jpg", width: 1200, height: 800, webpUrl: "/u/a.webp",
    sizes: { medium: { url: "/u/a-300x200.jpg", width: 300, height: 200, webpUrl: "/u/a-300x200.webp" } } };
  const g = mediaAttrs("gallery", [img]) as { images: Array<Record<string, unknown>> };
  assert.equal(g.images[0].webpSrcset, "/u/a-300x200.webp 300w, /u/a.webp 1200w");
});
