import { expect, test, type Page } from "@playwright/test";

/** Bộ điều khiển trình soạn HTML (không giao diện): lược đồ, lọc, lệnh, gõ nhanh, đồng bộ giá trị. Giao diện được kiểm ở admin CMS. */
type Rich = { html(): string; changes(): string[]; linkShortcuts(): number; stats(): { words: number; chars: number }; sync(v: string): boolean; setHtml(h: string): void; editable(): boolean;
  video(s: string, p?: string): boolean; audio(s: string): boolean; file(s: string, n: string): boolean; run(id: string): boolean; enabled(id: string): boolean; active(id: string): boolean; block(k: string): boolean; table(): boolean; hr(): boolean; image(s: string, a: string): boolean;
  link(h: string, t: string | null): boolean; hasLink(): boolean; color(m: string, c: string | null): boolean; selectAll(): void; caretToEnd(): void; setPlaceholder(t: string): void; setReadOnly(r: boolean): void };
const r = <T,>(page: Page, f: (r: Rich, a: any) => T, arg?: unknown) => page.evaluate(([src, a]) => (new Function("r", "a", `return (${src})(r, a)`))((window as unknown as { __rich: Rich }).__rich, a), [f.toString(), arg] as [string, unknown]);
const html = (page: Page) => r(page, (x) => x.html());
const open = async (page: Page, qs = "") => { await page.goto(`/rich.html${qs}`); await page.locator(".rte-content").waitFor(); };
const typeSlow = (page: Page, text: string) => page.keyboard.type(text, { delay: 15 });
const focusEnd = async (page: Page) => { await page.locator(".rte-content").click(); await page.keyboard.press("Control+End"); };

test("nạp HTML, gõ, ghi lại; HTML rỗng → chuỗi rỗng", async ({ page }) => {
  await open(page, "?value=<p>Xin <strong>chào</strong></p>");
  expect(await html(page)).toBe("<p>Xin <strong>chào</strong></p>");
  await focusEnd(page); await typeSlow(page, "!");
  expect(await html(page)).toBe("<p>Xin <strong>chào!</strong></p>");   // dấu đậm kéo dài sang chữ gõ tiếp (đúng hành vi của mọi trình soạn)
  await open(page, "?value=");
  expect(await html(page)).toBe("");
});

test("lọc khi nạp: script, on*, javascript:, url() trong style, màu lạ, data: bị bỏ; thẻ cho phép còn nguyên", async ({ page }) => {
  await open(page, '?value=<p onclick="x()">a<script>alert(1)</script><a href="javascript:alert(1)">l</a><img src="x" onerror="alert(1)"><img src="data:text/html;base64,AAAA"><iframe src="https://e"></iframe></p><p><span style="color:url(javascript:1)">b</span><span style="color:red;position:fixed">c</span></p><table><tbody><tr><th colspan="2">h</th></tr></tbody></table>');
  const h = await html(page);
  for (const bad of ["script", "onclick", "javascript:", "onerror", "data:", "iframe", "url(", "position"]) expect(h).not.toContain(bad);
  expect(h).toContain("color: red"); expect(h).toContain("<table>"); expect(h).toContain('colspan="2"');
});

test("gõ nhanh kiểu Markdown: tiêu đề, danh sách chấm, danh sách số, trích dẫn", async ({ page }) => {
  await open(page, "?value=");
  await focusEnd(page);
  await typeSlow(page, "# Chào"); expect(await html(page)).toBe("<h1>Chào</h1>");
  await page.keyboard.press("Enter"); await typeSlow(page, "- một"); await page.keyboard.press("Enter"); await typeSlow(page, "hai");
  expect(await html(page)).toBe("<h1>Chào</h1><ul><li><p>một</p></li><li><p>hai</p></li></ul>");
  await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); await typeSlow(page, "1. a"); await page.keyboard.press("Enter"); await typeSlow(page, "b");
  expect(await html(page)).toContain("<ol><li><p>a</p></li><li><p>b</p></li></ol>");
  await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); await typeSlow(page, "> q");
  expect(await html(page)).toContain("<blockquote><p>q</p></blockquote>");
});

test("đồng bộ giá trị: bản cũ của chính mình về muộn bị bỏ qua (giữ con trỏ), giá trị từ ngoài thì nạp", async ({ page }) => {
  await open(page, "?value=");
  await focusEnd(page); await typeSlow(page, "abc");
  const changes = await r(page, (x) => x.changes());
  expect(changes.length).toBeGreaterThanOrEqual(3);
  const older = changes[changes.length - 2];
  expect(await r(page, (x, a) => x.sync(a), older)).toBe(false);   // React trả bản cũ muộn
  expect(await html(page)).toBe("<p>abc</p>");
  expect(await r(page, (x) => x.sync("<p>abc</p>"))).toBe(false);                   // trả đúng bản mới nhất
  expect(await r(page, (x) => x.sync("<h2>Từ ngoài</h2>"))).toBe(true);             // thay đổi thật từ phần cha
  expect(await html(page)).toBe("<h2>Từ ngoài</h2>");
});

test("lệnh định dạng: đậm / nghiêng / gạch chân, kiểu đoạn, căn lề, danh sách; phím tắt ⌘B", async ({ page }) => {
  await open(page, "?value=<p>abc</p>");
  await r(page, (x) => x.selectAll());
  await r(page, (x) => x.run("bold")); expect(await html(page)).toBe("<p><strong>abc</strong></p>");
  expect(await r(page, (x) => x.active("bold"))).toBe(true);
  await r(page, (x) => x.run("bold")); await r(page, (x) => x.run("italic")); await r(page, (x) => x.run("underline"));
  expect(await html(page)).toBe("<p><em><u>abc</u></em></p>");
  await r(page, (x) => x.run("clear")); expect(await html(page)).toBe("<p>abc</p>");
  await r(page, (x) => x.block("h3")); await r(page, (x) => x.run("alignCenter"));
  expect(await html(page)).toBe('<h3 style="text-align: center;">abc</h3>');
  await r(page, (x) => x.block("paragraph")); await r(page, (x) => x.run("bulletList")); expect(await html(page)).toContain("<ul><li>");
  await r(page, (x) => x.run("orderedList")); expect(await html(page)).toContain("<ol>");
  await page.locator(".rte-content").click(); await page.keyboard.press("ControlOrMeta+a"); await page.keyboard.press("ControlOrMeta+b");
  expect(await html(page)).toContain("<strong>");
});

test("liên kết: thêm, mở tab mới, gỡ trên vùng chọn nhiều khối; ⌘K báo giao diện; địa chỉ nguy hiểm không thành liên kết", async ({ page }) => {
  await open(page, "?value=<p>xin chào</p><p>hai</p>");
  await r(page, (x) => x.selectAll());
  await r(page, (x) => x.link("https://example.com/a", "_blank"));
  expect(await html(page)).toBe('<p><a href="https://example.com/a" target="_blank" rel="noopener noreferrer">xin chào</a></p><p><a href="https://example.com/a" target="_blank" rel="noopener noreferrer">hai</a></p>');
  expect(await r(page, (x) => x.hasLink())).toBe(true);
  await r(page, (x) => x.run("unlink")); expect(await html(page)).toBe("<p>xin chào</p><p>hai</p>");
  await page.locator(".rte-content").click(); await page.keyboard.press("ControlOrMeta+k");
  expect(await r(page, (x) => x.linkShortcuts())).toBe(1);
  await r(page, (x) => x.selectAll());
  expect(await r(page, (x) => x.link("javascript:alert(1)", null))).toBe(false);
  expect(await html(page)).not.toContain("javascript:");
});

test("màu chữ / màu nền chỉ nhận màu hợp lệ; bảng: chèn, thêm hàng / cột, xoá; ảnh; đường kẻ", async ({ page }) => {
  await open(page, "?value=<p>màu</p>");
  await r(page, (x) => x.selectAll());
  expect(await r(page, (x) => x.color("textColor", "#e53935"))).toBe(true);
  expect(await html(page)).toBe('<p><span style="color: rgb(229, 57, 53);">màu</span></p>');
  expect(await r(page, (x) => x.color("textColor", "url(javascript:1)"))).toBe(false);
  await r(page, (x) => x.color("textColor", null)); expect(await html(page)).toBe("<p>màu</p>");
  await r(page, (x) => x.color("highlight", "#fff3a3")); expect(await html(page)).toContain("<mark");
  await open(page, "?value=<p>a</p>");
  await r(page, (x) => x.caretToEnd()); await r(page, (x) => x.table());
  expect((await html(page)).match(/<tr>/g)?.length).toBe(3);
  await r(page, (x) => x.run("rowAfter")); await r(page, (x) => x.run("colAfter"));
  expect((await html(page)).match(/<tr>/g)?.length).toBe(4);
  expect((await html(page)).match(/<td>/g)?.length).toBe(16);
  await r(page, (x) => x.run("tableDelete")); expect(await html(page)).not.toContain("<table");
  await r(page, (x) => x.hr()); await r(page, (x) => x.caretToEnd()); await r(page, (x) => x.image("https://example.com/a.png", "Ảnh"));
  expect(await html(page)).toContain("<hr>"); expect(await html(page)).toContain('<img src="https://example.com/a.png" alt="Ảnh">');
  expect(await r(page, (x) => x.image("javascript:alert(1)", "x"))).toBe(false);
  expect(await html(page)).not.toContain("javascript:");
});

test("chế độ mã: setHtml lọc rồi phát thay đổi; chỉ đọc; placeholder; thống kê từ", async ({ page }) => {
  await open(page, "?value=<p>x</p>&placeholder=Nhập…");
  await r(page, (x) => x.setHtml('<h2>Từ mã</h2><p onclick="x()">ok</p><script>1</script>'));
  expect(await html(page)).toBe("<h2>Từ mã</h2><p>ok</p>");
  expect((await r(page, (x) => x.changes())).pop()).toBe("<h2>Từ mã</h2><p>ok</p>");
  expect(await r(page, (x) => x.stats())).toEqual({ words: 3, chars: 6 });
  await r(page, (x) => x.setHtml("")); await expect(page.locator(".rte-empty")).toHaveAttribute("data-placeholder", "Nhập…");
  await r(page, (x) => x.setPlaceholder("Mới")); await expect(page.locator(".rte-empty")).toHaveAttribute("data-placeholder", "Mới");
  await open(page, "?value=<p>x</p>&readonly=1");
  expect(await r(page, (x) => x.editable())).toBe(false);
  await r(page, (x) => x.setReadOnly(false)); expect(await r(page, (x) => x.editable())).toBe(true);
});

test("video, âm thanh, tệp tải xuống: chèn từ địa chỉ media, lọc khi nạp, từ chối địa chỉ nguy hiểm", async ({ page }) => {
  await open(page, "?value=<p>a</p>");
  await r(page, (x) => x.caretToEnd());
  expect(await r(page, (x) => x.video("https://x.com/v.mp4", "https://x.com/p.jpg"))).toBe(true);
  expect(await html(page)).toContain('<video src="https://x.com/v.mp4" controls="" preload="metadata" poster="https://x.com/p.jpg"></video>');
  expect(await r(page, (x) => x.audio("/uploads/a.mp3"))).toBe(true);
  expect(await html(page)).toContain('<audio src="/uploads/a.mp3" controls="" preload="metadata"></audio>');
  await r(page, (x) => x.caretToEnd());
  expect(await r(page, (x) => x.file("/uploads/bang-gia.pdf", "Bảng giá.pdf"))).toBe(true);
  expect(await html(page)).toContain('<a href="/uploads/bang-gia.pdf" download="">Bảng giá.pdf</a>');
  for (const bad of ["javascript:alert(1)", "data:video/mp4;base64,AAAA"]) {
    expect(await r(page, (x, a) => x.video(a), bad)).toBe(false); expect(await r(page, (x, a) => x.audio(a), bad)).toBe(false); expect(await r(page, (x, a) => x.file(a, "x"), bad)).toBe(false);
  }
  // nạp lại HTML có sẵn: giữ nguyên; thuộc tính nguy hiểm bị bỏ
  await r(page, (x) => x.setHtml('<video src="https://x.com/v.mp4" controls onerror="x()" poster="javascript:1"><source src="https://e/s.mp4"></video><audio src="javascript:1"></audio><p><a href="/f.zip" download>f</a></p>'));
  const h = await html(page);
  expect(h).toContain('<video src="https://x.com/v.mp4"'); expect(h).toContain('<a href="/f.zip" download="">f</a>');
  for (const bad of ["onerror", "javascript:", "<audio", "<source"]) expect(h).not.toContain(bad);
});
