import { expect, test } from "@playwright/test";
import { clickEnd, open, state, texts } from "./helpers";

/** Gắn dữ liệu: chọn nguồn ở bảng cài đặt → khung soạn hiện giá trị xem trước, không sửa tay; bỏ gắn → gõ lại được. */
const panel = (page: import("@playwright/test").Page) => page.locator("details.ecx-bindings");

test.describe("gắn dữ liệu", () => {
  test("tiêu đề gắn với tiêu đề bài: xem trước giá trị mẫu, không gõ được, lưu attrs.bindings; bỏ gắn trả lại chữ cũ", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Tiêu đề bài");
    await panel(page).locator("summary").click();
    await page.getByLabel("Nội dung: nguồn").selectOption("core/post");
    await expect(page.getByLabel("Nội dung: trường")).toHaveValue("title");
    expect((await state(page)).docs.root.blocks[0].attrs.bindings).toEqual({ content: { source: "core/post", args: { field: "title" } } });
    const bound = c.locator("h2[data-ecx-bound]");
    await expect(bound).toHaveText("Bài viết mẫu");
    await expect(bound).toHaveAttribute("title", "Bài đang xem › Tiêu đề");
    await expect(c.locator("h2 [contenteditable]")).toHaveCount(0);
    await page.getByLabel("Nội dung: trường").selectOption("author");
    await expect(bound).toHaveText("Admin");
    // Không có dữ liệu mẫu → hiện tên nguồn
    await page.getByLabel("Nội dung: trường").selectOption("link");
    await page.getByLabel("Nội dung: trường").selectOption("featuredImage");
    await expect(bound).toHaveText("[Bài đang xem › Ảnh đại diện]");
    await page.getByRole("button", { name: "Bỏ gắn" }).click();
    expect((await state(page)).docs.root.blocks[0].attrs.bindings).toBeUndefined();
    await clickEnd(c, "Tiêu đề bài");
    await page.keyboard.type("!");
    expect((await texts(page))[0]).toBe("heading:Tiêu đề bài!");
  });

  test("trường meta: nhập khoá, chỉ giữ ký tự hợp lệ; hoàn tác bỏ việc gắn", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await panel(page).locator("summary").click();
    await page.getByLabel("Nội dung: nguồn").selectOption("core/post-meta");
    await page.getByLabel("Nội dung: key").fill("gia ban<>");
    expect((await state(page)).docs.root.blocks[1].attrs.bindings).toEqual({ content: { source: "core/post-meta", args: { key: "giaban" } } });
    await expect(c.locator("p[data-ecx-bound]")).toHaveText("{giaban}");
    const undo = page.locator(".ecx-topbar").getByRole("button", { name: "Hoàn tác" });
    for (let i = 0; i < 12 && (await state(page)).docs.root.blocks[1].attrs.bindings; i++) await undo.click();
    expect((await state(page)).docs.root.blocks[1].attrs.bindings).toBeUndefined();
    await expect(c.locator("[data-ecx-rich]", { hasText: "Nội dung bài viết." })).toBeVisible();
  });

  test("nguồn của plugin (registerBindingSource) xuất hiện và xem trước bất đồng bộ; nút gắn chữ", async ({ page }) => {
    const c = await open(page, "?doc=rich&plugin=1");
    const btn = c.locator(".ecx-button [data-ecx-rich]").first();
    test.skip(!(await btn.count()), "playground không có khối nút");
    await btn.click();
    await panel(page).locator("summary").click();
    await page.getByLabel("Chữ trên nút: nguồn").selectOption("acme/product");
    await expect(c.locator(".ecx-button [data-ecx-bound]").first()).toHaveText("199.000 ₫");
    await page.getByLabel("Chữ trên nút: trường").selectOption("stock");
    await expect(c.locator(".ecx-button [data-ecx-bound]").first()).toHaveText("12 cái");
  });
});

test("ảnh gắn ảnh đại diện của bài: chưa có ảnh mẫu → khung chờ ghi tên nguồn; mô tả ảnh gắn tiêu đề", async ({ page }) => {
  const c = await open(page, "?doc=rich");
  await c.locator("figure.ecx-image img").click();
  await panel(page).locator("summary").click();
  await page.getByLabel("Mô tả ảnh: nguồn").selectOption("core/post");
  await expect(c.locator("figure.ecx-image img")).toHaveAttribute("alt", "Bài viết mẫu");
  await page.getByLabel("Ảnh: nguồn", { exact: true }).selectOption("core/post");
  await page.getByLabel("Ảnh: trường", { exact: true }).selectOption("featuredImage");
  await expect(c.locator(".ecx-bound-media")).toHaveText("[Bài đang xem › Ảnh đại diện]");
  const img = (await state(page)).docs.root.blocks.find((b: { type: string }) => b.type === "image");
  expect(img.attrs.bindings).toEqual({ alt: { source: "core/post", args: { field: "title" } }, src: { source: "core/post", args: { field: "featuredImage" } } });
  expect(img.attrs.src).toContain("sample.svg");
});
