/**
 * HTML do website vẽ giúp (host.renderBlock) trước khi đưa vào khung soạn: khung soạn cùng nguồn với ứng dụng nhúng (admin),
 * nên mọi thứ chạy được (script, on*, javascript:) đều bị bỏ — chỉ giữ phần hiển thị.
 */
const DROP = "script, noscript, object, embed, base, meta, link[rel=import], frame, frameset, template";
const URL_ATTRS = ["href", "src", "action", "formaction", "poster", "xlink:href", "srcset", "data"];

export function sanitizeServerHtml(html: string, doc: Document): string {
  const box = doc.createElement("template");
  box.innerHTML = html;
  const root = box.content;
  root.querySelectorAll(DROP).forEach((el) => el.remove());
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const a of Array.from(el.attributes)) {
      const name = a.name.toLowerCase(), value = a.value.trim().toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(a.name);
      else if (URL_ATTRS.includes(name) && /^(javascript|vbscript|data:text\/html)/.test(value.replace(/[\s\u0000-\u001f]/g, ""))) el.removeAttribute(a.name);
    }
    // Khung con: chỉ http(s), luôn sandbox (không script, không cùng nguồn)
    if (el.tagName === "IFRAME") {
      if (!/^https?:\/\//i.test(el.getAttribute("src") ?? "")) el.remove();
      else el.setAttribute("sandbox", "");
    }
  }
  const out = doc.createElement("div");
  out.appendChild(root.cloneNode(true));
  return out.innerHTML;
}
