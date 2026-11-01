import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Frame, type Page } from "@playwright/test";
import { canvas, clickEnd, open, showToolbar } from "./helpers";

/**
 * Trợ năng (axe-core) cho giao diện trình soạn ở các trạng thái chính — không có lỗi mức nghiêm trọng / nguy hiểm.
 * Kiểm cả phần giao diện của trình soạn trong khung soạn (nút "+", nhãn header/footer, ô trống), không kiểm nội dung của theme.
 */
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
type Target = Page | Frame;
async function audit(target: Target, include?: string[]) {
  // Đợi hiệu ứng hiện ra (mờ dần) xong — không thì axe đo màu chữ đang mờ
  await new Promise((r) => setTimeout(r, 300));
  if (!(await target.evaluate(() => !!(window as any).axe))) await target.evaluate(AXE);
  const res = await target.evaluate(async (sel) => {
    const ctx = sel?.length ? { include: sel.map((s) => [s]) } : document;
    const r = await (window as any).axe.run(ctx, { resultTypes: ["violations"] });
    return r.violations.map((v: any) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0]?.target?.join(" "), html: v.nodes[0]?.html?.slice(0, 120) }));
  }, include ?? null);
  return res.filter((v: { impact: string }) => v.impact === "serious" || v.impact === "critical");
}

test.describe("trợ năng (axe)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "axe cho cùng kết quả trên mọi trình duyệt — chạy một lần");

  test("giao diện chính: thanh trên cùng, bảng cài đặt, thanh công cụ khối", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Đây là đoạn văn đầu tiên.");
    await showToolbar(page);
    expect(await audit(page, [".ecx-topbar", ".ecx-right", ".ecx-toolbar", ".ecx-breadcrumbs"])).toEqual([]);
  });

  test("thư viện khối, mẫu, cây khối", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    expect(await audit(page, [".ecx-left"])).toEqual([]);
    await page.locator(".ecx-inserter-panel").getByRole("tab", { name: "Mẫu" }).click();
    expect(await audit(page, [".ecx-left"])).toEqual([]);
    await page.getByRole("button", { name: "Cây khối" }).click();
    expect(await audit(page, [".ecx-left"])).toEqual([]);
  });

  test("menu tuỳ chọn, hộp tuỳ chọn, bảng phím tắt, popover chèn, hộp liên kết", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await page.getByRole("button", { name: "Tuỳ chọn", exact: true }).click();
    expect(await audit(page, [".ecx-menu"])).toEqual([]);
    await page.getByRole("menu").getByText("Tuỳ chọn trình soạn…").click();
    for (const tab of ["Chung", "Giao diện", "Trợ năng", "Khối"]) {
      await page.getByRole("dialog").getByRole("tab", { name: tab }).click();
      expect(await audit(page, [".ecx-modal"]), tab).toEqual([]);
    }
    await page.keyboard.press("Escape");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    expect(await audit(page, [".ecx-inserter-popover"])).toEqual([]);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Backspace");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Shift+ArrowLeft");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    expect(await audit(page, [".ecx-link-popover"])).toEqual([]);
  });

  test("phần giao diện trình soạn trong khung soạn: tài liệu trống, header/footer, nút +", async ({ page }) => {
    await open(page, "?empty=1");
    const frame = page.frames().find((f) => f.url() === "about:srcdoc")!;
    expect(await audit(frame, [".ecx-canvas-root"])).toEqual([]);
    await open(page);
    const frame2 = page.frames().find((f) => f.url() === "about:srcdoc")!;
    expect(await audit(frame2, [".ecx-nested", ".ecx-default-appender", ".ecx-appender"])).toEqual([]);
    void canvas;
  });
});
