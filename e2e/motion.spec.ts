import { expect, test, type Page } from "@playwright/test";
import { clickEnd, open, showToolbar, state } from "./helpers";

/** Chuyển động (@ecomcx/ecomweb-content 1.16): chọn hiệu ứng cuộn / hover một cú bấm, lưu đúng, xem thử trên khung soạn. */
const groupOf = async (page: Page) => (await state(page)).docs.root.blocks.find((b: { type: string }) => b.type === "group");

async function groupInspector(page: Page) {
  const c = await open(page, "?doc=post");
  await clickEnd(c, "Đoạn thứ hai.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/nhom");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Thẻ");
  await showToolbar(page);
  await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
  const insp = page.locator(".ecx-inspector");
  await insp.getByRole("tab", { name: "Kiểu dáng" }).click();
  await insp.getByRole("button", { name: "Chuyển động" }).click();
  return { c, insp };
}

test.describe("chuyển động", () => {
  test("chọn hiệu ứng cuộn: lưu vào style.motion, hiện tuỳ chọn phụ, xem thử chạy animation thật", async ({ page }) => {
    const { c, insp } = await groupInspector(page);
    await expect(insp.getByLabel("Tốc độ")).toHaveCount(0); // chưa chọn hiệu ứng thì chưa có tuỳ chọn phụ
    await insp.getByRole("radio", { name: "Trượt lên" }).click();
    let g = await groupOf(page);
    expect(g.attrs.style.motion).toEqual({ in: "slide-up" });
    await insp.getByRole("radio", { name: "Chậm" }).click();
    await insp.getByLabel("Độ trễ").selectOption("200");
    await insp.getByLabel("Chạy lại mỗi lần cuộn tới").check();
    await insp.getByLabel("Hiện lần lượt từng khối con").check(); // nhóm là khối chứa nên có tuỳ chọn này
    g = await groupOf(page);
    expect(g.attrs.style.motion).toEqual({ in: "slide-up", duration: "slow", delay: 200, repeat: true, stagger: true });

    // Xem thử: khối nhận is-in và có animation đúng tên (keyframes do website nạp)
    const el = c.locator(`[data-ecx-block="${g.id}"]`);
    await insp.getByRole("button", { name: "Xem thử" }).click();
    await expect.poll(() => el.evaluate((n) => getComputedStyle(n.firstElementChild!).animationName)).toBe("ecx-in-slide-up");
    // Khung soạn không bao giờ ẩn khối khi chỉnh
    await expect(el).toHaveCSS("opacity", "1");

    // Chọn "Không" gỡ sạch (kể cả tuỳ chọn phụ)
    await insp.getByRole("radio", { name: "Không" }).first().click();
    g = await groupOf(page);
    expect(g.attrs.style?.motion).toBeUndefined();
  });

  test("hover một chạm: Nhấc lên → có transition và transform khi rê chuột; Đặt lại gỡ sạch", async ({ page }) => {
    const { c, insp } = await groupInspector(page);
    await insp.getByRole("radiogroup", { name: "Hiệu ứng rê chuột" }).getByRole("radio", { name: "Nhấc lên" }).click();
    const g = await groupOf(page);
    expect(g.attrs.style.motion).toEqual({ hover: "lift" });
    const el = c.locator(`[data-ecx-block="${g.id}"]`);
    await expect.poll(() => el.evaluate((n) => getComputedStyle(n).transitionProperty)).toContain("transform");
    await el.hover();
    await expect.poll(() => el.evaluate((n) => getComputedStyle(n).transform)).not.toBe("none");
    await insp.getByRole("button", { name: "Đặt lại" }).last().click();
    expect((await groupOf(page)).attrs.style?.motion).toBeUndefined();
  });

  test("hiệu ứng của plugin (registerAnimation) hiện trong danh sách, chọn được và có keyframes để xem thử", async ({ page }) => {
    const { c, insp } = await groupInspector(page);
    await page.evaluate(async () => {
      const m = (window as any).__ecx;
      m.registerAnimation({ id: "acme-pop", label: "Bật lên", group: "Nảy", css: "@keyframes ecx-in-acme-pop{from{opacity:0;scale:.5}}" });
    });
    await insp.getByLabel("Hiệu ứng khác").selectOption("acme-pop");
    const g = await groupOf(page);
    expect(g.attrs.style.motion).toEqual({ in: "acme-pop" });
    const css = await c.locator("html").evaluate((h) => h.ownerDocument.querySelector("style[data-ecx=motion]")?.textContent ?? "");
    expect(css).toContain("ecx-in-acme-pop");
  });
});
