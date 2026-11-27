import { baseKeymap, chainCommands, toggleMark } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { history, redo, undo } from "prosemirror-history";
import { inputRules, textblockTypeInputRule, wrappingInputRule } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { liftListItem, sinkListItem, splitListItem } from "prosemirror-schema-list";
import { EditorState, Plugin } from "prosemirror-state";
import { columnResizing, goToNextCell, tableEditing } from "prosemirror-tables";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { isEmptyDoc, parseHtml, toHtml } from "./html";
import { richSchema as S } from "./schema";

export interface RichControllerOptions {
  /** HTML ban đầu. */
  value: string;
  /** Mỗi khi tài liệu đổi (do người dùng gõ / thao tác), kèm HTML mới. */
  onChange(html: string): void;
  /** Sau mỗi giao dịch (đổi vùng chọn, đổi tài liệu): giao diện vẽ lại thanh công cụ. */
  onUpdate?(): void;
  /** ⌘K / Ctrl+K trong vùng soạn: giao diện mở hộp liên kết. */
  onLinkShortcut?(): void;
  placeholder?: string;
  readOnly?: boolean;
  ariaLabel?: string;
}

const hardBreak = (state: EditorState, dispatch?: (tr: ReturnType<EditorState["tr"]["scrollIntoView"]>) => void) => {
  if (dispatch) dispatch(state.tr.replaceSelectionWith(S.nodes.hard_break.create()).scrollIntoView());
  return true;
};

/**
 * Bộ điều khiển ProseMirror của trình soạn HTML — KHÔNG có giao diện (React, thanh công cụ do ứng dụng chủ dựng bằng bộ UI của nó).
 * Giữ ba việc dễ sai: gõ nhanh kiểu Markdown, phím tắt, và đồng bộ giá trị từ ngoài mà không mất con trỏ.
 */
export class RichController {
  readonly view: EditorView;
  private last: string;
  // HTML đã phát ra mà phần cha chưa trả lại qua `sync`. React có thể vẽ muộn với giá trị cũ khi gõ nhanh: giá trị đó không phải
  // thay đổi từ ngoài, nạp lại tài liệu sẽ làm mất con trỏ.
  private inflight: string[] = [];
  private placeholder: string;
  private opts: RichControllerOptions;

  constructor(host: HTMLElement, opts: RichControllerOptions) {
    this.opts = opts;
    this.last = opts.value;
    this.placeholder = opts.placeholder ?? "";
    this.view = new EditorView(host, {
      state: this.create(opts.value),
      editable: () => !this.opts.readOnly,
      attributes: { role: "textbox", "aria-multiline": "true", ...(opts.ariaLabel ? { "aria-label": opts.ariaLabel } : {}), class: "rte-content" },
      dispatchTransaction: (tr) => {
        const next = this.view.state.apply(tr);
        this.view.updateState(next);
        if (tr.docChanged) this.emit(toHtml(next.doc));
        this.opts.onUpdate?.();
      },
    });
  }

  get state(): EditorState { return this.view.state; }
  html(): string { return toHtml(this.view.state.doc); }

  /** Cập nhật hàm gọi lại / thuộc tính khi ứng dụng chủ vẽ lại (không dựng lại trình soạn). */
  update(patch: Partial<Pick<RichControllerOptions, "onChange" | "onUpdate" | "onLinkShortcut" | "readOnly" | "ariaLabel">> & { placeholder?: string }): void {
    const { placeholder, ...rest } = patch;
    const editableChanged = rest.readOnly !== undefined && rest.readOnly !== this.opts.readOnly;
    this.opts = { ...this.opts, ...rest };
    if (rest.ariaLabel !== undefined) this.view.dom.setAttribute("aria-label", rest.ariaLabel);
    if (editableChanged) this.view.setProps({ editable: () => !this.opts.readOnly });
    if (placeholder !== undefined && placeholder !== this.placeholder) { this.placeholder = placeholder; this.view.dispatch(this.view.state.tr.setMeta("rte-placeholder", true)); }
  }

  /**
   * Giá trị `value` mới từ phần cha. Trả `true` nếu là thay đổi từ ngoài và đã nạp vào tài liệu (con trỏ về đầu);
   * `false` nếu chính là (hoặc là bản cũ về muộn của) giá trị trình soạn vừa phát ra.
   */
  sync(value: string): boolean {
    if (value === this.last) { this.inflight = []; return false; }
    const at = this.inflight.indexOf(value);
    if (at >= 0) { this.inflight = this.inflight.slice(at + 1); return false; }
    this.inflight = [];
    this.last = value;
    this.view.updateState(this.create(value));
    this.opts.onUpdate?.();
    return true;
  }

  /** Thay cả tài liệu bằng HTML người dùng vừa sửa (chế độ mã HTML) và báo `onChange`. */
  setHtml(html: string): void {
    this.view.updateState(this.create(html));
    this.emit(this.html());
    this.opts.onUpdate?.();
  }

  stats(): { words: number; chars: number } {
    const doc = this.view.state.doc;
    const text = doc.textBetween(0, doc.content.size, " ");
    const t = text.trim();
    return { words: t ? t.split(/\s+/).length : 0, chars: text.replace(/\s/g, "").length };
  }

  focus(): void { this.view.focus(); }
  destroy(): void { this.view.destroy(); }

  private emit(html: string) {
    this.last = html;
    this.inflight = [...this.inflight.slice(-49), html];
    this.opts.onChange(html);
  }

  private create(html: string): EditorState {
    return EditorState.create({ schema: S, doc: parseHtml(html), plugins: this.plugins() });
  }

  private plugins(): Plugin[] {
    const li = S.nodes.list_item;
    return [
      history(),
      inputRules({
        rules: [
          textblockTypeInputRule(/^(#{1,6})\s$/, S.nodes.heading, (m) => ({ level: m[1].length })),
          wrappingInputRule(/^\s*([-+*])\s$/, S.nodes.bullet_list),
          wrappingInputRule(/^(\d+)\.\s$/, S.nodes.ordered_list, (m) => ({ order: +m[1] }), (m, node) => node.childCount + node.attrs.order === +m[1]),
          wrappingInputRule(/^\s*>\s$/, S.nodes.blockquote),
          textblockTypeInputRule(/^```$/, S.nodes.code_block),
        ],
      }),
      keymap({
        "Mod-z": undo, "Mod-y": redo, "Shift-Mod-z": redo,
        "Mod-b": toggleMark(S.marks.strong), "Mod-i": toggleMark(S.marks.em), "Mod-u": toggleMark(S.marks.underline),
        Enter: splitListItem(li),
        Tab: chainCommands(sinkListItem(li), goToNextCell(1)), "Shift-Tab": chainCommands(liftListItem(li), goToNextCell(-1)),
        "Shift-Enter": hardBreak,
        "Mod-k": () => { this.opts.onLinkShortcut?.(); return !!this.opts.onLinkShortcut; },
      }),
      keymap(baseKeymap),
      dropCursor(), gapCursor(), columnResizing(), tableEditing(),
      new Plugin({
        props: {
          decorations: (state) => {
            if (!this.placeholder || !isEmptyDoc(state.doc)) return null;
            return DecorationSet.create(state.doc, [Decoration.node(0, state.doc.firstChild!.nodeSize, { class: "rte-empty", "data-placeholder": this.placeholder })]);
          },
        },
      }),
    ];
  }
}
