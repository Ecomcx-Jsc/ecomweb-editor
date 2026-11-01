import { expect, test, type Page } from "@playwright/test";
import { canvas, clickEnd, mod, open, showToolbar, state, texts } from "./helpers";

const menu = async (page: Page, item: string) => {
  await page.getByRole("button", { name: "Tuỳ chọn", exact: true }).click();
  await page.getByRole("menu").getByText(item, { exact: true }).click();
};

test.describe("tuỳ chọn trình soạn (menu ⋮)", () => {
  // Xoá tuỳ chọn một lần đầu phiên (tải lại trang trong test vẫn giữ tuỳ chọn vừa lưu)
  test.beforeEach(async ({ page }) => { await page.addInitScript(() => { if (!sessionStorage.getItem("prefs-reset")) { localStorage.removeItem("ecx-editor-prefs"); sessionStorage.setItem("prefs-reset", "1"); } }); });

  test("thanh công cụ cố định: nằm dưới thanh trên cùng, vẫn đổi định dạng được", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await menu(page, "Thanh công cụ cố định");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.type("x");
    const fixed = page.locator(".ecx-fixed-toolbar .ecx-toolbar.is-fixed");
    await expect(fixed).toBeVisible();
    await expect(page.locator(".ecx-toolbar:not(.is-fixed)")).toHaveCount(0);
    await fixed.getByRole("button", { name: "Căn giữa" }).click();
    expect((await state(page)).docs.root.blocks[2].attrs.textAlign).toBe("center");
  });

  test("không phân tâm: ẩn thư viện, cây khối, bảng cài đặt; tắt lại hiện đủ", async ({ page }) => {
    await open(page, "?doc=post");
    await menu(page, "Không phân tâm");
    await expect(page.locator(".ecx-right")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Thêm khối" })).toHaveCount(0);
    await menu(page, "Không phân tâm");
    await expect(page.locator(".ecx-right")).toBeVisible();
  });

  test("làm nổi khối đang sửa: khối khác mờ đi", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await menu(page, "Làm nổi khối đang sửa");
    await clickEnd(c, "Đoạn thứ hai.");
    await expect(c.locator("h2", { hasText: "Tiêu đề bài" })).toHaveCSS("opacity", "0.3");
    await expect(c.locator("p", { hasText: "Đoạn thứ hai." })).toHaveCSS("opacity", "1");
  });

  test("toàn màn hình: trình soạn phủ kín cửa sổ", async ({ page }) => {
    await open(page, "?doc=post");
    await menu(page, "Toàn màn hình");
    await expect(page.locator(".ecx-editor")).toHaveClass(/is-fullscreen/);
    await expect(page.locator(".ecx-editor")).toHaveCSS("position", "fixed");
  });

  test("soạn mã: sửa JSON áp vào khối; JSON hỏng thì báo lỗi và không ghi; ⌘⇧⌥M quay lại", async ({ page }) => {
    await open(page, "?doc=post");
    await menu(page, "Soạn mã");
    const code = page.getByLabel("Soạn mã", { exact: true });
    await expect(code).toBeVisible();
    const json = await code.inputValue();
    expect(json).toContain("Tiêu đề bài");
    await code.fill(json.replace("Đoạn thứ hai.", "Sửa bằng mã"));
    await code.blur();
    expect(await texts(page)).toContain("paragraph:Sửa bằng mã");
    await code.fill("{ hỏng");
    await code.blur();
    await expect(page.locator(".ecx-code-editor .ecx-notice.is-error")).toContainText("Nội dung không hợp lệ");
    expect(await texts(page)).toContain("paragraph:Sửa bằng mã");
    await code.fill(json);
    await code.blur();
    await page.keyboard.press(`${mod}+Shift+Alt+KeyM`);
    await expect(canvas(page).locator(".ecx-canvas-root")).toBeVisible();
  });

  test("hộp Tuỳ chọn: ẩn khối khỏi thư viện và menu /; tuỳ chọn được nhớ sau khi tải lại", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await menu(page, "Tuỳ chọn trình soạn…");
    const dlg = page.getByRole("dialog", { name: "Tuỳ chọn trình soạn" });
    await dlg.getByRole("tab", { name: "Khối" }).click();
    await dlg.locator("[data-block-type='table'] input").uncheck();
    await dlg.getByRole("tab", { name: "Chung" }).click();
    await dlg.getByLabel("Luôn mở cây khối").check();
    await page.keyboard.press("Escape");
    await expect(dlg).toHaveCount(0);
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/bang");
    await expect(page.locator(".ecx-inserter-popover [data-key='table']")).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".ecx-listview")).toBeVisible();
    const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("ecx-editor-prefs") ?? "{}"));
    expect(prefs.hiddenBlockTypes).toContain("table");
  });

  test("giữ con trỏ trong khối: mũi tên phải ở cuối khối không nhảy sang khối sau", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await menu(page, "Tuỳ chọn trình soạn…");
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("tab", { name: "Trợ năng" }).click();
    await dlg.getByLabel("Giữ con trỏ trong khối").check();
    await page.keyboard.press("Escape");
    await clickEnd(c, "Nội dung bài viết.");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("!");
    expect((await texts(page))[1]).toBe("paragraph:Nội dung bài viết.!");
  });

  test("hiện chữ trên nút + đường dẫn khối ở đáy bấm chọn khối cha", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Cột trái");
    const crumbs = page.locator(".ecx-breadcrumbs");
    await expect(crumbs).toContainText("Cột");
    await crumbs.getByRole("button", { name: "Cột", exact: true }).first().click();
    const st = await state(page);
    const columns = st.docs.root.blocks.find((b: { type: string }) => b.type === "columns");
    expect(st.selection.ids).toEqual([columns.id]);
    await menu(page, "Tuỳ chọn trình soạn…");
    await page.getByRole("dialog").getByRole("tab", { name: "Trợ năng" }).click();
    await page.getByRole("dialog").getByLabel("Hiện chữ trên nút").check();
    await page.keyboard.press("Escape");
    await showToolbar(page);
    await expect(page.locator(".ecx-toolbar .ecx-tool-label", { hasText: "Lên" }).first()).toBeVisible();
  });

  test("khối dùng nhiều hiện đầu thư viện; chép toàn bộ nội dung; bảng phím tắt", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/duong ke");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    await expect(page.locator("[data-section='most-used'] [data-key='horizontalRule']")).toBeVisible();
    await menu(page, "Chép toàn bộ nội dung");
    // Ghi clipboard là bất đồng bộ: chờ tới khi có nội dung (đọc clipboard chỉ cấp quyền được ở Chromium)
    if (test.info().project.name === "chromium") await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Tiêu đề bài");
    await menu(page, "Phím tắt");
    await expect(page.getByRole("dialog", { name: "Phím tắt" })).toContainText("Lên thanh công cụ của khối");
  });
});
