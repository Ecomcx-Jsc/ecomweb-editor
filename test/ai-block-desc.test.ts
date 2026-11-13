import assert from "node:assert/strict";
import { test } from "node:test";
import { CORE_NODES } from "@ecomcx/ecomweb-content";
import { blockDescription } from "../src/v2/ui/block-descriptions";

// Không phải khối người soạn / AI chọn: gốc tài liệu, chữ, xuống dòng, định dạng chữ (mark).
const NOT_BLOCKS = new Set(["doc", "text", "hardBreak", "bold", "italic", "underline", "strike", "code", "highlight", "textStyle", "link", "subscript", "superscript"]);

// Giữ AI đồng bộ (docs/plan-editor-elementor.md mục 6): khối lõi mới phải có mô tả — trợ lý dựng giao diện nhận nó trong danh mục khối.
test("mọi khối lõi trong CORE_NODES có mô tả (vi + en)", () => {
  for (const lang of ["vi", "en"]) {
    const missing = Object.keys(CORE_NODES).filter((n) => !NOT_BLOCKS.has(n) && !blockDescription(n, lang));
    assert.deepEqual(missing, [], `thiếu mô tả ${lang} (src/locales/${lang}/block-desc.ts)`);
  }
});
