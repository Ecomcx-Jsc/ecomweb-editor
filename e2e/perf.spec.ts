import { expect, test } from "@playwright/test";
import { END, canvas, mod } from "./helpers";

/**
 * Hiệu năng với tài liệu lớn (2.000 khối): mở, gõ, Enter, hoàn tác phải nhanh — đo trong trình duyệt (keydown → chữ có trên
 * màn hình). Ngưỡng rộng để máy CI chậm vẫn đạt nhưng bắt được chỗ tệ đi (O(n²), vẽ lại cả tài liệu mỗi phím).
 */
test.describe("hiệu năng — 2.000 khối", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "đo trên một trình duyệt là đủ (số liệu so được giữa các lần chạy)");
  test.setTimeout(120_000);

  test("mở, gõ, Enter, hoàn tác trong ngưỡng", async ({ page }) => {
    const t0 = Date.now();
    await page.goto("/?blocks=2000");
    const c = canvas(page);
    await expect(c.locator("[data-ecx-rich]").nth(1999)).toBeAttached({ timeout: 30_000 });
    const loadMs = Date.now() - t0;
    expect(await page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.length)).toBe(2000);

    // Gõ ở khoảng giữa tài liệu
    const target = c.locator("p", { hasText: "Đoạn 1001:" });
    await target.scrollIntoViewIfNeeded();
    await target.click();
    await target.press(END);
    // Đo trong trang (như người dùng cảm nhận): keydown → khung hình đầu tiên đã vẽ chữ mới
    await page.evaluate(() => {
      const w = window as any;
      w.__lat = [];
      const doc = document.querySelector<HTMLIFrameElement>("iframe[data-ecx-canvas]")!.contentDocument!;
      doc.addEventListener("keydown", () => { const t0 = performance.now(); requestAnimationFrame(() => setTimeout(() => w.__lat.push(performance.now() - t0), 0)); }, true);
    });
    for (const ch of "Đo tốc độ gõ phím trong tài liệu dài") await page.keyboard.type(ch);
    await page.waitForTimeout(100);
    const typing: number[] = await page.evaluate(() => (window as any).__lat);
    const enterStart = Date.now();
    await page.keyboard.press("Enter");
    await page.keyboard.type("x");
    await expect(c.locator("p", { hasText: /^x$/ })).toHaveCount(1);
    const enterMs = Date.now() - enterStart;
    const undoStart = Date.now();
    await page.keyboard.press(`${mod}+z`);
    await page.keyboard.press(`${mod}+z`);
    await expect(c.locator("p", { hasText: /^x$/ })).toHaveCount(0);
    const undoMs = Date.now() - undoStart;
    const sorted = [...typing].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95) - 1] ?? sorted.at(-1)!;
    console.log(`2.000 khối: mở ${loadMs} ms · gõ p95 ${p95.toFixed(1)} ms (trung vị ${sorted[Math.floor(sorted.length / 2)].toFixed(1)} ms) · Enter+gõ ${enterMs} ms · 2× hoàn tác ${undoMs} ms`);
    expect(loadMs).toBeLessThan(8_000);
    expect(p95).toBeLessThan(40);
    expect(enterMs).toBeLessThan(600);
    expect(undoMs).toBeLessThan(600);
  });
});
