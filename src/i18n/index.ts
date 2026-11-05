/**
 * Đa ngôn ngữ của trình soạn. Chữ nằm trong các "bó" theo ngôn ngữ (src/locales/<mã>/), mỗi bó chia thành nhóm (namespace).
 * Ứng dụng / plugin thêm ngôn ngữ bằng `registerLocale("ja", { v2: {...}, legacy: {...} })` — chỉ cần dịch các nhóm muốn dịch;
 * khoá thiếu rơi về ngôn ngữ gốc ("ja-JP" → "ja") rồi tiếng Anh. Không cần sửa mã của trình soạn.
 */
import { en } from "../locales/en";
import { vi } from "../locales/vi";

/** Một chữ, hoặc một nhóm chữ con (vd `dropHint.image`) — nhóm con cũng được gộp dự phòng theo từng khoá. */
export type Message = string | Record<string, string>;
export type Messages = Record<string, Message>;
export type Bundle = Record<string, Messages>;

const locales = new Map<string, Bundle>();
const listeners = new Set<() => void>();
let version = 0;
const FALLBACK = "en";

/** "vi-VN" / "VI" → "vi". Rỗng → "vi". */
export const normalizeLang = (lang?: string | null): string => (lang ?? "vi").trim().toLowerCase().replace(/_/g, "-") || "vi";

/** Thêm / bổ sung chữ cho một ngôn ngữ (gộp theo từng khoá; gọi nhiều lần được). */
export function registerLocale(lang: string, bundle: Record<string, Messages>) {
  const code = normalizeLang(lang);
  const cur = locales.get(code) ?? {};
  for (const [ns, msgs] of Object.entries(bundle)) cur[ns] = mergeMessages(cur[ns] ?? {}, msgs);
  locales.set(code, cur);
  version++;
  listeners.forEach((l) => l());
}

/** Mã các ngôn ngữ đã đăng ký. */
export const availableLocales = (): string[] => [...locales.keys()];
export const onLocalesChange = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const localesVersion = () => version;

/** Gộp `over` lên `base`: khoá con là object thì gộp theo từng khoá con (dịch dở một nhóm con vẫn giữ phần còn lại). */
function mergeMessages(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const prev = out[k];
    out[k] = typeof v === "object" && v && typeof prev === "object" && prev ? { ...prev, ...v } : v;
  }
  return out;
}

const cache = new Map<string, { v: number; m: Messages }>();
/**
 * Chữ của một nhóm theo ngôn ngữ, đã gộp dự phòng: tiếng Anh < ngôn ngữ gốc ("pt" cho "pt-br") < đúng ngôn ngữ.
 * Kết quả được nhớ theo phiên bản đăng ký → dùng trong render không tạo object mới.
 */
export function messages(ns: string, lang?: string | null): Messages {
  const code = normalizeLang(lang);
  const key = `${ns}\0${code}`;
  const hit = cache.get(key);
  if (hit && hit.v === version) return hit.m;
  const chain = [FALLBACK, code.includes("-") ? code.split("-")[0] : null, code].filter((c): c is string => !!c);
  const m = chain.reduce<Messages>((acc, c) => mergeMessages(acc, locales.get(c)?.[ns] ?? {}), {});
  cache.set(key, { v: version, m });
  return m;
}

/** Thay `{tên}` trong chữ: `format("Bộ sưu tập · {n} ảnh", { n: 3 })`. */
export const format = (text: string, vars?: Record<string, string | number>): string =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;

/** Chữ của một nhóm đã biết, có kiểu theo khoá của vi.ts: `msgs("motion", "vi").title`. */
export const msgs = <K extends keyof typeof import("../locales/vi").vi>(ns: K, lang?: string | null): (typeof import("../locales/vi").vi)[K] =>
  messages(ns as string, lang) as unknown as (typeof import("../locales/vi").vi)[K];

// Ngôn ngữ có sẵn trong gói. Đăng ký ngay trong module này (không qua import chỉ để lấy hiệu ứng phụ) vì package.json khai
// "sideEffects" chỉ cho *.css — bundler sẽ bỏ import như vậy. Ngôn ngữ khác: registerLocale() ở ứng dụng.
registerLocale("en", en);
registerLocale("vi", vi);
