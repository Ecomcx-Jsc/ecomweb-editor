import assert from "node:assert/strict";
import { test } from "node:test";
import { makeBlock } from "../src/v2/core/model";
import { richToHtml, serializeBlocks } from "../src/v2/core/clipboard";

test("chép ra HTML / text: nút giữ chữ + liên kết, ảnh giữ chú thích, nhúng giữ liên kết", () => {
  const nodes = [
    makeBlock("paragraph", {}, "Đoạn mở đầu"),
    makeBlock("image", { src: "https://example.com/a.png", alt: "a", caption: "Chú thích ảnh" }),
    { ...makeBlock("buttons", {}), content: [makeBlock("button", { text: "Nút một", href: "https://example.com/x" })] },
    makeBlock("embed", { url: "https://youtu.be/abc", caption: "Video giới thiệu" }),
  ];
  const s = serializeBlocks(nodes as never);
  assert.ok(s.html.includes("<figure><img") && s.html.includes("<figcaption>Chú thích ảnh</figcaption>"), s.html);
  assert.ok(s.html.includes('<a href="https://example.com/x">Nút một</a>'), s.html);
  assert.ok(s.html.includes('<a href="https://youtu.be/abc">Video giới thiệu</a>'), s.html);
  assert.ok(s.text.includes("Chú thích ảnh") && s.text.includes("Nút một") && s.text.includes("Video giới thiệu"), s.text);
});

test("chép ra HTML: ảnh không chú thích vẫn là <img> trần; URL nguy hiểm bị bỏ", () => {
  assert.equal(richToHtml([{ type: "image", attrs: { src: "https://example.com/a.png" } }]), '<img src="https://example.com/a.png" alt="">');
  assert.equal(richToHtml([{ type: "image", attrs: { src: "javascript:alert(1)", caption: "x" } }]), "");
  assert.equal(richToHtml([{ type: "button", attrs: { text: "Bấm", href: "javascript:alert(1)" } }]), "<p>Bấm</p>");
});
