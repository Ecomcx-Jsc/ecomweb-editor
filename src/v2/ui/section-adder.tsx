import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useEditor, useUiTick } from "../context";

/** Khoảng (px) quanh ranh giới hai section mà rê chuột vào thì hiện nút. */
const ZONE = 14;

/** Chỉ số chèn khi con trỏ ở gần ranh giới giữa các khối cấp trên cùng (trên khối đầu, giữa hai khối, dưới khối cuối); xa ranh giới → null. */
export function boundaryAt(rects: Array<{ top: number; bottom: number }>, y: number, zone = ZONE): { index: number; y: number } | null {
  for (let i = 0; i <= rects.length; i++) {
    const edge = i === 0 ? rects[0]?.top : i === rects.length ? rects[i - 1].bottom : (rects[i - 1].bottom + rects[i].top) / 2;
    if (edge !== undefined && Math.abs(y - edge) <= zone) return { index: i, y: edge };
  }
  return null;
}

/**
 * Nút "+ Thêm section" (như Elementor): rê chuột tới ranh giới giữa hai section cấp trên cùng của tài liệu đang soạn → hiện nút giữa khung;
 * bấm mở popover chèn tại đúng chỗ đó (tab Khối / Mẫu).
 */
export function SectionAdder() {
  const { ui, store, labels } = useEditor();
  useUiTick();
  const [spot, setSpot] = useState<{ index: number; x: number; y: number; left: number } | null>(null);
  const doc = ui.canvasDoc;
  useEffect(() => {
    if (!doc) return;
    const move = (e: MouseEvent) => {
      if (ui.drag || ui.zoomOut || ui.inserter) return setSpot(null);
      const docId = store.activeDocId;
      const d = store.getState().docs[docId];
      if (!d || d.mode !== "default" || !d.blocks.length) return setSpot(null);
      const rects = d.blocks.map((b) => ui.blockRect(b.id)).filter((r): r is DOMRect => !!r);
      const f = ui.canvasFrame?.getBoundingClientRect();
      if (!f || rects.length !== d.blocks.length) return setSpot(null);
      const scale = f.width / (ui.canvasFrame!.offsetWidth || f.width) || 1;
      const y = f.top + e.clientY * scale;
      const hit = boundaryAt(rects, y);
      setSpot(hit ? { index: hit.index, y: hit.y, x: f.left + f.width / 2, left: f.left } : null);
    };
    // Không ẩn khi chuột rời khung soạn: nút nằm ở trang ngoài, rời khung để bấm nút là chuyện bình thường
    const leave = () => setSpot(null);
    doc.addEventListener("mousemove", move);
    doc.addEventListener("scroll", leave);
    return () => { doc.removeEventListener("mousemove", move); doc.removeEventListener("scroll", leave); };
  }, [doc, ui, store]);
  if (!spot || ui.drag || ui.inserter) return null;
  return (
    <button type="button" className="ecx-section-adder" style={{ top: Math.round(spot.y - 14), left: Math.round(spot.x - 14) }} aria-label={labels.addSection} title={labels.addSection}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        ui.openInserter({ mode: "between", docId: store.activeDocId, parentId: null, index: spot.index, rect: { left: Math.max(spot.left + 8, spot.x - 160), top: spot.y, bottom: spot.y + 14 } });
        setSpot(null);
      }}>
      <Plus className="ecx-icon" />
    </button>
  );
}
