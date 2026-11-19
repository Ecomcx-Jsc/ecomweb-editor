/** Command palette (⌘⇧P / Ctrl+Shift+P): quickly find an action, a view, a block to insert, or jump to a block on the page. */
export const palette: typeof import("../vi/palette").palette = {
  title: "Command palette", placeholder: "Type a command, a block to insert or text on the page…", empty: "No matching command", hint: "↑ ↓ choose · Enter run · Esc close",
  groupActions: "Actions", groupView: "View", groupInsert: "Insert block", groupGoto: "Go to block",
  save: "Save", undo: "Undo", redo: "Redo", selectParent: "Select parent block", duplicate: "Duplicate selected block", remove: "Delete selected block", moveUp: "Move block up", moveDown: "Move block down", copyStyle: "Copy selected block style", pasteStyle: "Paste style onto selected block",
  desktop: "Preview desktop", tablet: "Preview tablet", mobile: "Preview phone", listView: "Toggle block list", settings: "Toggle settings panel", inserter: "Open block inserter", zoomOut: "Zoom out to rearrange", library: "Open pattern library",
  insert: "Insert", goto: "Go to",
};
