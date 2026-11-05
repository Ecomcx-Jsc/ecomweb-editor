import assert from "node:assert/strict";
import { test } from "node:test";
import { availableLocales, format, messages, normalizeLang, registerLocale } from "../src/i18n";
import { en } from "../src/locales/en";
import { vi } from "../src/locales/vi";
import { labelsLegacy } from "../src/shared/labels";
import { labelsV2 } from "../src/v2/labels";

const keysOf = (o: Record<string, unknown>) => Object.keys(o).sort();
const placeholders = (v: unknown) => (typeof v === "string" ? [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",") : "");

test("vi và en có cùng nhóm, cùng khoá và cùng chỗ thay {tên}", () => {
  assert.deepEqual(keysOf(vi), keysOf(en));
  for (const ns of Object.keys(vi) as Array<keyof typeof vi>) {
    const a = vi[ns] as Record<string, unknown>, b = en[ns] as Record<string, unknown>;
    assert.deepEqual(keysOf(a), keysOf(b), `nhóm ${ns}`);
    for (const k of Object.keys(a)) {
      assert.equal(typeof a[k], typeof b[k], `${ns}.${k}`);
      assert.equal(placeholders(a[k]), placeholders(b[k]), `${ns}.${k}: {chỗ thay} khác nhau`);
      if (typeof a[k] === "object") assert.deepEqual(keysOf(a[k] as never), keysOf(b[k] as never), `${ns}.${k}`);
    }
  }
});

test("ngôn ngữ có sẵn: vi và en đã đăng ký, không cần import gì thêm", () => {
  assert.ok(availableLocales().includes("vi") && availableLocales().includes("en"));
  assert.equal(labelsV2("vi").lang, "vi");
  assert.equal(labelsV2("en").editor, en.v2.editor);
  assert.equal(labelsLegacy("vi").heading, vi.legacy.heading);
});

test("ngôn ngữ mới: dịch dở một nhóm, khoá thiếu rơi về tiếng Anh; không cần sửa mã", () => {
  registerLocale("ja", { v2: { editor: "コンテンツエディター" }, motion: { title: "モーション" } });
  const l = labelsV2("ja");
  assert.equal(l.editor, "コンテンツエディター");
  assert.equal(l.addBlock, en.v2.addBlock); // chưa dịch → tiếng Anh
  assert.equal(l.lang, "ja");
  assert.equal(messages("motion", "ja").title, "モーション");
  assert.equal(messages("motion", "ja").scroll, en.motion.scroll);
});

test("mã vùng rơi về ngôn ngữ gốc rồi tiếng Anh; viết hoa / gạch dưới được chuẩn hoá", () => {
  registerLocale("pt", { v2: { editor: "Editor de conteúdo", addBlock: "Adicionar bloco" } });
  registerLocale("pt-br", { v2: { addBlock: "Adicionar bloco (BR)" } });
  assert.equal(messages("v2", "pt-BR").addBlock, "Adicionar bloco (BR)");
  assert.equal(messages("v2", "pt_BR").editor, "Editor de conteúdo"); // từ "pt"
  assert.equal(messages("v2", "pt-PT").editor, "Editor de conteúdo");
  assert.equal(normalizeLang("EN_us"), "en-us");
  assert.equal(normalizeLang(undefined), "vi");
});

test("nhóm con (dropHint) gộp theo từng khoá; đăng ký lần hai bổ sung chứ không xoá", () => {
  registerLocale("de", { v2: { dropHint: { image: "Bild hierher ziehen." } } });
  const hint = messages("v2", "de").dropHint as Record<string, string>;
  assert.equal(hint.image, "Bild hierher ziehen.");
  assert.equal(hint.video, (en.v2.dropHint as Record<string, string>).video);
  registerLocale("de", { v2: { editor: "Inhaltseditor" } });
  assert.equal((messages("v2", "de").dropHint as Record<string, string>).image, "Bild hierher ziehen.");
  assert.equal(messages("v2", "de").editor, "Inhaltseditor");
});

test("format thay {tên}; thiếu biến thì giữ nguyên", () => {
  assert.equal(format("Bộ sưu tập · {n} ảnh", { n: 3 }), "Bộ sưu tập · 3 ảnh");
  assert.equal(format("{a} và {b}", { a: "x" }), "x và {b}");
  assert.equal(format("không biến"), "không biến");
});
