import { expect, test } from "@playwright/test";
import { canvas, clickEnd, mod, open, state, texts } from "./helpers";

/** Header/footer (phần dùng chung) sửa ngay trong template. */
test.describe("tài liệu lồng (header / footer)", () => {
  test("header, footer tải qua host và hiện dữ liệu thật của khối động", async ({ page }) => {
    const c = await open(page);
    await expect(c.locator(".ecx-template-part-header .ecx-site-title")).toHaveText("ECOMCX Demo");
    await expect(c.locator(".ecx-template-part-header .ecx-navigation-menu li")).toHaveText(["Trang chủ", "Giới thiệu", "Liên hệ"]);
    await expect(c.locator(".ecx-template-part-footer")).toContainText("Chân trang © ECOMCX");
    await expect(c.locator("header.ecx-template-part")).toHaveCount(1);
    await expect(c.locator("footer.ecx-template-part")).toHaveCount(1);
  });

  test("sửa chữ trong footer ngay tại template: chỉ footer có thay đổi; Lưu gọi host.documents.save cho footer", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Chân trang © ECOMCX");
    await page.keyboard.type(" 2026");
    expect(await texts(page, "part:footer")).toContain("paragraph:Chân trang © ECOMCX 2026");
    expect(await texts(page)).not.toContain("paragraph:Chân trang © ECOMCX 2026");
    const save = page.locator(".ecx-save");
    await expect(save).toHaveText("Lưu");
    await save.click();
    await expect(save).toHaveText("Đã lưu");
    const saves = await page.evaluate(() => (window as any).__ecx.saves);
    expect(saves.map((s: { kind: string; ref: unknown }) => `${s.kind}:${s.ref}`)).toEqual(["part:footer"]);
    expect(JSON.stringify(saves[0].content)).toContain("Chân trang © ECOMCX 2026");
  });

  test("sửa cả template và footer: nút Lưu báo 2 tài liệu, lưu cả hai trong một lần", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Chân trang © ECOMCX");
    await page.keyboard.type("!");
    await clickEnd(c, "Đây là đoạn văn đầu tiên.");
    await page.keyboard.type("!");
    const save = page.locator(".ecx-save");
    await expect(save).toHaveText("Lưu (2)");
    await page.keyboard.press(`${mod}+s`);
    await expect(save).toHaveText("Đã lưu");
    const kinds = (await page.evaluate(() => (window as any).__ecx.saves)).map((s: { kind: string }) => s.kind).sort();
    expect(kinds).toEqual(["part", "root"]);
  });

  test("hoàn tác xuyên tài liệu: ⌘Z trả lại chữ của footer và hết 'có thay đổi'", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Chân trang © ECOMCX");
    await page.keyboard.type(" xyz");
    await page.keyboard.press(`${mod}+z`);
    expect(await texts(page, "part:footer")).toContain("paragraph:Chân trang © ECOMCX");
    await expect(page.locator(".ecx-save")).toHaveText("Đã lưu");
  });

  test("bấm đúp header → chế độ tập trung chỉ hiện header; Quay lại về template", async ({ page }) => {
    const c = await open(page);
    await c.locator(".ecx-template-part-header").dblclick({ position: { x: 5, y: 5 } });
    await expect(c.locator(".ecx-focus-bar")).toBeVisible();
    await expect(c.locator(".ecx-canvas-root")).toHaveAttribute("data-ecx-doc", "part:header");
    await expect(c.locator("h1", { hasText: "Chào mừng tới website" })).toHaveCount(0);
    await expect(c.locator(".ecx-site-title")).toBeVisible();
    await c.getByRole("button", { name: "← Quay lại" }).click();
    await expect(c.locator(".ecx-canvas-root")).toHaveAttribute("data-ecx-doc", "root");
    await expect(c.locator("h1", { hasText: "Chào mừng tới website" })).toBeVisible();
  });

  test("thanh công cụ của phần dùng chung có 'Chỉnh sửa bản gốc'", async ({ page }) => {
    const c = await open(page);
    await page.getByRole("button", { name: "Cây khối" }).click();
    await page.locator(".ecx-list-row", { hasText: "Phần dùng chung · footer" }).click();
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chỉnh sửa bản gốc" }).click();
    await expect(c.locator(".ecx-canvas-root")).toHaveAttribute("data-ecx-doc", "part:footer");
    await expect(c.locator(".ecx-canvas-root")).toContainText("Chân trang © ECOMCX");
  });

  test("cây khối hiện khối con của header (lấy từ tài liệu lồng)", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Cây khối" }).click();
    const row = page.locator(".ecx-list-row", { hasText: "Phần dùng chung · header" });
    // Cấp ngoài cùng mở sẵn: thấy khối con của header; thu lại thì ẩn
    await expect(page.locator(".ecx-list-row", { hasText: "Nhóm" })).toBeVisible();
    await row.getByRole("button", { name: "Collapse" }).click();
    await expect(page.locator(".ecx-list-row", { hasText: "Nhóm" })).toHaveCount(0);
  });

  test("kéo đoạn văn từ template vào footer: chuyển giữa hai tài liệu, một lần hoàn tác", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Đây là đoạn văn đầu tiên.");
    const h = await page.locator(".ecx-drag-handle").boundingBox();
    const target = await c.locator("p", { hasText: "Chân trang © ECOMCX" }).boundingBox();
    await page.mouse.move(h!.x + 8, h!.y + 8);
    await page.mouse.down();
    await page.mouse.move(h!.x + 40, h!.y + 40, { steps: 4 });
    await page.mouse.move(target!.x + 20, target!.y + target!.height - 3, { steps: 10 });
    await page.mouse.up();
    expect(await texts(page, "part:footer")).toEqual(["paragraph:Chân trang © ECOMCX", "paragraph:Đây là đoạn văn đầu tiên."]);
    expect(await texts(page)).not.toContain("paragraph:Đây là đoạn văn đầu tiên.");
    await expect(page.locator(".ecx-save")).toHaveText("Lưu (2)");
    await page.keyboard.press(`${mod}+z`);
    expect(await texts(page)).toContain("paragraph:Đây là đoạn văn đầu tiên.");
    expect(await texts(page, "part:footer")).toEqual(["paragraph:Chân trang © ECOMCX"]);
  });

  test("lưu phần dùng chung lỗi: báo lỗi, vẫn còn 'có thay đổi', tài liệu gốc vẫn lưu được", async ({ page }) => {
    const c = await open(page, "?failSave=part");
    await clickEnd(c, "Chân trang © ECOMCX");
    await page.keyboard.type("!");
    await clickEnd(c, "Đây là đoạn văn đầu tiên.");
    await page.keyboard.type("!");
    await page.locator(".ecx-save").click();
    await expect(page.locator(".ecx-notice.is-error")).toContainText("Lưu phần dùng chung thất bại");
    await expect(page.locator(".ecx-save")).toHaveText("Lưu");
    const st = await state(page);
    expect(st.docs["part:footer"].blocks).not.toEqual(st.docs["part:footer"].saved);
    expect(st.docs.root.blocks).toEqual(st.docs.root.saved);
  });

  test("onChange chỉ báo khi tài liệu gốc đổi, đúng định dạng lưu", async ({ page }) => {
    const c = await open(page);
    const before = await page.evaluate(() => (window as any).__ecx.changes);
    await clickEnd(c, "Chân trang © ECOMCX");
    await page.keyboard.type("!");
    expect(await page.evaluate(() => (window as any).__ecx.changes)).toBe(before);
    await clickEnd(c, "Đây là đoạn văn đầu tiên.");
    await page.keyboard.type("!");
    expect(await page.evaluate(() => (window as any).__ecx.changes)).toBeGreaterThan(before);
  });
});
