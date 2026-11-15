import type { Device } from "@ecomcx/ecomweb-content";
import { ChevronRight, Monitor, RotateCcw, Smartphone, Tablet } from "lucide-react";
import { createContext, useContext, useState, type ComponentType, type ReactNode } from "react";
import { useEditor } from "../context";
import { useMsgs } from "../i18n";

/** Thành phần chung của bảng cài đặt (cùng một giao diện cho mọi mục). */
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

/** Cụm 3 icon khổ màn hình cạnh nhãn: ô này chỉnh riêng theo khổ; bấm = đổi khổ của cả trình soạn (khung soạn co lại theo). */
export function DeviceSwitch() {
  const { ui } = useEditor();
  const t = useMsgs("controls");
  const items: Array<["desktop" | "tablet" | "mobile", Icon, string]> = [["desktop", Monitor, t.desktop], ["tablet", Tablet, t.tablet], ["mobile", Smartphone, t.mobile]];
  return (
    <span className="ecx-row-devices" role="group" aria-label={t.device}>
      {items.map(([d, I, title]) => (
        <button key={d} type="button" title={title} aria-label={title} aria-pressed={ui.device === d} className={cx(ui.device === d && "is-active")} onClick={() => ui.setDevice(d)}><I className="ecx-icon" /></button>
      ))}
    </span>
  );
}

/**
 * Một ô của bảng: nhãn bên trái; bên phải là cụm khổ màn hình (ô chỉnh theo khổ — có `device`) và nút ↶ về mặc định (khi đã đổi — có `onReset`).
 * `extra`: nút nhỏ thêm cạnh nhãn (vd xích 4 cạnh).
 */
export function Row({ label, children, device, onReset, extra }: { label: ReactNode; children: ReactNode; device?: Device; onReset?(): void; extra?: ReactNode }) {
  const t = useMsgs("controls");
  return (
    <div className="ecx-style-row">
      <span className="ecx-row-head">
        <span className="ecx-field-label">{label}</span>
        {onReset && <button type="button" className="ecx-row-reset" title={t.reset} aria-label={`${t.reset}: ${typeof label === "string" ? label : ""}`} onClick={onReset}><RotateCcw className="ecx-icon" /></button>}
        <span className="ecx-row-tools">{extra}{device !== undefined && <DeviceSwitch />}</span>
      </span>
      {children}
    </div>
  );
}

/** Đếm thứ tự mục trong một bảng: mục đầu mở sẵn, còn lại gập (như bảng của các bộ khối lớn: thấy hết tên mục trong một màn hình). */
const SectionIndex = createContext<{ n: number } | null>(null);
export function SectionGroup({ children }: { children: ReactNode }) {
  return <SectionIndex.Provider value={{ n: 0 }}>{children}</SectionIndex.Provider>;
}
// Mục người dùng đã mở / gập: nhớ theo tên trong phiên soạn (đổi sang khối khác vẫn giữ)
const remembered = new Map<string, boolean>();

/**
 * Một mục: tiêu đề bấm để thu / mở, chấm khi mục có giá trị, nút đặt lại, phần "Thêm tuỳ chọn" cho thiết lập ít dùng.
 * Mặc định: mục đầu của bảng (trong SectionGroup) và mục đã có giá trị thì mở; còn lại gập. `summary`: một dòng hiện khi gập.
 */
export function Section({ title, children, more, defaultOpen, modified, onReset, moreOpen, summary, head }: {
  title: string; children?: ReactNode; more?: ReactNode; defaultOpen?: boolean; modified?: boolean; onReset?(): void; moreOpen?: boolean; summary?: ReactNode;
  /** Phần tử đặt trước tiêu đề (vd công tắc "Hiện" của một phần khối). */
  head?: ReactNode;
}) {
  const group = useContext(SectionIndex);
  const [index] = useState(() => (group ? group.n++ : 0));
  const [open, setOpenState] = useState(() => remembered.get(title) ?? defaultOpen ?? (!group || index === 0 || !!modified));
  const setOpen = (v: boolean) => { remembered.set(title, v); setOpenState(v); };
  const [showMore, setShowMore] = useState(!!moreOpen);
  const t = useMsgs("controls");
  return (
    <section className={cx("ecx-style-section", open && "is-open")}>
      <div className="ecx-style-section-head">
        {head}
        <button type="button" className="ecx-style-section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="ecx-style-section-title">{title}{modified && <span className="ecx-dot" aria-label={t.modified} />}</span>
          {!open && summary && <span className="ecx-style-section-summary">{summary}</span>}
          <ChevronRight className={cx("ecx-icon ecx-icon-sm ecx-chevron", open && "is-open")} aria-hidden />
        </button>
        {open && modified && onReset && <button type="button" className="ecx-link-btn" onClick={onReset}>{t.reset}</button>}
      </div>
      {open && (
        <div className="ecx-style-section-body">
          {children}
          {more && (showMore || moreOpen ? more : <button type="button" className="ecx-link-btn ecx-more-btn" onClick={() => setShowMore(true)}>{t.moreOptions}</button>)}
        </div>
      )}
    </section>
  );
}
