/** Kho panel plugin (registerBlockPanel) — đăng ký ở đây, trình soạn đọc. */
import type { ComponentType } from "react";

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
  /** Loại khối áp dụng; bỏ trống = mọi khối. */
  blocks?: string[];
  /** Thứ tự (nhỏ đứng trước, mặc định 10). */
  order?: number;
  /**
   * Thuộc tính thêm vào khối (kể cả khối lõi), vd { lazy: { default: true } } — cần khai báo để trình soạn lưu được.
   * Bắt buộc có `blocks` khi khai báo thuộc tính. Website đọc được qua filter "post.blocks" hoặc renderer của plugin.
   */
  attributes?: Record<string, { default?: unknown }>;
  component: ComponentType<BlockPanelProps>;
}


const panels = new Map<string, BlockPanel>();
const listeners = new Set<() => void>();
let snapshot: BlockPanel[] = [];
const changed = () => { snapshot = [...panels.values()].sort((a, b) => (a.order ?? 10) - (b.order ?? 10)); listeners.forEach((l) => l()); };
export function registerBlockPanel(panel: BlockPanel) { panels.set(panel.id, panel); changed(); }
export function unregisterBlockPanel(id: string) { const had = panels.delete(id); if (had) changed(); return had; }

/** Panel áp dụng cho một loại khối. */
export const blockPanelsFor = (type: string) => snapshot.filter((p) => !p.blocks || p.blocks.includes(type));
export const blockPanels = () => snapshot;
export function onBlockPanelsChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
