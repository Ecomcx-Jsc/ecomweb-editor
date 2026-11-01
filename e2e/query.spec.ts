import { expect, test, type Page } from "@playwright/test";
import { clickEnd, open, state } from "./helpers";

/** Danh sách bài sửa được: mỗi mục là bài thật (host.queryPosts), sửa khuôn trên bài đang chọn, các mục khác cập nhật theo. */
const items = (c: ReturnType<typeof import("./helpers").canvas>) => c.locator(".ecx-post-template > li.ecx-post");
const setQuery = (page: Page, attrs: Record<string, unknown>) => page.evaluate((a) => {
  const s = (window as unknown as { __ecx: { store: { getState(): any; setAttrs(ids: string[], a: object): void } } }).__ecx.store;
  s.setAttrs([s.getState().docs.root.blocks[1].id], a);
}, attrs);

test.describe("danh sách bài", () => {
  test("mỗi mục hiện bài thật; mục đầu sửa được, mục sau là bản xem trước", async ({ page }) => {
    const c = await open(page, "?doc=loop");
    await expect(items(c)).toHaveCount(3);
    await expect(items(c).nth(0).locator(".ecx-post-title")).toHaveText("Khai trương cửa hàng");
    await expect(items(c).nth(1).locator(".ecx-post-title")).toHaveText("Bộ sưu tập mùa đông");
    await expect(items(c).nth(2).locator(".ecx-post-title")).toHaveText("Giảm giá cuối tuần");
    await expect(items(c).nth(0)).toHaveClass(/is-active/);
    await expect(items(c).nth(1).locator("[contenteditable=true]")).toHaveCount(0);
    expect((await page.evaluate(() => (window as any).__ecx.queries.at(-1)))).toMatchObject({ inherit: false, perPage: 3, postType: "post", orderBy: "date", order: "desc" });
  });

  test("sửa chữ trong khuôn: mọi mục đổi theo, dữ liệu lưu một khuôn", async ({ page }) => {
    const c = await open(page, "?doc=loop");
    await expect(items(c)).toHaveCount(3);
    await clickEnd(c, "Đọc thêm");
    await page.keyboard.type(" ngay");
    await expect(items(c).nth(1).locator("p", { hasText: "Đọc thêm ngay" })).toHaveCount(1);
    await expect(items(c).nth(2).locator("p", { hasText: "Đọc thêm ngay" })).toHaveCount(1);
    const tpl = (await state(page)).docs.root.blocks[1].content[0];
    expect(tpl.content.map((b: { type: string }) => b.type)).toEqual(["postTitle", "postDate", "paragraph"]);
  });

  test("bấm mục khác: khuôn sửa trên bài đó; chọn khối trong mục đó là khối thật của khuôn", async ({ page }) => {
    const c = await open(page, "?doc=loop");
    await expect(items(c)).toHaveCount(3);
    await items(c).nth(2).click({ position: { x: 30, y: 12 } });
    await expect(items(c).nth(2)).toHaveClass(/is-active/);
    await expect(items(c).nth(0).locator(".ecx-post-title")).toHaveText("Khai trương cửa hàng");
    await items(c).nth(2).locator(".ecx-post-title").click();
    const st = await state(page);
    const title = st.docs.root.blocks[1].content[0].content[0];
    expect(st.selection.ids).toEqual([title.id]);
    const para = c.locator(".ecx-post.is-active [data-ecx-rich]", { hasText: "Đọc thêm" });
    const box = (await para.boundingBox())!;
    await para.click({ position: { x: box.width - 4, y: box.height / 2 } });
    await page.keyboard.type("!");
    await expect(items(c).nth(0).locator("p", { hasText: "Đọc thêm!" })).toHaveCount(1);
  });

  test("đổi thiết lập (số bài, chuyên mục, sắp xếp) → danh sách tải lại; không có bài → báo, khuôn vẫn sửa được", async ({ page }) => {
    const c = await open(page, "?doc=loop");
    await expect(items(c)).toHaveCount(3);
    await setQuery(page, { category: "tin-tuc" });
    await expect(items(c)).toHaveCount(2);
    await expect(items(c).nth(1).locator(".ecx-post-title")).toHaveText("Giảm giá cuối tuần");
    await setQuery(page, { category: undefined, orderBy: "title", order: "asc", perPage: 4 });
    await expect(items(c)).toHaveCount(4);
    await expect(items(c).nth(0).locator(".ecx-post-title")).toHaveText("Bộ sưu tập mùa đông");
    await setQuery(page, { category: "khong-co" });
    await expect(c.locator(".ecx-post-none")).toBeVisible();
    await expect(items(c)).toHaveCount(2); // dòng báo + khuôn
    await clickEnd(c, "Đọc thêm");
    await page.keyboard.type("?");
    expect(JSON.stringify((await state(page)).docs.root.blocks[1])).toContain("Đọc thêm?");
  });

  test("bảng cài đặt của khối danh sách hiện thiết lập truy vấn", async ({ page }) => {
    const c = await open(page, "?doc=loop");
    await expect(items(c)).toHaveCount(3);
    await page.getByRole("button", { name: "Cây khối" }).click();
    await page.locator(".ecx-list-row", { hasText: "Danh sách bài" }).first().click();
    await expect(page.locator(".ecx-inspector")).toContainText("Danh sách bài");
    await expect(page.locator(".ecx-inspector select, .ecx-inspector input").first()).toBeVisible();
    void c;
  });
});
