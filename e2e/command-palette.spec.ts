// Bảng lệnh (⌘⇧P / Ctrl+Shift+P): thao tác, chế độ xem, chèn khối, nhảy tới khối theo chữ.
import { expect, test } from "@playwright/test";
import { mod, open, state } from "./helpers";

const pal = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Bảng lệnh" });

test("mở bằng phím tắt và nút; Esc đóng; gõ lọc không dấu; Enter chạy lệnh đổi khổ xem", async ({ page }) => {
  await open(page, "?doc=post");
  await page.keyboard.press(`${mod}+Shift+P`);
  await expect(pal(page)).toBeVisible();
  await expect(pal(page).getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pal(page)).toBeHidden();
  await page.getByRole("button", { name: /^Bảng lệnh/ }).click();
  await pal(page).getByRole("combobox").fill("may tinh bang");
  await expect(pal(page).getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(pal(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Máy tính bảng", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("thao tác theo khối đang chọn: Nhân đôi, Chọn khối cha; không chọn khối thì không có lệnh khối", async ({ page }) => {
  await open(page, "?doc=post");
  await page.keyboard.press(`${mod}+Shift+P`);
  await pal(page).getByRole("combobox").fill("nhan doi");
  await expect(pal(page).getByRole("option")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const before = (await state(page)).docs.root.blocks.length;
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.select([s.getState().docs.root.blocks[1].id]); });
  await page.keyboard.press(`${mod}+Shift+P`);
  await pal(page).getByRole("combobox").fill("nhan doi");
  await pal(page).getByRole("option", { name: /Nhân đôi/ }).click();
  await expect.poll(async () => (await state(page)).docs.root.blocks.length).toBe(before + 1);
});

test("nhảy tới khối theo chữ trong trang; chèn khối theo tên cũ ('nhom') mở bảng chèn với từ khoá đó", async ({ page }) => {
  await open(page, "?doc=post");
  await page.keyboard.press(`${mod}+Shift+P`);
  await pal(page).getByRole("combobox").fill("thứ hai");
  const go = pal(page).getByRole("option", { name: /Đi tới: .*thứ hai/i });
  await expect(go).toBeVisible();
  await go.click();
  const sel = await page.evaluate(() => { const s = (window as any).__ecx.store; return s.block(s.getState().selection.ids[0])?.inline?.map((n: any) => n.text).join(""); });
  expect(sel).toContain("thứ hai");
  await page.keyboard.press(`${mod}+Shift+P`);
  await pal(page).getByRole("combobox").fill("nhom");
  await pal(page).getByRole("option", { name: /Chèn: Group/ }).click();
  await expect(page.locator(".ecx-inserter-panel .ecx-search")).toHaveValue("Group");
});

test("Row: Alt + kéo tay nắm giữa hai cột đổi khoảng cách cột (ô Khoảng giữa các cột), kéo thường vẫn đổi độ rộng", async ({ page }) => {
  const c = await open(page, "?empty=1&content=1");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "x", type: "columns", attrs: {}, content: [{ id: "c1", type: "column", attrs: {}, content: [{ id: "p1", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "A" }] }] }, { id: "c2", type: "column", attrs: {}, content: [{ id: "p2", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "B" }] }] }] }]); s.select(["x"]); });
  await page.waitForTimeout(500);
  const handle = c.locator("[data-ecx-col-handle]").first();
  const box = (await handle.boundingBox())!;
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  const gap = await page.evaluate(() => (window as any).__ecx.store.block("x").attrs.columnsGap);
  expect(gap?.base).toMatch(/^\d+px$/);
  expect(parseInt(gap.base, 10)).toBeGreaterThan(40); // 24px mặc định + 2 × 30
  const widths = await page.evaluate(() => (window as any).__ecx.store.block("x").content.map((k: any) => k.attrs.width));
  expect(widths.every((w: unknown) => w === undefined)).toBe(true); // Alt-kéo không đổi độ rộng
});

test("Section: kéo dải trái / phải của đệm đổi padding-left / padding-right (lưu px theo khổ đang xem)", async ({ page }) => {
  const c = await open(page, "?doc=empty");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "x", type: "group", attrs: { style: { padding: { base: { top: "40px", right: "40px", bottom: "40px", left: "40px" } } } }, content: [{ id: "p1", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Nội dung" }] }] }]); });
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__ecx.store.select(["x"]));
  await page.waitForTimeout(400);
  const zone = c.locator('[data-ecx-block="x"] [data-ecx-zone="padding-left"]');
  const box = (await zone.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  const pad = await page.evaluate(() => (window as any).__ecx.store.block("x").attrs.style.padding.base);
  expect(parseInt(pad.left, 10)).toBeGreaterThan(80);
  expect(pad.right).toBe("40px"); // cạnh khác giữ nguyên
  const zr = c.locator('[data-ecx-block="x"] [data-ecx-zone="padding-right"]');
  const br = (await zr.boundingBox())!;
  await page.mouse.move(br.x + br.width / 2, br.y + br.height / 2);
  await page.mouse.down();
  await page.mouse.move(br.x + br.width / 2 - 50, br.y + br.height / 2, { steps: 6 }); // kéo vào trong = tăng
  await page.mouse.up();
  expect(parseInt((await page.evaluate(() => (window as any).__ecx.store.block("x").attrs.style.padding.base)).right, 10)).toBeGreaterThan(80);
});
