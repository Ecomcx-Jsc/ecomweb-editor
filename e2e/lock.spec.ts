import { expect, test, type Page } from "@playwright/test";
import { HOME, clickEnd, open, showToolbar, state, texts } from "./helpers";

/** Khoá khối: không cho di chuyển / xoá; khoá bố cục bên trong; chỉ cho sửa nội dung. */
const tool = (page: Page, name: string) => page.locator(".ecx-toolbar").getByRole("button", { name, exact: false });
async function lockVia(page: Page, ...options: string[]) {
  await showToolbar(page);
  await page.locator(".ecx-toolbar").getByRole("button", { name: "Thêm", exact: true }).click();
  await page.getByRole("menuitem", { name: "Khoá…" }).click();
  const dlg = page.getByRole("dialog", { name: "Khoá khối" });
  for (const o of options) await dlg.getByLabel(o, { exact: false }).check();
  await dlg.getByRole("button", { name: "Xong" }).click();
}

test.describe("khoá khối", () => {
  test("không cho di chuyển + không cho xoá: thanh công cụ ẩn thao tác, Delete / Backspace không xoá, cây khối có biểu tượng khoá", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await lockVia(page, "Không cho di chuyển", "Không cho xoá");
    expect((await state(page)).docs.root.blocks[1].attrs.lock).toEqual({ move: true, remove: true });
    await showToolbar(page);
    await expect(page.locator(".ecx-toolbar .ecx-drag-handle")).toHaveCount(0);
    await expect(tool(page, "Lên")).toHaveCount(0);
    await expect(tool(page, "Đang khoá")).toBeVisible();
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Thêm", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Xoá" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    // Chọn cả khối rồi Delete: vẫn còn
    await clickEnd(c, "Nội dung bài viết.");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Delete");
    expect(await texts(page)).toContain("paragraph:Nội dung bài viết.");
    // Backspace ở đầu đoạn sau không gộp mất khối bị khoá… và Backspace ở đầu khối khoá không gộp nó vào khối trước
    const el = await clickEnd(c, "Nội dung bài viết.");
    await el.press(HOME);
    await page.keyboard.press("Backspace");
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai."]);
    await page.getByRole("button", { name: "Cây khối" }).click();
    await expect(page.locator(".ecx-list-row", { hasText: "Nội dung bài viết." }).getByLabel("Đang khoá")).toBeVisible();
  });

  test("khoá bố cục bên trong nhóm: Enter không tạo khối, không thêm / kéo khối vào; gõ chữ vẫn được", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/nhom");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Trong nhóm");
    await showToolbar(page);
    await tool(page, "Chọn khối cha").click();
    await lockVia(page, "Khoá bố cục bên trong");
    const group = (await state(page)).docs.root.blocks[3];
    expect(group.attrs.templateLock).toBe("all");
    await clickEnd(c, "Trong nhóm");
    await page.keyboard.press("Enter");
    await page.keyboard.type("!");
    const g = (await state(page)).docs.root.blocks[3];
    expect(g.content.length).toBe(1);
    expect(g.content[0].inline[0].text).toBe("Trong nhóm!");
    // "/" trong nhóm khoá không mở danh sách chèn
    await page.keyboard.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
    await page.keyboard.type("/");
    await expect(page.locator(".ecx-inserter-popover")).toHaveCount(0);
  });

  test("chỉ cho sửa nội dung: khối bên trong không có tab Kiểu dáng, không đổi loại", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Cột trái");
    await showToolbar(page);
    await tool(page, "Chọn khối cha").click();
    await tool(page, "Chọn khối cha").click();
    await lockVia(page, "Chỉ cho sửa nội dung bên trong");
    await clickEnd(c, "Cột trái");
    await expect(page.locator(".ecx-inspector").getByRole("tab", { name: "Kiểu dáng" })).toHaveCount(0);
    await showToolbar(page);
    await expect(tool(page, "Đổi loại khối")).toHaveCount(0);
    await page.keyboard.type(" sửa được");
    expect(await texts(page)).toContain("paragraph:Cột trái sửa được");
  });
});
