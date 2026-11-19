// Hộp "Viết bằng AI": chữ markdown nhẹ của AI thành tiêu đề / danh sách / chữ đậm thật; lỗi hiện câu hướng dẫn; có gợi ý nhanh và tuỳ chọn.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

async function openAi(page: import("@playwright/test").Page) {
  await open(page, "?doc=empty&ai=1");
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  await page.locator('.ecx-inserter-popover [data-key="ai-write"], .ecx-inserter-panel [data-key="ai-write"]').first().click();
  await expect(page.locator("[data-ecx-ai-write]")).toBeVisible();
}

test("Viết bằng AI: markdown thành khối thật, xem trước không còn ## / **, chèn ra tiêu đề + danh sách", async ({ page }) => {
  await openAi(page);
  await page.locator("[data-ai-write-prompt]").fill("demo-md giới thiệu cửa hàng");
  await page.locator("[data-ai-write-run]").click();
  const res = page.locator("[data-ecx-ai-result]");
  await expect(res.locator("h2")).toHaveText("Vì sao chọn chúng tôi");
  await expect(res.locator("strong")).toHaveText("nhanh");
  await expect(res.locator("ul li")).toHaveCount(2);
  await expect(res.locator("ol li")).toHaveCount(2);
  await expect(res).not.toContainText("##"); await expect(res).not.toContainText("**");
  await page.locator("[data-ai-write-insert]").click();
  const types = await page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.map((b: any) => b.type));
  expect(types).toEqual(expect.arrayContaining(["heading", "paragraph", "bulletList", "orderedList"]));
});

test("Viết bằng AI: AI chưa bật → câu hướng dẫn vào Cài đặt › AI; gợi ý nhanh điền yêu cầu", async ({ page }) => {
  await openAi(page);
  await page.locator(".ecx-ai-chips button").first().click();
  await expect(page.locator("[data-ai-write-prompt]")).not.toHaveValue("");
  await page.locator("[data-ai-write-prompt]").fill("demo-fail");
  await page.locator("[data-ai-write-run]").click();
  await expect(page.locator(".ecx-ai-error")).toContainText("Cài đặt › AI");
  await expect(page.locator("[data-ai-write-insert]")).toHaveCount(0);
});
