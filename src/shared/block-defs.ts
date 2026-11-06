import type { BlockDefinition } from "@ecomcx/ecomweb-content";
import type { LucideIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/**
 * Kho khối của plugin (defineBlock + registerBlock) — không phụ thuộc trình soạn nào: bản TipTap (1.x) và bản cây khối (v2)
 * cùng đọc. Panel plugin (registerBlockPanel) cũng nằm ở đây.
 */
export interface BlockEditProps {
  attrs: Record<string, any>;
  setAttrs(attrs: Record<string, unknown>): void;
  selected: boolean;
  /** Nội dung bên trong (khối có content "inline"/"blocks") — đặt vào chỗ muốn người dùng gõ. */
  children?: ReactNode;
}

export interface RegisterBlockOptions {
  /** Biểu tượng trong slash menu và khung khối. */
  icon?: LucideIcon;
  /** Xem trước tuỳ chỉnh trong trình soạn; không có → khung chung + form cài đặt sinh từ attributes. */
  edit?: ComponentType<BlockEditProps>;
  /** Dịch nhãn ("%khoá%" → chữ theo ngôn ngữ admin) — admin truyền vào. */
  translate?(text: string): string;
  /** Khối của theme: chỉ chèn được khi soạn template / phần dùng chung (host.scope = "template"), không chèn vào bài viết. */
  templateOnly?: boolean;
  /** Khối chứa khối khác: nội dung có sẵn khi chèn (mặc định một đoạn văn trống). */
  initialContent?(): Array<Record<string, unknown>>;
}

const blocks = new Map<string, BlockDefinition>();
const options = new Map<string, RegisterBlockOptions>();
const listeners = new Set<() => void>();

export function storeBlockDefinition(def: BlockDefinition, opts: RegisterBlockOptions) { blocks.set(def.name, def); options.set(def.name, opts); listeners.forEach((l) => l()); }
export function dropBlockDefinition(name: string) { if (blocks.delete(name)) { options.delete(name); listeners.forEach((l) => l()); } }
export const blockDefinition = (name: string) => blocks.get(name);
export const blockOptions = (name: string): RegisterBlockOptions => options.get(name) ?? {};
/** Khối đang đăng ký (để chuẩn hoá + nâng phiên bản khi mở bài). */
export const registeredBlocks = (): BlockDefinition[] => [...blocks.values()];
export function onBlockDefinitionsChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
