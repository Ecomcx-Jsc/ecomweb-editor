import type { BlockAttrSpec, BlockDefinition } from "@ecomcx/ecomweb-content";
import { blockDefaults } from "@ecomcx/ecomweb-content";
import type { ComponentType, HTMLAttributes, ReactNode, Ref } from "react";
import { kindOf, makeBlock, setBlockKind, type BlockKind, type BNode } from "./model";
import { setStructureRule, type StructureRule } from "./structure";
import type { V2Labels } from "./labels";

/**
 * Định nghĩa khối của trình soạn v2. Phần dữ liệu (tên, thuộc tính) trùng với defineBlock của ecomweb-content;
 * phần giao diện (edit) vẽ khối ngay trên khung soạn với đúng markup của website.
 */
export interface BlockEditProps {
  block: BNode;
  attrs: Record<string, any>;
  setAttrs(attrs: Record<string, unknown>): void;
  /** Props phải gắn vào phần tử gốc của khối (chọn, viền, kéo thả, class kiểu dáng). Không bọc thêm thẻ. */
  blockProps: BlockProps;
  selected: boolean;
  /** Chế độ sửa của tài liệu chứa khối. */
  editable: boolean;
  labels: V2Labels;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BlockProps = HTMLAttributes<HTMLElement> & { ref: Ref<any>; "data-ecx-block": string; "data-type": string };

export type BlockCategory = "text" | "media" | "design" | "widgets" | "theme" | "embed" | (string & {});

export interface BlockVariation {
  name: string;
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  keywords?: string;
  attrs?: Record<string, unknown>;
  /** Tạo khối của biến thể (mặc định create của khối với attrs). */
  create?(): BNode;
  /** Biến thể đang áp dụng cho khối này (hiện tên/biểu tượng đúng biến thể). */
  isActive?(attrs: Record<string, any>): boolean;
}

export interface BlockTransform {
  /** Loại khối đích (hiện trong menu "Đổi loại khối"). */
  to: string;
  title?: string;
  /** Nhận các khối đang chọn (cùng loại), trả về khối thay thế; null = không đổi được. */
  convert(blocks: BNode[]): BNode[] | null;
  /** Áp dụng được cho nhiều khối cùng lúc. */
  multiple?: boolean;
}

export interface BlockType {
  name: string;
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  category?: BlockCategory;
  /** Từ khoá tìm (không dấu). */
  keywords?: string;
  kind: BlockKind;
  attributes?: Record<string, BlockAttrSpec>;
  /** Luật cấu trúc (chứa gì, nằm trong gì). */
  structure?: StructureRule;
  /** Ẩn khỏi trình chèn (khối con như column, listItem). */
  hidden?: boolean;
  /** Tạo khối mới khi chèn (mặc định: thuộc tính mặc định + nội dung tối thiểu). */
  create?(attrs?: Record<string, unknown>): BNode;
  /** Vẽ trên khung soạn. Không có → khung chung (tên khối + tóm tắt thuộc tính). */
  edit?: ComponentType<BlockEditProps>;
  /** Thanh công cụ riêng của khối (chèn vào thanh công cụ nổi). */
  toolbar?: ComponentType<BlockEditProps>;
  /**
   * Công cụ hiện trên thanh công cụ khi đang thao tác BÊN TRONG khối này (gõ trong ô bảng → công cụ bảng,
   * trong cột → thêm cột). `ancestor` là khối này, `currentId` là khối đang thao tác.
   */
  contextToolbar?: ComponentType<{ ancestor: BNode; currentId: string }>;
  /** Bảng cài đặt riêng (ngoài form tự sinh). */
  inspector?: ComponentType<BlockEditProps>;
  variations?: BlockVariation[];
  transforms?: BlockTransform[];
  /** Khối chữ: Enter xuống dòng trong khối thay vì tách khối (mã nguồn). */
  multiline?: boolean;
  /** Khối chữ: không cho định dạng chữ. */
  plain?: boolean;
  /** Khối chữ: chữ gợi ý khi trống. */
  placeholder?: string | ((labels: V2Labels) => string);
  supports?: { style?: boolean; anchor?: boolean; className?: boolean; blockStyle?: boolean; align?: boolean };
  /** Tóm tắt một dòng (cây khối, khung chung). */
  summary?(attrs: Record<string, any>): string | undefined;
}

export class BlockTypeRegistry {
  private types = new Map<string, BlockType>();
  private listeners = new Set<() => void>();
  private version = 0;

  register(type: BlockType) {
    this.types.set(type.name, type);
    if (kindOf(type.name) !== type.kind) setBlockKind(type.name, type.kind);
    if (type.structure) setStructureRule(type.name, type.structure);
    this.changed();
  }
  unregister(name: string) { if (this.types.delete(name)) this.changed(); }
  get(name: string): BlockType | undefined { return this.types.get(name); }
  all(): BlockType[] { return [...this.types.values()]; }
  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getVersion = () => this.version;
  private changed() { this.version++; this.listeners.forEach((l) => l()); }

  /** Tạo khối mới của loại `name` (có nội dung tối thiểu). */
  create(name: string, attrs?: Record<string, unknown>): BNode {
    const t = this.types.get(name);
    if (t?.create) return t.create(attrs);
    const defaults = t?.attributes ? Object.fromEntries(Object.entries(t.attributes).filter(([, s]) => s.default !== undefined).map(([k, s]) => [k, s.default])) : {};
    const kind = t?.kind ?? kindOf(name);
    return makeBlock(name, { ...defaults, ...attrs }, kind === "container" ? [makeBlock("paragraph")] : undefined);
  }

  /** Khối của plugin khai báo bằng defineBlock (ecomweb-content) → khối v2 với khung chung + form tự sinh. */
  registerDefinition(def: BlockDefinition, extra: Partial<BlockType> = {}) {
    const kind: BlockKind = def.content === "inline" ? "text" : def.content === "blocks" ? "container" : "atom";
    this.register({
      name: def.name, title: def.title, description: def.description, category: def.category ?? "widgets", keywords: def.keywords,
      kind, attributes: def.attributes,
      create: (attrs) => makeBlock(def.name, { ...blockDefaults(def), ...attrs }, kind === "container" ? [makeBlock("paragraph")] : undefined),
      ...extra,
    });
  }
}

export type RenderChildren = (props?: { className?: string; orientation?: "vertical" | "horizontal" }) => ReactNode;
