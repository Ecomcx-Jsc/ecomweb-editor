// Khối chèn từ bảng chèn ra đã có mẫu hoàn chỉnh (không rỗng) + Icon List: Enter thêm mục, Backspace xoá mục rỗng.
import { expect, test } from "@playwright/test";
import { canvas, open } from "./helpers";

const SAMPLES: Array<[key: string, type: string]> = [["iconBox", "iconBox"], ["iconList", "iconList"], ["counter", "counter"], ["testimonial", "testimonial"], ["progressBar", "progressBar"], ["countdown", "countdown"], ["socialLinks", "socialLinks"], ["tabs", "tabs"], ["accordion", "accordion"], ["carousel", "carousel"]];

async function insertViaInserter(page: import("@playwright/test").Page, key: string) {
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  const item = page.locator(`.ecx-inserter-popover [data-key="${key}"], .ecx-inserter-panel [data-key="${key}"]`).first();
  await item.click();
}

for (const [key, type] of SAMPLES) {
  test(`chèn ${type}: có nội dung mẫu`, async ({ page }) => {
    await open(page, "?doc=post");
    await insertViaInserter(page, key);
    const blocks = await page.evaluate((t) => {
      const find = (list: any[]): any => { for (const b of list) { if (b.type === t) return b; const r = b.content && find(b.content); if (r) return r; } };
      return JSON.parse(JSON.stringify(find((window as any).__ecx.store.getState().docs.root.blocks) ?? null));
    }, type);
    expect(blocks, `không thấy khối ${type}`).not.toBeNull();
    const dump = JSON.stringify(blocks);
    // có chữ thật ở đâu đó (thuộc tính hoặc khối con), không phải chuỗi rỗng toàn bộ
    expect(dump.replace(/"[a-zA-Z]+":""/g, "").length).toBeGreaterThan(40);
    if (type === "countdown") expect(blocks.attrs.target).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    if (type === "iconList") expect(blocks.attrs.items.length).toBeGreaterThanOrEqual(3);
    if (type === "counter") expect(blocks.attrs.end).toBeGreaterThan(0);
  });
}

test("Icon List: Enter thêm mục ngay dưới, Backspace ở mục trống xoá mục", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "il1", type: "iconList", attrs: { items: [{ text: "Một" }, { text: "Hai" }] } }]); s.select(["il1"]); });
  const inputs = c.locator('[data-ecx-block="il1"] li input');
  await expect(inputs).toHaveCount(2);
  await inputs.nth(0).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(inputs).toHaveCount(3);
  await expect(inputs.nth(1)).toBeFocused();
  await expect(inputs.nth(1)).toHaveValue("");
  await page.keyboard.type("Giữa");
  expect(await page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.find((b: any) => b.id === "il1").attrs.items.map((i: any) => i.text))).toEqual(["Một", "Giữa", "Hai"]);
  // xoá hết chữ rồi Backspace lần nữa → mục bị xoá, con trỏ về mục trước
  await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace");
  await expect(inputs).toHaveCount(2);
  await expect(inputs.nth(0)).toBeFocused();
});

test("chữ mẫu: bấm vào lần đầu chọn hết, gõ là thay (không chèn thêm); sửa rồi thì không chọn lại", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await insertViaInserter(page, "iconList");
  await c.locator(".ecx-variation-skip").click();
  const first = c.locator("[data-ecx-block] li input").first();
  const before = await first.inputValue();
  expect(before.length).toBeGreaterThan(0);
  await page.waitForTimeout(250); // để lần lấy nét tự động sau khi chèn xong hẳn rồi mới bấm
  await first.click();
  await page.keyboard.type("Mới");
  await expect(first).toHaveValue("Mới");
  await first.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  await expect(first).toHaveValue("Mới!");
});

test("chữ mẫu trong khối chữ (Tabs): bấm vào tiêu đề tab gõ là thay", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await insertViaInserter(page, "tabs");
  await c.locator(".ecx-variation-skip").click();
  const tab = c.locator('[role="tablist"] [role="tab"] [data-ecx-rich]').first();
  await tab.evaluate((e) => (e as HTMLElement).focus()); // (toạ độ chuột trong khung iframe lệch ở môi trường test: dùng focus thật)
  await page.keyboard.type("Giá");
  const txt = (await tab.textContent()) ?? "";
  expect(txt).toBe("Giá");
});

test("đoạn trống: bấm giữa chữ gợi ý thì con trỏ về đầu ô (không nằm giữa chữ gợi ý)", async ({ page }) => {
  const c = await open(page, "?doc=empty");
  await page.evaluate(() => { const st = (window as any).__ecx.store; st.insert("root", null, 0, [{ id: "p1", type: "paragraph", attrs: {}, inline: [] }, { id: "p2", type: "paragraph", attrs: {}, inline: [] }]); });
  await page.waitForTimeout(300);
  for (const [id, dx] of [["p1", 30], ["p1", 140], ["p2", 220]] as const) {
    const b = (await c.locator(`[data-ecx-block="${id}"]`).boundingBox())!;
    await page.mouse.click(b.x + dx, b.y + b.height / 2);
    await page.waitForTimeout(150);
    const r = await c.locator(`[data-ecx-block="${id}"]`).evaluate((e) => {
      const s = e.ownerDocument.getSelection()!; const rc = s.getRangeAt(0).getClientRects()[0]; const box = e.getBoundingClientRect();
      return { focused: e.ownerDocument.activeElement === e, offset: s.anchorOffset, left: rc ? Math.round(rc.left - box.left) : 0 };
    });
    expect(r.focused).toBe(true); expect(r.offset).toBe(0); expect(r.left).toBeLessThanOrEqual(1);
  }
});

test("chèn widget (Icon Box, Đếm số, Lời chứng thực…): gõ ngay vào ô chữ đầu tiên, chữ mẫu được thay", async ({ page, browserName }) => {
  // Giới hạn đã biết: Firefox của Playwright không chuyển phím vào ô sửa chữ (ProseMirror) trong iframe ngay sau focus() — ô nhập thường (ca trên) vẫn đúng; chưa kiểm bằng Firefox thật
  test.fixme(browserName === "firefox", "phím gõ không vào ô contenteditable trong iframe ở Firefox của Playwright");
  for (const [key, type] of [["iconBox", "iconBox"], ["counter", "counter"], ["testimonial", "testimonial"], ["progressBar", "progressBar"]] as const) {
    const c = await open(page, "?doc=post");
    await insertViaInserter(page, key);
    const sk = c.locator(".ecx-variation-skip"); if (await sk.count()) await sk.click();
    await page.waitForTimeout(250);
    await page.keyboard.type("Zq");
    const dump = await page.evaluate(() => JSON.stringify((window as any).__ecx.store.getState().docs.root.blocks));
    expect((dump.match(/Zq/g) ?? []).length, `gõ ngay sau khi chèn ${type} phải vào khối`).toBeGreaterThanOrEqual(1);
    expect(dump).not.toMatch(/ZqGiao|Giao hàng nhanhZq/);
  }
});

test("chèn khối không có ô gõ (Khoảng trống, Cột, Ảnh…): ⌘Z gỡ ngay khối vừa chèn — focus về khung soạn", async ({ page }) => {
  const { mod } = await import("./helpers");
  for (const key of ["spacer", "columns/50-50", "image", "customHtml"]) {
    await open(page, "?doc=empty");
    const count = () => page.evaluate(() => { let n = 0; const w = (l: any[]) => l.forEach((b) => { n++; b.content && w(b.content); }); w((window as any).__ecx.store.getState().docs.root.blocks); return n; });
    const before = await count();
    await insertViaInserter(page, key);
    await page.waitForTimeout(250);
    expect(await count(), key).toBeGreaterThan(before);
    await page.keyboard.press(`${mod}+z`);
    await page.waitForTimeout(120);
    expect(await count(), `⌘Z sau khi chèn ${key}`).toBe(before);
  }
});

test("Phần (Section): chèn ra dải rộng hết trang, nội dung trong khung, có tiêu đề + đoạn mẫu; 4 kiểu nền", async ({ page }) => {
  const c = await open(page, "?doc=empty");
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  for (const key of ["group/section", "group/section-light", "group/section-brand", "group/section-dark"]) {
    await page.locator(`.ecx-inserter-panel [data-key="${key}"]`).first().click();
    await page.waitForTimeout(150);
  }
  const groups = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__ecx.store.getState().docs.root.blocks.filter((b: any) => b.type === "group"))));
  expect(groups).toHaveLength(4);
  for (const g of groups) { expect(g.attrs.align).toBe("full"); expect(g.attrs.constrained).toBe(true); expect(g.content.map((k: any) => k.type)).toEqual(["heading", "paragraph"]); }
  expect(JSON.stringify(groups[1].attrs)).toContain("muted/10"); expect(groups[2].attrs.background).toBe("primary"); expect(groups[3].attrs.background).toBe("#111827");
  await expect(c.locator(".ecx-block-error")).toHaveCount(0);
});

test("bảng chèn gọn khi soạn bài: khối cũ đã gộp và khối giao diện ẩn, khối chính vẫn đủ", async ({ page }) => {
  await open(page, "?doc=post&content=1");
  await page.getByRole("button", { name: /Thêm khối/ }).first().click();
  const keys = await page.locator(".ecx-inserter-popover [data-key], .ecx-inserter-panel [data-key]").evaluateAll((els) => els.map((e) => e.getAttribute("data-key")));
  expect(keys.filter((k) => /^(group|columns)\//.test(k!)), "ô biến thể Nhóm / Cột").toEqual(["group/section"]);
  for (const k of ["details", "siteTitle", "postTitle", "comments", "navigation"]) expect(keys, k).not.toContain(k);
  for (const k of ["paragraph", "heading", "image", "tabs", "accordion", "carousel", "query", "search", "iconBox", "buttons"]) expect(keys, k).toContain(k);
});
