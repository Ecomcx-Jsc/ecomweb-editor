import { expect, test } from "@playwright/test";
import { clickEnd, open, showToolbar } from "./helpers";

/**
 * Hồi quy giao diện: ảnh chụp các màn hình chính so với ảnh chuẩn (e2e/visual.spec.ts-snapshots/). Giao diện đổi có chủ ý →
 * chạy `npx playwright test e2e/visual.spec.ts --update-snapshots` rồi xem lại ảnh mới trước khi commit.
 */
test.describe("giao diện (ảnh chụp)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "ảnh chuẩn chụp trên Chromium");
  const shot = { maxDiffPixelRatio: 0.01, animations: "disabled" as const, caret: "hide" as const };

  test("template có header/footer + bảng cài đặt trống", async ({ page }) => {
    await open(page);
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot("template.png", shot);
  });

  test("đang sửa đoạn văn: thanh công cụ + bảng cài đặt khối + đường dẫn khối", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Cột trái");
    await showToolbar(page);
    await expect(page).toHaveScreenshot("editing.png", shot);
  });

  test("thư viện khối", async ({ page }) => {
    await open(page, "?doc=post");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    await page.mouse.move(0, 0);
    await expect(page.locator(".ecx-left")).toHaveScreenshot("inserter.png", shot);
  });

  test("menu tuỳ chọn + hộp tuỳ chọn", async ({ page }) => {
    await open(page, "?doc=post");
    await page.getByRole("button", { name: "Tuỳ chọn", exact: true }).click();
    await expect(page.locator(".ecx-menu.is-floating")).toHaveScreenshot("options-menu.png", shot);
    await page.getByRole("menu").getByText("Tuỳ chọn trình soạn…").click();
    await page.getByRole("dialog").getByRole("tab", { name: "Khối" }).click();
    await expect(page.locator(".ecx-modal")).toHaveScreenshot("preferences-blocks.png", shot);
  });

  test("gõ / mở danh sách chèn khối", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    // Chuột không nằm trên danh sách (rê chuột đổi mục đang chọn)
    await page.mouse.move(1400, 880);
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    await expect(page.locator(".ecx-inserter-popover")).toHaveScreenshot("slash.png", shot);
  });
});
