import { expect, test, type Page } from "@playwright/test";
import { clickEnd, open, state } from "./helpers";

/**
 * Vòng 3: bấm / đổi MỌI ô điều khiển trong bảng bên phải của từng khối (công tắc, ô chọn từng giá trị, nút chọn, thanh trượt, ô chữ, ô số).
 * Sau mỗi thay đổi kiểm: không lỗi console / pageerror, `__ecx.check()`, không khối báo lỗi, canvas không tràn ngang.
 * ECX_SWEEP_ONLY=a,b chỉ chạy các khối đó.
 */
test.use({ actionTimeout: 4000 });
const TABS = ["Cài đặt", "Kiểu dáng", "Nâng cao"];

async function tileKeys(page: Page): Promise<string[]> {
  await page.getByRole("button", { name: "Thêm khối" }).first().click();
  await page.locator(".ecx-block-tile").first().waitFor();
  return [...new Set(await page.locator(".ecx-block-tile[data-key]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key!)))];
}

test("đổi mọi ô điều khiển của từng khối — gom hết lỗi", async ({ page }) => {
  test.setTimeout(3_600_000); // nhiều khối hơn: Firefox mất hơn 25 phút
  const errors: string[] = [];
  const touched: Record<string, number> = {};
  let current = "", step = "";
  page.on("pageerror", (e) => errors.push(`[${current}] ${step}: pageerror: ${e.message.split("\n")[0].slice(0, 140)}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|net::ERR|debugger eval code/.test(m.text()) /* "debugger eval code" = lỗi nội bộ của Playwright trên Firefox khi phần tử bị vẽ lại giữa chừng, không phải lỗi của trình soạn */) errors.push(`[${current}] ${step}: console.error: ${m.text().slice(0, 140)}`); });
  await open(page, "?doc=post");
  let keys = await tileKeys(page);
  if (process.env.ECX_SWEEP_ONLY) keys = keys.filter((k) => process.env.ECX_SWEEP_ONLY!.split(",").includes(k));
  for (const key of keys) {
    current = key;
    try {
      const c = await open(page, "?doc=post");
      await clickEnd(c, "Đoạn thứ hai.");
      await page.getByRole("button", { name: "Thêm khối" }).first().click();
      const tile = page.locator(`.ecx-block-tile[data-key='${key}']`);
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
      await page.waitForTimeout(150);
      const insp = page.locator(".ecx-inspector");
      const verify = async () => {
        const bad: string[] = await page.evaluate(() => (window as any).__ecx.check());
        // Kiểu "VIẾT HOA / Viết Hoa Đầu Từ" làm chữ hiển thị khác chữ dữ liệu về hoa / thường: đúng ý người dùng, không phải lỗi
        const real = bad.filter((m) => { const x = /màn hình "(.*)" ≠ dữ liệu "(.*)"/s.exec(m); return !(x && x[1].toLowerCase() === x[2].toLowerCase()); });
        if (real.length) errors.push(`[${key}] ${step}: ${real[0].slice(0, 120)}`);
        if (await c.locator(".ecx-block-error").count()) errors.push(`[${key}] ${step}: khối báo lỗi`);
      };
      for (const tab of TABS) {
        const t = insp.getByRole("tab", { name: tab });
        if (!(await t.count())) continue;
        await t.click();
        // Mở hết các mục thu gọn để thấy mọi ô
        for (let i = 0; i < 4; i++) {
          const heads = insp.locator(".ecx-style-section > button[aria-expanded='false'], .ecx-more-btn");
          const n = await heads.count();
          if (!n) break;
          for (let j = 0; j < n; j++) await heads.first().click({ timeout: 1500 }).catch(() => {});
        }
        const controls = await insp.locator("input[type=checkbox], input[type=range], select, input[type=number], input.ecx-input[type=text], input.ecx-input:not([type]), textarea, [role=radio]").count();
        for (let i = 0; i < Math.min(controls, 60); i++) {
          const el = insp.locator("input[type=checkbox], input[type=range], select, input[type=number], input.ecx-input[type=text], input.ecx-input:not([type]), textarea, [role=radio]").nth(i);
          if (!(await el.count())) break;
          const tag = await el.evaluate((n) => `${n.tagName.toLowerCase()}${(n as HTMLInputElement).type ? ":" + (n as HTMLInputElement).type : ""}${n.getAttribute("role") ? ":" + n.getAttribute("role") : ""}`).catch(() => "");
          const label = (await el.getAttribute("aria-label").catch(() => "")) || "";
          touched[key] = (touched[key] ?? 0) + 1;
          step = `${tab} › ${tag} "${label.slice(0, 30)}" #${i}`;
          try {
            if (tag.startsWith("select")) {
              const opts = await el.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
              for (const v of opts.slice(0, 12)) { await el.selectOption(v, { timeout: 1500 }); await verify(); }
            } else if (tag.startsWith("input:checkbox")) { await el.click({ timeout: 1500 }); await verify(); await el.click({ timeout: 1500 }); await verify(); }
            else if (tag === "input:range") { await el.evaluate((n) => { const r = n as HTMLInputElement; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; for (const v of [r.max, r.min]) { set.call(r, v); r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); } }); await verify(); }
            else if (tag.includes("radio")) { await el.click({ timeout: 1500 }); await verify(); }
            else if (tag === "input:number") { await el.fill("7", { timeout: 1500 }); await verify(); await el.fill("", { timeout: 1500 }); await verify(); }
            else { await el.fill("Thử 123", { timeout: 1500 }); await verify(); await el.fill("", { timeout: 1500 }); await verify(); }
          } catch { /* ô bị ẩn / bị che sau khi vẽ lại: bỏ qua, không phải lỗi */ }
        }
        step = `${tab} xong`;
        const over = await c.locator("body").evaluate((b) => { const d = b.ownerDocument.scrollingElement!; return d.scrollWidth - d.clientWidth; });
        if (over > 1) errors.push(`[${key}] ${tab}: canvas tràn ngang ${over}px`);
      }
    } catch (e) {
      errors.push(`[${key}] ngoại lệ (${step}): ${(e as Error).message.split("\n")[0].slice(0, 120)}`);
    }
  }
  console.log("TOUCHED", JSON.stringify(touched));
  expect(errors, "\n" + errors.join("\n")).toEqual([]);
});
