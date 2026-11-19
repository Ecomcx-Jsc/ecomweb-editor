import { ICON_CORE_COUNT, ICON_NAMES, SVG_ICON_MAX, isSvgIconValue, resolveIcon, toSvgIconValue } from "@ecomcx/ecomweb-content";
import { ChevronDown, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMsgs } from "../i18n";
import { IconSvg } from "./icon-svg"; // đồng thời nạp thư viện icon
import { cx } from "./style-controls";

const PAGE = 160;

/**
 * Ô chọn icon: ô hiện icon đang chọn + mũi tên; bấm mở hộp có hai tab — "Thư viện" (≈1.900 icon, có ô tìm) và "SVG riêng" (dán mã SVG hoặc chọn file .svg).
 * `allowNone`: có lựa chọn "Không có icon" (vd nút). `defaultLabel`: thêm ô "mặc định" (giá trị trống, vd icon của từng mục theo icon chung của danh sách);
 * khi đó `noneValue` là giá trị lưu cho "Không có icon".
 */
export function IconPicker({ value, onChange, label, allowNone, defaultLabel, noneValue }: { value?: string; onChange(v: string | undefined): void; label: string; allowNone?: boolean; defaultLabel?: string; noneValue?: string }) {
  const t = useMsgs("controls");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", out, true); document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", out, true); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  const has = !!value && !!resolveIcon(value);
  const text = has ? (isSvgIconValue(value) ? t.iconCustom : value) : value === noneValue && noneValue ? t.noIcon : defaultLabel ?? t.noIcon;
  return (
    <div className="ecx-icon-picker" ref={ref}>
      <button type="button" className={cx("ecx-icon-picker-btn", open && "is-open")} aria-haspopup="dialog" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        {has ? <IconSvg name={value} size={22} /> : <span className="ecx-muted">{text}</span>}
        <span className="ecx-icon-picker-name">{has ? text : ""}</span>
        <ChevronDown className="ecx-icon" />
      </button>
      {open && (
        // preventDefault: ô này nằm trong <label> của form — không chặn thì bấm trong bảng kích lại nút mở (bảng đóng rồi mở lại)
        <div className="ecx-icon-pop" role="dialog" aria-label={label} onClick={(e) => e.preventDefault()}>
          <IconGrid value={value} label={label} allowNone={allowNone} defaultLabel={defaultLabel} noneValue={noneValue} onPick={(v) => { onChange(v); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

/** Hộp chọn icon: tab Thư viện (tìm + lưới) / SVG riêng — dùng trong ô chọn icon của bảng phải và trong thanh công cụ của khối. */
export function IconGrid({ value, onPick, label, allowNone, defaultLabel, noneValue, className }: { value?: string; onPick(v: string | undefined): void; label: string; allowNone?: boolean; defaultLabel?: string; noneValue?: string; className?: string }) {
  const t = useMsgs("controls");
  const [tab, setTab] = useState<"library" | "svg">(isSvgIconValue(value) ? "svg" : "library");
  return (
    <div className={className}>
      <div className="ecx-icon-tabs" role="tablist" aria-label={label}>
        <button type="button" role="tab" aria-selected={tab === "library"} className={cx("ecx-icon-tab", tab === "library" && "is-active")} onClick={() => setTab("library")}>{t.iconLibrary}</button>
        <button type="button" role="tab" aria-selected={tab === "svg"} className={cx("ecx-icon-tab", tab === "svg" && "is-active")} onClick={() => setTab("svg")}>{t.iconCustom}</button>
      </div>
      {tab === "library" ? <LibraryTab value={value} onPick={onPick} label={label} allowNone={allowNone} defaultLabel={defaultLabel} noneValue={noneValue} /> : <SvgTab value={value} onPick={onPick} />}
    </div>
  );
}

function LibraryTab({ value, onPick, label, allowNone, defaultLabel, noneValue }: { value?: string; onPick(v: string | undefined): void; label: string; allowNone?: boolean; defaultLabel?: string; noneValue?: string }) {
  const t = useMsgs("controls");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  // Bộ lõi (tên quen thuộc) đứng trước, rồi tới thư viện; tìm theo tên không dấu, bỏ gạch nối
  const all = ICON_NAMES as readonly string[];
  const names = useMemo(() => {
    const k = q.trim().toLowerCase().replace(/[\s_]+/g, "-");
    if (!k) return all;
    const starts: string[] = [], has: string[] = [];
    for (const n of all) { const l = n.toLowerCase(); if (l.startsWith(k)) starts.push(n); else if (l.includes(k) || l.replace(/-/g, "").includes(k.replace(/-/g, ""))) has.push(n); }
    return [...starts, ...has];
  }, [q, all]);
  useEffect(() => setShown(PAGE), [q]);
  const has = !!value && !!resolveIcon(value) && !isSvgIconValue(value);
  const none = (noneValue ?? "") !== "" && value === noneValue;
  return (
    <>
      <input className="ecx-input" autoFocus placeholder={`${t.searchIcons} (${all.length})`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t.searchIcons} />
      <div className="ecx-icon-grid" role="listbox" aria-label={label}>
        {defaultLabel && <button type="button" role="option" aria-selected={!value} title={defaultLabel} className={cx("ecx-icon-cell", !value && "is-active")} onClick={() => onPick(undefined)}><span className="ecx-icon-cell-text">{defaultLabel}</span></button>}
        {(allowNone || noneValue) && <button type="button" role="option" aria-selected={defaultLabel ? none : !has} title={t.noIcon} className={cx("ecx-icon-cell", (defaultLabel ? none : !has) && "is-active")} onClick={() => onPick(noneValue)}><X className="ecx-icon" /></button>}
        {names.slice(0, shown).map((n) => (
          <button key={n} type="button" role="option" aria-selected={value === n} title={n} className={cx("ecx-icon-cell", value === n && "is-active")} onClick={() => onPick(n)}><IconSvg name={n} /></button>
        ))}
      </div>
      {names.length > shown && <button type="button" className="ecx-link-btn" onClick={() => setShown(shown + PAGE * 3)}>{t.iconMore.replace("{n}", String(names.length - shown))}</button>}
      {!names.length && <p className="ecx-pop-hint">{t.noIconFound}</p>}
      {all.length <= ICON_CORE_COUNT && <p className="ecx-pop-hint">{t.iconLibraryLoading}</p>}
    </>
  );
}

function SvgTab({ value, onPick }: { value?: string; onPick(v: string | undefined): void }) {
  const t = useMsgs("controls");
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => (code.trim() ? toSvgIconValue(code) : null), [code]);
  useEffect(() => setError(false), [code]);
  const loadFile = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 200_000) { setError(true); return; }
    setCode(await f.text());
  };
  return (
    <div className="ecx-icon-svg">
      <p className="ecx-pop-hint">{t.iconCustomHint}</p>
      <textarea className="ecx-input" rows={5} spellCheck={false} placeholder={'<svg viewBox="0 0 24 24">…</svg>'} aria-label={t.iconCustomCode} value={code} onChange={(e) => setCode(e.target.value)} />
      <div className="ecx-icon-svg-row">
        <button type="button" className="ecx-link-btn" onClick={() => file.current?.click()}><Upload className="ecx-icon ecx-icon-sm" aria-hidden /> {t.iconCustomFile}</button>
        <input ref={file} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ""; }} />
        <span className="ecx-icon-svg-preview" aria-label={t.iconCustomPreview}>{parsed ? <IconSvg name={parsed} size={32} /> : isSvgIconValue(value) && !code ? <IconSvg name={value} size={32} /> : null}</span>
      </div>
      {(error || (code.trim() && !parsed)) && <p className="ecx-pop-hint" role="alert">{t.iconCustomInvalid.replace("{max}", String(SVG_ICON_MAX))}</p>}
      <button type="button" className="ecx-btn ecx-btn-primary" disabled={!parsed} onClick={() => parsed && onPick(parsed)}>{t.iconCustomUse}</button>
    </div>
  );
}
