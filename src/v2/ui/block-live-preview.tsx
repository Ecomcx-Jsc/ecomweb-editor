import { CONTENT_VERSION } from "@ecomcx/ecomweb-content";
import { useEffect, useMemo, useState } from "react";
import { useEditor } from "../context";
import { docFromBlocks, type BNode } from "../core/model";

/**
 * Xem trước thật của khối khi rê chuột ở bảng chèn: vẽ đúng khối mẫu sẽ được chèn bằng khung soạn chỉ xem (giống thư viện mẫu),
 * nên đồng hồ chạy, thẻ, tab… hiện y như sau khi chèn. Đợi một nhịp để rê qua nhanh không dựng khung.
 */
export function LiveBlockPreview({ id, create }: { id: string; create(): BNode }) {
  const { ui } = useEditor();
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(false); const t = setTimeout(() => setOn(true), 160); return () => clearTimeout(t); }, [id]);
  const value = useMemo(() => { try { return { version: CONTENT_VERSION, blocks: [{ type: "richtext", data: docFromBlocks([create()]) }] }; } catch { return null; } }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ui.renderPreview || !value) return null;
  return (
    <div className="ecx-block-preview-live" aria-hidden="true">
      {on && <div className="ecx-block-preview-live-inner ecx-lib-preview-inner" style={{ width: 440, transform: `scale(${288 / 440})`, marginTop: -28, height: 190 / (288 / 440) + 28 }}>{ui.renderPreview(value)}</div>}
    </div>
  );
}
