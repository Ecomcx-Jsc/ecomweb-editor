import { useEffect, useState, type ReactNode } from "react";
import { useEditor } from "../context";
import { docFromBlocks, type BNode } from "../core/model";
import type { BlockEditProps } from "../core/registry";
import { sanitizeServerHtml } from "./server-html";
import { useMsgs } from "../i18n";

const MEDIA = "img, svg, video, canvas, picture, iframe, input, select, textarea, button, hr";
/** Có chữ hoặc ảnh / hình / ô nhập nào thấy được không (khung rỗng thì không). */
function hasVisibleContent(html: string): boolean {
  const box = document.createElement("div");
  box.innerHTML = html;
  return box.textContent!.trim().length > 0 || box.querySelector(MEDIA) !== null;
}

// Kết quả vẽ của website theo (khối, thuộc tính, nội dung): mở lại template / gõ ở khối khác không phải hỏi lại website
const cache = new Map<string, string | null>();
const CACHE_LIMIT = 300;

/**
 * Khối động / khối của theme-plugin do **website** vẽ bằng chính code + CSS của theme (host.renderBlock) — khung soạn thấy
 * đúng menu riêng, breadcrumb thật… như trang thật. Đang tải hoặc website không vẽ được → giao diện của trình soạn (`fallback`).
 */
export function ServerBlock({ node, blockProps, fallback, live = true }: { node: BNode; blockProps: BlockEditProps["blockProps"]; fallback: ReactNode; live?: boolean }) {
  const { host } = useEditor();
  const tp = useMsgs("placeholders");
  const json = docFromBlocks([node]).content?.[0];
  const key = JSON.stringify(json ?? null);
  const [html, setHtml] = useState<string | null | undefined>(() => cache.get(key));
  useEffect(() => {
    if (cache.has(key)) { setHtml(cache.get(key)); return; }
    let alive = true;
    // Chờ ngừng sửa thuộc tính một chút rồi mới hỏi website
    const timer = setTimeout(() => {
      host.renderBlock!(json as never).then((h) => h ?? null, () => null).then((h) => {
        if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
        cache.set(key, h);
        if (alive) setHtml(h);
      });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [key, host]); // eslint-disable-line react-hooks/exhaustive-deps
  // fallback luôn là con đầu của cùng một Fragment ở mọi nhánh dưới → đổi nhánh không dựng lại ô nhập đang gõ
  if (!live || !html) return <>{fallback}</>;
  const clean = sanitizeServerHtml(html, document);
  // Website vẽ ra rỗng (thiếu dữ liệu, theme chưa hỗ trợ khối…) → ô giữ chỗ của trình soạn (nhập được ngay) + nói rõ website chưa vẽ gì
  if (!hasVisibleContent(clean)) return <>{fallback}<p className="ecx-ph-missing is-note" contentEditable={false}>{tp.serverEmpty}</p></>;
  return (
    <div {...blockProps} className={[blockProps.className, "ecx-server-block"].filter(Boolean).join(" ")} contentEditable={false}>
      {/* pointer-events: none → bấm vào là chọn khối, không mở liên kết / gửi form của trang thật */}
      <div className="ecx-server-html" style={{ pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: clean }} />
    </div>
  );
}
