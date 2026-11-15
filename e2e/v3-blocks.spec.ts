import { expect, test, type Page } from "@playwright/test";
import { clickEnd, open, state } from "./helpers";

const find = async (page: Page, type: string) => {
  const walk = (list: any[]): any => { for (const b of list) { if (b.type === type) return b; const f = b.content && walk(b.content); if (f) return f; } };
  return walk((await state(page)).docs.root.blocks);
};
const insp = (page: Page) => page.locator(".ecx-inspector");

test.describe("v3: cài đặt riêng từng khối", () => {
  test("nút: chọn icon từ lưới, đặt icon bên phải, rộng hết khung", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    await clickEnd(c, "Nút 1");
    await insp(page).locator(".ecx-icon-picker-btn").click();
    await page.locator(".ecx-icon-pop input").fill("arrowRight");
    await page.locator('.ecx-icon-cell[title="arrowRight"]').click();
    expect((await find(page, "button")).attrs.icon).toBe("arrowRight");
    const a = c.locator("a.ecx-button").first();
    await expect(a.locator("svg")).toHaveCount(1);
    await insp(page).getByRole("radio", { name: "Phải chữ" }).click();
    expect((await find(page, "button")).attrs.iconPosition).toBe("right");
    expect(await a.evaluate((el) => el.lastElementChild?.tagName.toLowerCase())).toBe("svg");
    await insp(page).getByRole("radio", { name: "Hết khung" }).click();
    expect((await find(page, "button")).attrs.width).toBe("full");
    await expect(a).toHaveCSS("display", "flex");
  });

  test("khoảng trống: kéo tay nắm mép dưới đổi chiều cao; một lần ⌘Z trả lại", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/khoang trong");
    await page.keyboard.press("Enter");
    const spacer = c.locator(".ecx-spacer");
    await spacer.click();
    const handle = spacer.locator(".ecx-pad-handle");
    await expect(handle).toBeAttached();
    const before = (await spacer.boundingBox())!.height;
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, box.y + box.height / 2 + 60, { steps: 6 });
    await page.mouse.up();
    expect((await find(page, "spacer")).attrs.height).toBe(`${Math.round(before + 60)}px`);
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    expect((await find(page, "spacer")).attrs.height).toBe("lg");
  });
});

test("cột: hướng đảo, dàn đều quanh, căn chữ, rộng tối đa, liên kết cả cột", async ({ page }) => {
  const c = await open(page, "?doc=rich");
  const col = c.locator(".ecx-column").first();
  await col.locator("[data-ecx-rich]").first().click();
  for (let i = 0; i < 4 && (await page.locator(".ecx-inspector").getByRole("radio", { name: "Dọc, đảo thứ tự" }).count()) === 0; i++)
    await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
  await insp(page).getByRole("radio", { name: "Dọc, đảo thứ tự" }).click();
  await expect(col).toHaveCSS("flex-direction", "column-reverse");
  await insp(page).getByRole("radio", { name: "Dàn đều quanh" }).click();
  await expect(col).toHaveCSS("justify-content", "space-around");
  await insp(page).getByRole("radiogroup", { name: "Căn chữ" }).getByRole("radio", { name: "Giữa" }).click();
  await expect(col).toHaveCSS("text-align", "center");
  await insp(page).getByLabel("Liên kết cả cột").fill("/gioi-thieu");
  await insp(page).getByRole("switch", { name: "Mở tab mới" }).check();
  const attrs = (await find(page, "column")).attrs;
  expect(attrs).toMatchObject({ href: "/gioi-thieu", linkTarget: "_blank" });
  // Bộ cột: rộng tối đa → hàng hẹp lại và nằm giữa
  await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
  await insp(page).getByRole("spinbutton", { name: /Rộng tối đa của hàng/ }).fill("400");
  const row = c.locator(".ecx-columns").first();
  await expect(row).toHaveCSS("max-width", "400px");
  const [box, parent] = await row.evaluate((el) => [el.getBoundingClientRect(), el.parentElement!.getBoundingClientRect()].map((r) => [r.left, r.right]));
  expect(Math.abs((box[0] - parent[0]) - (parent[1] - box[1]))).toBeLessThan(2);
});

test.describe("v3: sửa lỗi bảng bên phải (báo cáo 13, mục 1)", () => {
  const insert = async (page: Page, slash: string, type: string) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type(slash);
    await page.keyboard.press("Enter");
    const id = (await find(page, type)).id;
    await page.evaluate((x) => (window as any).__ecx.store.select([x]), id);
    return c;
  };
  const tab = (page: Page, name: string) => insp(page).locator(".ecx-tabs").getByRole("tab", { name }).click();

  test("tab: có cài đặt — căn tiêu đề tab, tab mở đầu tiên", async ({ page }) => {
    const c = await insert(page, "/tabs", "tabs");
    await insp(page).getByRole("radiogroup", { name: "Căn tiêu đề tab" }).getByRole("radio", { name: "Giữa" }).click();
    await expect(c.locator(".ecx-tabs [role=tablist]")).toHaveCSS("justify-content", "center");
    await insp(page).getByLabel("Tab mở đầu tiên (số thứ tự)").fill("2");
    expect((await find(page, "tabs")).attrs.initial).toBe(2);
    // ô rời mà phần chưa thay: khoảng giữa tiêu đề tab vẫn còn ở Kiểu dáng
    await tab(page, "Kiểu dáng");
    await insp(page).getByRole("button", { name: "Tabs · tuỳ chọn khác" }).click();
    await expect(insp(page).getByText("Khoảng giữa tiêu đề")).toHaveCount(1);
  });

  test("accordion: nhãn tiếng Việt, còn ô khoảng giữa các mục; cột không lộ nhãn thô", async ({ page }) => {
    await insert(page, "/accordion", "accordion");
    await expect(insp(page).getByText("Mở nhiều mục cùng lúc")).toBeVisible();
    await expect(insp(page).getByText("multiple", { exact: true })).toHaveCount(0);
    await tab(page, "Kiểu dáng");
    await insp(page).getByRole("button", { name: "Accordion · tuỳ chọn khác" }).click();
    await expect(insp(page).getByText("Khoảng giữa các mục")).toHaveCount(1);
  });

  test("cột và bộ cột: không nhãn thô, không ô trùng", async ({ page }) => {
    await open(page, "?doc=rich");
    const col = await find(page, "column"), row = await find(page, "columns");
    await page.evaluate((x) => (window as any).__ecx.store.select([x]), col.id);
    await expect(insp(page).getByLabel("Liên kết cả cột")).toBeVisible();
    await expect(insp(page).getByText(/linkTarget|linkLabel/)).toHaveCount(0);
    await page.evaluate((x) => (window as any).__ecx.store.select([x]), row.id);
    await tab(page, "Kiểu dáng");
    await expect(insp(page).getByText(/columnsRowGap|Khoảng giữa các cột/)).toHaveCount(0);
  });

  test("phần của khối: chữ đủ giãn dòng, hoa/thường, phông, giãn chữ; kiểu viền", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    const btn = await find(page, "button");
    await page.evaluate((x) => (window as any).__ecx.store.select([x]), btn.id);
    await tab(page, "Kiểu dáng");
    const i = insp(page);
    if (await i.getByRole("radiogroup", { name: "Viết hoa chữ cái" }).count() === 0) await i.getByRole("button", { name: "Nút", exact: true }).click();
    await i.getByRole("radiogroup", { name: "Viết hoa chữ cái" }).getByRole("radio").nth(1).click();
    await i.getByLabel("Giãn dòng").fill("2");
    const a = c.locator("a.ecx-button").first();
    await expect(a).toHaveCSS("text-transform", "uppercase");
    expect((await find(page, "button")).attrs.parts.button.style).toMatchObject({ textTransform: "uppercase", lineHeight: { base: 2 } });
    await i.getByRole("button", { name: "Nút · tuỳ chọn khác" }).click();
    await expect(i.getByText("Cỡ nút")).toHaveCount(1);
  });
});
