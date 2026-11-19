import { expect, test, type Page } from "@playwright/test";
import { open, state } from "./helpers";

const tableBlock = async (page: Page) => {
  const st = await state(page);
  const find = (l: any[]): any => { for (const b of l) { if (b.type === "table") return b; const f = b.content && find(b.content); if (f) return f; } };
  return find(st.docs.root.blocks);
};

test("bảng: bôi đen 2 ô rồi chuột phải → menu bảng (gộp ô…) ; chuột phải trong một ô → thêm / xoá hàng, cột", async ({ page }) => {
  const c = await open(page, "?doc=rich");
  const cells = c.locator('[data-type="table"] td, [data-type="table"] th');
  await expect(cells.first()).toBeVisible();
  const a = await cells.nth(0).boundingBox(), b = await cells.nth(1).boundingBox();
  // bấm ô 1, Shift+bấm ô 2 → vùng ô được chọn
  await page.mouse.click(a!.x + 8, a!.y + 8);
  await page.keyboard.down("Shift"); await page.mouse.click(b!.x + b!.width - 8, b!.y + 8); await page.keyboard.up("Shift");
  await expect.poll(() => page.evaluate(() => (window as any).__ecx.store.getState().selection.ids.length)).toBe(2);
  await page.mouse.click(b!.x + b!.width / 2, b!.y + b!.height / 2, { button: "right" });
  const menu = page.locator(".ecx-context-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Gộp các ô đã chọn" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Xoá nội dung ô" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Nhân đôi/ })).toHaveCount(0); // chỉ thao tác của bảng
  const before = (await tableBlock(page)).content[0].content.length;
  await menu.getByRole("menuitem", { name: "Gộp các ô đã chọn" }).click();
  const t = await tableBlock(page);
  expect(t.content[0].content.length).toBe(before - 1);
  expect(Number(t.content[0].content[0].attrs.colspan)).toBe(2);
  // chuột phải trong một ô thường: menu có thao tác hàng / cột + menu khối bình thường
  const one = await cells.nth(2).boundingBox();
  await page.mouse.click(one!.x + 8, one!.y + 8, { button: "right" });
  await expect(menu.getByRole("menuitem", { name: /Thêm hàng/ }).first()).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Thêm cột bên phải" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Xoá cột" })).toBeVisible();
});

test("chuột phải ngay trong chữ của cột / tab → nhân đôi / xoá cả cột / tab đó, chọn lên phần tử", async ({ page }) => {
  const c = await open(page, "?empty=1&content=1");
  const p = (id: string, t: string) => ({ id, type: "paragraph", attrs: {}, inline: [{ type: "text", text: t }] });
  await page.evaluate((nodes) => (window as any).__ecx.store.insert("root", null, 0, nodes), [{ id: "cs", type: "columns", attrs: {}, content: [{ id: "c1", type: "column", attrs: {}, content: [p("p1", "Cột một")] }, { id: "c2", type: "column", attrs: {}, content: [p("p2", "Cột hai")] }] }]);
  await c.locator('[data-ecx-block="p1"]').click({ button: "right" });
  const menu = page.locator(".ecx-context-menu");
  await expect(menu.getByRole("menuitem", { name: /^Nhân bản: / })).toBeVisible();
  await menu.getByRole("menuitem", { name: /^Nhân bản: / }).click();
  expect((await state(page)).docs.root.blocks[0].content.length).toBe(3);
});

test("mẫu đồng bộ: bảng phải liệt kê ô cho sửa riêng; nhập giá trị → lưu vào overrides, để trống = theo mẫu", async ({ page }) => {
  const c = await open(page, "?empty=1&content=1");
  await page.evaluate(() => (window as any).__ecx.store.insert("root", null, 0, [{ id: "sp", type: "syncedPattern", attrs: { ref: 7 } }]));
  await expect(c.locator('[data-ecx-block="sp"] h2')).toContainText("Giảm giá mùa hè");
  await page.evaluate(() => (window as any).__ecx.store.select(["sp"], { editing: null }));
  const insp = page.locator(".ecx-inspector");
  const sec = insp.locator('[data-override="tieu-de"]');
  await expect(sec).toBeVisible();
  await sec.getByLabel("tieu-de: content").fill("Giảm 50% hôm nay");
  const read = async () => ((await state(page)).docs.root.blocks.find((b: any) => b.type === "syncedPattern") as any).attrs.overrides;
  expect(await read()).toEqual({ "tieu-de": { content: "Giảm 50% hôm nay" } });
  await sec.getByLabel("tieu-de: content").fill("");
  expect(await read()).toBeUndefined();
  // ô thứ hai của mẫu (nút)
  await insp.locator('[data-override="nut"]').getByLabel("nut: text").fill("Đặt ngay");
  expect(await read()).toEqual({ nut: { text: "Đặt ngay" } });
});

test("gắn dữ liệu có ở hầu hết khối: Info Box / Testimonial / Video / Group có dòng gắn cho từng ô chữ, ảnh, liên kết", async ({ page }) => {
  await open(page, "?empty=1&content=1");
  const insp = page.locator(".ecx-inspector");
  const cases: Array<[any, string[]]> = [
    [{ id: "x", type: "iconBox", attrs: { title: "A", text: "B" } }, ["title", "text", "href"]],
    [{ id: "x", type: "testimonial", attrs: { quote: "Q", name: "N" } }, ["quote", "name", "role", "src"]],
    [{ id: "x", type: "video", attrs: { src: "/a.mp4" } }, ["src", "poster"]],
    [{ id: "x", type: "map", attrs: { address: "Hà Nội" } }, ["address", "title"]],
  ];
  for (const [node, attrs] of cases) {
    await page.evaluate(() => { const st = (window as any).__ecx.store; if (st.block("x")) st.remove(["x"]); });
    await page.evaluate((n) => (window as any).__ecx.store.insert("root", null, 0, [n]), node);
    await page.waitForTimeout(400);
    await page.evaluate(() => (window as any).__ecx.store.select(["x"], { editing: null }));
    await insp.getByText("Cài đặt", { exact: true }).first().click();
    for (const a of attrs) await expect(insp.locator(`[data-binding="${a}"]`), `${node.type}.${a}`).toHaveCount(1);
  }
});

test("Gallery dạng Slider: khung soạn vẽ slide xếp NGANG (cuộn ngang) có nút trước / sau, không xếp dọc như lưới", async ({ page }) => {
  const c = await open(page, "?empty=1&content=1");
  const img = (n: number) => ({ src: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120'%3E%3Crect width='200' height='120' fill='%23${n}${n}${n}'/%3E%3C/svg%3E`, alt: `a${n}` });
  await page.evaluate((images) => (window as any).__ecx.store.insert("root", null, 0, [{ id: "g", type: "gallery", attrs: { layout: "slider", columns: 1, images, arrows: true, dots: true } }]), [img(1), img(5), img(9)]);
  const slides = c.locator('[data-ecx-block="g"] .ecx-carousel-slide');
  await expect(slides).toHaveCount(3);
  const [a, b] = await Promise.all([slides.nth(0).boundingBox(), slides.nth(1).boundingBox()]);
  expect(b!.x).toBeGreaterThan(a!.x + a!.width / 2); // slide thứ hai nằm bên phải, không nằm dưới
  expect(Math.abs(b!.y - a!.y)).toBeLessThan(4);
  const track = c.locator('[data-ecx-block="g"] .ecx-carousel-track');
  expect(await track.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await c.locator('[data-ecx-block="g"] .ecx-carousel-arrow.is-next').click();
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(10);
});
