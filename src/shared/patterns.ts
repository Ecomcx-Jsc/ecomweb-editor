import { normalizeContent } from "@ecomcx/ecomweb-content";

/**
 * Mẫu (pattern): đoạn nội dung dựng sẵn (giới thiệu, tính năng, bảng giá, kêu gọi hành động…) — chèn = chép khối vào bài,
 * sau đó sửa tự do (không liên kết với mẫu). Nguồn: lõi (registerCorePatterns), theme (patterns/*.json), plugin (registerPattern).
 */
export interface Pattern {
  /** Tên duy nhất: lõi "core/…", theme "theme/…", plugin "slug-plugin/…". */
  name: string;
  title: string;
  description?: string;
  /** Nhóm trong trình chèn: hero, features, cta, pricing, testimonials, faq, team, contact, text, gallery, footer, header… */
  category: string;
  keywords?: string;
  /** Nội dung: cây khối (`{ type: "doc", content }`), mảng khối, hoặc `{ version, blocks }` của @ecomcx/ecomweb-content. */
  content: unknown;
  /** Mẫu do người dùng tạo: id của mẫu. */
  ref?: number;
  /** Mẫu đồng bộ: chèn thành tham chiếu (`syncedPattern { ref }`) thay vì chép khối. */
  synced?: boolean;
}

const patterns = new Map<string, Pattern>();
const listeners = new Set<() => void>();
let snapshot: Pattern[] = [];
const changed = () => { snapshot = [...patterns.values()]; listeners.forEach((l) => l()); };

export function registerPattern(p: Pattern) { patterns.set(p.name, p); changed(); }
export function unregisterPattern(name: string) { if (patterns.delete(name)) changed(); }
export const registeredPatterns = (): Pattern[] => snapshot;
export function onPatternsChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** Khối của mẫu (đã chuẩn hoá theo @ecomcx/ecomweb-content). */
export function patternNodes(p: Pattern): Array<Record<string, unknown>> {
  const raw = Array.isArray(p.content) ? { type: "doc", content: p.content } : p.content;
  const { doc } = normalizeContent(raw);
  const main = doc.blocks.find((b) => b.type === "richtext");
  return ((main?.data as { content?: Array<Record<string, unknown>> } | undefined)?.content ?? []);
}

// Lõi không còn mẫu dựng sẵn (xoá 16/11 để thiết kế lại từng mẫu có nghiên cứu); mẫu của theme / plugin vẫn đăng ký bằng registerPattern.
/** Giữ API cũ: ứng dụng vẫn gọi, hiện không có mẫu lõi nào để đăng ký. */
export function registerCorePatterns(_locale = "vi") {}

export const PATTERN_CATEGORIES = ["hero", "features", "stats", "steps", "cta", "pricing", "testimonials", "faq", "team", "logos", "contact", "text", "gallery", "header", "footer"];
