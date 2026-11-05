import { useSyncExternalStore } from "react";
import { localesVersion, msgs, onLocalesChange } from "../i18n";
import type { vi } from "../locales/vi";
import { useEditor } from "./context";

/**
 * Chữ của một nhóm theo ngôn ngữ của trình soạn (`labels.lang`): `const t = useMsgs("motion"); t.title`.
 * Tự vẽ lại khi có ngôn ngữ / bản dịch mới được đăng ký lúc đang chạy (registerLocale).
 */
export function useMsgs<K extends keyof typeof vi>(ns: K): (typeof vi)[K] {
  const { labels } = useEditor();
  useSyncExternalStore(onLocalesChange, localesVersion, localesVersion);
  return msgs(ns, labels.lang);
}
