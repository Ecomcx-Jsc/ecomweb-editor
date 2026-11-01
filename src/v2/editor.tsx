import type { RichNode } from "@ecomcx/ecomweb-content";
import { normalizeContent } from "@ecomcx/ecomweb-content";
import { ListTree, Monitor, Plus, Redo2, Smartphone, Tablet, Undo2, X, PanelRight, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { coreBlockTypes, registerCoreBlocks } from "./blocks";
import { registeredPatterns, syncPluginBlocks } from "./compat";
import { registerCorePatterns } from "../patterns";
import { registerCoreBindingSources } from "./bindings";
import { Canvas, type Device } from "./canvas";
import { EditorContext, EditorUi, useEditor, useEditorState, useUiTick, type EditorContextValue } from "./context";
import type { EditorHost } from "./host";
import { InserterPanel, InserterPopover } from "./inserter";
import { enV2, viV2, type V2Labels } from "./labels";
import { blocksFromDoc, docFromBlocks, type BNode } from "./model";
import { BlockTypeRegistry } from "./registry";
import { Inspector, ListView } from "./sidebar";
import { PrefsStore, usePrefs, type PrefsStorage } from "./prefs";
import { Breadcrumbs, CodeEditor, MoreMenu } from "./options";
import { EditorStore, type DocRecord } from "./store";
import { BlockToolbar, DropIndicator, ToolButton } from "./toolbar";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

/** Nội dung lưu (ContentDoc, cây doc RichNode, HTML cũ) → khối cấp cao nhất. */
export function blocksFromContent(value: unknown): BNode[] {
  return splitContent(value).blocks;
}
/**
 * Tách nội dung lưu: khối soạn được (richtext) + các khối khác giữ nguyên (HTML nhập từ hệ thống cũ, khối của plugin cấp ContentDoc)
 * — truyền lại `extra` cho contentFromBlocks để lưu không mất dữ liệu.
 */
export function splitContent(value: unknown): { blocks: BNode[]; extra: Array<{ type: string; data: unknown; id?: string }> } {
  if (value == null) return { blocks: [], extra: [] };
  const { doc } = normalizeContent(value);
  const rich = doc.blocks.find((b) => b.type === "richtext")?.data as RichNode | undefined;
  return { blocks: blocksFromDoc(rich), extra: doc.blocks.filter((b) => b.type !== "richtext") };
}
/** Khối → nội dung lưu (ContentDoc chuẩn của CMS). */
export function contentFromBlocks(blocks: BNode[], extra: Array<{ type: string; data: unknown; id?: string }> = []) {
  return { version: 1, blocks: [{ type: "richtext", data: docFromBlocks(blocks) }, ...extra] };
}

export interface EditorProviderProps {
  /** Store có sẵn (tự quản lý) — hoặc truyền `value` để tạo mới. */
  store?: EditorStore;
  value?: unknown;
  /** Loại tài liệu gốc (post, template, part…) — template part, template hiện khối giao diện. */
  kind?: string;
  title?: string;
  host?: EditorHost;
  labels?: Partial<V2Labels>;
  lang?: "vi" | "en";
  registry?: BlockTypeRegistry;
  /** Cho chèn khối giao diện (tên website, menu, danh sách bài, phần dùng chung). */
  dynamicBlocks?: boolean;
  /**
   * Template bao quanh khi sửa trang (template khoá): template hiện nhưng khoá, khối "Nội dung bài"
   * là chỗ sửa trang. Có nút bật/tắt hiện template.
   */
  frame?: { content: unknown; title?: string };
  /** Nơi lưu tuỳ chọn trình soạn của người dùng (mặc định localStorage). */
  prefsStorage?: PrefsStorage;
  /** Tuỳ chọn tạo sẵn (ứng dụng cần đọc tuỳ chọn ở ngoài trình soạn, vd bố cục trang theo "không phân tâm"). */
  prefs?: PrefsStore;
  /** Nội dung tài liệu gốc đổi (định dạng lưu). */
  onChange?(content: ReturnType<typeof contentFromBlocks>, blocks: BNode[]): void;
  children: ReactNode;
}

export function EditorProvider({ store: given, value, kind, title, host = {}, labels, lang, registry: givenRegistry, dynamicBlocks, frame, prefsStorage, prefs: givenPrefs, onChange, children }: EditorProviderProps) {
  const base = lang === "en" ? enV2 : viV2;
  const allLabels = useMemo(() => ({ ...base, ...labels }), [base, labels]);
  const registry = useMemo(() => {
    if (givenRegistry) return givenRegistry;
    const r = new BlockTypeRegistry();
    registerCoreBlocks(r, allLabels, { dynamic: dynamicBlocks });
    return r;
  }, [givenRegistry, allLabels, dynamicBlocks]);
  const storeRef = useRef<EditorStore | null>(given ?? null);
  if (!storeRef.current) storeRef.current = new EditorStore({ kind, title, blocks: blocksFromContent(value) });
  const store = given ?? storeRef.current;
  useEffect(() => {
    if (!frame) { store.setFrame(null); return; }
    store.putDoc({ id: "frame", kind: "template", title: frame.title, blocks: blocksFromContent(frame.content), mode: "disabled" });
    store.setFrame("frame");
  }, [frame, store]);
  const ui = useMemo(() => new EditorUi(), []);
  const ownPrefs = useMemo(() => (givenPrefs ? null : new PrefsStore(prefsStorage)), [givenPrefs, prefsStorage]);
  const prefs = givenPrefs ?? ownPrefs!;
  // Đang mở trình soạn: focus không ở ô nhập nào (vd Tab ra khỏi khung soạn) thì Backspace / ⌘← / ⌘→ là lệnh quay lại /
  // tới trang của trình duyệt (Safari) → chặn để không rời trang mất bài đang sửa
  useEffect(() => {
    const guard = (e: KeyboardEvent) => {
      const a = document.activeElement as HTMLElement | null;
      if (a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT|IFRAME)$/.test(a.tagName))) return;
      if ((e.key === "Backspace" && !e.metaKey && !e.ctrlKey) || ((e.metaKey || e.altKey) && (e.key === "ArrowLeft" || e.key === "ArrowRight"))) e.preventDefault();
    };
    document.addEventListener("keydown", guard);
    return () => document.removeEventListener("keydown", guard);
  }, []);
  // Khối của plugin (registerBlock) + mẫu có sẵn của lõi
  useEffect(() => syncPluginBlocks(registry), [registry]);
  useEffect(() => { registerCoreBindingSources(allLabels.lang); }, [allLabels.lang]);
  useEffect(() => { if (!registeredPatterns().some((p) => p.name.startsWith("core/"))) registerCorePatterns(allLabels.lang); }, [allLabels.lang]);
  const ctx: EditorContextValue = useMemo(() => ({ store, registry, host, labels: allLabels, ui, prefs }), [store, registry, host, allLabels, ui, prefs]);

  // Báo nội dung gốc đổi
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    let last = store.getState().docs[store.getState().rootId].blocks;
    return store.subscribe(() => {
      const blocks = store.getState().docs[store.getState().rootId].blocks;
      if (blocks === last) return;
      last = blocks;
      onChangeRef.current?.(contentFromBlocks(blocks), blocks);
    });
  }, [store]);

  return <EditorContext.Provider value={ctx}>{children}</EditorContext.Provider>;
}

/** Lưu mọi tài liệu có thay đổi: gốc qua `saveRoot`, tài liệu lồng (header, mẫu…) qua host.documents.save. */
export async function saveAll(ctx: EditorContextValue, saveRoot?: (content: ReturnType<typeof contentFromBlocks>, doc: DocRecord) => Promise<void>) {
  const { store, host } = ctx;
  const dirty = store.dirtyDocs();
  const errors: string[] = [];
  await Promise.all(dirty.map(async (d) => {
    const sent = d.blocks;
    try {
      if (d.id === store.getState().rootId) { if (saveRoot) await saveRoot(contentFromBlocks(sent), d); else return; }
      else if (host.documents?.save) await host.documents.save({ kind: d.kind, ref: d.ref }, sent, contentFromBlocks(sent));
      else return;
      store.markSaved(d.id, sent);
    } catch (e) {
      errors.push(`${d.title ?? d.id}: ${(e as Error)?.message ?? e}`);
    }
  }));
  if (errors.length) throw new Error(errors.join("\n"));
}

export interface BlockEditorProps extends Omit<EditorProviderProps, "children"> {
  className?: string;
  /** Lưu tài liệu gốc (nút Lưu, ⌘S). Tài liệu lồng lưu qua host.documents.save. Không có → ẩn nút Lưu. */
  onSave?(content: ReturnType<typeof contentFromBlocks>): Promise<void>;
  /** Phần đầu thanh trên cùng (tên trang, nút quay lại…). */
  header?: ReactNode;
  /** Nút thêm của ứng dụng ở cuối thanh trên cùng, trước nút Lưu (lịch sử, đặt lại…). */
  actions?: ReactNode;
  /** Mục riêng của ứng dụng trong menu ⋮ Tuỳ chọn. */
  menuExtra?: (close: () => void) => ReactNode;
  /** Vẽ thêm trên nội dung trong khung soạn (ô tiêu đề bài). */
  canvasBefore?: ReactNode;
  defaultDevice?: Device;
  /** Kiểu biến thể khối của theme (theme.json › blockStyles). */
  blockStyles?: Record<string, Array<{ name: string; label: string }>>;
}

/** Trình soạn đầy đủ: thanh trên cùng, thư viện khối / cây khối, khung soạn, bảng cài đặt. */
export function BlockEditor({ className, onSave, header, actions, menuExtra, canvasBefore, defaultDevice = "desktop", blockStyles, ...provider }: BlockEditorProps) {
  return (
    <EditorProvider {...provider}>
      <EditorShell className={className} onSave={onSave} header={header} actions={actions} menuExtra={menuExtra} canvasBefore={canvasBefore} defaultDevice={defaultDevice} blockStyles={blockStyles} />
    </EditorProvider>
  );
}

function EditorShell({ className, onSave, header, actions, menuExtra, canvasBefore, defaultDevice, blockStyles }: Pick<BlockEditorProps, "className" | "onSave" | "header" | "actions" | "menuExtra" | "canvasBefore" | "defaultDevice" | "blockStyles">) {
  const ctx = useEditor();
  const { store, labels } = ctx;
  const p = usePrefs(ctx.prefs);
  const [left, setLeft] = useState<"inserter" | "list" | null>(() => (ctx.prefs.get().showListView ? "list" : null));
  const [right, setRight] = useState(true);
  const [device, setDevice] = useState<Device>(defaultDevice ?? "desktop");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  useEditorState((s) => s.revision);
  const dirty = store.isDirty();

  const save = async () => {
    if (saving === "saving") return;
    setSaving("saving");
    setError(null);
    try {
      await saveAll(ctx, onSave ? (c) => onSave(c) : undefined);
      setSaving("saved");
    } catch (e) {
      setSaving("error");
      setError((e as Error).message);
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); void saveRef.current(); }
      // ⌘⇧⌥M: đổi soạn trực quan ↔ soạn mã
      if (mod && e.shiftKey && e.altKey && e.code === "KeyM") { e.preventDefault(); ctx.prefs.set({ mode: ctx.prefs.get().mode === "code" ? "visual" : "code" }); }
    };
    document.addEventListener("keydown", onKey);
    const frameDoc = ctx.ui.canvasDoc;
    frameDoc?.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); frameDoc?.removeEventListener("keydown", onKey); };
  }, [ctx.ui.canvasDoc, ctx.ui.tick]);
  useEffect(() => { if (dirty && saving === "saved") setSaving("idle"); }, [dirty, saving]);

  const dirtyDocs = store.dirtyDocs();
  return (
    <div className={cx("ecx-editor", className, p.fullscreen && "is-fullscreen", p.distractionFree && "is-distraction-free", p.showIconLabels && "show-labels")}>
      <div className="ecx-topbar" role="toolbar" aria-label={labels.editor}>
        <div className="ecx-topbar-start">
          {header}
          {!p.distractionFree && <ToolButton label={labels.addBlock} active={left === "inserter"} className="ecx-tool-primary" onClick={() => setLeft(left === "inserter" ? null : "inserter")}>{left === "inserter" ? <X className="ecx-icon" /> : <Plus className="ecx-icon" />}</ToolButton>}
          <ToolButton label={labels.undo} disabled={!store.canUndo} onClick={() => store.undo()}><Undo2 className="ecx-icon" /></ToolButton>
          <ToolButton label={labels.redo} disabled={!store.canRedo} onClick={() => store.redo()}><Redo2 className="ecx-icon" /></ToolButton>
          {!p.distractionFree && <ToolButton label={labels.listView} active={left === "list"} onClick={() => setLeft(left === "list" ? null : "list")}><ListTree className="ecx-icon" /></ToolButton>}
          <FrameToggle />
          {p.mode === "visual" && <ZoomToggle />}
        </div>
        <div className="ecx-topbar-end">
          <div className="ecx-tool-group" role="group" aria-label="Device">
            {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, I]) => <ToolButton key={d} label={d} active={device === d} onClick={() => setDevice(d)}><I className="ecx-icon" /></ToolButton>)}
          </div>
          {!p.distractionFree && <ToolButton label={labels.settings} active={right} onClick={() => setRight(!right)}><PanelRight className="ecx-icon" /></ToolButton>}
          {actions}
          <MoreMenu extra={menuExtra} />
          {(onSave || ctx.host.documents?.save) && (
            <button type="button" className="ecx-btn ecx-btn-primary ecx-save" disabled={!dirty || saving === "saving"} onClick={() => void save()} title={dirtyDocs.map((d) => d.title ?? d.id).join(", ")}>
              {saving === "saving" ? labels.saving : dirty ? `${labels.save}${dirtyDocs.length > 1 ? ` (${dirtyDocs.length})` : ""}` : labels.saved}
            </button>
          )}
        </div>
      </div>
      {error && <div className="ecx-notice is-error" role="alert">{error}</div>}
      {p.fixedToolbar && p.mode === "visual" && <div className="ecx-fixed-toolbar"><BlockToolbar placement="fixed" /></div>}
      <div className="ecx-body">
        {left && !p.distractionFree && <aside className="ecx-left">{left === "inserter" ? <InserterPanel /> : <ListView />}</aside>}
        <main className="ecx-main">{p.mode === "code" ? <CodeEditor /> : <Canvas device={device} before={canvasBefore} />}</main>
        {right && !p.distractionFree && <aside className="ecx-right"><Inspector blockStyles={blockStyles} /></aside>}
      </div>
      {p.showBreadcrumbs && !p.distractionFree && p.mode === "visual" && <Breadcrumbs />}
      <EditorOverlays />
    </div>
  );
}

/** Bật / tắt hiện template quanh trang (khi có template bao quanh). */
function ZoomToggle() {
  const { ui, labels } = useEditor();
  useUiTick();
  return <ToolButton label={labels.zoomOut} active={ui.zoomOut} onClick={() => { ui.setZoomOut(!ui.zoomOut); if (ui.zoomOut) ui.announce(labels.zoomOutHint); }}><ZoomOut className="ecx-icon" /></ToolButton>;
}

function FrameToggle() {
  const { store, labels } = useEditor();
  const hasFrame = useEditorState((s) => !!s.docs.frame);
  const on = useEditorState((s) => s.frameId === "frame");
  if (!hasFrame) return null;
  return (
    <label className="ecx-check ecx-frame-toggle">
      <input type="checkbox" checked={on} onChange={(e) => store.setFrame(e.target.checked ? "frame" : null)} /> {labels.showTemplate}
    </label>
  );
}

/** Vùng thông báo cho trình đọc màn hình (đã chép, đã chèn…). */
function LiveRegion() {
  const { ui } = useEditor();
  useUiTick();
  return <div className="ecx-sr-only" aria-live="polite" role="status">{ui.announcement}</div>;
}

/** Lớp nổi phía trên khung soạn: thanh công cụ khối, popover chèn, đường thả. Dùng khi tự dựng bố cục riêng. */
export function EditorOverlays() {
  return (
    <>
      <BlockToolbar />
      <InserterPopover />
      <DropIndicator />
      <LiveRegion />
    </>
  );
}

export { coreBlockTypes };
