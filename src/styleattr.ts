import { Extension, type Editor as TiptapEditor } from "@tiptap/core";
import { collectStyles, normalizeAnchor, normalizeBindings, normalizeBlockStyleName, normalizeLock, normalizeTemplateLock, normalizeClassName, normalizeStyle, presetCss, styleClass, type BlockStyle, type StylePresets } from "@ecomcx/ecomweb-content";

const SKIP = new Set(["doc", "text", "hardBreak", "tableRow"]);

const json = (key: string, data: string, norm: (v: unknown) => unknown) => ({
  default: null, keepOnSplit: false,
  parseHTML: (el: HTMLElement) => { try { return norm(JSON.parse(el.getAttribute(data) ?? "null")) ?? null; } catch { return null; } },
  renderHTML: (attrs: Record<string, any>) => { const v = norm(attrs[key]); return v ? { [data]: JSON.stringify(v) } : {}; },
});

/**
 * Kiểu dáng khối (`attrs.style`, @ecomcx/ecomweb-content) cho mọi loại khối của trình soạn: lưu trong JSON, hiện bằng class `ecx-s-…`
 * (cùng CSS với website), sao chép/dán giữ nguyên qua `data-ecx-style`. Khối mới tách ra (Enter) không kế thừa.
 */
export const BlockStyleAttr = Extension.create({
  name: "cmsBlockStyle",
  addGlobalAttributes() {
    const types = this.extensions.filter((e) => e.type === "node" && !SKIP.has(e.name)).map((e) => e.name);
    return [{
      types,
      attributes: {
        style: {
          default: null,
          keepOnSplit: false,
          parseHTML: (el: HTMLElement) => { try { return normalizeStyle(JSON.parse(el.getAttribute("data-ecx-style") ?? "null")) ?? null; } catch { return null; } },
          renderHTML: (attrs: Record<string, any>) => {
            const style = normalizeStyle(attrs.style);
            return style ? { "data-ecx-style": JSON.stringify(style), class: styleClass(style) } : {};
          },
        },
        // Biến thể kiểu (.ecx-is-<tên>), class riêng, neo — giữ khi chép/dán qua data-*
        blockStyle: {
          default: null, keepOnSplit: false,
          parseHTML: (el: HTMLElement) => normalizeBlockStyleName(el.getAttribute("data-ecx-variant")) ?? null,
          renderHTML: (attrs: Record<string, any>) => { const v = normalizeBlockStyleName(attrs.blockStyle); return v ? { "data-ecx-variant": v, class: `ecx-is-${v}` } : {}; },
        },
        className: {
          default: null, keepOnSplit: false,
          parseHTML: (el: HTMLElement) => normalizeClassName(el.getAttribute("data-ecx-class")) ?? null,
          renderHTML: (attrs: Record<string, any>) => { const v = normalizeClassName(attrs.className); return v ? { "data-ecx-class": v, class: v } : {}; },
        },
        anchor: {
          default: null, keepOnSplit: false,
          parseHTML: (el: HTMLElement) => normalizeAnchor(el.getAttribute("data-ecx-anchor")) ?? null,
          renderHTML: (attrs: Record<string, any>) => { const v = normalizeAnchor(attrs.anchor); return v ? { "data-ecx-anchor": v } : {}; },
        },
        // Gắn dữ liệu / khoá khối (1.15): trình soạn 1.x không sửa nhưng phải giữ nguyên khi lưu
        bindings: json("bindings", "data-ecx-bindings", normalizeBindings),
        lock: json("lock", "data-ecx-lock", normalizeLock),
        templateLock: {
          default: null, keepOnSplit: false,
          parseHTML: (el: HTMLElement) => normalizeTemplateLock(el.getAttribute("data-ecx-template-lock")) ?? null,
          renderHTML: (attrs: Record<string, any>) => { const v = normalizeTemplateLock(attrs.templateLock); return v ? { "data-ecx-template-lock": v } : {}; },
        },
      },
    }];
  },
});

/** Biến CSS preset của theme áp vào vùng soạn (cùng giá trị với website). */
export const presetsCss = (presets?: StylePresets) => (presets ? presetCss(presets, ".cms-ed-content") : "");

/** CSS kiểu dáng của mọi khối trong tài liệu (một thẻ <style> trong trình soạn). */
export function documentStyleCss(editor: TiptapEditor): string {
  const styles: BlockStyle[] = [];
  editor.state.doc.descendants((n) => { const s = n.attrs?.style && normalizeStyle(n.attrs.style); if (s) styles.push(s); });
  return collectStyles(styles);
}
