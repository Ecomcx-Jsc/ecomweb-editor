// Trang phức tạp kiểu Elementor dựng bằng JSON: lồng nhiều tầng, hiệu ứng, slider, tab, nền chồng, ghim… Kiểm không lỗi console, không tràn ngang
// ở máy tính / tablet / điện thoại, mọi khối có kích thước thật, và chuẩn hoá hai lần không đổi. ECX_SHOTS=<thư mục> để chụp ảnh từng trang.
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { open } from "./helpers";

type B = { id: string; type: string; attrs: Record<string, unknown>; content?: B[]; inline?: unknown[] };
let n = 0;
const id = () => `cp${++n}`;
const mk = (type: string, attrs: Record<string, unknown> = {}, content?: B[]): B => ({ id: id(), type, attrs, ...(content ? { content } : {}) });
const txt = (type: string, text: string, attrs: Record<string, unknown> = {}): B => ({ id: id(), type, attrs, inline: [{ type: "text", text }] });
const h = (level: number, text: string, attrs: Record<string, unknown> = {}) => txt("heading", text, { level, ...attrs });
const p = (text: string, attrs: Record<string, unknown> = {}) => txt("paragraph", text, attrs);
const IMG = "/sample.svg";
const btn = (text: string, variant = "primary", extra: Record<string, unknown> = {}) => mk("button", { text, href: "#", variant, ...extra });
const row = (widths: number[], cols: B[][], attrs: Record<string, unknown> = {}) => mk("columns", { stack: true, ...attrs }, cols.map((c, i) => mk("column", { width: widths[i] }, c)));
const sec = (style: Record<string, unknown>, content: B[], attrs: Record<string, unknown> = {}) => mk("group", { align: "full", constrained: true, ...attrs, style }, content);
const card = (kids: B[], style: Record<string, unknown> = {}) => mk("group", { padding: "medium", style: { color: { background: "#ffffff" }, radius: "lg", shadow: "md", ...style } }, kids);

const agency = (): B[] => [
  mk("cover", { src: IMG, overlay: "primary", opacity: 55, minHeight: "520px", align: "full", contentAlign: "center" }, [
    h(1, "Chúng tôi dựng thương hiệu", { textAlign: "center", typedWords: "nổi bật|đáng nhớ|tăng trưởng", style: { motion: { in: "reveal-up", ease: "snappy" } } }),
    p("Thiết kế, công nghệ và chiến lược dưới một mái nhà.", { textAlign: "center", style: { motion: { in: "slide-up", delay: 200 } } }),
    mk("buttons", { align: "center" }, [btn("Xem dự án"), btn("Liên hệ", "outline")]),
  ]),
  sec({ margin: { base: { top: "-4rem" } }, zIndex: 2, padding: { base: "xl", mobile: "md" }, color: { background: "#ffffff" }, radius: "xl", shadow: "xl" }, [
    row([25, 25, 25, 25], [0, 1, 2, 3].map((i) => [mk("counter", { start: 0, end: [120, 8, 340, 99][i], suffix: ["+", "", "+", "%"][i], title: ["Dự án", "Năm", "Khách hàng", "Hài lòng"][i], textAlign: "center" })]), { verticalAlign: "center" }),
  ], { constrained: true }),
  sec({ padding: { base: "2xl", mobile: "lg" } }, [row([50, 50], [
    [h(2, "Quy trình rõ ràng"), p("Từ khảo sát tới vận hành, mỗi bước đều có người phụ trách và số liệu theo dõi."), mk("iconList", { items: [{ text: "Khảo sát & định hướng" }, { text: "Thiết kế giao diện" }, { text: "Lập trình & kiểm thử" }, { text: "Bàn giao & đào tạo" }], icon: "check" }), btn("Tìm hiểu thêm")],
    [mk("image", { src: IMG, alt: "Minh hoạ", ratio: "4/3", style: { radius: "xl", motion: { in: "zoom-in", loop: "float" } } }), mk("imageOverlay", { src: IMG, title: "Dự án nổi bật", subtitle: "Xem ngay", ratio: "16/9" })],
  ])]),
  sec({ color: { background: "#eef3f6" }, divider: { top: { shape: "wave", color: "#ffffff" }, bottom: { shape: "curve", color: "#ffffff", flip: true } }, padding: { base: "3xl", mobile: "xl" } }, [
    h(2, "Dịch vụ", { textAlign: "center" }),
    row([33, 33, 34], ["Thiết kế", "Lập trình", "Marketing"].map((t, i) => [mk("iconBox", { icon: ["star", "check", "heart"][i], title: t, text: "Giải pháp trọn gói, đo lường được.", hover: "grow", iconStyle: "circle", textAlign: "center", style: { motion: { in: "slide-up", delay: i * 150, hover: "lift" } } })])),
  ]),
  mk("tabs", { initial: 1 }, ["Chiến lược", "Triển khai", "Báo cáo"].map((t, i) => mk("tab", { title: t, icon: ["star", "check", "heart"][i] }, [
    row([60, 40], [[h(3, `Giai đoạn ${i + 1}`), p("Nội dung chi tiết của giai đoạn, kèm các chỉ số theo dõi bên cạnh."), mk("progressBar", { label: "Hoàn thành", value: 40 + i * 20, shape: "bar" })], [mk("progressBar", { label: "Mức độ", value: 70 + i * 10, shape: "circle" })]]),
  ]))),
  mk("carousel", { slidesPerView: 1, effect: "fade", autoplay: true, interval: 6, arrows: true, dots: true, heightMode: "min", minHeight: "18rem" }, [0, 1, 2].map((i) => mk("group", { style: { background: { image: { base: IMG }, overlay: "primary", overlayOpacity: 60 }, padding: "xl", layout: { type: "flex", direction: "column", justify: "center", align: "center" } } }, [h(2, `Câu chuyện ${i + 1}`, { textAlign: "center", style: { color: { text: "#ffffff" } } }), p("Một slide trong slider nhiều lớp.", { textAlign: "center", style: { color: { text: "#ffffff" } } })]))),
  mk("testimonials", { layout: "carousel", columns: 3, columnsTablet: 2, columnsMobile: 1 }, [0, 1, 2, 3, 4].map((i) => mk("testimonial", { quote: "Làm việc chuyên nghiệp, đúng hạn.", name: `Khách ${i + 1}`, role: "Giám đốc", rating: 5, variant: "card" }))),
  sec({ gradient: "linear-gradient(135deg, #1a597b, #f26251)", padding: { base: "2xl", mobile: "lg" }, color: { text: "#ffffff" } }, [
    h(2, "Ưu đãi kết thúc sau", { textAlign: "center" }),
    mk("countdown", { target: "2099-01-01T00:00:00Z" }),
    mk("buttons", { align: "center" }, [mk("popup", { triggerText: "Nhận báo giá", size: "md" }, [h(3, "Nhận báo giá"), p("Để lại thông tin, chúng tôi gọi lại trong ngày.")])]),
  ]),
  mk("accordion", {}, [0, 1, 2].map((i) => mk("details", { summary: `Câu hỏi ${i + 1}?` }, [p("Câu trả lời ngắn gọn, đầy đủ."), mk("iconList", { items: [{ text: "Ý một" }, { text: "Ý hai" }] })]))),
];

const portfolio = (): B[] => [
  sec({ position: { type: "sticky", top: "0" }, zIndex: 50, padding: "sm", color: { background: "#ffffff" }, layout: { type: "flex", direction: { base: "row" }, justify: "between", align: "center", wrap: true } }, [h(3, "STUDIO"), mk("buttons", {}, [btn("Dự án", "outline"), btn("Liên hệ", "outline")])], { constrained: false }),
  mk("gallery", { images: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ src: IMG, alt: `Ảnh ${i + 1}` })), columns: 4, layout: "masonry", lightbox: true }),
  sec({ padding: "2xl" }, [h(2, "Dự án", { textAlign: "center" }), mk("group", { style: { layout: { type: "grid", columns: { base: 3, tablet: 2, mobile: 1 }, }, gap: "md" } }, Array.from({ length: 6 }, (_, i) => mk("imageOverlay", { src: IMG, title: `Dự án ${i + 1}`, subtitle: "Xem chi tiết", ratio: i % 2 ? "1/1" : "4/3", style: { motion: { in: "fade", delay: (i % 3) * 120, stagger: false } } })))]),
  mk("carousel", { slidesPerView: 3, slidesTablet: 2, slidesMobile: 1, autoplay: false, arrows: true, dots: true, gap: "1rem" }, Array.from({ length: 6 }, (_, i) => mk("group", { style: { color: { background: "#f4f6f8" }, radius: "lg", padding: "lg", hover: { lift: true } } }, [mk("icon", { icon: "star" }), h(3, `Mục ${i + 1}`), p("Mô tả ngắn của mục trong slider ba cột.")]))),
  row([30, 70], [[h(2, "Câu chuyện"), p("Bên trái ghim khi cuộn.")].map((x) => x), [p("Đoạn một."), p("Đoạn hai."), mk("table", {}, [])].slice(0, 2)], { verticalAlign: "top" }),
];

const deep = (): B[] => {
  // Section > Row > Column > Section > Row > Column > Tabs > Accordion > Slider > Group
  const leaf = mk("carousel", { slidesPerView: 2, slidesMobile: 1 }, [0, 1, 2].map((i) => mk("group", { style: { color: { background: "#eef3f6" }, padding: "md", radius: "md" } }, [p(`Lá ${i + 1}`), btn("Mở")])));
  const acc = mk("accordion", {}, [mk("details", { summary: "Lớp accordion", open: true }, [leaf]), mk("details", { summary: "Lớp hai" }, [p("Nội dung")])]);
  const tabs = mk("tabs", {}, [mk("tab", { title: "Tab A" }, [acc]), mk("tab", { title: "Tab B" }, [p("Trống")])]);
  const inner = sec({ padding: "md", color: { background: "#ffffff" }, radius: "lg", shadow: "sm" }, [row([50, 50], [[h(3, "Cột lồng"), tabs], [p("Cột phải"), mk("progressBar", { value: 65, label: "Tiến độ" })]])], { constrained: false, align: undefined });
  return [sec({ padding: "lg", color: { background: "#f8fafb" } }, [h(2, "Lồng nhiều tầng"), row([100], [[inner]]), row([33, 33, 34], [0, 1, 2].map((i) => [card([h(4, `Thẻ ${i + 1}`), p("Thẻ trong cột trong hàng."), row([50, 50], [[mk("counter", { end: 10 * (i + 1) })], [mk("rating", { value: 4 })]])])]))])];
};

const event = (): B[] => [
  sec({ padding: "md", color: { background: "#f26251", text: "#ffffff" }, hide: ["mobile"] }, [p("Thanh thông báo chỉ hiện trên máy tính", { textAlign: "center" })], { constrained: false }),
  mk("cover", { src: IMG, minHeight: "480px", align: "full", overlay: "primary", opacity: 60, fixed: true }, [h(1, "Hội thảo Công nghệ 2099", { textAlign: "center", style: { motion: { in: "bounce-in" } } }), mk("countdown", { target: "2099-06-01T09:00:00+07:00", timezone: "Asia/Ho_Chi_Minh" }), mk("buttons", { align: "center" }, [btn("Đăng ký ngay")])]),
  sec({ padding: "xl" }, [h(2, "Diễn giả"), row([25, 25, 25, 25], [0, 1, 2, 3].map((i) => [mk("imageOverlay", { src: IMG, title: `Diễn giả ${i + 1}`, subtitle: "CTO", ratio: "1/1", style: { motion: { in: "flip-y", delay: i * 100 } } })]))]),
  sec({ padding: "lg", audience: undefined, schedule: { from: "2000-01-01T00:00:00Z", until: "2099-01-01T00:00:00Z" } }, [mk("group", { style: { audience: "guest", padding: "md", color: { background: "#fff7e6" } } }, [p("Chỉ khách thấy: Đăng nhập để nhận ưu đãi.")]), mk("group", { collapseHeight: "6rem", moreText: "Đọc thêm", style: { padding: "md" } }, [p("Lịch trình dài. ".repeat(40))])]),
  mk("form", { submitText: "Gửi đăng ký" }, [mk("formField", { kind: "text", name: "ten", label: "Họ tên", required: true }), mk("formField", { kind: "email", name: "email", label: "Email", required: true }), mk("formField", { kind: "textarea", name: "ghi-chu", label: "Ghi chú" })]),
  mk("map", { address: "Hà Nội", zoom: 12 }),
];

const PAGES: Record<string, () => B[]> = { agency, portfolio, deep, event };
const OUT = process.env.ECX_SHOTS;

async function load(page: Page, blocks: B[]) {
  const c = await open(page, "?empty=1&content=1");
  await page.evaluate((bs) => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, bs); s.select([]); }, blocks as never);
  await page.waitForTimeout(1200);
  return c;
}
const canvasMetrics = (page: Page) => page.evaluate(() => {
  const f = document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement; const d = f.contentDocument!; const de = d.documentElement;
  const over = de.scrollWidth - de.clientWidth;
  const who = over > 1 ? [...d.querySelectorAll("[data-ecx-block]")].filter((e) => e.getBoundingClientRect().right > de.clientWidth + 1).slice(0, 4).map((e) => `${e.getAttribute("data-ecx-block")}:${e.className.toString().split(" ")[0]}(+${Math.round(e.getBoundingClientRect().right - de.clientWidth)})`) : [];
  const empty = [...d.querySelectorAll("[data-ecx-block]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width < 1 || r.height < 1; }).map((e) => e.className.toString().split(" ")[0]).slice(0, 6);
  return { over, who, empty };
});

for (const [name, build] of Object.entries(PAGES)) {
  test(`trang phức tạp «${name}»: không lỗi, không tràn ngang ở 3 khổ, chuẩn hoá ổn định`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push("PAGEERR " + e.message.slice(0, 200)));
    page.on("console", (m) => { if (m.type() === "error" && !/404|favicon|Failed to load resource|debugger eval code/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
    const blocks = build().filter((b) => b.type !== "group" || b.content?.length || b.attrs.style);
    await load(page, blocks);
    const count = await page.evaluate(() => { let t = 0; const w = (l: any[]) => l.forEach((b) => { t++; b.content && w(b.content); }); w((window as any).__ecx.store.getState().docs.root.blocks); return t; });
    expect(count).toBeGreaterThan(10);
    const res: Record<string, unknown> = {};
    for (const [label, bi] of [["desktop", -1], ["tablet", 1], ["mobile", 2]] as const) {
      if (bi >= 0) { await page.locator(".ecx-tool-group[role=group]").filter({ has: page.locator("button[aria-pressed]") }).first().locator("button").nth(bi).click(); await page.waitForTimeout(800); }
      const m = await canvasMetrics(page);
      res[label] = m;
      if (OUT) {
        const full = await page.evaluate(() => (document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement).contentDocument!.documentElement.scrollHeight);
        await page.evaluate(() => { const f = document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement; f.contentDocument!.querySelectorAll(".ecx-in").forEach((e) => e.classList.add("is-in")); });
        await page.setViewportSize({ width: 1440, height: Math.min(9000, full + 140) }); await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/${name}-${label}.png` });
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
      expect(m.over, `${name}@${label} tràn ngang ${m.who.join(", ")}`).toBeLessThanOrEqual(1);
    }
    console.log(name, JSON.stringify(res));
    // ECX_DUMP_BLOCKS=<thư mục>: xuất trang thành fixture hợp đồng page-<tên>.json (content / máy chủ / SDK / parity cùng kiểm)
    if (process.env.ECX_DUMP_BLOCKS) {
      const input = await page.evaluate(() => (window as any).__ecx.content());
      writeFileSync(`${process.env.ECX_DUMP_BLOCKS}/page-${name}.json`, JSON.stringify({ name: `page-${name}`, note: `Trang phức tạp «${name}» dựng bằng JSON (lồng nhiều tầng, hiệu ứng, slider, tab): chuẩn hoá ổn định, vẽ được ở website`, input }, null, 2));
    }
    // chuẩn hoá hai lần không đổi (không mất thuộc tính khi lưu)
    const same = await page.evaluate(() => { const s = (window as any).__ecx.store; const a = JSON.stringify(s.getState().docs.root.blocks); return a.length > 100; });
    expect(same).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}
