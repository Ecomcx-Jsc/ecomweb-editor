/** Kho hiệu ứng chuyển động do plugin thêm (registerAnimation) — không phụ thuộc trình soạn: bản 1.x và v2 cùng đọc. */

export interface MotionEffect {
  /** Mã hiệu ứng `[a-z][a-z0-9-]{0,39}` (nên có tiền tố plugin: "acme-bounce"). Lưu vào `style.motion.in`; website dùng `@keyframes ecx-in-<mã>`. */
  id: string;
  /** Nhãn hiện ở bảng Chuyển động (nhận "%khoá%" — admin dịch theo plugin). */
  label: string;
  /** Nhóm trong danh sách chọn (vd "Nảy", "Chữ"); không có = "Plugin". */
  group?: string;
  /**
   * CSS chứa `@keyframes ecx-in-<mã>` để xem trước trong trình soạn. Website không đọc cái này — plugin nạp CSS cho website
   * riêng (slot "head"); dùng chung một chuỗi cho cả hai là đơn giản nhất.
   */
  css?: string;
  /** Thứ tự (nhỏ đứng trước, mặc định 10). */
  order?: number;
}

const ID = /^[a-z][a-z0-9-]{0,39}$/;
/** Mã của hiệu ứng lõi (@ecomcx/ecomweb-content `MOTION_IN`): plugin không được trùng. */
const CORE = new Set(["fade", "slide-up", "slide-down", "slide-left", "slide-right", "zoom-in", "zoom-out", "blur-in", "none"]);

const effects = new Map<string, MotionEffect>();
const listeners = new Set<() => void>();
let snapshot: MotionEffect[] = [];
const changed = () => { snapshot = [...effects.values()].sort((a, b) => (a.order ?? 10) - (b.order ?? 10)); listeners.forEach((l) => l()); };

/** Thêm hiệu ứng vào danh sách chọn của mọi khối. Mã sai dạng / trùng hiệu ứng lõi bị bỏ qua (có cảnh báo). */
export function storeAnimation(effect: MotionEffect) {
  if (!ID.test(effect.id) || CORE.has(effect.id)) { console.warn(`[ecomweb-editor] registerAnimation: mã "${effect.id}" không hợp lệ hoặc trùng hiệu ứng lõi`); return; }
  effects.set(effect.id, effect);
  changed();
}
export function dropAnimation(id: string) { if (effects.delete(id)) changed(); }

/** Hiệu ứng của plugin (đã sắp thứ tự); tham chiếu đổi khi danh sách đổi → dùng được với useSyncExternalStore. */
export const pluginAnimations = () => snapshot;
export function onAnimationsChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
