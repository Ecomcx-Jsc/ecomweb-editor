import type { Device } from "@ecomcx/ecomweb-content";
import { ChevronRight } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { useEditor } from "../context";

/** Thành phần chung của tab Kiểu dáng (cùng một giao diện cho mọi mục). */
export const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
export type Icon = ComponentType<{ className?: string }>;

export function Seg<T extends string>({ value, options, onChange, label }: { value: T | undefined; options: Array<[T, Icon | string, string]>; onChange(v: T | undefined): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="ecx-seg">
      {options.map(([v, I, title]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} title={title} aria-label={title} className={cx("ecx-seg-btn", value === v && "is-active")}
          onClick={() => onChange(value === v ? undefined : v)}>{typeof I === "string" ? I : <I className="ecx-icon" />}</button>
      ))}
    </div>
  );
}
export function Row({ label, children, device }: { label: string; children: ReactNode; device?: Device }) {
  const { labels } = useEditor();
  return (
    <div className="ecx-style-row">
      <span className="ecx-field-label">{label}{device && device !== "base" && <em className="ecx-device-tag">{device === "tablet" ? labels.lang === "vi" ? "Máy tính bảng" : "Tablet" : labels.lang === "vi" ? "Điện thoại" : "Mobile"}</em>}</span>
      {children}
    </div>
  );
}
/**
 * Một mục của tab Kiểu dáng: tiêu đề bấm để thu / mở (mũi tên), dấu chấm khi mục có giá trị, nút đặt lại,
 * phần "Thêm tuỳ chọn" cho thiết lập ít dùng (tự mở khi đã có giá trị).
 */
export function Section({ title, children, more, defaultOpen = true, modified, onReset, moreOpen }: {
  title: string; children?: ReactNode; more?: ReactNode; defaultOpen?: boolean; modified?: boolean; onReset?(): void; moreOpen?: boolean;
}) {
  const { labels } = useEditor();
  const [open, setOpen] = useState(defaultOpen);
  const [showMore, setShowMore] = useState(!!moreOpen);
  const vi = labels.lang === "vi";
  return (
    <section className="ecx-style-section">
      <div className="ecx-style-section-head">
        <button type="button" className="ecx-style-section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <ChevronRight className={cx("ecx-icon ecx-icon-sm ecx-chevron", open && "is-open")} aria-hidden />{title}{modified && <span className="ecx-dot" aria-label={vi ? "đã chỉnh" : "modified"} />}
        </button>
        {modified && onReset && <button type="button" className="ecx-link-btn" onClick={onReset}>{vi ? "Đặt lại" : "Reset"}</button>}
      </div>
      {open && (
        <div className="ecx-style-section-body">
          {children}
          {more && (showMore || moreOpen ? more : <button type="button" className="ecx-link-btn ecx-more-btn" onClick={() => setShowMore(true)}>{vi ? "+ Thêm tuỳ chọn" : "+ More options"}</button>)}
        </div>
      )}
    </section>
  );
}

