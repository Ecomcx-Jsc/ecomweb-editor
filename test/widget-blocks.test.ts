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
  assert.equal(coreBlockTypes(labelsV2("vi")).find((x) => x.name === "counter")!.title, "Bộ đếm số");
});
