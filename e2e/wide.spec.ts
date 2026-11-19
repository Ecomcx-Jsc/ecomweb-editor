import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { open } from "./helpers";

/**
 * Nội dung "khó" trong Nhóm hết trang (align full) và trong cột hẹp: ảnh khổng lồ, bảng 12 cột, mã / chữ không ngắt dài, nhiều nút, nhiều tab, lưới 6 cột…
 * Ở 3 khổ (máy tính / tablet / điện thoại): trang không tràn ngang, khối nào cũng nằm trong khung nhìn (hoặc tự cuộn trong khối nếu là bảng / mã).
 */
type B = Record<string, unknown>;
let n = 0;
const id = () => `W${++n}`;
const T = (t: string) => [{ type: "text", text: t }];
const p = (t: string, attrs: B = {}): B => ({ id: id(), type: "paragraph", attrs, inline: T(t) });
const h = (t: string, level = 2): B => ({ id: id(), type: "heading", attrs: { level }, inline: T(t) });
const wid = (type: string, attrs: B, content?: B[]): B => ({ id: id(), type, attrs, ...(content ? { content } : {}) });
const grp = (kids: B[], attrs: B = {}): B => wid("group", attrs, kids);
const svg = (w: number, hgt: number) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${hgt}'><rect width='100%' height='100%' fill='#1a597b'/><text x='20' y='60' font-size='48' fill='white'>${w}x${hgt}</text></svg>`)}`;
const LONG = "SieuDaiKhongNgatTuMotHaiBaBonNamSauBaySauMuoiMuoiMotMuoiHaiMuoiBaMuoiBonMuoiLamMuoiSauMuoiBayMuoiTamMuoiChinHaiMuoi".repeat(3);
const cell = (t: string, head = false): B => wid(head ? "tableHeader" : "tableCell", {}, [p(t)]);
const row = (cells: B[]): B => wid("tableRow", {}, cells);
const table12 = (): B => wid("table", {}, [row(Array.from({ length: 12 }, (_, i) => cell(`Cột số ${i + 1} tiêu đề dài`, true))), row(Array.from({ length: 12 }, (_, i) => cell(`Giá trị ${i + 1} ${LONG.slice(0, 20)}`)))]);
const btn = (t: string): B => wid("button", { text: t, variant: "primary", href: "#" });

const CASES: Array<{ name: string; build: () => B }> = [
  { name: "anh-3000px", build: () => wid("image", { src: svg(3000, 1000), alt: "Ảnh rất rộng", width: 3000, height: 1000 }) },
  { name: "bang-12-cot", build: table12 },
  { name: "ma-dai", build: () => wid("codeBlock", { language: "js" }, undefined) },
  { name: "chu-khong-ngat", build: () => p(LONG) },
  { name: "tieu-de-khong-ngat", build: () => ({ id: id(), type: "heading", attrs: { level: 1 }, inline: T(LONG) }) },
  { name: "nhieu-nut", build: () => wid("buttons", {}, Array.from({ length: 8 }, (_, i) => btn("Nút số " + (i + 1) + " nhãn dài"))) },
  { name: "tabs-8", build: () => wid("tabs", {}, Array.from({ length: 8 }, (_, i) => wid("tab", { title: "Tab tiêu đề dài số " + (i + 1) }, [p("Nội dung " + i)]))) },
  { name: "cot-6", build: () => wid("columns", {}, Array.from({ length: 6 }, (_, i) => wid("column", {}, [h("Cột " + (i + 1), 3), p("Nội dung cột để thử xếp chồng."), btn("Nút")]))) },
  { name: "luoi-6-the", build: () => grp(Array.from({ length: 6 }, (_, i) => wid("iconBox", { icon: "star", title: "Thẻ " + i, text: "Mô tả " + LONG.slice(0, 40) })), { style: { layout: { type: "grid", columns: { base: 6, tablet: 3, mobile: 1 } } } }) },
  { name: "carousel-4-anh", build: () => wid("carousel", { slidesPerView: 4 }, Array.from({ length: 6 }, (_, i) => grp([wid("image", { src: svg(1200, 800), alt: "Ảnh " + i }), h("Tiêu đề slide dài số " + i, 3)]))) },
  { name: "carousel-hero-cover", build: () => wid("carousel", { slidesPerView: 1, autoplay: false }, Array.from({ length: 3 }, (_, i) => wid("cover", { overlay: "primary", opacity: 50, minHeight: "320px", src: svg(2400, 1200) }, [h("Slide hero " + (i + 1), 2), p("Mô tả ngắn"), btn("Xem ngay")]))) },
  { name: "danh-sach-icon-ngang", build: () => wid("iconList", { layout: "inline", items: Array.from({ length: 10 }, (_, i) => ({ text: "Mục dài số " + (i + 1) })) }) },
  { name: "mang-xa-hoi-10", build: () => wid("socialLinks", { links: ["facebook", "x", "instagram", "youtube", "tiktok", "linkedin", "github", "zalo", "telegram", "email"].map((s) => ({ service: s, url: "https://example.com/" + s })) }) },
  { name: "form", build: () => wid("form", {}) },
  { name: "video-youtube", build: () => wid("video", { src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }) },
  { name: "ban-do", build: () => wid("map", { address: "Hà Nội", height: 600 }) },
  { name: "html-rong", build: () => wid("customHtml", { html: `<div style="width:2400px;height:80px;background:#f26251">rộng 2400px</div>` }) },
  { name: "dem-so-6", build: () => grp(Array.from({ length: 6 }, (_, i) => wid("counter", { end: 1000 * (i + 1), title: "Chỉ số dài số " + i })), { style: { layout: { type: "flex", direction: { base: "row" } }, gap: { base: "md" } } }) },
];
const WRAPS: Array<{ name: string; wrap: (kid: B) => B }> = [
  { name: "nhom-full", wrap: (k) => grp([k], { align: "full", padding: "large", style: { color: { background: "primary/10" } } }) },
  { name: "cot-hep", wrap: (k) => wid("columns", {}, [wid("column", { width: 25 }, [k]), wid("column", { width: 75 }, [p("Cột rộng")])]) },
  { name: "tab", wrap: (k) => wid("tabs", {}, [wid("tab", { title: "A" }, [k]), wid("tab", { title: "B" }, [p("b")])]) },
];
const DEVICES: Array<[string, string]> = [["Máy tính", "d"], ["Máy tính bảng", "t"], ["Điện thoại", "m"]];

async function load(page: Page, blocks: B[]) {
  await page.evaluate((nodes) => {
    const st = (window as any).__ecx.store;
    const old = st.getState().docs.root.blocks.map((b: { id: string }) => b.id);
    st.insert("root", null, 0, nodes, { focus: false });
    st.remove(old);
    st.select([]);
  }, blocks);
}

test("nội dung khó trong Nhóm hết trang / cột hẹp / tab: không tràn ngang, không lỗi khối ở 3 khổ", async ({ page }) => {
  test.setTimeout(900_000);
  const problems: string[] = [];
  let cur = "";
  page.on("pageerror", (e) => problems.push(`[${cur}] pageerror: ${e.message.split("\n")[0].slice(0, 120)}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|net::ERR|React keys must be passed/.test(m.text())) problems.push(`[${cur}] console.error: ${m.text().slice(0, 140)}`); });
  const c = await open(page, "?doc=empty");
  const only = process.env.ECX_WIDE_ONLY?.split(",");
  for (const w of WRAPS) for (const k of CASES) {
    if (only && !only.includes(k.name)) continue;
    cur = `${w.name} ← ${k.name}`;
    try {
      const kid = k.build();
      if (k.name === "ma-dai") (kid as B).attrs = { language: "js", code: "const x = " + JSON.stringify(LONG + LONG) + ";" };
      await load(page, [w.wrap(kid)]);
      await page.waitForTimeout(100);
      // ECX_DUMP_WIDE=<thư mục>: xuất nội dung đã lưu để kiểm bản website thật (sdk render + style.css) ở bước sau
      if (process.env.ECX_DUMP_WIDE) { mkdirSync(process.env.ECX_DUMP_WIDE, { recursive: true }); writeFileSync(`${process.env.ECX_DUMP_WIDE}/${w.name}__${k.name}.json`, JSON.stringify(await page.evaluate(() => (window as any).__ecx.content()))); }
      if (await c.locator(".ecx-block-error").count()) problems.push(`[${cur}] khối báo lỗi`);
      for (const [label, key] of DEVICES) {
        await page.getByRole("button", { name: label, exact: true }).first().click();
        await page.waitForTimeout(160);
        const over = await c.locator("body").evaluate((b) => { const d = b.ownerDocument.scrollingElement!; return d.scrollWidth - d.clientWidth; });
        if (over > 1) {
          // khối nào tràn: liệt kê vài khối vượt mép phải khung
          const who = await c.locator("body").evaluate((b) => { const vw = b.ownerDocument.documentElement.clientWidth; return [...b.ownerDocument.querySelectorAll("[data-ecx-block]")].filter((e) => e.getBoundingClientRect().right > vw + 1).slice(0, 3).map((e) => `${(e as HTMLElement).dataset.type}(+${Math.round(e.getBoundingClientRect().right - vw)})`).join(","); });
          problems.push(`[${cur}] tràn ngang ${over}px ở ${label}: ${who}`);
        }
      }
      await page.getByRole("button", { name: "Máy tính", exact: true }).first().click();
    } catch (e) { problems.push(`[${cur}] ngoại lệ: ${(e as Error).message.split("\n")[0].slice(0, 120)}`); }
  }
  const uniq = [...new Set(problems)];
  console.log(`WIDE ${uniq.length} bất thường`);
  expect(uniq, "\n" + uniq.join("\n")).toEqual([]);
});
