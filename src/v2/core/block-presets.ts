import type { BlockControls } from "@ecomcx/ecomweb-content";
import type { BNode } from "./model";

/**
 * Kiểu đặt sẵn + mặc định khi chèn của từng loại khối (toàn website, host.blockPresets):
 * { "<loại>": { default?: attrs, presets?: [{ name, attrs }] } }. Chỉ chứa thuộc tính KIỂU (style, parts, biến thể, ô kiểu dáng của khối),
 * không chứa nội dung (chữ, ảnh, liên kết) — "Mặc định của khối" không đổi khối đã có, không lưu nội dung.
 */
export interface BlockPreset { name: string; attrs: Record<string, unknown> }
export interface BlockPresetEntry { default?: Record<string, unknown>; presets?: BlockPreset[] }
export type BlockPresetMap = Record<string, BlockPresetEntry>;

/** Thuộc tính kiểu chung của mọi khối. */
const COMMON = ["style", "parts", "blockStyle"];

/** Tên thuộc tính kiểu của một loại khối: chung + ô điều khiển khai CSS (lõi + plugin). */
export function styleKeys(type: string, controls: readonly BlockControls[]): string[] {
  const own = controls.filter((c) => c.blocks === "*" || c.blocks.includes(type)).flatMap((c) => Object.keys(c.attributes));
  return [...new Set([...COMMON, ...own])];
}

/** Lấy phần kiểu của attrs (bỏ ô trống). */
export function pickStyle(attrs: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== "") out[k] = attrs[k];
  return out;
}

/** Áp một bộ kiểu: xoá mọi thuộc tính kiểu đang có rồi đặt theo bộ kiểu (nội dung giữ nguyên). */
export function applyStyle(keys: string[], style: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const k of keys) patch[k] = style[k];
  return patch;
}

/** So sánh hai bộ kiểu (thứ tự khoá không quan trọng). */
export const sameStyle = (a: Record<string, unknown>, b: Record<string, unknown>) => stable(a) === stable(b);
function stable(v: unknown): string {
  if (v && typeof v === "object" && !Array.isArray(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  return JSON.stringify(v);
}

/** Khối mới chèn: thêm kiểu mặc định của loại khối (chỉ thuộc tính chưa có — mẫu / biến thể đã đặt thì giữ). */
export function withDefaults(node: BNode, map: BlockPresetMap | null): BNode {
  const def = map?.[node.type]?.default;
  if (!def) return node;
  const attrs = { ...node.attrs };
  for (const [k, v] of Object.entries(def)) if (attrs[k] === undefined) attrs[k] = v;
  return { ...node, attrs };
}

// Kho trong bộ nhớ (một lần nạp mỗi phiên soạn); UI đăng ký nghe thay đổi
let current: BlockPresetMap | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
export const presetsSnapshot = () => current;
export const onPresetsChange = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function setPresets(m: BlockPresetMap | null) { current = m; listeners.forEach((l) => l()); }
export function ensurePresets(load?: () => Promise<Record<string, unknown>>) {
  if (current || loading || !load) return;
  loading = load().then((m) => setPresets((m ?? {}) as BlockPresetMap), () => setPresets({})).finally(() => { loading = null; });
}

/** Như withDefaults cho kết quả tạo khối (một khối hoặc mẫu nhiều khối). */
export function freshWithDefaults<T extends BNode | BNode[]>(made: T): T {
  return (Array.isArray(made) ? made.map((n) => withDefaults(n, current)) : withDefaults(made, current)) as T;
}
