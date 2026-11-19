import { blockBgVideo } from "@ecomcx/ecomweb-content";

/** Xem trước video nền (style.background.video) của Section / Row / Column ngay trong khung soạn — cùng thẻ và class với website. */
export function BgVideoPreview({ style }: { style: unknown }) {
  const src = blockBgVideo(style);
  return src ? <video className="ecx-bg-video" src={src} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} contentEditable={false} data-ecx-ui /> : null;
}
