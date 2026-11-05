import { normalizeStyle } from "@ecomcx/ecomweb-content";
import type { CSSProperties } from "react";

const SIDES = ["", "Top", "Right", "Bottom", "Left"];

/**
 * Bỏ thuộc tính inline của khối mà kiểu dáng (attrs.style) đã thay thế. Inline luôn thắng class `ecx-s-…`, nên không bỏ thì khung
 * soạn hiện sai (vd nút đặt nền trắng ở Kiểu dáng vẫn đen). Cùng danh sách với `overridden()` của renderer website (theme-sdk rich.tsx)
 * để khung soạn và website khớp nhau.
 */
export function withoutOverridden(inline: CSSProperties, rawStyle: unknown): CSSProperties {
  const style = normalizeStyle(rawStyle);
  if (!style) return inline;
  const drop = new Set<string>();
  if (style.padding) SIDES.forEach((x) => drop.add(`padding${x}`));
  if (style.margin) SIDES.forEach((x) => drop.add(`margin${x}`));
  if (style.gap) drop.add("gap");
  if (style.width) drop.add("width");
  if (style.maxWidth) drop.add("maxWidth");
  if (style.minHeight) drop.add("minHeight");
  if (style.fontSize) drop.add("fontSize");
  if (style.lineHeight) drop.add("lineHeight");
  if (style.fontWeight) drop.add("fontWeight");
  if (style.textAlign) drop.add("textAlign");
  if (style.color?.text) drop.add("color");
  if (style.color?.background) { drop.add("background"); drop.add("backgroundColor"); }
  if (style.border) SIDES.forEach((x) => drop.add(`border${x}`));
  if (style.radius) drop.add("borderRadius");
  return Object.fromEntries(Object.entries(inline).filter(([k]) => !drop.has(k))) as CSSProperties;
}
