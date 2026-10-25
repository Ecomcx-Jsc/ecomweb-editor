import { Component, type ReactNode } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";

/**
 * Bọc phần nổi của trình soạn (tay kéo, thanh khối, menu chọn chữ…): lỗi khi vẽ chỉ ẩn phần đó, không làm sập trình soạn
 * hay cả trang chứa nó; giao dịch kế tiếp của trình soạn thì vẽ lại.
 */
export class OverlayBoundary extends Component<{ editor: TiptapEditor; name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.warn(`[editor] ${this.props.name}:`, error);
    const reset = () => { this.props.editor.off("transaction", reset); this.setState({ failed: false }); };
    this.props.editor.on("transaction", reset);
  }
  render() { return this.state.failed ? null : this.props.children; }
}
