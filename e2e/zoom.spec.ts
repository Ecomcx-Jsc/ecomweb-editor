import { expect, test, type Page } from "@playwright/test";
import { clickEnd, open, shape, showToolbar, state, texts } from "./helpers";

/** Thu nhỏ để sắp xếp: thấy cả trang, chọn / di chuyển / xoá cả phần; bấm đúp hoặc Enter để quay lại sửa. */
const zoomBtn = (page: Page) => page.locator(".ecx-topbar").getByRole("button", { name: "Thu nhỏ để sắp xếp" });
const selected = async (page: Page) => (await state(page)).selection.ids as string[];
const topTypes = async (page: Page) => (await state(page)).docs.root.blocks.map((b: { type: string }) => b.type);

test.describe("thu nhỏ", () => {
  test("bật: khung soạn thu còn một nửa; bấm vào chữ trong danh sách chọn cả danh sách, không gõ được", async ({ page }) => {
    const c = await open(page);
    await zoomBtn(page).click();
    await expect(zoomBtn(page)).toHaveAttribute("aria-pressed", "true");
    const frame = page.locator("iframe[data-ecx-canvas]");
    expect(await frame.evaluate((f) => getComputedStyle(f).transform)).toContain("matrix(0.5");
    const before = await texts(page);
    await c.locator("[data-ecx-rich]", { hasText: "Mục hai" }).click();
    const root = (await state(page)).docs.root.blocks;
    expect(await selected(page)).toEqual([root.find((b: { type: string }) => b.type === "bulletList").id]);
    expect((await state(page)).selection.editing ?? null).toBeNull();
    await page.keyboard.type("xyz");
    expect(await texts(page)).toEqual(before);
    // Header (tài liệu lồng) → chọn cả khối phần dùng chung
    await c.locator(".ecx-template-part-header .ecx-site-title").click();
    expect(await selected(page)).toEqual([root[0].id]);
  });

  test("mũi tên đi giữa các phần; nút di chuyển của thanh công cụ đổi chỗ cả phần; Delete xoá, hoàn tác trả lại", async ({ page }) => {
    const c = await open(page);
    await zoomBtn(page).click();
    await c.locator("[data-ecx-rich]", { hasText: "Đây là đoạn văn đầu tiên." }).click();
    const root = (await state(page)).docs.root.blocks;
    expect(await selected(page)).toEqual([root[2].id]);
    await page.keyboard.press("ArrowDown");
    expect(await selected(page)).toEqual([root[3].id]);
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    expect(await selected(page)).toEqual([root[1].id]);
    await page.keyboard.press("ArrowDown");
    await showToolbar(page);
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Xuống", exact: false }).click();
    expect(await topTypes(page)).toEqual(["templatePart", "heading", "bulletList", "paragraph", "columns", "templatePart"]);
    await c.locator("[data-ecx-rich]", { hasText: "Cột phải" }).click();
    await page.keyboard.press("Delete");
    expect(await topTypes(page)).toEqual(["templatePart", "heading", "bulletList", "paragraph", "templatePart"]);
    await page.locator(".ecx-topbar").getByRole("button", { name: "Hoàn tác" }).click();
    expect(((await shape(page)) as unknown[]).length).toBe(6);
  });

  test("bấm đúp một phần: về cỡ thường, phần đó vẫn được chọn; Enter cũng thoát", async ({ page }) => {
    const c = await open(page);
    await zoomBtn(page).click();
    await c.locator("[data-ecx-rich]", { hasText: "Cột trái" }).dblclick();
    await expect(zoomBtn(page)).toHaveAttribute("aria-pressed", "false");
    const root = (await state(page)).docs.root.blocks;
    expect(await selected(page)).toEqual([root[4].id]);
    expect(await page.locator("iframe[data-ecx-canvas]").evaluate((f) => getComputedStyle(f).transform)).toBe("none");
    await zoomBtn(page).click();
    await c.locator("[data-ecx-rich]", { hasText: "Chào mừng tới website" }).click();
    await page.keyboard.press("Enter");
    await expect(zoomBtn(page)).toHaveAttribute("aria-pressed", "false");
    // Thoát rồi thì gõ chữ bình thường
    await clickEnd(c, "Chào mừng tới website");
    await page.keyboard.type("!");
    expect((await texts(page)).some((t) => t.startsWith("heading:Chào mừng tới website!"))).toBe(true);
  });

  test("kéo một phần bằng tay nắm khi đang thu nhỏ", async ({ page }) => {
    const c = await open(page);
    await zoomBtn(page).click();
    await c.locator("[data-ecx-rich]", { hasText: "Chào mừng tới website" }).click();
    await showToolbar(page);
    const handle = page.locator(".ecx-toolbar .ecx-drag-handle");
    const hb = (await handle.boundingBox())!;
    const target = (await c.locator(".ecx-columns").first().boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 10, target.y + target.height - 2, { steps: 12 });
    await page.mouse.up();
    expect(await topTypes(page)).toEqual(["templatePart", "paragraph", "bulletList", "columns", "heading", "templatePart"]);
  });
});
