import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeContent } from "@ecomcx/ecomweb-content";
import { blocksFromDoc, docFromBlocks, inlineLength, makeBlock, type BNode } from "../src/v2/model";
import { flatten } from "../src/v2/ops";
import { fixTree } from "../src/v2/structure";
import { EditorStore } from "../src/v2/store";

/**
 * Fuzz tầng lõi: chuỗi thao tác ngẫu nhiên (có hạt giống — lỗi nào cũng tái hiện được bằng FUZZ_SEED) trên store, sau mỗi bước:
 * cây luôn hợp lệ theo luật cấu trúc, định danh không trùng, không mất chữ ngoài ý muốn; cuối chuỗi: hoàn tác hết về đúng bản đầu,
 * làm lại hết về đúng bản cuối, lưu → đọc lại → lưu cho cùng một kết quả.
 */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000; };
}
const P = (t: string) => makeBlock("paragraph", {}, t);
const li = (t: string) => makeBlock("listItem", {}, [P(t)]);
function seedDoc(): BNode[] {
  return [
    makeBlock("heading", { level: 2 }, "Tiêu đề"), P("Một hai ba"), makeBlock("bulletList", {}, [li("a"), li("bb"), li("ccc")]),
    makeBlock("group", {}, [P("trong nhóm"), P("x")]), makeBlock("columns", {}, [makeBlock("column", {}, [P("trái")]), makeBlock("column", {}, [P("phải")])]),
    makeBlock("blockquote", {}, [P("trích")]), makeBlock("image", { src: "https://x/a.png" }), P(""), makeBlock("codeBlock", {}, "a\nb"),
  ];
}
const shape = (blocks: BNode[]) => JSON.stringify(docFromBlocks(blocks));

function invariants(s: EditorStore, where: string) {
  const blocks = s.getState().docs.root.blocks;
  assert.equal(fixTree(blocks), blocks, `${where}: cây không hợp lệ theo luật cấu trúc`);
  const ids = flatten(blocks).map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, `${where}: trùng định danh khối`);
  for (const b of flatten(blocks)) {
    assert.ok(!(b.inline && b.content), `${where}: khối vừa có chữ vừa có khối con`);
    for (const n of b.inline ?? []) assert.ok(n.type !== "text" || (n.text ?? "").length > 0, `${where}: text rỗng trong ${b.type}`);
  }
  const sel = s.getState().selection;
  for (const id of sel.ids) assert.ok(s.locate(id), `${where}: vùng chọn trỏ tới khối không còn`);
}

function step(s: EditorStore, r: () => number): string {
  const blocks = s.getState().docs.root.blocks;
  const all = flatten(blocks);
  const texts = all.filter((b) => b.inline);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const t = texts.length ? pick(texts) : null;
  const any = all.length ? pick(all) : null;
  const op = Math.floor(r() * 16);
  switch (op) {
    case 0: case 1: if (t) { const len = inlineLength(t.inline); const at = Math.floor(r() * (len + 1)); s.splitText(t.id, at, Math.min(len, at + (r() < 0.2 ? 2 : 0))); return `split ${t.type}@${at}`; } break;
    case 2: if (t) { s.mergeBackward(t.id); return `mergeBackward ${t.type}`; } break;
    case 3: if (t) { s.mergeForward(t.id); return `mergeForward ${t.type}`; } break;
    case 4: if (t) { s.setInline(t.id, [{ type: "text", text: `x${Math.floor(r() * 99)}` }, ...(r() < 0.3 ? [{ type: "hardBreak" }] : []), { type: "text", text: "y", marks: r() < 0.5 ? [{ type: "bold" }] : undefined }]); return "type"; } break;
    case 5: if (any) { s.remove([any.id]); return `remove ${any.type}`; } break;
    case 6: if (any) { s.duplicate([any.id]); return `duplicate ${any.type}`; } break;
    case 7: if (any) { s.moveBy([any.id], r() < 0.5 ? -1 : 1); return `move ${any.type}`; } break;
    case 8: if (any) { s.insertAfter(any.id, [r() < 0.5 ? P("mới") : makeBlock("horizontalRule")]); return `insertAfter ${any.type}`; } break;
    case 9: { const top = blocks.length ? pick(blocks) : null; if (top) { s.wrap([top.id], "group"); return "wrap"; } break; }
    case 10: { const g = all.find((b) => b.type === "group"); if (g) { s.unwrap(g.id); return "unwrap"; } break; }
    case 11: { const item = all.filter((b) => b.type === "listItem"); if (item.length) { const i = pick(item); s.indentItem(i.id); return "indent"; } break; }
    case 12: { const item = all.filter((b) => b.type === "listItem"); if (item.length) { const i = pick(item); s.outdentItem(i.id, r() < 0.5); return "outdent"; } break; }
    case 13: if (any && blocks.length) { const target = pick(blocks); s.moveTo([any.id], "root", null, Math.floor(r() * (blocks.length + 1))); void target; return `moveTo ${any.type}`; } break;
    case 14: if (t) { s.setType([t.id], r() < 0.5 ? "heading" : "paragraph", { level: 3 }); return "setType"; } break;
    case 15: if (any) { s.setAttrs([any.id], { className: r() < 0.5 ? "a" : undefined }); return "setAttrs"; } break;
  }
  return "noop";
}

const SEEDS = Number(process.env.FUZZ_RUNS ?? 400);
const BASE = Number(process.env.FUZZ_SEED ?? 1);

test(`fuzz: ${SEEDS} chuỗi × 60 thao tác ngẫu nhiên giữ cây hợp lệ; hoàn tác / làm lại / lưu-đọc lại đúng`, () => {
  for (let k = 0; k < SEEDS; k++) {
    const seed = BASE + k;
    const r = rng(seed);
    const s = new EditorStore({ blocks: seedDoc() });
    const initial = shape(s.getState().docs.root.blocks);
    const log: string[] = [];
    try {
      for (let i = 0; i < 60; i++) {
        log.push(step(s, r));
        // Thỉnh thoảng hoàn tác giữa chừng rồi làm tiếp (nhánh lịch sử mới)
        if (r() < 0.08) { s.undo(); log.push("undo"); }
        invariants(s, `bước ${i}`);
      }
      // Trạng thái đỉnh lịch sử: làm lại hết phần còn trong ngăn "làm lại" (bước cuối có thể là hoàn tác)
      let guard = 0;
      while (s.canRedo && guard++ < 1000) s.redo();
      invariants(s, "đỉnh lịch sử");
      const final = shape(s.getState().docs.root.blocks);
      while (s.canUndo && guard++ < 2000) s.undo();
      assert.equal(shape(s.getState().docs.root.blocks), initial, "hoàn tác hết không về bản đầu");
      while (s.canRedo && guard++ < 3000) s.redo();
      assert.equal(shape(s.getState().docs.root.blocks), final, "làm lại hết không về bản cuối");
      // Lưu → chuẩn hoá như máy chủ → đọc lại → lưu: ổn định
      const saved = docFromBlocks(s.getState().docs.root.blocks);
      const normalized = normalizeContent({ version: 1, blocks: [{ type: "richtext", data: saved }] }).doc.blocks[0]?.data;
      const again = docFromBlocks(blocksFromDoc(normalized as never));
      assert.equal(JSON.stringify(docFromBlocks(blocksFromDoc(again))), JSON.stringify(again), "lưu-đọc lại không ổn định");
    } catch (e) {
      throw new Error(`FUZZ_SEED=${seed} hỏng sau: ${log.slice(-8).join(" → ")}\n${(e as Error).message}`);
    }
  }
});

