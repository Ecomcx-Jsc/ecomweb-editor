import { useMemo, useSyncExternalStore } from "react";

/**
 * Tuỳ chọn của trình soạn — cách trình soạn hiển thị cho người đang dùng (không đổi nội dung, không đổi website).
 * Lưu theo người dùng qua `PrefsStorage` của ứng dụng (mặc định localStorage của trình duyệt).
 */
export interface EditorPrefs {
  /** Thanh công cụ khối cố định dưới thanh trên cùng thay vì nổi trên khối. */
  fixedToolbar: boolean;
  /** Chỉ còn nội dung: ẩn thư viện khối, cây khối, bảng cài đặt. */
  distractionFree: boolean;
  /** Làm mờ mọi khối trừ khối đang sửa. */
  spotlight: boolean;
  /** Trình soạn che hết giao diện quản trị. */
  fullscreen: boolean;
  /** Mở sẵn cây khối khi vào trình soạn. */
  showListView: boolean;
  /** Đường dẫn khối (cha › con) ở đáy trình soạn. */
  showBreadcrumbs: boolean;
  /** Phím mũi tên không nhảy sang khối khác ở đầu/cuối khối. */
  keepCaretInsideBlock: boolean;
  /** Nút trên thanh công cụ hiện chữ thay vì chỉ biểu tượng. */
  showIconLabels: boolean;
  /** Mục "Dùng nhiều" trong thư viện khối. */
  mostUsedBlocks: boolean;
  /** Loại khối ẩn khỏi trình chèn (vẫn vẽ được nếu nội dung có sẵn). */
  hiddenBlockTypes: string[];
  /** Soạn bằng khối hoặc sửa thẳng mã (JSON nội dung). */
  mode: "visual" | "code";
  /** Số lần chèn theo loại khối (mục "Dùng nhiều"). */
  insertCounts: Record<string, number>;
}

export const DEFAULT_PREFS: EditorPrefs = {
  fixedToolbar: false, distractionFree: false, spotlight: false, fullscreen: false, showListView: false, showBreadcrumbs: true,
  keepCaretInsideBlock: false, showIconLabels: false, mostUsedBlocks: true, hiddenBlockTypes: [], mode: "visual", insertCounts: {},
};

export interface PrefsStorage {
  load(): Partial<EditorPrefs> | null;
  save(prefs: EditorPrefs): void;
}

/** Lưu trong trình duyệt (mỗi máy một bộ); ứng dụng có tài khoản nên lưu lên máy chủ để theo người dùng. */
export const localPrefsStorage = (key = "ecx-editor-prefs"): PrefsStorage => ({
  load() { try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; } },
  save(p) { try { localStorage.setItem(key, JSON.stringify(p)); } catch { /* trình duyệt chặn bộ nhớ */ } },
});

export class PrefsStore {
  private prefs: EditorPrefs;
  private listeners = new Set<() => void>();
  constructor(private storage: PrefsStorage = localPrefsStorage()) {
    this.prefs = { ...DEFAULT_PREFS, ...(storage.load() ?? {}) };
  }
  get = () => this.prefs;
  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  set(patch: Partial<EditorPrefs>) {
    this.prefs = { ...this.prefs, ...patch };
    this.storage.save(this.prefs);
    this.listeners.forEach((l) => l());
  }
  toggle(key: { [K in keyof EditorPrefs]: EditorPrefs[K] extends boolean ? K : never }[keyof EditorPrefs]) { this.set({ [key]: !this.prefs[key] } as Partial<EditorPrefs>); }
  countInsert(type: string) { this.set({ insertCounts: { ...this.prefs.insertCounts, [type]: (this.prefs.insertCounts[type] ?? 0) + 1 } }); }
}

/** Màn hình hẹp (điện thoại): thanh công cụ nổi đè lên dòng đang gõ và tràn mép → luôn ghim trên cùng (như WordPress trên điện thoại). */
export const NARROW_QUERY = "(max-width: 640px)";
const narrowMq = typeof matchMedia === "function" ? matchMedia(NARROW_QUERY) : null;
const subscribeNarrow = (l: () => void) => { narrowMq?.addEventListener("change", l); return () => narrowMq?.removeEventListener("change", l); };
const isNarrow = () => !!narrowMq?.matches;

export function usePrefs(store: PrefsStore): EditorPrefs {
  const prefs = useSyncExternalStore(store.subscribe, store.get, store.get);
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
  return useMemo(() => (narrow && !prefs.fixedToolbar ? { ...prefs, fixedToolbar: true } : prefs), [prefs, narrow]);
}
