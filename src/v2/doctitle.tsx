import { useLayoutEffect, useRef } from "react";
import { useEditor } from "./context";
import { makeBlock } from "./model";

/**
 * Ô tiêu đề của tài liệu đặt trong khung soạn (truyền vào Canvas `before`): mang kiểu chữ tiêu đề của theme.
 * Enter → xuống khối đầu tiên (tài liệu trống thì tạo đoạn văn).
 */
export function DocTitle({ value, onChange, placeholder, autoFocus }: { value: string; onChange(v: string): void; placeholder?: string; autoFocus?: boolean }) {
  const { store } = useEditor();
  const ref = useRef<HTMLTextAreaElement>(null);
  // Cao theo nội dung (tiêu đề dài xuống dòng)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  useLayoutEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <h1 className="ecx-doc-title">
      <textarea ref={ref} className="ecx-doc-title-input" rows={1} value={value} placeholder={placeholder} aria-label={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
        onFocus={() => store.clearSelection()}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const rootId = store.getState().rootId;
          const first = store.getState().docs[rootId].blocks[0];
          if (first?.inline) store.focusText(first.id, 0);
          else store.insert(rootId, null, 0, [makeBlock("paragraph")]);
        }} />
    </h1>
  );
}
