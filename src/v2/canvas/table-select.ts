import { useEffect } from "react";
import { useEditor } from "../context";
import { cellRect, cellTable, cellsInRect } from "../core/tables";

const CELL = '[data-type="tableCell"], [data-type="tableHeader"]';

/**
 * Bôi đen vùng ô của bảng như WordPress / Google Docs: kéo chuột từ ô này sang ô khác, hoặc Shift+bấm ô khác khi đang ở trong
 * một ô của cùng bảng → chọn mọi ô trong hình chữ nhật (ô gộp được nới trọn). Chọn xong: thanh công cụ có Gộp ô / Xoá nội dung.
 */
export function useTableRangeSelect(doc: Document) {
  const { store } = useEditor();
  useEffect(() => {
    let anchor: string | null = null;
    let inRange = false;
    const cellOf = (t: EventTarget | null) => (t instanceof (doc.defaultView as unknown as typeof globalThis).Element ? (t as Element).closest<HTMLElement>(CELL) : null);
    const selectRange = (a: string, b: string) => {
      const ta = cellTable(store, a), tb = cellTable(store, b);
      if (!ta || !tb || ta.table.id !== tb.table.id) return false;
      const rect = cellRect(ta.table, a, b);
      if (!rect) return false;
      (doc.activeElement as HTMLElement | null)?.blur?.();
      doc.getSelection()?.removeAllRanges();
      store.select(cellsInRect(ta.table, rect).map((c) => c.id), { editing: null });
      doc.querySelector<HTMLElement>(".ecx-canvas-root")?.focus({ preventScroll: true });
      return true;
    };
    /** Ô của chỗ đang gõ / đang chọn (mốc cho Shift+bấm). */
    const currentCell = () => {
      const s = store.getState().selection;
      const id = s.editing ?? s.ids[0];
      if (!id) return null;
      const loc = store.locate(id);
      if (!loc) return null;
      for (const x of [id, ...[...loc.ancestors].reverse()]) if (cellTable(store, x)) return x;
      return null;
    };
    const down = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const cell = cellOf(e.target);
      anchor = cell?.dataset.ecxBlock ?? null;
      inRange = false;
      head = null;
      if (!cell || !e.shiftKey) return;
      const from = currentCell();
      if (from && from !== anchor && selectRange(from, anchor!)) { e.preventDefault(); e.stopPropagation(); anchor = from; }
    };
    let head: string | null = null;
    const move = (e: MouseEvent) => {
      if (!anchor) return;
      // Lúc kéo bôi chữ, e.target vẫn là phần tử bắt đầu kéo → lấy ô dưới con trỏ
      const cell = cellOf(doc.elementFromPoint(e.clientX, e.clientY))?.dataset.ecxBlock;
      if (cell && (cell !== anchor || inRange) && cell !== head && selectRange(anchor, cell)) {
        head = cell;
        if (!inRange) { inRange = true; doc.documentElement.classList.add("ecx-cell-selecting"); }
      }
      if (inRange) {
        // Đang bôi theo ô: trình duyệt không được bôi chữ song song (vệt bôi chữ nhảy qua các ô), ô gõ không đổi thành dải chữ
        e.preventDefault();
        e.stopPropagation();
        doc.getSelection()?.removeAllRanges();
      }
    };
    const up = (e: MouseEvent) => {
      if (inRange) { e.stopPropagation(); doc.getSelection()?.removeAllRanges(); }
      doc.documentElement.classList.remove("ecx-cell-selecting");
      anchor = null; head = null; inRange = false;
    };
    doc.addEventListener("mousedown", down, true);
    doc.addEventListener("mousemove", move, true);
    doc.addEventListener("mouseup", up, true);
    return () => { doc.removeEventListener("mousedown", down, true); doc.removeEventListener("mousemove", move, true); doc.removeEventListener("mouseup", up, true); };
  }, [doc, store]);
}
