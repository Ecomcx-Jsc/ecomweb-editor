/** Kho panel plugin (registerBlockPanel) — đăng ký ở đây, trình soạn đọc. */
import type { ComponentType } from "react";
import { defineBlockControls, type BlockControls, type ControlSpec } from "@ecomcx/ecomweb-content";

/** Props của panel plugin trong tab "Khối". */
export interface BlockPanelProps {
  /** Loại khối đang chọn (vd "image", "button", "shop/product"). */
  type: string;
  /** Thuộc tính hiện tại của khối. */
  attrs: Record<string, any>;
  /** Đổi thuộc tính (chỉ thuộc tính đã khai báo ở `attributes` hoặc thuộc tính sẵn có của khối). */
  setAttrs(attrs: Record<string, unknown>): void;
}

export interface BlockPanel {
  /** Mã duy nhất, dạng "slug-plugin/tên". */
  id: string;
  /** Tiêu đề mục trong tab "Khối" (nhận "%khoá%" — admin dịch theo plugin). */
  title: string;
  /** Loại khối áp dụng; bỏ trống hoặc "*" = mọi khối. */
  blocks?: string[] | "*";
  /** Tab đặt panel: "block" (mặc định) hoặc "style" (tab Kiểu dáng). */
  tab?: "block" | "style";
  /** Thứ tự (nhỏ đứng trước, mặc định 10). */
  order?: number;
  /**
   * Thuộc tính thêm vào khối (kể cả khối lõi), vd { lazy: { default: true } } — cần khai báo để trình soạn lưu được.
   * Bắt buộc có `blocks` khi khai báo thuộc tính. Website đọc được qua filter "post.blocks" hoặc renderer của plugin.
   */
  attributes?: Record<string, { default?: unknown; label?: string } | (ControlSpec & { label?: string })>;
  /** Giao diện riêng; bỏ trống = trình soạn tự vẽ ô cho các thuộc tính có `type`. */
  component?: ComponentType<BlockPanelProps>;
}


const panels = new Map<string, BlockPanel>();
const listeners = new Set<() => void>();
let snapshot: BlockPanel[] = [];
const changed = () => {
  snapshot = [...panels.values()].sort((a, b) => (a.order ?? 10) - (b.order ?? 10));
  controls = snapshot.flatMap((p) => { const t = typed(p); return Object.keys(t).length ? [{ id: p.id, blocks: p.blocks ?? "*", attributes: t }] : []; });
  listeners.forEach((l) => l());
};
/** Thuộc tính có `type` + `css` → ô điều khiển khai CSS (kiểm khai báo ngay lúc đăng ký: sai → ném lỗi). */
const typed = (p: BlockPanel) => Object.fromEntries(Object.entries(p.attributes ?? {}).filter(([, s]) => "type" in s && s.type)) as Record<string, ControlSpec>;
let controls: BlockControls[] = [];
export function registerBlockPanel(panel: BlockPanel) {
  const t = typed(panel);
  if (Object.keys(t).length) defineBlockControls({ id: panel.id, blocks: panel.blocks ?? "*", attributes: t });
  panels.set(panel.id, panel); changed();
}
export function unregisterBlockPanel(id: string) { const had = panels.delete(id); if (had) changed(); return had; }

/** Panel áp dụng cho một loại khối. */
export const blockPanelsFor = (type: string, tab: "block" | "style" = "block") => snapshot.filter((p) => (p.blocks === undefined || p.blocks === "*" || p.blocks.includes(type)) && (p.tab ?? "block") === tab);
/** Ô điều khiển khai CSS của mọi panel (đầu vào của controlsCss — cùng hàm website dùng). */
export const blockControls = () => controls;
export const blockPanels = () => snapshot;
export function onBlockPanelsChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

// ---------------------------------------------------------------------------
// Hành động trên khối (registerBlockAction) — menu ⋮ của thanh công cụ khối
// ---------------------------------------------------------------------------
export interface BlockActionContext {
  /** Các khối đang chọn (id, loại, thuộc tính). */
  blocks: Array<{ id: string; type: string; attrs: Record<string, any> }>;
  /** Đổi thuộc tính các khối đang chọn. */
  setAttrs(attrs: Record<string, unknown>): void;
}
export interface BlockAction {
  /** Mã duy nhất "slug-plugin/tên". */
  id: string;
  /** Nhãn trong menu (nhận "%khoá%"). */
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Loại khối áp dụng; bỏ trống / "*" = mọi khối. */
  blocks?: string[] | "*";
  run(ctx: BlockActionContext): void | Promise<void>;
}
const actions = new Map<string, BlockAction>();
let actionList: BlockAction[] = [];
export function registerBlockAction(a: BlockAction) { actions.set(a.id, a); actionList = [...actions.values()]; listeners.forEach((l) => l()); }
export function unregisterBlockAction(id: string) { const had = actions.delete(id); if (had) { actionList = [...actions.values()]; listeners.forEach((l) => l()); } return had; }
export const blockActionsFor = (types: string[]) => actionList.filter((a) => !a.blocks || a.blocks === "*" || types.every((t) => (a.blocks as string[]).includes(t)));

// ---------------------------------------------------------------------------
// Khối sẵn sàng (onBlockReady) + asset theo nhu cầu — khung soạn (iframe) đọc
// ---------------------------------------------------------------------------
export type BlockReadyFn = (el: HTMLElement, attrs: Record<string, unknown>) => void | (() => void);
export interface BlockAsset { kind: "script" | "style"; src: string; when: { blocks?: string[]; className?: string } }
let ready: Array<{ type: string; fn: BlockReadyFn }> = [];
let assets: BlockAsset[] = [];
export function onBlockReady(type: string, fn: BlockReadyFn) {
  const e = { type, fn };
  ready = [...ready, e]; listeners.forEach((l) => l());
  return () => { ready = ready.filter((x) => x !== e); listeners.forEach((l) => l()); };
}
export function registerBlockAssets(list: BlockAsset[]) { assets = [...assets, ...list]; listeners.forEach((l) => l()); }
export const blockReadyFns = () => ready;
export const blockAssets = () => assets;
