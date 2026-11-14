import assert from "node:assert/strict";
import { test } from "node:test";
import { coreBlockTypes } from "../src/v2/blocks";
import { placeholderFields } from "../src/v2/blocks/compat";
import { labelsV2 } from "../src/v2/labels";

test("cột chia đều không ghi width (để CSS chia đều); 33/66, 66/33 giữ % thật", () => {
  const cols = coreBlockTypes(labelsV2("vi")).find((t) => t.name === "columns")!;
  for (const v of cols.variations ?? []) {
    const widths = v.create!().content!.map((c) => c.attrs.width);
    if (v.name === "33-66") assert.deepEqual(widths, [33, 67]);
    else if (v.name === "66-33") assert.deepEqual(widths, [67, 33]);
    else assert.ok(widths.every((w) => w === undefined), v.name);
  }
  assert.ok(cols.create!().content!.every((c) => c.attrs.width === undefined));
});

test("ô giữ chỗ tự sinh cho khối plugin: lấy ô media/chữ/url, bỏ thuộc tính kỹ thuật; placeholder ghi đè được", () => {
  const attributes = { image: { type: "object", control: "media" }, title: { type: "string" }, url: { type: "string", control: "url" }, align: { type: "string", enum: ["l", "r"] }, className: { type: "string" } } as never;
  const auto = placeholderFields({ attributes });
  assert.deepEqual(auto.fields, ["image", "title", "url"]);
  assert.deepEqual(auto.required, []);
  const custom = placeholderFields({ attributes, placeholder: { fields: ["title", "nope"], required: ["title"] } });
  assert.deepEqual(custom, { fields: ["title"], required: ["title"] });
});
