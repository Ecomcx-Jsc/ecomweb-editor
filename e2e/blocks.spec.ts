import { expect, test, type Page } from "@playwright/test";
import { canvas, clickEnd, mod, open, shape, state, texts } from "./helpers";

const toolbar = (page: Page) => page.locator(".ecx-toolbar");
const tool = (page: Page, label: string) => toolbar(page).getByRole("button", { name: label, exact: false });

test.describe("chọn khối + thanh công cụ", () => {
  test("Esc chọn cả khối; Delete xoá; ⌘⇧D nhân bản", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await page.keyboard.press("Escape");
    const st = await state(page);
    expect(st.selection.ids).toEqual([st.docs.root.blocks[1].id]);
    await page.keyboard.press(`${mod}+Shift+d`);
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai."]);
    await page.keyboard.press("Delete");
    await page.keyboard.press("Escape");
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai."]);
  });

  test("thanh công cụ hiện khi gõ; lên / xuống đổi chỗ khối", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await expect(toolbar(page)).toBeVisible();
    await tool(page, "Lên").click();
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Đoạn thứ hai.", "paragraph:Nội dung bài viết."]);
    await tool(page, "Xuống").click();
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai."]);
    // Con trỏ vẫn trong khối: gõ tiếp được
    await page.keyboard.type("!");
    expect((await texts(page))[2]).toBe("paragraph:Đoạn thứ hai.!");
  });

  test("đổi loại khối: đoạn → tiêu đề H3 → danh sách", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await tool(page, "Đổi loại khối").click();
    await page.getByRole("menuitem", { name: "Tiêu đề H3" }).click();
    let st = await state(page);
    expect(st.docs.root.blocks[2]).toMatchObject({ type: "heading", attrs: { level: 3 } });
    await clickEnd(c, "Đoạn thứ hai.");
    await tool(page, "Đổi loại khối").click();
    await page.getByRole("menuitem", { name: "Danh sách", exact: true }).click();
    expect(((await shape(page)) as unknown[])[2]).toEqual({ bulletList: [{ listItem: ["paragraph"] }] });
    st = await state(page);
    expect(st.docs.root.blocks[2].content[0].content[0].inline[0].text).toBe("Đoạn thứ hai.");
  });

  test("cấp tiêu đề đổi bằng menu cấp", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Tiêu đề bài");
    await tool(page, "Cấp").click();
    await page.getByRole("menuitem", { name: "H4" }).click();
    expect((await state(page)).docs.root.blocks[0].attrs.level).toBe(4);
    await expect(c.locator("h4", { hasText: "Tiêu đề bài" })).toBeVisible();
  });

  test("căn giữa chữ", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await tool(page, "Căn giữa").click();
    expect((await state(page)).docs.root.blocks[2].attrs.textAlign).toBe("center");
    await expect(c.locator("p", { hasText: "Đoạn thứ hai." })).toHaveCSS("text-align", "center");
  });

  test("đậm bằng thanh công cụ và ⌘B; liên kết bằng ⌘K", async ({ page }) => {
    const c = await open(page, "?doc=post");
    const el = await clickEnd(c, "Đoạn thứ hai.");
    await el.press("Shift+Home");
    await tool(page, "Đậm").click();
    expect((await state(page)).docs.root.blocks[2].inline).toEqual([{ type: "text", text: "Đoạn thứ hai.", marks: [{ type: "bold" }] }]);
    await page.keyboard.press(`${mod}+b`);
    expect((await state(page)).docs.root.blocks[2].inline).toEqual([{ type: "text", text: "Đoạn thứ hai." }]);
    await page.keyboard.press(`${mod}+k`);
    const input = page.getByLabel("Địa chỉ liên kết");
    await input.fill("https://ecomcx.vn");
    await page.getByLabel("Mở tab mới").check();
    await input.press("Enter");
    expect((await state(page)).docs.root.blocks[2].inline[0].marks).toEqual([{ type: "link", attrs: { href: "https://ecomcx.vn", target: "_blank", rel: "noopener" } }]);
    await expect(c.locator("a[href='https://ecomcx.vn']")).toHaveText("Đoạn thứ hai.");
  });

  test("menu thêm: chèn trên / dưới, gom nhóm, bỏ nhóm, xoá", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await tool(page, "Thêm").click();
    await page.getByRole("menuitem", { name: "Thêm khối phía dưới" }).click();
    await page.keyboard.type("cuối");
    expect((await texts(page)).at(-1)).toBe("paragraph:cuối");
    await clickEnd(c, "Đoạn thứ hai.");
    await tool(page, "Thêm").click();
    await page.getByRole("menuitem", { name: "Gom vào nhóm" }).click();
    expect(((await shape(page)) as unknown[])[2]).toEqual({ group: ["paragraph"] });
    await tool(page, "Thêm").click();
    await page.getByRole("menuitem", { name: "Bỏ nhóm" }).click();
    expect(((await shape(page)) as unknown[])[2]).toBe("paragraph");
    await tool(page, "Thêm").click();
    await page.getByRole("menuitem", { name: "Xoá" }).click();
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:cuối"]);
  });

  test("chọn khối cha từ đoạn văn trong cột", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Cột trái");
    await tool(page, "Chọn khối cha").click();
    let st = await state(page);
    const columns = st.docs.root.blocks.find((b: { type: string }) => b.type === "columns");
    expect(st.selection.ids).toEqual([columns.content[0].id]);
    await tool(page, "Chọn khối cha").click();
    st = await state(page);
    expect(st.selection.ids).toEqual([columns.id]);
  });

  test("Shift+bấm chọn nhiều khối rồi xoá cùng lúc", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Tiêu đề bài");
    await page.keyboard.press("Escape");
    await c.locator("p", { hasText: "Nội dung bài viết." }).click({ modifiers: ["Shift"] });
    expect((await state(page)).selection.ids.length).toBe(2);
    await page.keyboard.press("Backspace");
    expect(await texts(page)).toEqual(["paragraph:Đoạn thứ hai."]);
  });

  test("⌘A hai lần chọn mọi khối", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press(`${mod}+a`);
    await page.keyboard.press(`${mod}+a`);
    expect((await state(page)).selection.ids.length).toBe(3);
  });
});

test.describe("chèn khối", () => {
  test("gõ / mở danh sách, lọc không dấu, Enter chèn khối", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/tieu de");
    const pop = page.locator(".ecx-inserter-popover");
    await expect(pop).toBeVisible();
    await expect(pop.getByRole("option").first()).toContainText("Tiêu đề");
    await page.keyboard.press("Enter");
    await expect(pop).toBeHidden();
    await page.keyboard.type("Mới");
    expect((await state(page)).docs.root.blocks[3]).toMatchObject({ type: "heading" });
    expect((await texts(page)).at(-1)).toBe("heading:Mới");
  });

  test("slash: mũi tên chọn mục, Esc đóng và giữ chữ", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    const pop = page.locator(".ecx-inserter-popover");
    await expect(pop).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(pop.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();
    expect((await texts(page)).at(-1)).toBe("paragraph:/");
  });

  test("slash chèn khối chứa: nhóm có đoạn văn bên trong, con trỏ vào trong", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/nhom");
    await page.keyboard.press("Enter");
    await page.keyboard.type("trong nhóm");
    expect(((await shape(page)) as unknown[])[3]).toEqual({ group: ["paragraph"] });
    expect((await texts(page)).at(-1)).toBe("paragraph:trong nhóm");
  });

  test("thư viện khối: tìm và bấm chèn sau khối đang chọn", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    await page.locator(".ecx-inserter-panel .ecx-search").fill("duong ke");
    await page.locator(".ecx-block-tile", { hasText: "Đường kẻ" }).click();
    expect(((await shape(page)) as unknown[]).slice(0, 4)).toEqual(["heading", "paragraph", "horizontalRule", "paragraph"]);
    await expect(c.locator("hr")).toBeVisible();
  });

  test("thư viện khối: kéo thả khối vào giữa hai đoạn", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    const tile = page.locator(".ecx-block-tile[data-key='spacer']");
    await tile.scrollIntoViewIfNeeded();
    // boundingBox của phần tử trong iframe đã là toạ độ trang ngoài
    const target = await c.locator("p", { hasText: "Đoạn thứ hai." }).boundingBox();
    const t = await tile.boundingBox();
    await page.mouse.move(t!.x + t!.width / 2, t!.y + t!.height / 2);
    await page.mouse.down();
    await page.mouse.move(t!.x + 40, t!.y + 20, { steps: 4 });
    await page.mouse.move(target!.x + 20, target!.y + 3, { steps: 8 });
    await expect(page.locator(".ecx-drop-line")).toBeVisible();
    await page.mouse.up();
    expect(await shape(page)).toEqual(["heading", "paragraph", "spacer", "paragraph"]);
  });

  test("bấm dưới khối cuối: thêm đoạn trống và gõ được ngay", async ({ page }) => {
    const c = await open(page, "?doc=post");
    const root = c.locator(".ecx-canvas-root");
    const box = await root.boundingBox();
    await root.click({ position: { x: box!.width / 2, y: box!.height - 40 } });
    await page.keyboard.type("cuối trang");
    expect((await texts(page)).at(-1)).toBe("paragraph:cuối trang");
  });

  test("tài liệu trống: bấm 'Bắt đầu viết' rồi gõ", async ({ page }) => {
    const c = await open(page, "?empty=1");
    await c.locator(".ecx-default-appender").click();
    await page.keyboard.type("Xin chào");
    expect(await texts(page)).toEqual(["paragraph:Xin chào"]);
  });
});

test.describe("kéo thả + chép dán + cây khối + cài đặt", () => {
  test("kéo tay nắm trên thanh công cụ: đưa đoạn cuối lên đầu", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    const handle = page.locator(".ecx-drag-handle");
    const h = await handle.boundingBox();
    const first = await c.locator("h2", { hasText: "Tiêu đề bài" }).boundingBox();
    await page.mouse.move(h!.x + h!.width / 2, h!.y + h!.height / 2);
    await page.mouse.down();
    await page.mouse.move(h!.x + 30, h!.y + 30, { steps: 4 });
    await page.mouse.move(first!.x + 30, first!.y + 4, { steps: 10 });
    await page.mouse.up();
    expect(await texts(page)).toEqual(["paragraph:Đoạn thứ hai.", "heading:Tiêu đề bài", "paragraph:Nội dung bài viết."]);
    await page.keyboard.press(`${mod}+z`);
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai."]);
  });

  test("kéo đoạn văn vào cột", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Đây là đoạn văn đầu tiên.");
    const h = await page.locator(".ecx-drag-handle").boundingBox();
    const col = await c.locator("p", { hasText: "Cột phải" }).boundingBox();
    await page.mouse.move(h!.x + 8, h!.y + 8);
    await page.mouse.down();
    await page.mouse.move(h!.x + 40, h!.y + 40, { steps: 4 });
    await page.mouse.move(col!.x + 10, col!.y + col!.height - 2, { steps: 10 });
    await page.mouse.up();
    const st = await state(page);
    const columns = st.docs.root.blocks.find((b: { type: string }) => b.type === "columns");
    expect(columns.content[1].content.map((b: { inline: Array<{ text: string }> }) => b.inline[0].text)).toEqual(["Cột phải", "Đây là đoạn văn đầu tiên."]);
  });

  test("chép rồi dán khối (⌘C / ⌘V khi đang chọn khối)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Tiêu đề bài");
    await page.keyboard.press("Escape");
    await page.keyboard.press(`${mod}+c`);
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Escape");
    await page.keyboard.press(`${mod}+v`);
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai.", "heading:Tiêu đề bài"]);
    const st = await state(page);
    expect(st.docs.root.blocks[3].id).not.toBe(st.docs.root.blocks[0].id);
  });

  test("cắt khối (⌘X)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await page.keyboard.press("Escape");
    await page.keyboard.press(`${mod}+x`);
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Đoạn thứ hai."]);
  });

  test("dán HTML từ Word/Google Docs: tạo tiêu đề + danh sách + đoạn có định dạng", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await c.locator("[data-ecx-rich][data-empty]").evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData("text/html", `<meta charset="utf-8"><b style="font-weight:normal" id="docs-internal-guid-1"><h2>Tiêu đề dán</h2><ul><li><p>Mục A</p></li><li><p>Mục B</p></li></ul><p><span style="font-weight:700">Đậm</span> thường</p></b>`);
      dt.setData("text/plain", "Tiêu đề dán\nMục A\nMục B\nĐậm thường");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    const sh = (await shape(page)) as unknown[];
    expect(sh.slice(3)).toEqual(["heading", { bulletList: [{ listItem: ["paragraph"] }, { listItem: ["paragraph"] }] }, "paragraph"]);
    const st = await state(page);
    expect(st.docs.root.blocks[5].inline).toEqual([{ type: "text", text: "Đậm", marks: [{ type: "bold" }] }, { type: "text", text: " thường" }]);
  });

  test("dán đường dẫn lên chữ đang bôi đen → liên kết; đường dẫn ảnh vào đoạn trống → khối ảnh", async ({ page }) => {
    const c = await open(page, "?doc=post");
    const el = await clickEnd(c, "Đoạn thứ hai.");
    await el.press("Shift+Home");
    const paste = (selector: string, text: string) => c.locator(selector).first().evaluate((node, t) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", t);
      node.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    }, text);
    await paste("p:has-text('Đoạn thứ hai.')", "https://ecomcx.vn");
    expect((await state(page)).docs.root.blocks[2].inline[0].marks).toEqual([{ type: "link", attrs: { href: "https://ecomcx.vn" } }]);
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await paste("[data-ecx-rich][data-empty]", "https://example.com/a.png");
    expect((await state(page)).docs.root.blocks[3]).toMatchObject({ type: "image", attrs: { src: "https://example.com/a.png" } });
    await expect(c.locator("img[src='https://example.com/a.png']")).toHaveCount(1);
  });

  test("cây khối: hiện cấu trúc lồng, bấm chọn khối", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Cây khối" }).click();
    const tree = page.locator(".ecx-listview");
    await expect(tree.locator(".ecx-list-row", { hasText: "Phần dùng chung · header" })).toBeVisible();
    await tree.locator(".ecx-list-row", { hasText: "Cột" }).first().click();
    const st = await state(page);
    expect(st.selection.ids).toEqual([st.docs.root.blocks.find((b: { type: string }) => b.type === "columns").id]);
    await expect(page.locator(".ecx-toolbar")).toBeVisible();
  });

  test("bảng cài đặt: form tự sinh đổi thuộc tính (cấp tiêu đề, neo)", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Tiêu đề bài");
    const insp = page.locator(".ecx-inspector");
    await expect(insp.locator(".ecx-block-card")).toContainText("Tiêu đề");
    await insp.getByLabel("Cấp tiêu đề").fill("3");
    expect((await state(page)).docs.root.blocks[0].attrs.level).toBe(3);
    await insp.getByText("Nâng cao").click();
    await insp.getByLabel("Neo (id)").fill("gioi thieu!");
    expect((await state(page)).docs.root.blocks[0].attrs.anchor).toBe("gioithieu");
    await expect(c.locator("h3#gioithieu")).toBeVisible();
  });

  test("đổi khổ màn hình: iframe đổi bề rộng (media query đúng thiết bị)", async ({ page }) => {
    await open(page, "?doc=post");
    await page.getByRole("button", { name: "mobile" }).click();
    await expect(page.locator("iframe[data-ecx-canvas]")).toHaveCSS("width", "390px");
    await page.getByRole("button", { name: "tablet" }).click();
    await expect(page.locator("iframe[data-ecx-canvas]")).toHaveCSS("width", "768px");
  });
});
