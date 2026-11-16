import { expect, test, type Page } from "@playwright/test";
import { clickEnd, open } from "./helpers";

/**
 * Vòng 9: chữ giao diện của bảng bên phải ở cả hai ngôn ngữ: không lộ khoá dịch thô (a.b.c), không `undefined` / `[object Object]`,
 * tiếng Anh không còn chữ có dấu tiếng Việt, tiếng Việt không còn các câu tiếng Anh dài (trừ tên riêng / thuật ngữ).
 */
test.use({ actionTimeout: 4000 });
const TABS = ["Cài đặt", "Kiểu dáng", "Nâng cao"];
const TABS_EN = ["Settings", "Style", "Advanced"];
const RAW_KEY = /(?:^|\s)[a-z][a-zA-Z]+(?:\.[a-zA-Z_]+){1,3}(?:\s|$)/;
/** Dữ liệu do máy chủ của trang thử (playground) trả về, không phải chữ của trình soạn. */
const HOST_DATA = ["Menu chính", "Chân trang — chưa gán menu", "Chuyên mục", "Thẻ", "Đầu trang (header)", "Chân trang (footer)"];
const VI = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

async function tileKeys(page: Page): Promise<string[]> {
  await page.getByRole("button", { name: /Thêm khối|Add block/ }).first().click();
  await page.locator(".ecx-block-tile").first().waitFor();
  return [...new Set(await page.locator(".ecx-block-tile[data-key]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key!)))];
}

for (const lang of ["vi", "en"] as const) {
  test(`chữ giao diện bảng phải — ${lang}: không lộ khoá dịch, không lẫn ngôn ngữ`, async ({ page }) => {
    test.setTimeout(900_000);
    const problems: string[] = [];
    const url = lang === "en" ? "?doc=post&lang=en" : "?doc=post";
    await open(page, url);
    let keys = await tileKeys(page);
    if (process.env.ECX_SWEEP_ONLY) keys = keys.filter((k) => process.env.ECX_SWEEP_ONLY!.split(",").includes(k));
    for (const key of keys) {
      try {
        const c = await open(page, url);
        await clickEnd(c, lang === "en" ? "Second paragraph." : "Đoạn thứ hai.").catch(async () => { await c.locator("p").last().click(); });
        await page.getByRole("button", { name: /Thêm khối|Add block/ }).first().click();
        const tile = page.locator(`.ecx-block-tile[data-key='${key}']`);
        await tile.scrollIntoViewIfNeeded();
        await tile.click();
        await page.waitForTimeout(120);
        const insp = page.locator(".ecx-inspector");
        for (const tab of lang === "en" ? TABS_EN : TABS) {
          const t = insp.getByRole("tab", { name: tab });
          if (!(await t.count())) continue;
          await t.click();
          for (let i = 0; i < 3; i++) {
            const heads = insp.locator(".ecx-style-section > button[aria-expanded='false'], .ecx-more-btn");
            const n = await heads.count();
            if (!n) break;
            for (let j = 0; j < n; j++) await heads.first().click({ timeout: 1000 }).catch(() => {});
          }
          // Mọi chữ nhìn thấy: nhãn, nút, tooltip (title / aria-label), placeholder, chữ trong ô chọn
          const texts: string[] = await insp.evaluate((el) => {
            const out: string[] = [];
            const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let n = w.nextNode(); n; n = w.nextNode()) { const v = (n.nodeValue ?? "").trim(); if (v) out.push(v); }
            el.querySelectorAll("[title],[aria-label],[placeholder]").forEach((e) => { for (const a of ["title", "aria-label", "placeholder"]) { const v = e.getAttribute(a); if (v) out.push(v); } });
            return out;
          });
          for (const tx of new Set(texts)) {
            if (/undefined|\[object Object\]|NaN/.test(tx)) problems.push(`[${key}] ${lang} "${tab}": chữ lỗi "${tx.slice(0, 50)}"`);
            else if (RAW_KEY.test(tx) && !/^https?:|\.(com|vn|png|jpg)|@/.test(tx) && tx.length < 60) problems.push(`[${key}] ${lang} "${tab}": lộ khoá dịch "${tx.slice(0, 50)}"`);
            else if (lang === "en" && VI.test(tx) && !HOST_DATA.includes(tx)) problems.push(`[${key}] en "${tab}": còn tiếng Việt "${tx.slice(0, 50)}"`);
          }
        }
        // Chữ trong canvas do trình soạn sinh (chữ gợi ý, nút "+ Thêm …", khung chọn ảnh); nội dung bài mẫu là tiếng Việt nên bỏ qua đoạn có sẵn
        if (lang === "en") {
          const canvasTexts: string[] = await c.locator("body").evaluate((b) => {
            const out: string[] = [];
            b.querySelectorAll("[data-placeholder]").forEach((e) => out.push(e.getAttribute("data-placeholder") ?? ""));
            b.querySelectorAll("[data-ecx-placeholder] *, .ecx-media-placeholder *, .ecx-add-column, .ecx-section-adder, .ecx-add-item, [data-ecx-add]").forEach((e) => { if (e.children.length === 0) out.push((e.textContent ?? "").trim(), e.getAttribute("title") ?? "", e.getAttribute("aria-label") ?? ""); });
            return out.filter(Boolean);
          });
          for (const tx of new Set(canvasTexts)) if (VI.test(tx) && !HOST_DATA.includes(tx)) problems.push(`[${key}] en canvas: còn tiếng Việt "${tx.slice(0, 50)}"`);
        }
      } catch (e) { problems.push(`[${key}] ${lang} ngoại lệ: ${(e as Error).message.split("\n")[0].slice(0, 100)}`); }
    }
    const uniq = [...new Set(problems)];
    expect(uniq, "\n" + uniq.join("\n")).toEqual([]);
  });
}
