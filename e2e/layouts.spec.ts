import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { open } from "./helpers";

/**
 * Danh mục bố cục trang web thường gặp, dựng bằng các khối có sẵn rồi kiểm ở 3 khổ (máy tính / tablet / điện thoại):
 * không khối nào báo lỗi, không tràn ngang, cột xếp chồng trên điện thoại. Ảnh chụp ra thư mục tạm khi đặt ECX_LAYOUT_SHOTS=<thư mục>.
 */
type B = Record<string, unknown>;
let n = 0;
const id = () => `L${++n}`;
const T = (t: string) => [{ type: "text", text: t }];
const p = (t: string, attrs: B = {}): B => ({ id: id(), type: "paragraph", attrs, inline: T(t) });
const h = (t: string, level = 2, attrs: B = {}): B => ({ id: id(), type: "heading", attrs: { level, ...attrs }, inline: T(t) });
const btn = (text: string, variant = "primary"): B => ({ id: id(), type: "button", attrs: { text, variant, href: "#" } });
const btns = (items: B[], attrs: B = {}): B => ({ id: id(), type: "buttons", attrs, content: items });
const grp = (kids: B[], attrs: B = {}): B => ({ id: id(), type: "group", attrs, content: kids });
const col = (kids: B[], width?: number): B => ({ id: id(), type: "column", attrs: width ? { width } : {}, content: kids });
const cols = (cs: B[], attrs: B = {}): B => ({ id: id(), type: "columns", attrs, content: cs });
const wid = (type: string, attrs: B): B => ({ id: id(), type, attrs });
const bg = (c: string, extra: B = {}) => ({ color: { background: c }, ...extra });
const grid = (c: number, gap = "md"): B => ({ layout: { type: "grid", columns: { base: c, tablet: Math.min(c, 2), mobile: 1 } }, gap: { base: gap } });
const row = (gap = "md"): B => ({ layout: { type: "flex", direction: { base: "row" } }, gap: { base: gap } });
const details = (summary: string, body: string): B => ({ id: id(), type: "details", attrs: { summary }, content: [p(body)] });
const cell = (t: string, header = false): B => ({ id: id(), type: header ? "tableHeader" : "tableCell", attrs: {}, content: [p(t)] });
const tr = (cells: B[]): B => ({ id: id(), type: "tableRow", attrs: {}, content: cells });
const LOREM = "Nội dung mẫu để thử bố cục: đủ dài để xuống dòng khi cột hẹp và để thấy khoảng cách giữa các khối.";
const feature = (icon: string, title: string): B => wid("iconBox", { icon, title, text: LOREM });
const card = (kids: B[], extra: B = {}): B => grp(kids, { padding: "medium", style: { color: { background: "muted/10" }, radius: "12px", border: { width: "1px", style: "solid", color: "muted/30" }, ...extra } });

const LAYOUTS: Array<{ name: string; build: () => B[]; stackSel?: string }> = [
  { name: "hero-giua", build: () => [grp([h("Xây website nhanh hơn", 1, { textAlign: "center" }), p(LOREM, { textAlign: "center" }), btns([btn("Bắt đầu ngay"), btn("Xem demo", "outline")], { align: "center" })], { padding: "large", align: "full", style: bg("primary/15") })] },
  { name: "hero-chia-doi", build: () => [cols([col([h("Tiêu đề lớn bên trái", 1), p(LOREM), btns([btn("Dùng thử")])]), col([wid("imageBox", { title: "Ảnh minh hoạ", text: LOREM })])], { verticalAlign: "center" })], stackSel: ".ecx-columns" },
  { name: "hero-anh-nen", build: () => [{ id: id(), type: "cover", attrs: { overlay: "primary", opacity: 60, minHeight: "360px", align: "full" }, content: [h("Hero ảnh nền", 1, { textAlign: "center" }), p(LOREM, { textAlign: "center" }), btns([btn("Liên hệ")], { align: "center" })] }] },
  { name: "tinh-nang-3-cot", build: () => [h("Tính năng nổi bật", 2, { textAlign: "center" }), cols([col([feature("star", "Nhanh")]), col([feature("heart", "Dễ dùng")]), col([feature("check", "An toàn")])])], stackSel: ".ecx-columns" },
  { name: "tinh-nang-luoi-6", build: () => [grp(["star", "heart", "check", "phone", "mail", "clock"].map((i) => feature(i, "Tính năng " + i)), { style: grid(3) })] },
  { name: "so-le-anh-chu", build: () => [cols([col([wid("image", { src: "/sample.svg", alt: "a" })]), col([h("Ảnh bên trái", 2), p(LOREM)])], { verticalAlign: "center" }), cols([col([h("Ảnh bên phải", 2), p(LOREM)]), col([wid("image", { src: "/sample.svg", alt: "b" })])], { verticalAlign: "center" })] },
  { name: "dai-so-lieu", build: () => [grp([1200, 350, 98, 15].map((e, i) => wid("counter", { end: e, title: ["Khách hàng", "Dự án", "Hài lòng %", "Năm"][i], textAlign: "center" })), { padding: "large", style: { ...bg("primary/10"), ...grid(4) } })] },
  { name: "bang-gia-3-cot", build: () => [cols(["Cơ bản", "Chuyên nghiệp", "Doanh nghiệp"].map((t, i) => col([card([h(t, 3, { textAlign: "center" }), h(["199k", "499k", "999k"][i], 2, { textAlign: "center" }), wid("iconList", { items: [{ text: "Tính năng một" }, { text: "Tính năng hai" }, { text: "Hỗ trợ 24/7" }] }), btns([btn("Chọn gói", i === 1 ? "primary" : "outline")], { align: "center" })])])), { verticalAlign: "stretch" })], stackSel: ".ecx-columns" },
  { name: "loi-chung-thuc-3", build: () => [cols([1, 2, 3].map((i) => col([wid("testimonial", { quote: LOREM, name: "Khách hàng " + i, role: "Giám đốc", rating: 5 })])))], stackSel: ".ecx-columns" },
  { name: "hoi-dap-faq", build: () => [h("Câu hỏi thường gặp", 2, { textAlign: "center" }), { id: id(), type: "accordion", attrs: { columns: 1 }, content: [details("Làm sao để bắt đầu?", LOREM), details("Giá thế nào?", LOREM), details("Có hỗ trợ không?", LOREM)] }] },
  { name: "faq-2-cot", build: () => [{ id: id(), type: "accordion", attrs: { columns: 2 }, content: [1, 2, 3, 4].map((i) => details("Câu hỏi " + i, LOREM)) }] },
  { name: "tabs-noi-dung", build: () => [{ id: id(), type: "tabs", attrs: {}, content: ["Giới thiệu", "Tính năng", "Giá"].map((t) => ({ id: id(), type: "tab", attrs: { title: t }, content: [p(LOREM)] })) }] },
  { name: "dai-logo-doi-tac", build: () => [h("Đối tác", 3, { textAlign: "center" }), grp([1, 2, 3, 4, 5, 6].map((i) => wid("imageBox", { title: "Logo " + i })), { style: grid(6) })] },
  { name: "thu-vien-anh", build: () => [wid("gallery", { columns: 3, images: [] })] },
  { name: "cta-keu-goi", build: () => [grp([h("Sẵn sàng bắt đầu?", 2, { textAlign: "center" }), p(LOREM, { textAlign: "center" }), btns([btn("Đăng ký miễn phí")], { align: "center" })], { padding: "large", align: "full", style: bg("accent/20") })] },
  { name: "lien-he-60-40", build: () => [cols([col([h("Gửi tin nhắn", 2), wid("form", {})], 60), col([h("Thông tin", 3), p("Địa chỉ: 1 Đường ABC"), p("Điện thoại: 0123 456 789"), wid("map", { address: "Hà Nội", height: 240 })], 40)])], stackSel: ".ecx-columns" },
  { name: "doi-ngu-4", build: () => [grp([1, 2, 3, 4].map((i) => wid("iconBox", { media: "image", title: "Thành viên " + i, text: "Chức danh", textAlign: "center" })), { style: grid(4) })] },
  { name: "the-bai-viet-3", build: () => [cols([1, 2, 3].map((i) => col([wid("imageBox", { title: "Bài viết " + i, text: LOREM })])))], stackSel: ".ecx-columns" },
  { name: "co-sidebar-70-30", build: () => [cols([col([h("Nội dung chính", 2), p(LOREM), p(LOREM), p(LOREM)], 70), col([card([h("Thanh bên", 3), p("Danh mục"), p("Bài mới")])], 30)])], stackSel: ".ecx-columns" },
  { name: "quy-trinh-4-buoc", build: () => [grp([1, 2, 3, 4].map((i) => wid("iconBox", { media: "number", number: String(i), title: "Bước " + i, text: LOREM, textAlign: "center" })), { style: grid(4) })] },
  { name: "chan-trang-4-cot", build: () => [grp([cols([col([h("Công ty", 4), p("Giới thiệu"), p("Tuyển dụng")]), col([h("Sản phẩm", 4), p("Tính năng"), p("Bảng giá")]), col([h("Hỗ trợ", 4), p("Hướng dẫn"), p("Liên hệ")]), col([h("Theo dõi", 4), p("Facebook"), p("Zalo")])]), p("© 2026 Công ty. Bảo lưu mọi quyền.", { textAlign: "center" })], { padding: "large", align: "full", style: bg("muted/20") })], stackSel: ".ecx-columns" },
  { name: "dang-ky-nhan-tin", build: () => [grp([h("Nhận tin mới", 2, { textAlign: "center" }), p("Đăng ký để không bỏ lỡ.", { textAlign: "center" }), wid("form", { submitText: "Đăng ký" })], { padding: "large", style: bg("primary/10") })] },
  { name: "bang-so-sanh", build: () => [{ id: id(), type: "table", attrs: {}, content: [tr(["Tính năng", "Gói A", "Gói B", "Gói C"].map((t) => cell(t, true))), ...[1, 2, 3].map((i) => tr(["Mục " + i, "✓", "✓", "—"].map((t) => cell(t))))] }] },
  { name: "video-va-chu", build: () => [cols([col([wid("video", { src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })]), col([h("Xem giới thiệu", 2), p(LOREM), btns([btn("Tìm hiểu thêm")])])], { verticalAlign: "center" })], stackSel: ".ecx-columns" },
  { name: "cac-section-mau-xen-ke", build: () => ["primary/15", "accent/15", "muted/20"].map((c, i) => grp([h("Section " + (i + 1), 2, { textAlign: "center" }), p(LOREM, { textAlign: "center" })], { padding: "large", align: "full", style: bg(c) })) },
  { name: "the-cao-bang-nhau", build: () => [cols([1, 2, 3].map((i) => col([card([h("Thẻ " + i, 3), p(LOREM.repeat(i)), btns([btn("Chi tiết", "outline")])])])), { verticalAlign: "stretch" })], stackSel: ".ecx-columns" },
  { name: "bai-viet-2-cot-chu", build: () => [cols([col([h("Cột chữ trái", 3), p(LOREM.repeat(3))]), col([h("Cột chữ phải", 3), p(LOREM.repeat(3))])])], stackSel: ".ecx-columns" },
  { name: "sidebar-dinh-khi-cuon", build: () => [cols([col([h("Bài dài", 2), p(LOREM.repeat(4)), p(LOREM.repeat(4))], 70), col([card([h("Mục lục", 3), p("Mục một"), p("Mục hai")], { position: { type: "sticky", top: "1rem" } })], 30)], { verticalAlign: "top" })], stackSel: ".ecx-columns" },
  { name: "section-co-duong-chia", build: () => [grp([h("Section có sóng", 2, { textAlign: "center" }), p(LOREM, { textAlign: "center" })], { padding: "large", align: "full", style: { ...bg("primary/20"), divider: { bottom: { shape: "wave", color: "white", height: 80 } } } }), grp([h("Section vát", 2, { textAlign: "center" }), p(LOREM, { textAlign: "center" })], { padding: "large", align: "full", style: { ...bg("accent/20"), divider: { top: { shape: "tilt", color: "primary/20" }, bottom: { shape: "curve", color: "white" } } } })] },
  { name: "cot-25-50-25", build: () => [cols([col([p("Cột trái hẹp")], 25), col([h("Cột giữa rộng", 3), p(LOREM)], 50), col([p("Cột phải hẹp")], 25)])], stackSel: ".ecx-columns" },
  { name: "cot-40-20-20-20", build: () => [cols([col([h("Chính", 3), p(LOREM)], 40), col([p("Phụ 1")], 20), col([p("Phụ 2")], 20), col([p("Phụ 3")], 20)])], stackSel: ".ecx-columns" },
  { name: "carousel-the", build: () => [{ id: id(), type: "carousel", attrs: { slidesPerView: 2 }, content: [1, 2, 3].map((i) => grp([h("Thẻ " + i, 3), p(LOREM)], { padding: "medium", style: bg("muted/10") })) }] },
  { name: "banner-tieu-de-trang", build: () => [grp([wid("breadcrumbs", {}), h("Tên trang", 1)], { padding: "medium", align: "full", style: bg("muted/15") })] },
];

const DEVICES: Array<[string, string, number]> = [["Máy tính", "d", 0], ["Máy tính bảng", "t", 0], ["Điện thoại", "m", 0]];

async function load(page: Page, blocks: B[]) {
  await page.evaluate((nodes) => {
    const st = (window as any).__ecx.store;
    const old = st.getState().docs.root.blocks.map((b: { id: string }) => b.id);
    st.insert("root", null, 0, nodes, { focus: false });
    st.remove(old);
    st.select([]);
  }, blocks);
}

for (const lay of LAYOUTS) {
  test(`bố cục: ${lay.name} — không lỗi khối, không tràn ngang ở 3 khổ, cột xếp chồng trên điện thoại`, async ({ page }) => {
    const c = await open(page, "?doc=post");
    await load(page, lay.build());
    await expect(c.locator(".ecx-block-error")).toHaveCount(0);
    // Xuất nội dung đã lưu của bố cục thành fixture hợp đồng (ECX_DUMP_LAYOUTS=<thư mục>): content / máy chủ / SDK cùng kiểm
    if (process.env.ECX_DUMP_LAYOUTS) {
      const input = await page.evaluate(() => (window as any).__ecx.content());
      writeFileSync(`${process.env.ECX_DUMP_LAYOUTS}/layout-${lay.name}.json`, JSON.stringify({ name: `layout-${lay.name}`, note: "Bố cục trang thường gặp (dựng bằng trình soạn): chuẩn hoá không làm mất thuộc tính nào", input }, null, 2));
    }
    const shots = process.env.ECX_LAYOUT_SHOTS;
    for (const [label, key] of DEVICES) {
      await page.getByRole("button", { name: label, exact: true }).first().click();
      await page.waitForTimeout(150);
      const over = await c.locator("body").evaluate((b) => { const d = b.ownerDocument.scrollingElement!; return d.scrollWidth - d.clientWidth; });
      expect(over, `tràn ngang ${over}px ở khổ ${label}`).toBeLessThanOrEqual(1);
      if (key === "m" && lay.stackSel) {
        // Điện thoại: các cột xếp chồng — không cột nào hẹp hơn nửa bề rộng khung
        const ok = await c.locator(lay.stackSel).first().evaluate((el) => {
          const w = el.ownerDocument.documentElement.clientWidth;
          return [...el.children].filter((k) => (k as HTMLElement).dataset.type === "column").every((k) => k.getBoundingClientRect().width > w * 0.5);
        });
        expect(ok, "cột không xếp chồng trên điện thoại").toBe(true);
      }
      if (shots) await c.locator(".ecx-canvas-root").screenshot({ path: `${shots}/${lay.name}-${key}.png` });
    }
  });
}
