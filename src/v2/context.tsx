import { createContext, useCallback, useContext, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { EditorStore, EditorState, EditingMode } from "./store";
import type { BlockTypeRegistry } from "./registry";
import type { EditorHost } from "./host";
import type { V2Labels } from "./labels";

/** Những thứ cả cây React của trình soạn dùng chung (khung soạn trong iframe là portal nên vẫn nhận được context). */
export interface EditorContextValue {
  store: EditorStore;
  registry: BlockTypeRegistry;
  host: EditorHost;
  labels: V2Labels;
  /** Bộ phận giao diện đăng ký với nhau (khung soạn ↔ thanh công cụ ↔ kéo thả). */
  ui: EditorUi;
}

/** Cầu nối giữa khung soạn (iframe) và giao diện bên ngoài. */
export class EditorUi {
  /** Tài liệu của iframe khung soạn (null khi chưa nạp). */
  canvasDoc: Document | null = null;
  canvasFrame: HTMLIFrameElement | null = null;
  private listeners = new Set<() => void>();
  /** Phiên bản đo lại vị trí (cuộn, đổi cỡ, nạp lại iframe). */
  tick = 0;
  /** Popover chèn khối (slash "/" hoặc nút "+") đang mở. */
  inserter: InserterRequest | null = null;
  drag: DragState | null = null;
  /** Đang gõ chữ: ẩn thanh công cụ cho khỏi che chữ (rê chuột thì hiện lại) — như WordPress. */
  typing = false;
  setTyping(v: boolean) { if (this.typing !== v) { this.typing = v; this.bump(); } }
  /** Bàn phím của popover chèn khối khi đang gõ "/" (khối chữ chuyển phím lên/xuống/Enter/Esc sang). */
  inserterKey: ((key: string) => boolean) | null = null;
  /** Ô gõ đang có focus (khoá richViews: "blockId" hoặc "blockId#field"). */
  activeRich: string | null = null;
  /** Mở hộp sửa liên kết cho ô gõ (khoá richViews). */
  openLink: ((viewKey: string) => void) | null = null;

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getTick = () => this.tick;
  bump() { this.tick++; this.listeners.forEach((l) => l()); }

  /** Phần tử DOM của khối trong khung soạn. */
  blockEl(id: string): HTMLElement | null {
    return this.canvasDoc?.querySelector<HTMLElement>(`[data-ecx-block="${CSS.escape(id)}"]`) ?? null;
  }
  /** Khung chữ nhật của khối theo toạ độ trang ngoài (cộng vị trí iframe). */
  blockRect(id: string): DOMRect | null {
    const el = this.blockEl(id);
    if (!el || !this.canvasFrame) return null;
    const r = el.getBoundingClientRect();
    const f = this.canvasFrame.getBoundingClientRect();
    const scale = f.width / (this.canvasFrame.offsetWidth || f.width) || 1;
    return new DOMRect(f.left + r.left * scale, f.top + r.top * scale, r.width * scale, r.height * scale);
  }
  openInserter(req: InserterRequest | null) { this.inserter = req; this.bump(); }
  setDrag(d: DragState | null) { this.drag = d; this.bump(); }
}

export interface InserterRequest {
  /** "slash" = gõ "/" trong đoạn trống (chữ sau "/" là từ khoá), "appender" = nút "+", "between" = chèn giữa hai khối. */
  mode: "slash" | "appender" | "between";
  docId: string;
  parentId: string | null;
  index: number;
  /** Khối chữ đang gõ "/" (slash) — chọn xong thì thay khối này. */
  blockId?: string;
  query?: string;
  /** Neo popover (toạ độ trang ngoài). */
  rect: { left: number; top: number; bottom: number };
}

export interface DragState {
  ids: string[];
  /** Khối mới kéo từ thư viện (chưa có trong tài liệu). */
  newType?: string;
  x: number;
  y: number;
  target: DropTarget | null;
}
export interface DropTarget { docId: string; parentId: string | null; index: number; rect: { left: number; top: number; width: number; height: number }; horizontal: boolean }

export const EditorContext = createContext<EditorContextValue | null>(null);
export function useEditor(): EditorContextValue {
  const v = useContext(EditorContext);
  if (!v) throw new Error("ecomweb-editor/v2: thiếu <EditorProvider>");
  return v;
}

/** Đọc một phần trạng thái; chỉ vẽ lại khi phần đó đổi (so sánh ===, hoặc hàm so sánh riêng). */
export function useEditorState<T>(select: (s: EditorState) => T, equal: (a: T, b: T) => boolean = Object.is): T {
  const { store } = useEditor();
  // Bộ đệm theo cả trạng thái LẪN hàm chọn: useSyncExternalStore gọi hàm chọn cũ với trạng thái mới trước khi vẽ lại
  // (vd đổi tài liệu đang xem) — chỉ so trạng thái sẽ trả về giá trị của hàm chọn cũ.
  const last = useRef<{ s: EditorState; select: (s: EditorState) => T; v: T } | null>(null);
  const get = useCallback(() => {
    const s = store.getState();
    if (last.current && last.current.s === s && last.current.select === select) return last.current.v;
    const v = select(s);
    if (last.current && equal(last.current.v, v)) { last.current = { s, select, v: last.current.v }; return last.current.v; }
    last.current = { s, select, v };
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, select]);
  return useSyncExternalStore(store.subscribe, get, get);
}
export const shallowArray = <T,>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function useUiTick(): number {
  const { ui } = useEditor();
  return useSyncExternalStore(ui.subscribe, ui.getTick, ui.getTick);
}

/** Tài liệu + chế độ sửa của vùng đang vẽ (khối trong header lồng trong template nhận docId của header). */
export interface DocScope { docId: string; mode: EditingMode; depth: number; /** Các tài liệu bao ngoài (chống lồng vòng tròn: header chứa chính nó). */ chain?: string[] }
export const DocScopeContext = createContext<DocScope>({ docId: "root", mode: "default", depth: 0 });
export const useDocScope = () => useContext(DocScopeContext);

export function DocScopeProvider({ value, children }: { value: DocScope; children: ReactNode }) {
  return <DocScopeContext.Provider value={value}>{children}</DocScopeContext.Provider>;
}
