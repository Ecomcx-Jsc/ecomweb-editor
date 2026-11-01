import type { Editor as TiptapEditor } from "@tiptap/core";
import { patternNodes, type Pattern } from "../shared/patterns";

/** Chèn mẫu dưới khối đang chọn (dòng trống đang có con trỏ → thay dòng đó). */
export function insertPattern(editor: TiptapEditor, p: Pattern) {
  const nodes = p.synced && p.ref ? [{ type: "syncedPattern", attrs: { ref: p.ref } }] : patternNodes(p);
  if (!nodes.length) return false;
  const { $from, empty } = editor.state.selection;
  if (empty && $from.depth > 0 && $from.parent.type.name === "paragraph" && $from.parent.content.size === 0)
    return editor.chain().focus().insertContentAt({ from: $from.before(), to: $from.after() }, nodes).run();
  const after = $from.depth > 0 ? $from.after(1) : editor.state.doc.content.size;
  return editor.chain().focus().insertContentAt(after, nodes).run();
}
