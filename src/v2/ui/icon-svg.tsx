import { createElement, type ReactNode } from "react";
import { registerIconLibrary, resolveIcon, type SvgIconNode } from "@ecomcx/ecomweb-content";
import { ICON_LIBRARY } from "@ecomcx/ecomweb-content/icon-library";

// ≈1.900 icon của thư viện: nạp một lần khi trình soạn khởi động (cùng thư viện với website)
registerIconLibrary(ICON_LIBRARY);

const camel = (props: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(props).map(([k, v]) => [k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v]));
const node = (n: SvgIconNode, key: number): ReactNode => createElement(n.tag, { key, ...camel(n.props) }, ...n.children.map(node));

/** Vẽ icon theo giá trị lưu (tên trong bảng / thư viện, hoặc SVG riêng `svg:…` đã lọc) — cùng cách với website. Không có icon → null. */
export function IconSvg({ name, size = 24, stroke = 2, className, label, style }: { name?: unknown; size?: number; stroke?: number; className?: string; label?: string; style?: import("react").CSSProperties }): ReactNode {
  const r = resolveIcon(name);
  if (!r) return null;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const, focusable: "false" as const };
  if (r.kind === "svg") {
    const root = camel(r.icon.root);
    return <svg className={className} style={style && Object.keys(style).length ? style : undefined} width={size} height={size} viewBox={r.icon.viewBox} fill={root.fill ?? "currentColor"} {...(root.stroke ? { stroke: root.stroke } : {})} {...(root.strokeWidth ? { strokeWidth: root.strokeWidth } : {})} {...(root.strokeLinecap ? { strokeLinecap: root.strokeLinecap as "round" } : {})} {...(root.strokeLinejoin ? { strokeLinejoin: root.strokeLinejoin as "round" } : {})} {...a11y}>{r.icon.children.map(node)}</svg>;
  }
  return <svg className={className} style={style && Object.keys(style).length ? style : undefined} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...a11y}><path d={r.d} /></svg>;
}
