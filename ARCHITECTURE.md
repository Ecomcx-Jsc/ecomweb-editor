# Kiến trúc @ecomcx/ecomweb-editor

## Thư mục

```
src/
  index.ts        Điểm vào 1.x (`@ecomcx/ecomweb-editor`)
  legacy/         Trình soạn 1.x dựa trên TipTap (chỉ sửa lỗi, không thêm tính năng)
  i18n/           Đa ngôn ngữ: registerLocale, messages, msgs, format (không phụ thuộc React)
  locales/        Chữ giao diện theo ngôn ngữ: vi/, en/ — mỗi nhóm chữ một file
  shared/         Dùng chung 1.x + v2, không phụ thuộc TipTap hay v2: đăng ký khối/panel/mẫu của plugin, bảng kiểu dáng, nhãn
  v2/             Trình soạn cây khối (`@ecomcx/ecomweb-editor/v2`)
    core/         Dữ liệu + thao tác thuần: model, ops, structure, store, tables, clipboard, bindings, patterns, host (kiểu)
    text/         Ô gõ chữ (mỗi khối chữ một ProseMirror nhỏ): rich-schema, rich-text, paste
    canvas/       Khung soạn iframe: canvas, block-list, dnd, canvas-css
    ui/           Giao diện quanh khung soạn: toolbar, inserter, inspector, attr-form, list-view, options, các panel
    blocks/       Giao diện từng loại khối lõi + khối plugin 1.x (compat)
    context.tsx   prefs.ts   labels.ts   i18n.ts      Nền chung cho mọi tầng (i18n.ts: hook useMsgs)
    editor.tsx    index.ts                  Ghép mọi thứ (EditorProvider, BlockEditor)
```

## Nguyên tắc

1. **Phụ thuộc một chiều.** Tầng thấp không biết tầng cao: `core → text → canvas → ui → blocks → editor`.
   Tầng trên cần gì ở tầng dưới thì import; tầng dưới cần hành vi của tầng trên thì nhận qua tham số / host / registry.
   `import type` được phép đi ngược chiều (trừ `core` không được dùng React, ProseMirror, lucide, TipTap).
2. **`core` không có giao diện.** Test được bằng Node (không trình duyệt). Mọi thay đổi tài liệu đi qua `EditorStore` (lịch sử hoàn tác, khoá khối).
3. **Định dạng lưu là của `@ecomcx/ecomweb-content`.** Trình soạn không tự đặt định dạng; thuộc tính mới phải có trong content (TS + C#) trước.
4. **Ứng dụng nói chuyện với trình soạn qua `EditorHost`** (media, tài liệu lồng, dữ liệu động, truy vấn bài, CSS website…). Trình soạn không gọi API của CMS.
5. **Plugin mở rộng qua registry** (khối, panel, mẫu, nguồn gắn dữ liệu), không sửa mã lõi.
6. **Chữ hiển thị nằm trong `src/locales/<mã>/`, không trong mã** — đọc qua `labels` (v2 / legacy), `useMsgs("nhóm")` (React) hoặc `msgs("nhóm", lang)` (ngoài React); không so sánh `lang === "vi"`. Thêm chữ = thêm vào cả `vi/` và `en/`. Thông báo cho lập trình viên (lỗi console, script) bằng tiếng Anh.

## Quy ước

- Tên file **kebab-case** (`block-list.tsx`, `rich-schema.ts`); component / kiểu PascalCase bên trong file.
- Một file một trách nhiệm; file vượt ~400 dòng hoặc chứa nhiều component độc lập thì tách.
- Phụ thuộc gói khác bằng dải semver; `@ecomcx/ecomweb-content` là **peerDependency** (ứng dụng và trình soạn dùng chung một bản).
  Link cục bộ (`file:`) chỉ được nằm trong `devDependencies`.

## Kiểm tra tự động

- `npm test` chạy `scripts/check-layers.mjs` (tên file + chiều phụ thuộc) rồi unit test.
- `npm publish` chạy `scripts/check-publish.mjs` (chặn phụ thuộc đường dẫn cục bộ).
- `npm run e2e`: Playwright trên Chromium, Firefox, WebKit với playground.
