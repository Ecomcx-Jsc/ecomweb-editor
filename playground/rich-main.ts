import { AllSelection, TextSelection } from "prosemirror-state";
import { RichController, commandMap, insertAudio, insertFile, insertHr, insertImage, insertVideo, insertTable, linkAt, setBlock, setLink, setMarkAttr, richSchema, type BlockKind } from "../src/rich";

/**
 * Trang thử bộ điều khiển trình soạn HTML (không giao diện) cho test E2E: `window.__rich` cho test gọi lệnh và đọc kết quả.
 * `?value=<html>`, `?readonly=1`, `?placeholder=…`.
 */
const q = new URLSearchParams(location.search);
const out = document.getElementById("out")!;
const changes: string[] = [];
let linkShortcut = 0, updates = 0;
const ctl = new RichController(document.getElementById("host")!, {
  value: q.get("value") ?? "", placeholder: q.get("placeholder") ?? "", readOnly: q.get("readonly") === "1", ariaLabel: "Soạn thử",
  onChange: (h) => { changes.push(h); out.textContent = h; },
  onUpdate: () => { updates++; },
  onLinkShortcut: () => { linkShortcut++; },
});
const run = (cmd: (s: typeof ctl.state, d: typeof ctl.view.dispatch) => boolean) => cmd(ctl.state, ctl.view.dispatch);
(window as unknown as { __rich: unknown }).__rich = {
  html: () => ctl.html(), changes: () => changes, linkShortcuts: () => linkShortcut, updates: () => updates, stats: () => ctl.stats(),
  sync: (v: string) => ctl.sync(v), setHtml: (h: string) => ctl.setHtml(h), editable: () => ctl.view.editable,
  run: (id: string) => run(commandMap[id].run), enabled: (id: string) => commandMap[id].enabled?.(ctl.state) ?? true, active: (id: string) => !!commandMap[id].active?.(ctl.state),
  block: (k: BlockKind) => run(setBlock(k)), table: () => run(insertTable(3, 3)), hr: () => run(insertHr), image: (src: string, alt: string) => run(insertImage(src, alt)),
  video: (src: string, poster?: string) => run(insertVideo(src, poster)), audio: (src: string) => run(insertAudio(src)), file: (src: string, name: string) => run(insertFile(src, name)),
  link: (href: string, target: string | null) => run(setLink(href, target)), hasLink: () => !!linkAt(ctl.state),
  color: (mark: "textColor" | "highlight", c: string | null) => run(setMarkAttr(richSchema.marks[mark], c)),
  selectAll: () => ctl.view.dispatch(ctl.state.tr.setSelection(new AllSelection(ctl.state.doc))),
  caretToEnd: () => ctl.view.dispatch(ctl.state.tr.setSelection(TextSelection.atEnd(ctl.state.doc))),
  setPlaceholder: (t: string) => ctl.update({ placeholder: t }), setReadOnly: (r: boolean) => ctl.update({ readOnly: r }),
};
out.textContent = ctl.html();
