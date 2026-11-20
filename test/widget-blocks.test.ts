import assert from "node:assert/strict";
import { test } from "node:test";
import { CORE_NODES, WIDGET_BLOCKS } from "@ecomcx/ecomweb-content";
import { coreBlockTypes } from "../src/v2/blocks";
import { labelsV2 } from "../src/v2/labels";

test("widget lõi có trong thư viện khối: tên theo ngôn ngữ, mô tả, thuộc tính theo schema, khối mới tạo hợp lệ", () => {
  for (const lang of ["vi", "en"]) {
    const types = coreBlockTypes(labelsV2(lang));
    for (const name of WIDGET_BLOCKS) {
      const t = types.find((x) => x.name === name);
      assert.ok(t, name);
      assert.ok(t.title && t.description, `${lang} ${name}`);
      assert.equal(t.category, "widgets");
      for (const k of Object.keys(CORE_NODES[name].attrs!)) assert.ok(t.attributes?.[k], `${name}.${k}`);
      const b = t.create!();
      assert.equal(b.type, name);
    }
  }
  assert.equal(coreBlockTypes(labelsV2("vi")).find((x) => x.name === "counter")!.title, "Count Up");
});

test("ô Kiểu dáng lõi có trong thuộc tính khối (danh mục AI) nhưng ẩn khỏi form Cài đặt; khối chưa khai attributes giữ mô tả CORE_NODES", () => {
  const types = Object.fromEntries(coreBlockTypes(labelsV2("vi")).map((t) => [t.name, t]));
  assert.deepEqual(types.bulletList.attributes?.listMarker?.control, "hidden");
  assert.ok(types.bulletList.attributes?.listMarker?.enum?.includes("check"));
  assert.equal(types.button.attributes?.buttonBg?.type, "string");
  assert.equal(types.image.attributes?.imageOpacity?.max, 1);
  assert.equal(types.tabs.attributes?.align?.control, "hidden");
  // Thuộc tính sẵn có của khối không đổi
  assert.equal(types.heading.attributes?.level?.control, undefined);
  assert.equal(types.spacer.attributes?.textShadow, undefined);
});

test("soạn bài / trang thường: Danh sách bài, Tìm kiếm, Icon chèn được; khối giao diện khác chỉ có ở Trình dựng", async () => {
  const { BlockTypeRegistry } = await import("../src/v2/core/registry");
  const { registerCoreBlocks } = await import("../src/v2/blocks");
  const r = new BlockTypeRegistry();
  registerCoreBlocks(r, labelsV2("vi"));
  const hidden = (n: string) => r.all().find((t) => t.name === n)?.hidden === true;
  for (const n of ["query", "search", "icon", "postTitle"]) assert.equal(hidden(n), false, n);
  for (const n of ["featuredImage", "postExcerpt", "readMore", "pagination"]) assert.equal(hidden(n), false, n);
  const hiddenCount = (reg: { all(): { hidden?: boolean }[] }) => reg.all().filter((t) => t.hidden).length;
  const d = new BlockTypeRegistry();
  registerCoreBlocks(d, labelsV2("vi"), { dynamic: true });
  assert.ok(hiddenCount(r) > hiddenCount(d), "Trình dựng (dynamic) hiện thêm khối giao diện so với soạn bài thường");
});
