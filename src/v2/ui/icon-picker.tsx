import { ICON_NAMES, ICON_PATHS } from "@ecomcx/ecomweb-content";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMsgs } from "../i18n";
import { cx } from "./style-controls";

const Svg = ({ name, size = 20 }: { name: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON_PATHS[name]} /></svg>
);

/**
 * Ô chọn icon: ô hiện icon đang chọn + mũi tên; bấm mở lưới icon có ô tìm (như bảng chọn icon của các bộ khối lớn).
 * `allowNone`: có lựa chọn "Không có icon" (vd nút).
 */
export function IconPicker({ value, onChange, label, allowNone }: { value?: string; onChange(v: string | undefined): void; label: string; allowNone?: boolean }) {
  const t = useMsgs("controls");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", out, true); document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", out, true); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  const names = useMemo(() => { const k = q.trim().toLowerCase(); return (ICON_NAMES as readonly string[]).filter((n) => !k || n.toLowerCase().includes(k)); }, [q]);
  const has = !!value && !!ICON_PATHS[value];
  return (
    <div className="ecx-icon-picker" ref={ref}>
      <button type="button" className={cx("ecx-icon-picker-btn", open && "is-open")} aria-haspopup="dialog" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        {has ? <Svg name={value!} size={22} /> : <span className="ecx-muted">{t.noIcon}</span>}
        <span className="ecx-icon-picker-name">{has ? value : ""}</span>
        <ChevronDown className="ecx-icon" />
      </button>
      {open && (
        // preventDefault: ô này nằm trong <label> của form — không chặn thì bấm trong bảng kích lại nút mở (bảng đóng rồi mở lại)
        <div className="ecx-icon-pop" role="dialog" aria-label={label} onClick={(e) => e.preventDefault()}>
          <input className="ecx-input" autoFocus placeholder={t.searchIcons} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="ecx-icon-grid" role="listbox" aria-label={label}>
            {allowNone && <button type="button" role="option" aria-selected={!has} title={t.noIcon} className={cx("ecx-icon-cell", !has && "is-active")} onClick={() => { onChange(undefined); setOpen(false); }}><X className="ecx-icon" /></button>}
            {names.map((n) => (
              <button key={n} type="button" role="option" aria-selected={value === n} title={n} className={cx("ecx-icon-cell", value === n && "is-active")} onClick={() => { onChange(n); setOpen(false); }}><Svg name={n} /></button>
            ))}
          </div>
          {!names.length && <p className="ecx-pop-hint">{t.noIconFound}</p>}
        </div>
      )}
    </div>
  );
}
