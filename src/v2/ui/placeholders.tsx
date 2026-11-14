import { embedInfo, isSafeUrl } from "@ecomcx/ecomweb-content";
import { File as FileIcon, Image as ImageIcon, Images, Link2, Music, Plus, Video } from "lucide-react";
import { useId, useState, type ComponentType, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { useEditor } from "../context";
import { useMsgs } from "../i18n";
import { MediaActions, useFileDrop } from "./media-actions";
import type { BlockProps } from "../core/registry";
import type { MediaItem, MediaKind } from "../../shared/types";

/**
 * Ô giữ chỗ dùng chung (trình soạn v2) — khối lõi và khối plugin cùng một kiểu: ô thả media, ô gõ có gợi ý, ô dán link,
 * ô chọn từ danh sách, nút "+ Thêm khối". Chỉ có trong khung soạn; website không vẽ gì khi ô còn trống.
 */
const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
type Icon = ComponentType<{ className?: string }>;
const KIND_ICON: Record<MediaKind, Icon> = { image: ImageIcon, gallery: Images, video: Video, audio: Music, file: FileIcon };
/** Bấm vào ô nhập / nút trong khối: không chọn khối, không để khung soạn bắt phím. */
const stop = { contentEditable: false, onMouseDown: (e: MouseEvent) => e.stopPropagation() } as const;

export interface MediaPlaceholderProps {
  kind: MediaKind;
  onSelect(items: MediaItem[]): void;
  /** Có → hiện nút "Chèn từ URL". */
  onUrl?(url: string): void;
  /** Câu chính (mặc định "Kéo thả ảnh vào đây"…). */
  title?: ReactNode;
  icon?: Icon;
  /** Kiểu tệp nhận khi tải lên (vd "application/pdf"); mặc định theo `kind`. */
  accept?: string;
  /** Nút / nội dung thêm dưới hàng nút (vd chọn màu nền của ảnh bìa). */
  extra?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Ô là phần tử gốc của khối (khối Ảnh, Video…): gắn props của khối. */
  blockProps?: BlockProps;
  compact?: boolean;
}

/** Vùng kéo thả media: viền nét đứt luôn thấy; rê chuột → màu chính; kéo tệp vào → nền xanh, viền liền, "Thả để tải lên". */
export function MediaPlaceholder({ kind, onSelect, onUrl, title, icon, accept, extra, className, style, blockProps, compact }: MediaPlaceholderProps) {
  const t = useMsgs("placeholders");
  const drop = useFileDrop(kind, onSelect);
  const I = icon ?? KIND_ICON[kind] ?? ImageIcon;
  return (
    <div {...(blockProps ?? {})} {...drop.props} data-ecx-placeholder="media"
      className={cx(blockProps?.className, "ecx-media-placeholder ecx-ph-drop", compact && "is-compact", drop.over && "is-drop-target", className)}
      style={{ ...(blockProps?.style ?? {}), ...style }}>
      <I className="ecx-icon ecx-ph-icon" />
      <p className="ecx-ph-title">{drop.over ? t.dropNow : title ?? t.drop[kind] ?? t.drop.file}</p>
      {!drop.over && <p className="ecx-placeholder-hint">{t.dropSub}</p>}
      {!drop.over && <MediaActions kind={kind} accept={accept} onSelect={onSelect} onUrl={onUrl} extra={extra} />}
    </div>
  );
}

export interface TextPlaceholderProps {
  value: string;
  onChange(value: string): void;
  /** Chữ gợi ý (vd nhãn của thuộc tính). */
  placeholder: string;
  /** Nhiều dòng (textarea). */
  multiline?: boolean;
  /** Nhãn cho trình đọc màn hình (mặc định = gợi ý). */
  label?: string;
  required?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/** Ô gõ ngay trên khối: chữ gợi ý luôn hiện khi trống, cỡ chữ = cỡ chữ thật của chỗ đặt ô (kế thừa font). */
export function TextPlaceholder({ value, onChange, placeholder, multiline, label, required, id, className, style }: TextPlaceholderProps) {
  const props = {
    ...stop, id, className: cx("ecx-ph-text", className), style, value, placeholder, required, "aria-label": label ?? placeholder, "aria-required": required || undefined,
    "data-ecx-placeholder": "text", onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return multiline ? <textarea {...props} rows={2} /> : <input {...props} type="text" />;
}

export interface LinkPlaceholderProps {
  /** Đường dẫn hợp lệ được gửi (đã trim). */
  onSubmit(url: string): void;
  title?: ReactNode;
  hint?: ReactNode;
  /** Kiểm link nhúng được (embedInfo) thay vì chỉ link an toàn. */
  embed?: boolean;
  /** Kiểm thêm (vd link YouTube); trả về false → báo lỗi. */
  validate?(url: string): boolean;
  buttonText?: string;
  label?: string;
  icon?: Icon;
  defaultValue?: string;
  className?: string;
  blockProps?: BlockProps;
}

/** Ô dán đường dẫn ngay trong khối (nhúng, YouTube, link mua…): kiểm hợp lệ trước khi nhận. */
export function LinkPlaceholder({ onSubmit, title, hint, embed, validate, buttonText, label, icon: I = Link2, defaultValue = "", className, blockProps }: LinkPlaceholderProps) {
  const t = useMsgs("placeholders");
  const id = useId();
  const [draft, setDraft] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const url = draft.trim();
    if (!isSafeUrl(url) || (validate && !validate(url))) return setError(t.linkInvalid);
    if (embed && !embedInfo(url)) return setError(t.embedUnsupported);
    setError(null);
    onSubmit(url);
  };
  return (
    <div {...(blockProps ?? {})} data-ecx-placeholder="link" className={cx(blockProps?.className, "ecx-media-placeholder ecx-ph-link", className)}>
      {title && <p className="ecx-ph-title"><I className="ecx-icon" />{title}</p>}
      <form className="ecx-ph-row" {...stop} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label htmlFor={id} className="ecx-ph-label">{label ?? t.link}</label>
        <input id={id} className="ecx-input" type="url" inputMode="url" placeholder="https://…" value={draft} aria-invalid={!!error || undefined}
          onChange={(e) => { setDraft(e.target.value); setError(null); }} />
        <button type="submit" className="ecx-btn ecx-btn-primary">{buttonText ?? t.embed}</button>
      </form>
      {error ? <p className="ecx-media-error" role="alert">{error}</p> : hint ? <p className="ecx-placeholder-hint">{hint}</p> : null}
    </div>
  );
}

export interface PickPlaceholderProps {
  title?: ReactNode;
  label: string;
  options: Array<{ value: string; label: string }>;
  value?: string | null;
  onChange(value: string): void;
  /** Nút tạo mới (vd "Tạo form"). */
  createLabel?: string;
  onCreate?(): void;
  hint?: ReactNode;
  icon?: Icon;
  className?: string;
  blockProps?: BlockProps;
}

/** Chọn từ danh sách ngay trong khối (form, menu…) — không bắt nhớ mã số. */
export function PickPlaceholder({ title, label, options, value, onChange, createLabel, onCreate, hint, icon: I, className, blockProps }: PickPlaceholderProps) {
  const t = useMsgs("placeholders");
  const id = useId();
  return (
    <div {...(blockProps ?? {})} data-ecx-placeholder="pick" className={cx(blockProps?.className, "ecx-media-placeholder ecx-ph-pick", className)}>
      {title && <p className="ecx-ph-title">{I && <I className="ecx-icon" />}{title}</p>}
      <div className="ecx-ph-row" {...stop}>
        <label htmlFor={id} className="ecx-ph-label">{label}</label>
        <select id={id} className="ecx-input" value={value ?? ""} onChange={(e) => e.target.value && onChange(e.target.value)}>
          <option value="">{t.choose}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {onCreate && <button type="button" className="ecx-btn" onClick={onCreate}><Plus className="ecx-icon ecx-icon-sm" />{createLabel}</button>}
      </div>
      {hint && <p className="ecx-placeholder-hint">{hint}</p>}
    </div>
  );
}

export interface AddBlockButtonProps {
  /** Khối chứa nhận khối mới; không truyền → khối chứa gần nhất của nút trên khung soạn. */
  parentId?: string;
  docId?: string;
  /** Vị trí chèn; mặc định cuối danh sách. */
  index?: number;
  label?: string;
  className?: string;
}

/** Nút "+ Thêm khối" lớn giữa khối chứa trống: mở trình chèn ngay tại chỗ. */
export function AddBlockButton({ parentId, docId, index, label, className }: AddBlockButtonProps) {
  const { ui, store } = useEditor();
  const t = useMsgs("placeholders");
  const text = label ?? t.addBlock;
  return (
    <button type="button" className={cx("ecx-appender ecx-add-block", className)} aria-label={text} contentEditable={false} data-ecx-placeholder="add"
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => {
        const el = e.currentTarget as HTMLElement;
        const pid = parentId ?? el.closest<HTMLElement>("[data-ecx-block]")?.dataset.ecxBlock;
        const loc = pid ? store.locate(pid) : null;
        if (!pid || !loc) return;
        const r = el.getBoundingClientRect();
        const f = ui.canvasFrame?.getBoundingClientRect();
        ui.openInserter({ mode: "appender", docId: docId ?? loc.docId, parentId: pid, index: index ?? loc.block.content?.length ?? 0, rect: { left: (f?.left ?? 0) + r.left, top: (f?.top ?? 0) + r.top, bottom: (f?.top ?? 0) + r.bottom } });
      }}>
      <Plus className="ecx-icon" aria-hidden />{text}
    </button>
  );
}

/** Nút "+ Thêm …" nhỏ ở cuối danh sách (tab, mục accordion, slide, ảnh gallery). */
export function AddItemButton({ label, onClick, className }: { label: string; onClick(): void; className?: string }) {
  return (
    <button type="button" className={cx("ecx-add-item", className)} {...stop} data-ecx-placeholder="add-item" onClick={onClick}>
      <Plus className="ecx-icon ecx-icon-sm" aria-hidden />{label}
    </button>
  );
}

/** Ô bắt buộc còn trống: viền cam + "Còn thiếu: …". */
export function MissingNote({ fields }: { fields: string[] }) {
  const t = useMsgs("placeholders");
  if (!fields.length) return null;
  return <p className="ecx-ph-missing" role="status">{t.missing.replace("{fields}", fields.join(", "))}</p>;
}
