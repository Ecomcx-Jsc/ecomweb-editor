import { expect, test, type Page } from "@playwright/test";
import { clickEnd, open, showToolbar, state } from "./helpers";

/** Bảng cài đặt: giá trị chọn có nhãn (không hiện giá trị thô), ô chọn dữ liệu thật, trình sửa riêng, tab Kiểu dáng thống nhất. */
const insp = (page: Page) => page.locator(".ecx-inspector");
const blockOf = async (page: Page, type: string, docId?: string) => {
  const st = await state(page);
  const walk = (list: any[]): any => { for (const b of list) { if (b.type === type) return b; const f = b.content && walk(b.content); if (f) return f; } };
  for (const d of Object.values<any>(st.docs)) if (!docId || d.id === docId) { const f = walk(d.blocks); if (f) return f; }
};

test.describe("bảng cài đặt khối", () => {
  test("khối Menu: markup như website (không chấm đầu dòng), chọn vị trí từ danh sách thật, hướng có nhãn; vị trí chưa gán menu → lời nhắc", async ({ page }) => {
    const c = await open(page);
    const nav = c.locator(".ecx-navigation").first();
    await expect(nav.locator(".ecx-navigation-items > nav.ecx-navigation-menu > ul > li > a")).toHaveCount(3);
    expect(await nav.locator(".ecx-navigation-items > nav.ecx-navigation-menu > ul").evaluate((ul) => getComputedStyle(ul).listStyleType)).toBe("none");
    await nav.click();
    const location = insp(page).getByLabel("Vị trí menu");
    await expect(location.locator("option")).toHaveText(["— Chọn —", "Menu chính", "Chân trang — chưa gán menu"]);
    await expect(location).toHaveValue("primary");
    await expect(insp(page).getByRole("radio", { name: "Ngang" })).toHaveAttribute("aria-checked", "true");
    await expect(insp(page).locator("select option", { hasText: /^horizontal$/ })).toHaveCount(0);
    await insp(page).getByRole("radio", { name: "Dọc" }).click();
    expect((await blockOf(page, "navigation")).attrs.orientation).toBe("vertical");
    await expect(nav).toHaveClass(/ecx-navigation-vertical/);
    await location.selectOption("footer");
    await expect(c.locator(".ecx-navigation").first()).toContainText("Vị trí “footer” chưa có menu");
  });

  test("Danh sách bài: chuyên mục chọn từ danh sách thật; bật “Theo trang đang xem” thì ẩn các thiết lập truy vấn", async ({ page }) => {
    const c = await open(page, "?doc=loop");
    await page.getByRole("button", { name: "Cây khối" }).click();
    await page.locator(".ecx-list-row", { hasText: "Danh sách bài" }).first().click();
    const cat = insp(page).getByLabel("Chuyên mục");
    await expect(cat.locator("option")).toHaveText(["— Chọn —", "Tin tức", "Sản phẩm", "Hướng dẫn"]);
    await cat.selectOption("tin-tuc");
    expect((await blockOf(page, "query")).attrs.category).toBe("tin-tuc");
    await expect(c.locator(".ecx-post-template > li.ecx-post")).toHaveCount(2);
    await expect(insp(page).getByRole("radio", { name: "Mới → cũ / Z → A" })).toBeVisible();
    await insp(page).getByLabel("Theo trang đang xem").check();
    await expect(insp(page).getByLabel("Chuyên mục")).toHaveCount(0);
    await expect(insp(page).getByLabel("Loại bài")).toHaveCount(0);
  });

  test("Mạng xã hội: thêm liên kết, chọn mạng, đổi thứ tự, xoá — khung soạn hiện theo", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/mang xa hoi");
    await page.keyboard.press("Enter");
    await expect(c.locator('[data-ecx-placeholder="social"]')).toBeVisible();
    const ed = insp(page).locator(".ecx-social-editor");
    await ed.getByRole("button", { name: "Thêm liên kết" }).click();
    await ed.getByLabel("Địa chỉ 1").fill("https://facebook.com/ecomcx");
    await ed.getByRole("button", { name: "Thêm liên kết" }).click();
    await ed.getByLabel("Mạng 2").selectOption("zalo");
    await ed.getByLabel("Địa chỉ 2").fill("https://zalo.me/0900000000");
    await expect(c.locator(".ecx-social li:not(.ecx-ph-add)")).toHaveText(["Facebook", "Zalo"]);
    await ed.locator("[data-social-row='1']").getByRole("button", { name: "Lên" }).click();
    expect((await blockOf(page, "socialLinks")).attrs.links.map((l: { service: string }) => l.service)).toEqual(["zalo", "facebook"]);
    await ed.locator("[data-social-row='1']").getByRole("button", { name: "Xoá liên kết" }).click();
    await expect(c.locator(".ecx-social li:not(.ecx-ph-add)")).toHaveText(["Zalo"]);
  });

  test("tab Kiểu dáng: một kiểu giao diện, màu preset, đặt lại; cỡ chữ theo khổ điện thoại hiện giá trị kế thừa", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await insp(page).getByRole("tab", { name: "Kiểu dáng" }).click();
    await expect(insp(page).locator("[class*='cms-ed']")).toHaveCount(0);
    const color = insp(page).locator(".ecx-style-section", { hasText: "Màu" }).first();
    await color.getByRole("button", { name: "Chữ: accent" }).click().catch(async () => { await color.locator(".ecx-chip-swatch").nth(1).click(); });
    expect((await blockOf(page, "paragraph")).attrs.style?.color?.text).toBeTruthy();
    await color.getByRole("button", { name: "Đặt lại" }).click();
    expect((await blockOf(page, "paragraph")).attrs.style?.color).toBeUndefined();
    const typo = insp(page).locator(".ecx-style-section").first();
    await typo.getByRole("radio", { name: "lg" }).click();
    await insp(page).getByRole("radio", { name: /Điện thoại|Mobile/ }).first().click();
    await expect(typo.getByLabel(/Cỡ chữ.*tuỳ chỉnh|Cỡ chữ: /).first()).toHaveAttribute("placeholder", /lg/);
    await typo.getByRole("radio", { name: "sm" }).click();
    expect((await blockOf(page, "paragraph")).attrs.style.fontSize).toEqual({ base: "lg", mobile: "sm" });
  });

  test("menu ⋮ của thanh công cụ cố định không bị cắt: hiện trọn và bấm được", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("ecx-editor-prefs", JSON.stringify({ fixedToolbar: true })));
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await page.locator(".ecx-fixed-toolbar").getByRole("button", { name: "Thêm", exact: true }).click();
    const item = page.getByRole("menuitem", { name: "Nhân bản" });
    await expect(item).toBeVisible();
    const box = (await item.boundingBox())!;
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest("[role=menuitem]"), [box.x + box.width / 2, box.y + box.height / 2])).toBe(true);
    await item.click();
    expect((await state(page)).docs.root.blocks.length).toBe(4);
    void showToolbar;
  });
});
