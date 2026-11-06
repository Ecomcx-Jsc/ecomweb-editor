import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { normalizeContent } from "@ecomcx/ecomweb-content";
import { blocksFromDoc, docFromBlocks, inlineText, joinInline, makeBlock, splitInline, type BNode } from "../src/v2/core/model";
import { findBlock, flatten, moveBlocks } from "../src/v2/core/ops";
import { fixTree } from "../src/v2/core/structure";
import { EditorStore } from "../src/v2/core/store";

const P = (text: string, attrs = {}) => makeBlock("paragraph", attrs, text);
const H = (text: string, level = 2) => makeBlock("heading", { level }, text);
const li = (text: string, ...nested: BNode[]) => makeBlock("listItem", {}, [P(text), ...nested]);
const ul = (...items: BNode[]) => makeBlock("bulletList", {}, items);
const texts = (blocks: BNode[]) => flatten(blocks).filter((b) => b.inline).map((b) => inlineText(b.inline));
const shape = (blocks: BNode[]): unknown => blocks.map((b) => (b.inline ? `${b.type}:${inlineText(b.inline)}` : b.content ? { [b.type]: shape(b.content) } : b.type));
const store = (...blocks: BNode[]) => new EditorStore({ blocks });
const root = (s: EditorStore) => s.getState().docs.root.blocks;

// ---------------------------------------------------------------------------
// Định dạng lưu ↔ mô hình
// ---------------------------------------------------------------------------
test("đọc rồi ghi lại mọi fixture của ecomweb-content: không mất dữ liệu", () => {
  const dir = path.resolve("node_modules/@ecomcx/ecomweb-content/fixtures");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length > 5);
  for (const f of files) {
    const fx = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    const { doc } = normalizeContent(fx.input ?? fx);
    for (const blk of doc.blocks) {
      if (blk.type !== "richtext") continue;
      const back = docFromBlocks(blocksFromDoc(blk.data));
      assert.deepEqual(normalizeContent({ version: 1, blocks: [{ type: "richtext", data: back }] }).doc.blocks[0].data, blk.data, f);
    }
  }
});

test("khối lạ của plugin: suy loại từ nội dung, giữ nguyên dữ liệu", () => {
  const doc = { type: "doc", content: [
    { type: "acme/card", attrs: { id: 7 } },
    { type: "acme/note", content: [{ type: "text", text: "hi", marks: [{ type: "bold" }] }] },
    { type: "acme/box", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
  ] };
  const blocks = blocksFromDoc(doc);
  assert.equal(blocks[0].raw, undefined);
  assert.ok(blocks[1].inline);
  assert.ok(blocks[2].content);
  assert.deepEqual(docFromBlocks(blocks), doc);
});

test("cắt / nối chữ giữ định dạng và gộp lại khi cùng định dạng", () => {
  const inline = [{ type: "text", text: "Xin " }, { type: "text", text: "chào", marks: [{ type: "bold" }] }, { type: "hardBreak" }, { type: "text", text: "bạn" }];
  const [a, b] = splitInline(inline, 6);
  assert.deepEqual(a, [{ type: "text", text: "Xin " }, { type: "text", text: "ch", marks: [{ type: "bold" }] }]);
  assert.deepEqual(b, [{ type: "text", text: "ào", marks: [{ type: "bold" }] }, { type: "hardBreak" }, { type: "text", text: "bạn" }]);
  assert.deepEqual(joinInline(a, b), inline);
});

// ---------------------------------------------------------------------------
// Luật cấu trúc
// ---------------------------------------------------------------------------
test("cấu trúc: listItem lạc chỗ được bọc chung một danh sách; column lạc được bọc columns", () => {
  const fixed = fixTree([li("a"), li("b"), P("x"), makeBlock("column", {}, [P("c")])]);
  assert.deepEqual(shape(fixed), [{ bulletList: [{ listItem: ["paragraph:a"] }, { listItem: ["paragraph:b"] }] }, "paragraph:x", { columns: [{ column: ["paragraph:c"] }] }]);
});

test("cấu trúc: đoạn văn trong danh sách được bọc listItem; listItem rỗng có đoạn văn; danh sách rỗng bị bỏ", () => {
  const fixed = fixTree([makeBlock("bulletList", {}, [P("a")]), makeBlock("bulletList", {}, []), makeBlock("orderedList", {}, [makeBlock("listItem", {}, [])])]);
  assert.deepEqual(shape(fixed), [{ bulletList: [{ listItem: ["paragraph:a"] }] }, { orderedList: [{ listItem: ["paragraph:"] }] }]);
});

test("cấu trúc: cây hợp lệ giữ nguyên tham chiếu (React không vẽ lại)", () => {
  const blocks = [P("a"), ul(li("b"))];
  assert.equal(fixTree(blocks), blocks);
});

// ---------------------------------------------------------------------------
// Thao tác thuần
// ---------------------------------------------------------------------------
test("di chuyển: không cho thả vào chính nó; index tính trước khi bỏ khối", () => {
  const g = makeBlock("group", {}, [P("in")]);
  const blocks = [P("a"), g, P("b")];
  assert.equal(moveBlocks(blocks, [g.id], g.id, 0), blocks);
  const moved = moveBlocks(blocks, [blocks[0].id], null, 3);
  assert.deepEqual(texts(moved), ["in", "b", "a"]);
  const into = moveBlocks(blocks, [blocks[2].id], g.id, 0);
  assert.deepEqual(shape(into), ["paragraph:a", { group: ["paragraph:b", "paragraph:in"] }]);
  // Không đụng tới nhánh khác: chia sẻ tham chiếu
  assert.equal(findBlock(moved, g.id)!.block, g);
});

// ---------------------------------------------------------------------------
// Store: gõ chữ, Enter, Backspace, Delete
// ---------------------------------------------------------------------------
test("Enter giữa đoạn: tách hai đoạn, con trỏ đầu đoạn mới; cuối tiêu đề → đoạn văn", () => {
  const s = store(P("Xin chào"), H("Tiêu đề"));
  const [a, h] = root(s);
  s.splitText(a.id, 3);
  assert.deepEqual(shape(root(s)), ["paragraph:Xin", "paragraph: chào", "heading:Tiêu đề"]);
  const created = root(s)[1];
  assert.deepEqual(s.getState().caret, { id: created.id, offset: 0 });
  s.splitText(h.id, 7);
  assert.equal(root(s)[3].type, "paragraph");
  // Tách giữa tiêu đề: phần sau vẫn là tiêu đề cùng cấp
  s.splitText(h.id, 4);
  assert.deepEqual(shape(root(s)).slice(2, 4), ["heading:Tiêu", "heading: đề"]);
  assert.equal(root(s)[3].attrs.level, 2);
});

test("Enter khi có bôi đen: xoá phần bôi đen rồi tách", () => {
  const s = store(P("abcdef"));
  s.splitText(root(s)[0].id, 2, 4);
  assert.deepEqual(texts(root(s)), ["ab", "ef"]);
});

test("Backspace đầu đoạn: nối vào khối chữ trước (kể cả khối chữ cuối trong nhóm), con trỏ ở chỗ nối", () => {
  const s = store(makeBlock("group", {}, [P("trong")]), P("ngoài"));
  const outer = root(s)[1];
  s.mergeBackward(outer.id);
  assert.deepEqual(shape(root(s)), [{ group: ["paragraph:trongngoài"] }]);
  assert.equal(s.getState().caret?.offset, 5);
});

test("Backspace sau ảnh: đoạn trống bị xoá và ảnh được chọn; đoạn có chữ thì chỉ chọn ảnh", () => {
  const img = makeBlock("image", { src: "https://x/a.png" });
  const s = store(img, P(""), P("x"));
  s.mergeBackward(root(s)[1].id);
  assert.deepEqual(shape(root(s)), ["image", "paragraph:x"]);
  assert.deepEqual(s.getState().selection.ids, [img.id]);
  s.mergeBackward(root(s)[1].id);
  assert.deepEqual(shape(root(s)), ["image", "paragraph:x"]);
});

test("Backspace ở tiêu đề trống → đoạn văn", () => {
  const s = store(P("a"), H(""));
  s.mergeBackward(root(s)[1].id);
  assert.equal(root(s)[1].type, "paragraph");
});

test("Delete cuối đoạn: kéo đoạn sau lên nối", () => {
  const s = store(P("ab"), P("cd"));
  s.mergeForward(root(s)[0].id);
  assert.deepEqual(texts(root(s)), ["abcd"]);
  assert.equal(s.getState().caret?.offset, 2);
});

test("Enter trong trích dẫn ở đoạn trống cuối: thoát ra ngoài", () => {
  const s = store(makeBlock("blockquote", {}, [P("q"), P("")]));
  const empty = root(s)[0].content![1];
  s.splitText(empty.id, 0);
  assert.deepEqual(shape(root(s)), [{ blockquote: ["paragraph:q"] }, "paragraph:"]);
});

// ---------------------------------------------------------------------------
// Danh sách
// ---------------------------------------------------------------------------
test("danh sách: Enter tạo mục mới; Enter ở mục trống cuối → thoát thành đoạn văn", () => {
  const s = store(ul(li("một")));
  const para = root(s)[0].content![0].content![0];
  s.splitText(para.id, 3);
  assert.deepEqual(shape(root(s)), [{ bulletList: [{ listItem: ["paragraph:một"] }, { listItem: ["paragraph:"] }] }]);
  const empty = root(s)[0].content![1].content![0];
  s.splitText(empty.id, 0);
  assert.deepEqual(shape(root(s)), [{ bulletList: [{ listItem: ["paragraph:một"] }] }, "paragraph:"]);
});

test("danh sách: Enter ở mục trống giữa danh sách → tách danh sách làm hai", () => {
  const s = store(ul(li("a"), li(""), li("c")));
  const empty = root(s)[0].content![1].content![0];
  s.splitText(empty.id, 0);
  assert.deepEqual(shape(root(s)), [{ bulletList: [{ listItem: ["paragraph:a"] }] }, "paragraph:", { bulletList: [{ listItem: ["paragraph:c"] }] }]);
});

test("danh sách: Tab lồng vào mục trước, Shift+Tab đưa ra", () => {
  const s = store(ul(li("a"), li("b"), li("c")));
  const b = root(s)[0].content![1];
  assert.ok(s.indentItem(b.id));
  assert.deepEqual(shape(root(s)), [{ bulletList: [{ listItem: ["paragraph:a", { bulletList: [{ listItem: ["paragraph:b"] }] }] }, { listItem: ["paragraph:c"] }] }]);
  // Mục đầu không lồng được
  assert.equal(s.indentItem(root(s)[0].content![0].id), false);
  assert.ok(s.outdentItem(b.id));
  assert.deepEqual(shape(root(s)), [{ bulletList: [{ listItem: ["paragraph:a"] }, { listItem: ["paragraph:b"] }, { listItem: ["paragraph:c"] }] }]);
});

test("danh sách: Backspace đầu mục nối vào mục trước, danh sách con đi theo", () => {
  const s = store(ul(li("a"), li("b", ul(li("b1")))));
  const bPara = root(s)[0].content![1].content![0];
  s.mergeBackward(bPara.id);
  assert.deepEqual(shape(root(s)), [{ bulletList: [{ listItem: ["paragraph:ab", { bulletList: [{ listItem: ["paragraph:b1"] }] }] }] }]);
});

test("danh sách: Backspace đầu mục đầu tiên → thành đoạn văn trước danh sách", () => {
  const s = store(ul(li("a"), li("b")));
  s.mergeBackward(root(s)[0].content![0].content![0].id);
  assert.deepEqual(shape(root(s)), ["paragraph:a", { bulletList: [{ listItem: ["paragraph:b"] }] }]);
});

// ---------------------------------------------------------------------------
// Lịch sử
// ---------------------------------------------------------------------------
test("hoàn tác: gõ liên tục gộp một bước; Enter là bước riêng; làm lại được", () => {
  const s = store(P(""));
  const id = root(s)[0].id;
  s.setInline(id, [{ type: "text", text: "a" }]);
  s.setInline(id, [{ type: "text", text: "ab" }]);
  s.splitText(id, 2);
  assert.deepEqual(texts(root(s)), ["ab", ""]);
  s.undo();
  assert.deepEqual(texts(root(s)), ["ab"]);
  s.undo();
  assert.deepEqual(texts(root(s)), [""]);
  assert.equal(s.canUndo, false);
  s.redo(); s.redo();
  assert.deepEqual(texts(root(s)), ["ab", ""]);
});

test("hoàn tác xuyên tài liệu: sửa header và template trong một lần gom", () => {
  const s = store(P("template"));
  s.putDoc({ id: "part:header", kind: "part", blocks: [P("header")] });
  const h = s.getState().docs["part:header"].blocks[0];
  const t = root(s)[0];
  s.batch(() => {
    s.setInline(h.id, [{ type: "text", text: "Header mới" }]);
    s.setInline(t.id, [{ type: "text", text: "Template mới" }]);
  });
  assert.deepEqual(s.dirtyDocs().map((d) => d.id).sort(), ["part:header", "root"]);
  s.undo();
  assert.equal(s.isDirty(), false);
});

test("lưu: đánh dấu bản đã gửi; sửa tiếp trong lúc lưu vẫn là chưa lưu", () => {
  const s = store(P("a"));
  const id = root(s)[0].id;
  s.setInline(id, [{ type: "text", text: "b" }]);
  const sent = root(s);
  s.setInline(id, [{ type: "text", text: "c" }]);
  s.markSaved("root", sent);
  assert.equal(s.isDirty(), true);
  s.markSaved("root");
  assert.equal(s.isDirty(), false);
});

test("tài liệu chỉ xem (disabled): mọi thao tác bị chặn", () => {
  const s = store(P("a"));
  s.setDocMode("root", "disabled");
  s.splitText(root(s)[0].id, 1);
  s.remove([root(s)[0].id]);
  assert.deepEqual(texts(root(s)), ["a"]);
});

// ---------------------------------------------------------------------------
// Khối: nhân bản, xoá, di chuyển, bọc
// ---------------------------------------------------------------------------
test("nhân bản, lên/xuống, bọc nhóm, bỏ vỏ, xoá → con trỏ về khối chữ trước", () => {
  const s = store(P("a"), P("b"), P("c"));
  const [a, b, c] = root(s);
  s.duplicate([b.id]);
  assert.deepEqual(texts(root(s)), ["a", "b", "b", "c"]);
  assert.notEqual(root(s)[2].id, b.id);
  assert.ok(s.moveBy([c.id], -1));
  assert.deepEqual(texts(root(s)), ["a", "b", "c", "b"]);
  assert.equal(s.moveBy([a.id], -1), false);
  s.wrap([a.id, b.id], "group");
  assert.deepEqual(shape(root(s)), [{ group: ["paragraph:a", "paragraph:b"] }, "paragraph:c", "paragraph:b"]);
  s.unwrap(root(s)[0].id);
  assert.deepEqual(texts(root(s)), ["a", "b", "c", "b"]);
  s.remove([c.id]);
  assert.deepEqual(s.getState().caret, { id: b.id, offset: -1 });
});

test("chọn dải bằng Shift: leo lên cùng cấp", () => {
  const g = makeBlock("group", {}, [P("g1"), P("g2")]);
  const s = store(P("a"), g, P("c"));
  const [a, , c] = root(s);
  s.select([g.content![1].id]);
  s.selectRange(c.id);
  assert.deepEqual(s.getState().selection.ids, [g.id, c.id]);
  s.select([a.id]);
  s.selectRange(c.id);
  assert.equal(s.getState().selection.ids.length, 3);
});

test("chèn sau đoạn trống: thay luôn đoạn trống; chèn nhóm sau mục danh sách: leo ra ngoài danh sách", () => {
  const s = store(P(""), ul(li("x")));
  s.insertAfter(root(s)[0].id, [H("Mới")]);
  assert.deepEqual(shape(root(s))[0], "heading:Mới");
  const item = root(s)[1].content![0];
  s.insertAfter(item.id, [makeBlock("group", {}, [P("g")])]);
  assert.deepEqual(shape(root(s)).slice(1), [{ bulletList: [{ listItem: ["paragraph:x"] }] }, { group: ["paragraph:g"] }]);
});

test("kéo thả sang tài liệu khác (template → header) là một bước hoàn tác", () => {
  const s = store(P("a"), P("b"));
  s.putDoc({ id: "part:header", kind: "part", blocks: [P("h")] });
  const b = root(s)[1];
  s.moveTo([b.id], "part:header", null, 1);
  assert.deepEqual(texts(root(s)), ["a"]);
  assert.deepEqual(texts(s.getState().docs["part:header"].blocks), ["h", "b"]);
  s.undo();
  assert.deepEqual(texts(root(s)), ["a", "b"]);
  assert.deepEqual(texts(s.getState().docs["part:header"].blocks), ["h"]);
});

test("đồng bộ khối plugin không đè khối lõi cùng tên (khối 1.x đăng ký qua registerBlock)", async () => {
  const { BlockTypeRegistry } = await import("../src/v2/core/registry");
  const { syncPluginBlocks } = await import("../src/v2/blocks/compat");
  const { registerBlock } = await import("../src/shared/block-defs");
  const { defineBlock } = await import("@ecomcx/ecomweb-content");
  const r = new BlockTypeRegistry();
  const coreEdit = () => null;
  r.register({ name: "templatePart", title: "Lõi", kind: "atom", edit: coreEdit });
  registerBlock(defineBlock({ name: "templatePart", title: "1.x" }), {});
  registerBlock(defineBlock({ name: "acme/x", title: "Acme" }), {});
  const stop = syncPluginBlocks(r);
  assert.equal(r.get("templatePart")!.edit, coreEdit);
  assert.equal(r.get("acme/x")!.title, "Acme");
  registerBlock(defineBlock({ name: "acme/x", title: "Acme 2" }), {});
  assert.equal(r.get("acme/x")!.title, "Acme 2");
  stop();
});

// ---------------------------------------------------------------------------
// Khoá khối
// ---------------------------------------------------------------------------
test("khoá: lock.remove chặn xoá (cả Backspace gộp), lock.move chặn di chuyển / kéo thả", () => {
  const s = store(P("a"), makeBlock("paragraph", { lock: { move: true, remove: true } }, "khoá"), P("c"));
  const [a, locked, c] = root(s);
  s.remove([locked.id]);
  s.moveBy([locked.id], -1);
  s.moveTo([locked.id], "root", null, 3);
  s.mergeBackward(locked.id);
  s.mergeForward(a.id);
  s.wrap([locked.id], "group");
  assert.deepEqual(texts(root(s)), ["a", "khoá", "c"]);
  // Khối không khoá vẫn thao tác bình thường; xoá nhiều khối bỏ qua khối bị khoá
  s.remove([a.id, locked.id]);
  assert.deepEqual(texts(root(s)), ["khoá", "c"]);
  assert.equal(s.canRemove(c.id), true);
});

test("templateLock all: không thêm / xoá / di chuyển khối con; insert: di chuyển được nhưng không thêm / xoá; Enter không tạo khối mới", () => {
  const g = makeBlock("group", { templateLock: "all" }, [P("x"), P("y")]);
  const s = store(g, P("ngoài"));
  const [x, y] = g.content!;
  s.remove([x.id]);
  s.moveBy([y.id], -1);
  s.insert("root", g.id, 0, [P("mới")]);
  s.splitText(x.id, 1);
  s.duplicate([x.id]);
  assert.deepEqual(texts(root(s)), ["x", "y", "ngoài"]);
  // Kéo khối ngoài vào nhóm bị khoá: không được
  s.moveTo([root(s)[1].id], "root", g.id, 0);
  assert.deepEqual(shape(root(s)), [{ group: ["paragraph:x", "paragraph:y"] }, "paragraph:ngoài"]);
  // Gõ chữ vẫn được
  s.setInline(x.id, [{ type: "text", text: "x2" }]);
  assert.equal(texts(root(s))[0], "x2");
  s.setAttrs([g.id], { templateLock: "insert" });
  s.moveBy([y.id], -1);
  assert.deepEqual(texts(root(s)).slice(0, 2), ["y", "x2"]);
  s.remove([y.id]);
  assert.equal(texts(root(s)).length, 3);
});

test("templateLock kế thừa xuống khối lồng; contentOnly: không đổi loại khối", () => {
  const inner = makeBlock("group", {}, [P("sâu")]);
  const s = store(makeBlock("group", { templateLock: "contentOnly" }, [inner]));
  const deep = inner.content![0];
  assert.equal(s.templateLockOf(inner.id), "contentOnly");
  assert.equal(s.isContentOnly(deep.id), true);
  s.setType([deep.id], "heading");
  s.remove([deep.id]);
  assert.deepEqual(shape(root(s)), [{ group: [{ group: ["paragraph:sâu"] }] }]);
  // Khối con tự đặt templateLock "none" → thoát khoá
  s.batch(() => s.setAttrs([inner.id], { templateLock: "none" }));
  assert.equal(s.templateLockOf(inner.id), undefined);
});

test("gắn dữ liệu: attrs.bindings qua lưu → đọc lại còn nguyên; đổi loại khối (đoạn → tiêu đề) giữ bindings", () => {
  const bindings = { content: { source: "core/post", args: { field: "title" } } };
  const blocks = [makeBlock("paragraph", { bindings })];
  const { doc } = normalizeContent({ version: 1, blocks: [{ type: "richtext", data: docFromBlocks(blocks) }] });
  const back = blocksFromDoc(doc.blocks[0].data as never);
  assert.deepEqual(back[0].attrs.bindings, bindings);
  const st = store(...back);
  st.setType([back[0].id], "heading", { level: 2 });
  const h = st.getState().docs.root.blocks[0];
  assert.equal(h.type, "heading");
  assert.deepEqual(h.attrs.bindings, bindings);
});

test("chọn chữ qua nhiều khối: xoá nối phần còn lại, gõ thay thế, khối giữa bị bỏ trọn; hoàn tác một bước", () => {
  const t = (s: string) => [{ type: "text" as const, text: s }];
  const a = makeBlock("paragraph", {}, t("Xin chào bạn")), img = makeBlock("image", { src: "/a.png" }), b = makeBlock("heading", { level: 2 }, t("Tiêu đề hai")), c = makeBlock("paragraph", {}, t("Cuối"));
  const st = store(a, img, b, c);
  st.selectText({ id: b.id, offset: 4 }, { id: a.id, offset: 4 }); // kéo ngược: head trước anchor
  const info = st.rangeInfo()!;
  assert.equal(info.first.id, a.id);
  assert.deepEqual(info.whole, [img.id]);
  assert.deepEqual(st.rangeContent().map((n) => [n.type, n.inline ? inlineText(n.inline) : ""]), [["paragraph", "chào bạn"], ["image", ""], ["heading", "Tiêu"]]);
  assert.ok(st.deleteRange("X"));
  const blocks = st.getState().docs.root.blocks;
  assert.deepEqual(blocks.map((x) => [x.type, x.inline ? inlineText(x.inline) : ""]), [["paragraph", "Xin X đề hai"], ["paragraph", "Cuối"]]);
  assert.deepEqual(st.getState().caret, { id: a.id, offset: 5 });
  assert.equal(st.getState().range, null);
  st.undo();
  assert.equal(st.getState().docs.root.blocks.length, 4);
});

test("chọn chữ qua nhiều khối: vào trong danh sách — mục cuối trống bị bỏ; khối khoá chặn xoá; Shift+mũi tên mở rộng", () => {
  const t = (s: string) => [{ type: "text" as const, text: s }];
  const p = makeBlock("paragraph", {}, t("Mở đầu"));
  const i1 = makeBlock("listItem", {}, [makeBlock("paragraph", {}, t("Một"))]);
  const i2 = makeBlock("listItem", {}, [makeBlock("paragraph", {}, t("Hai"))]);
  const list = makeBlock("bulletList", {}, [i1, i2]);
  const st = store(p, list);
  const two = st.getState().docs.root.blocks[1].content![1].content![0];
  st.selectText({ id: p.id, offset: 3 }, { id: two.id, offset: 3 });
  assert.deepEqual(st.rangeInfo()!.whole, [i1.id]);
  st.deleteRange();
  const after = st.getState().docs.root.blocks;
  assert.equal(inlineText(after[0].inline!), "Mở ");
  assert.equal(after.length, 1, "danh sách trống sau khi bỏ hai mục → bỏ luôn");
  // Khoá
  const q = makeBlock("paragraph", {}, t("A")), locked = makeBlock("paragraph", { lock: { remove: true } }, t("B")), r = makeBlock("paragraph", {}, t("C"));
  const st2 = store(q, locked, r);
  st2.selectText({ id: q.id, offset: 0 }, { id: r.id, offset: 1 });
  assert.equal(st2.deleteRange(), false);
  assert.equal(st2.getState().docs.root.blocks.length, 3);
  // Mở rộng / thu về một khối
  st2.selectText({ id: q.id, offset: 1 }, { id: locked.id, offset: 1 });
  st2.extendRange(1);
  assert.deepEqual(st2.getState().range!.head, { id: r.id, offset: 1 });
  st2.extendRange(-1); st2.extendRange(-1);
  assert.equal(st2.getState().range, null);
  assert.deepEqual(st2.getState().caret, { id: q.id, offset: 0, to: 1 });
  // Chọn khối khác → bỏ dải chữ
  st2.selectText({ id: q.id, offset: 0 }, { id: r.id, offset: 1 });
  st2.select([r.id]);
  assert.equal(st2.getState().range, null);
});

test("bảng: gộp phải / dưới, tách ô, thêm / xoá hàng cột đi qua ô gộp — bảng luôn vuông vức", async () => {
  const { tableContext, mergeCells, splitCell, addRow, deleteColumn, normalizeTable } = await import("../src/v2/core/tables");
  const c = (s: string) => makeBlock("tableCell", {}, [makeBlock("paragraph", {}, [{ type: "text", text: s }])]);
  const table = makeBlock("table", {}, [0, 1, 2].map((r) => makeBlock("tableRow", {}, [0, 1, 2].map((k) => c(`${r}${k}`)))));
  const st = store(table);
  const t = () => st.getState().docs.root.blocks[0];
  const cellText = (x: BNode) => (x.content ?? []).map((p) => inlineText(p.inline ?? [])).join("|");
  const shapeOf = () => t().content!.map((r) => r.content!.map((x) => `${cellText(x)}${x.attrs.colspan ? `c${x.attrs.colspan}` : ""}${x.attrs.rowspan ? `r${x.attrs.rowspan}` : ""}`));
  const ctxAt = (r: number, k: number) => tableContext(st, t().content![r].content![k].content![0].id)!;
  mergeCells(st, ctxAt(0, 0), "right");
  assert.deepEqual(shapeOf(), [["00|01c2", "02"], ["10", "11", "12"], ["20", "21", "22"]]);
  mergeCells(st, ctxAt(0, 0), "down"); // 1 ô cao 1 rộng 2 không gộp được với ô dưới rộng 1
  assert.deepEqual(shapeOf()[1].length, 3);
  mergeCells(st, ctxAt(1, 0), "down");
  assert.deepEqual(shapeOf(), [["00|01c2", "02"], ["10|20r2", "11", "12"], ["21", "22"]]);
  addRow(st, ctxAt(1, 1), true); // chèn giữa ô gộp dọc → ô đó cao thêm
  assert.deepEqual(shapeOf(), [["00|01c2", "02"], ["10|20r3", "11", "12"], ["", ""], ["21", "22"]]);
  deleteColumn(st, ctxAt(0, 1)); // xoá cột 3
  assert.deepEqual(shapeOf(), [["00|01c2"], ["10|20r3", "11"], [""], ["21"]]);
  splitCell(st, ctxAt(1, 0));
  assert.deepEqual(shapeOf(), [["00|01c2"], ["10|20", "11"], ["", ""], ["", "21"]]);
  // Bảng lệch kiểu dữ liệu cũ (rowspan mà không bỏ ô bị che) → lấp đủ ô
  const ragged = makeBlock("table", {}, [makeBlock("tableRow", {}, [makeBlock("tableCell", { rowspan: 2 }, [makeBlock("paragraph")]), c("a")]), makeBlock("tableRow", {}, [c("b"), c("x")])]);
  assert.deepEqual(normalizeTable(ragged).content!.map((r) => r.content!.length), [3, 2]);
  assert.equal(normalizeTable(t()), t(), "bảng đã vuông giữ nguyên tham chiếu");
});
