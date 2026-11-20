import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { EditorStore, EditorState, EditingMode } from "./core/store";
import type { BlockTypeRegistry } from "./core/registry";
import type { DynamicData, DynamicPost, EditorHost } from "./core/host";
import type { V2Labels } from "./labels";
import type { PrefsStore } from "./prefs";

/** Những thứ cả cây React của trình soạn dùng chung (khung soạn trong iframe là portal nên vẫn nhận được context). */
export interface EditorContextValue {
  store: EditorStore;
  registry: BlockTypeRegistry;
  host: EditorHost;
  labels: V2Labels;
  /** Bộ phận giao diện đăng ký với nhau (khung soạn ↔ thanh công cụ ↔ kéo thả). */
  ui: EditorUi;
  /** Tuỳ chọn trình soạn của người dùng. */
  prefs: PrefsStore;
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
  /** Đang gõ chữ: ẩn thanh công cụ cho khỏi che chữ (rê chuột thì hiện lại). */
  typing = false;
  /** Thu nhỏ: cả trang trong tầm nhìn, chỉ chọn / sắp xếp các phần (khối cấp cao nhất). */
  zoomOut = false;
  /** Khối đang "xem trước khi rê chuột": khung soạn vẽ mọi quy tắc :hover của khối đó như đang rê (Kiểu dáng › Xem trước khi rê chuột). */
  previewHoverId: string | null = null;
  setPreviewHover(id: string | null) { if (this.previewHoverId !== id) { this.previewHoverId = id; this.bump(); } }
  /** Khổ màn hình đang soạn: khung soạn vẽ theo bề rộng này, tab Kiểu dáng sửa giá trị của khổ này (dùng chung, đổi một nơi thì nơi kia theo). */
  device: "desktop" | "tablet" | "mobile" = "desktop";
  setDevice(d: "desktop" | "tablet" | "mobile") { if (this.device !== d) { this.device = d; this.bump(); } }
  /** Mở thư viện khối đầy đủ (cột trái) — nút "Xem tất cả" của chèn nhanh; ứng dụng / BlockEditor gán. */
  browseAll: (() => void) | null = null;
  setZoomOut(v: boolean) { if (this.zoomOut !== v) { this.zoomOut = v; this.bump(); } }
  setTyping(v: boolean) { if (this.typing !== v) { this.typing = v; this.bump(); } }
  /** Bàn phím của popover chèn khối khi đang gõ "/" (khối chữ chuyển phím lên/xuống/Enter/Esc sang). */
  inserterKey: ((key: string) => boolean) | null = null;
  /** Ô gõ đang có focus (khoá richViews: "blockId" hoặc "blockId#field"). */
  activeRich: string | null = null;
  /** Mở hộp sửa liên kết cho ô gõ (khoá richViews). */
  openLink: ((viewKey: string) => void) | null = null;
  /** Mở hộp "Viết bằng AI": chèn ở vị trí (khối chứa lệnh /ai thì thay khối đó). */
  openAiWrite: ((at: { blockId?: string; docId: string; parentId: string | null; index: number }) => void) | null = null;

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
  /** Vẽ nội dung bằng khung soạn chỉ xem (tầng editor gán; ui không import editor): xem trước thật ở bảng chèn và thư viện mẫu. */
  renderPreview: ((value: { version: number; blocks: unknown[] }) => ReactNode) | null = null;
  /** Mục con đang chọn trong khối dạng danh sách (Icon List, Mạng xã hội…): khung soạn tô mục, bảng phải hiện cài đặt riêng của mục. */
  activeItem = new Map<string, number>();
  setActiveItem(blockId: string, i: number) { if (this.activeItem.get(blockId) !== i) { this.activeItem.set(blockId, i); this.bump(); } }
  /** Khối vừa chèn còn chữ mẫu chưa sửa: bấm vào ô chữ lần đầu thì chọn hết để gõ là thay (không chèn thêm vào chữ mẫu). Bỏ cờ khi khối có thay đổi đầu tiên. */
  fresh = new Set<string>();
  /**
   * Khối vừa chèn từ bảng chèn + vùng chọn "tự đến" sau đó (con trỏ vào ô chữ đầu của khối). Lần chèn kế tiếp, nếu người dùng chưa bấm chỗ khác,
   * đặt khối mới NGAY SAU khối vừa chèn cùng cấp — thay vì lồng vào trong khối vừa chèn (vì con trỏ đang nằm sâu trong nó).
   */
  insertAnchor: { id: string; sel: string } | null = null;
  /** Cầu nối tới vùng chọn hiện tại của store (EditorProvider gắn vào). */
  currentIds: () => readonly string[] = () => [];
  private anchorTimer: ReturnType<typeof setTimeout> | null = null;
  markInsertAnchor(id: string, delay = 500) {
    this.insertAnchor = null;
    if (this.anchorTimer) clearTimeout(this.anchorTimer); // chèn nhanh nhiều khối: chỉ lần chèn cuối được đặt mốc
    this.anchorTimer = setTimeout(() => { this.anchorTimer = null; this.insertAnchor = { id, sel: this.currentIds().join(",") }; }, delay);
  }
  /** Khối vừa chèn đang chờ chọn bố cục (không lưu vào nội dung). */
  pickIds = new Set<string>();
  requestPick(id: string) { this.pickIds.add(id); this.bump(); }
  // Chọn / bỏ qua bố cục xong khối vẫn được chọn (bảng phải hiện lưới bố cục vừa chọn) — không đẩy con trỏ vào chữ
  // `focus`: "Bỏ qua" = dùng bố cục mặc định và gõ luôn → con trỏ vào ô chữ đầu; chọn một thẻ thì giữ khối được chọn để bảng phải hiện thẻ đó
  resolvePick(id: string, focus = false) { if (this.pickIds.delete(id)) { this.bump(); if (focus) { this.focusFirstField(id); this.markInsertAnchor(id, 450); } } }
  /**
   * Khối widget vừa chèn (Icon Box, Đếm số, Đánh giá…) có ô gõ ngay trên khối (ô chữ, không phải khối chữ) nên không tự nhận con trỏ như Đoạn văn:
   * gõ ngay sau khi chèn không vào đâu. Đưa con trỏ vào ô chữ đầu tiên của khối (chữ mẫu đã chọn sẵn nên gõ là thay). Khối đang chờ chọn bố cục thì để ô chọn giữ focus.
   */
  focusFirstField(id: string) {
    let tries = 0;
    const attempt = () => {
      if (this.pickIds.has(id)) return;
      const el = this.blockEl(id);
      if (!el) { if (++tries < 8) setTimeout(attempt, 40); return; }
      const doc = el.ownerDocument, active = doc.activeElement as HTMLElement | null;
      if (active && active !== doc.body && el.contains(active) && !active.closest(".ecx-variation-chooser")) return;
      const field = el.querySelector<HTMLElement>('input[data-ecx-placeholder="text"], textarea[data-ecx-placeholder="text"], [contenteditable="true"]');
      if (field && !field.closest("[data-ecx-inert]")) { field.focus({ preventScroll: true }); return; }
      // Khối không có ô gõ (Ảnh, Khoảng trống, Cột…): đưa focus về khung soạn — nếu để ở nút của bảng chèn thì ⌘Z, Delete, mũi tên không tới trình soạn
      (doc.querySelector<HTMLElement>(".ecx-canvas-root"))?.focus({ preventScroll: true });
    };
    setTimeout(attempt, 60);
  }
  /** Thông báo cho trình đọc màn hình (vùng aria-live). */
  announcement = "";
  announce(text: string) { this.announcement = ""; this.bump(); setTimeout(() => { this.announcement = text; this.bump(); }, 30); }
  /** Alt+F10: đưa bàn phím lên thanh công cụ của khối. */
  focusToolbar() { document.querySelector<HTMLElement>(".ecx-toolbar button:not(:disabled)")?.focus(); }
  setDrag(d: DragState | null) { this.drag = d; this.bump(); }
  /** Menu chuột phải đang mở: vị trí theo toạ độ trang ngoài + các khối áp dụng. */
  contextMenu: { x: number; y: number; ids: string[] } | null = null;
  openContextMenu(m: { x: number; y: number; ids: string[] } | null) {
    if (m) for (const d of [document, this.canvasDoc]) d?.dispatchEvent(new Event("ecx-close-menus"));   // đóng menu ⋮ đang mở
    if (m || this.contextMenu) { this.contextMenu = m; this.bump(); }
  }
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
  // Giữ nguyên object khi nội dung không đổi: mọi khối đọc context này — object mới mỗi lần vẽ = vẽ lại cả tài liệu mỗi phím gõ
  const chain = (value.chain ?? []).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => value, [value.docId, value.mode, value.depth, chain]);
  return <DocScopeContext.Provider value={stable}>{children}</DocScopeContext.Provider>;
}

/** Bài của mục đang vẽ trong "Danh sách bài" — khối bài (tiêu đề, ảnh…) và gắn dữ liệu core/post đọc bài này. */
export const LoopPostContext = createContext<DynamicPost | null>(null);
/** Dữ liệu động của chỗ đang vẽ: host.dynamic, với `post` là bài của mục danh sách bài (nếu nằm trong). */
export function useDynamicData(): DynamicData {
  const { host } = useEditor();
  const post = useContext(LoopPostContext);
  return useMemo(() => (post ? { ...host.dynamic, post } : host.dynamic ?? {}), [host.dynamic, post]);
}
