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
  await insp(page).getByRole("button", { name: "Liên kết cả cột" }).click();
  await insp(page).getByLabel("Liên kết cả cột").fill("/gioi-thieu");
  await insp(page).getByRole("switch", { name: "Mở tab mới" }).check();
  const attrs = (await find(page, "column")).attrs;
  expect(attrs).toMatchObject({ href: "/gioi-thieu", linkTarget: "_blank" });
  // Bộ cột: rộng tối đa → hàng hẹp lại và nằm giữa
  await page.locator(".ecx-toolbar").getByRole("button", { name: "Chọn khối cha" }).click();
  await insp(page).getByRole("button", { name: "Rộng tối đa của nội dung" }).click();
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
    await insp(page).getByRole("button", { name: "Liên kết cả cột" }).click();
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

  test("phần của khối: viền từng cạnh, bo từng góc", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    await page.evaluate((x) => (window as any).__ecx.store.select([x]), (await find(page, "button")).id);
    await tab(page, "Kiểu dáng");
    const i = insp(page);
    if (await i.getByLabel("Độ dày viền: Chỉnh từng cạnh").count() === 0) await i.getByRole("button", { name: "Nút", exact: true }).click();
    await i.getByLabel("Độ dày viền: Chỉnh từng cạnh").click();
    await i.getByRole("spinbutton", { name: "Độ dày viền dưới" }).fill("3");
    await i.getByLabel("Bo góc: Chỉnh từng góc").click();
    await i.getByRole("spinbutton", { name: "Bo góc trên trái" }).fill("12");
    const st = (await find(page, "button")).attrs.parts.button.style;
    expect(st).toMatchObject({ border: { width: { bottom: "3px" } }, radius: { topLeft: "12px" } });
    const a = c.locator("a.ecx-button").first();
    await expect(a).toHaveCSS("border-bottom-width", "3px");
    await expect(a).toHaveCSS("border-top-width", "0px");
    await expect(a).toHaveCSS("border-top-left-radius", "12px");
    await expect(a).toHaveCSS("border-bottom-right-radius", "0px");
  });

  test("chữ chuyển màu ở phần; màu liên kết + khi rê ở khối chứa", async ({ page }) => {
    const c = await open(page, "?doc=rich");
    await page.evaluate((x) => (window as any).__ecx.store.select([x]), (await find(page, "button")).id);
    await tab(page, "Kiểu dáng");
    const i = insp(page);
    const row = i.locator(".ecx-style-row", { hasText: "Chữ chuyển màu" }).first();
    if (await row.count() === 0) await i.getByRole("button", { name: "Nút", exact: true }).click();
    await row.locator(".ecx-chip-swatch").last().click(); // tuỳ chỉnh: hai màu
    expect((await find(page, "button")).attrs.parts.button.style.textGradient).toMatch(/^linear-gradient\(/);
    await expect(c.locator("a.ecx-button").first()).toHaveCSS("background-clip", "text");
    // Nhóm: màu liên kết của nội dung bên trong
    await page.evaluate(() => (window as any).__ecx.store.insert("root", null, 0, [{ id: "g1", type: "group", attrs: {}, content: [{ id: "g1p", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "xem", marks: [{ type: "link", attrs: { href: "/x" } }] }] }] }], { select: true }));
    await page.evaluate(() => (window as any).__ecx.store.select(["g1"]));
    await tab(page, "Kiểu dáng");
    await i.getByRole("button", { name: "Màu", exact: true }).click();
    await i.getByRole("button", { name: /^Màu liên kết/ }).click();
    await i.getByRole("button", { name: "Màu liên kết: accent" }).click();
    expect((await find(page, "group")).attrs.style.link).toEqual({ color: "accent" });
    await expect(c.locator('[data-ecx-block="g1"] a').first()).toHaveCSS("color", "rgb(242, 98, 81)");
  });
});

test.describe("v3: thao tác thẳng trên khung soạn", () => {
  const addGroup = (page: Page) => page.evaluate(() => (window as any).__ecx.store.insert("root", null, 0, [{ id: "g1", type: "group", attrs: { style: { padding: { base: "24px" }, minHeight: { base: "220px" } } }, content: [{ id: "g1p", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Trong nhóm" }] }] }], { select: true }));
  const drag = async (page: Page, x: number, y: number, dy: number) => {
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x, y + dy / 2, { steps: 4 }); await page.mouse.move(x, y + dy, { steps: 4 }); await page.mouse.up();
  };
  const frameBox = async (page: Page, sel: string) => {
    const f = (await page.locator("iframe[data-ecx-canvas]").boundingBox())!;
    const b = (await page.frameLocator("iframe[data-ecx-canvas]").locator(sel).boundingBox())!;
    return { ...b, fx: f.x, fy: f.y };
  };

  test("kéo ở bất kỳ đâu trong vùng đệm trên / lề dưới của khối đang chọn", async ({ page }) => {
    await open(page, "?doc=post");
    await addGroup(page);
    await page.evaluate(() => (window as any).__ecx.store.select(["g1"]));
    const z = await frameBox(page, '[data-ecx-block="g1"] [data-ecx-zone="padding-top"]');
    expect(Math.round(z.height)).toBe(24); // vùng kéo cao đúng bằng đệm, rộng hết khối
    const g = await frameBox(page, '[data-ecx-block="g1"]');
    expect(Math.abs(z.width - g.width)).toBeLessThan(2);
    await drag(page, z.x + z.width * 0.8, z.y + 12, 30); // gần mép phải: vẫn kéo được
    expect((await find(page, "group")).attrs.style.padding.base).toMatchObject({ top: "54px" });
    const m = await frameBox(page, '[data-ecx-block="g1"] [data-ecx-zone="margin-bottom"]');
    await drag(page, m.x + m.width / 4, m.y + m.height / 2, 20); // lề có sẵn của luồng chữ + 20 (giữa mép là nút "+ Thêm section")
    expect((await find(page, "group")).attrs.style.margin.base).toMatchObject({ bottom: `${Math.round(m.height) + 20}px` });
  });

  test("khối bố cục đang chọn: nắm chỗ trống kéo xuống cuối bài = đổi chỗ; bấm thường vẫn chỉ chọn", async ({ page }) => {
    await open(page, "?doc=post");
    await addGroup(page);
    await page.evaluate(() => (window as any).__ecx.store.select(["g1"]));
    await expect.poll(async () => (await frameBox(page, '[data-ecx-block="g1"]')).height).toBeGreaterThanOrEqual(220);
    // chờ hiệu ứng dời khối (khi chèn nhóm) chạy xong: lúc đang chạy, mép khối lướt qua con trỏ làm hiện nút "+ Thêm section"
    const lastId = await page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.at(-1).id);
    let prev = -1;
    await expect.poll(async () => { const y = (await frameBox(page, `[data-ecx-block="${lastId}"]`)).y; const same = Math.abs(y - prev) < 0.5; prev = y; return same; }, { intervals: [150] }).toBe(true);
    const g = await frameBox(page, '[data-ecx-block="g1"]');
    const x = g.x + g.width / 2, y = g.y + g.height - 60; // dưới đoạn văn, trên vùng đệm dưới
    await page.mouse.click(x, y);
    expect((await state(page)).docs.root.blocks[0].id).toBe("g1");
    const last = await frameBox(page, `[data-ecx-block="${lastId}"]`);
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + ((last.y + last.height - 4) - y) * i / 10);
    await page.mouse.up();
    const ids = (await state(page)).docs.root.blocks.map((b: any) => b.id);
    expect(ids[0]).not.toBe("g1");
    expect(ids).toContain("g1");
  });
});

test("bộ cột vừa chèn: chọn bố cục ngay trên khung soạn; biến thể 50 / 50 không hỏi lại", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => (window as any).__ecx.store.insert("root", null, 0, [{ id: "R", type: "columns", attrs: {}, content: [] }]));
  await c.getByRole("button", { name: "25 / 50 / 25" }).click();
  const row = await find(page, "columns");
  expect(row.content.map((x: any) => x.attrs.width)).toEqual([25, 50, 25]);
  await expect(c.locator('[data-ecx-block="R"] > .ecx-column')).toHaveCount(3);
  await expect(c.locator(".ecx-col-layouts")).toHaveCount(0);
  await page.keyboard.type("Cột đầu");
  expect((await find(page, "column")).content[0].inline[0].text).toBe("Cột đầu");
});


test("chép / dán kiểu dáng ngay trên thanh công cụ", async ({ page }) => {
  await open(page, "?doc=post");
  const ids = await page.evaluate(() => { const s = (window as any).__ecx.store; const b = s.getState().docs.root.blocks; s.setAttrs([b[1].id], { style: { color: { text: "accent" }, padding: { base: "lg" } } }); s.select([b[1].id]); return b.map((x: any) => x.id); });
  const bar = page.locator(".ecx-toolbar");
  await bar.getByRole("button", { name: "Chép / dán kiểu dáng" }).click();
  await page.getByRole("menuitem", { name: "Chép kiểu dáng" }).click();
  await page.evaluate((x) => (window as any).__ecx.store.select([x]), ids[2]);
  await bar.getByRole("button", { name: "Chép / dán kiểu dáng" }).click();
  await page.getByRole("menuitem", { name: "Dán kiểu dáng" }).click();
  const b = (await state(page)).docs.root.blocks[2];
  expect(b.attrs.style).toMatchObject({ color: { text: "accent" }, padding: { base: "lg" } });
});

test("thanh công cụ: căn dọc của bộ cột, căn các nút, liên kết của nút", async ({ page }) => {
  const c = await open(page, "?doc=rich");
  const bar = page.locator(".ecx-toolbar");
  const row = await find(page, "columns");
  await page.evaluate((x) => (window as any).__ecx.store.select([x]), row.id);
  await bar.getByRole("button", { name: "Căn dọc" }).click();
  await page.getByRole("menuitem", { name: /Giữa/ }).click();
  expect((await find(page, "columns")).attrs.verticalAlign).toBe("center");
  const btn = await find(page, "button");
  await page.evaluate((x) => (window as any).__ecx.store.select([x]), btn.id);
  await bar.getByRole("button", { name: "Căn các nút" }).click();
  await page.getByRole("menuitem", { name: /Căn giữa/ }).click();
  expect((await find(page, "buttons")).attrs.align).toBe("center");
  await bar.getByRole("button", { name: "Liên kết của nút" }).click();
  const input = page.getByRole("textbox", { name: "Liên kết của nút" });
  await input.fill("javascript:alert(1)");
  await expect(page.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
  await input.fill("/lien-he");
  await page.getByRole("checkbox", { name: "Mở tab mới" }).check();
  await page.getByRole("button", { name: "Áp dụng" }).click();
  expect((await find(page, "button")).attrs).toMatchObject({ href: "/lien-he", target: "_blank" });
  void c;
});

test("tab: thanh công cụ dời tab đang mở, thêm tab", async ({ page }) => {
  await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "T", type: "tabs", attrs: {}, content: [
    { id: "t1", type: "tab", attrs: { title: "Một" }, content: [{ id: "tp1", type: "paragraph", attrs: {}, inline: [] }] },
    { id: "t2", type: "tab", attrs: { title: "Hai" }, content: [{ id: "tp2", type: "paragraph", attrs: {}, inline: [] }] }] }]); s.select(["T"]); });
  const bar = page.locator(".ecx-toolbar");
  await expect(bar.getByRole("button", { name: "Dời tab đang mở sang trái" })).toBeDisabled();
  await bar.getByRole("button", { name: "Dời tab đang mở sang phải" }).click();
  const titles = async () => (await find(page, "tabs")).content.map((t: any) => t.attrs.title);
  expect(await titles()).toEqual(["Hai", "Một"]);
  await expect(bar.getByRole("button", { name: "Dời tab đang mở sang phải" })).toBeDisabled(); // tab vừa dời vẫn đang mở, nằm cuối
  await bar.getByRole("button", { name: "Thêm tab" }).click();
  expect((await titles()).length).toBe(3);
});

test.describe("cột trái: cây khối, dàn ý, media", () => {
  // Cột trái trượt vào (0.2s): tắt chuyển động để rê / bấm đúng chỗ
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });
  test("dòng cây khối: nút ⋮ mở menu khối; đổi tên, ẩn, cắt", async ({ page }) => {
    await open(page, "?doc=post");
    await page.getByRole("button", { name: "Cây khối" }).first().click();
    const tree = page.getByRole("tree", { name: "Cây khối" });
    const row = tree.locator(".ecx-list-row").nth(1);
    await row.hover();
    // shortcut: Playwright đôi khi treo ở bước chờ "ổn định" của nút này dù nút đã hiện, đứng yên (đã đo) — bấm thẳng; nút vẫn được rê hiện như người dùng
    await row.getByRole("button", { name: "Tuỳ chọn" }).click({ force: true });
    await page.getByRole("menuitem", { name: "Đổi tên" }).click();
    await page.getByRole("textbox", { name: "Đổi tên khối" }).fill("Mở bài");
    await page.getByRole("button", { name: "Lưu", exact: true }).last().click();
    await expect(tree.locator(".ecx-list-row").nth(1)).toHaveText(/^Mở bài/);
    await expect(page.locator(".ecx-block-card strong")).toHaveText("Mở bài");
    // chuột phải trên dòng = cùng menu; Ẩn → cả 3 khổ
    await tree.locator(".ecx-list-row").nth(1).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Ẩn" }).click();
    const b = (await state(page)).docs.root.blocks[1];
    expect(b.attrs.customName).toBe("Mở bài");
    expect(b.attrs.style.hide).toEqual(["desktop", "tablet", "mobile"]);
    await expect(tree.locator(".ecx-list-row").nth(1).getByLabel("Đang ẩn")).toBeVisible();
    await tree.locator(".ecx-list-row").nth(1).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Hiện lại" }).click();
    expect((await state(page)).docs.root.blocks[1].attrs.style?.hide).toBeUndefined();
    const before = (await state(page)).docs.root.blocks.length;
    const text = await page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks[1].inline?.map((n: any) => n.text ?? "").join("") ?? "");
    await tree.locator(".ecx-list-row").nth(1).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Cắt" }).click();
    await expect.poll(async () => (await state(page)).docs.root.blocks.length).toBe(before - 1); // chép vào clipboard xong mới xoá
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(text);
  });

  test("tab Dàn ý: số chữ, tiêu đề theo cấp, báo nhảy cấp; đóng cột trái", async ({ page }) => {
    await open(page, "?doc=post");
    await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [
      { id: "h1", type: "heading", attrs: { level: 2 }, inline: [{ type: "text", text: "Mục lớn" }] },
      { id: "h2", type: "heading", attrs: { level: 4 }, inline: [{ type: "text", text: "Mục nhảy" }] }]); });
    await page.getByRole("button", { name: "Cây khối" }).first().click();
    await page.getByRole("tab", { name: "Dàn ý" }).click();
    const o = page.locator(".ecx-outline");
    await expect(o.getByRole("button", { name: /H2\s*Mục lớn/ })).toBeVisible();
    await expect(o.getByRole("button", { name: /Mục nhảy.*nhảy cấp/ })).toBeVisible();
    await o.getByRole("button", { name: /Mục nhảy/ }).click();
    expect((await state(page)).selection.ids).toEqual(["h2"]);
    await page.locator(".ecx-left").getByRole("button", { name: "Đóng" }).click();
    await expect(page.locator(".ecx-left")).toHaveCount(0);
  });

  test("bảng chèn: tab Media chèn ảnh từ thư viện; nút đóng", async ({ page }) => {
    await open(page, "?doc=post&media=1");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    await page.getByRole("tab", { name: "Media" }).click();
    await page.getByRole("button", { name: "Ảnh mẫu 2" }).click();
    const img = (await state(page)).docs.root.blocks.find((b: any) => b.type === "image");
    expect(img.attrs).toMatchObject({ mediaId: 22, alt: "Ảnh mẫu 2" });
    await page.getByRole("radio", { name: "Video" }).click();
    await expect(page.getByRole("button", { name: "clip.mp4" })).toBeVisible();
    await page.locator(".ecx-inserter-panel").getByRole("button", { name: "Đóng" }).click();
    await expect(page.locator(".ecx-inserter-panel")).toHaveCount(0);
  });
});

test("tab Cài đặt: ô đã đổi có nút ↶ về mặc định", async ({ page }) => {
  await open(page, "?doc=post");
  const id = await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "H", type: "heading", attrs: { level: 3 }, inline: [{ type: "text", text: "Đầu" }] }]); s.select(["H"], { editing: null }); return "H"; });
  const reset = insp(page).getByRole("button", { name: "Đặt lại: Cấp tiêu đề" });
  await reset.click();
  expect((await find(page, "heading")).attrs.level ?? 2).toBe(2);
  await expect(reset).toHaveCount(0);
  void id;
});

test("tabs: dọc, accordion trên điện thoại, icon + phụ đề của từng tab", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "T", type: "tabs", attrs: {}, content: [
    { id: "t1", type: "tab", attrs: { title: "Một" }, content: [{ id: "tp1", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "nội dung một" }] }] },
    { id: "t2", type: "tab", attrs: { title: "Hai" }, content: [{ id: "tp2", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "nội dung hai" }] }] }] }], { focus: false }); s.select(["T"], { editing: null }); });
  await insp(page).getByRole("radio", { name: "Dọc" }).click();
  await insp(page).getByRole("checkbox", { name: "Thành accordion trên điện thoại" }).check();
  expect((await find(page, "tabs")).attrs).toMatchObject({ orientation: "vertical", mobileAccordion: true });
  const tabs = c.locator(".ecx-tabs.is-vertical.has-mobile-accordion");
  await expect(tabs).toBeVisible();
  // thanh tiêu đề bên trái nội dung
  const list = await tabs.locator(".ecx-tabs-list").boundingBox(), panel = await tabs.locator(".ecx-tab-panel").first().boundingBox();
  expect(list!.x + list!.width).toBeLessThanOrEqual(panel!.x + 1);
  // phụ đề + icon của tab: sửa trên khối tab
  await page.evaluate(() => (window as any).__ecx.store.select(["t1"], { editing: null }));
  await insp(page).getByLabel("Phụ đề").fill("Giới thiệu nhanh");
  await expect(tabs.locator(".ecx-tab-subtitle")).toHaveText("Giới thiệu nhanh");
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["t1"], { icon: "star" }));
  await expect(tabs.locator(".ecx-tab-icon")).toHaveCount(1);
  // điện thoại: tiêu đề tab 2 nằm giữa panel 1 và panel 2 (accordion)
  await page.getByRole("button", { name: "Điện thoại" }).first().click();
  await page.evaluate(() => (window as any).__ecx.store.select([]));
  // khung soạn đổi khổ có chuyển động: chờ bố cục ổn định
  await expect.poll(async () => { const t2 = await tabs.locator(".ecx-tab-button").nth(1).boundingBox(), p1 = await tabs.locator(".ecx-tab-panel").first().boundingBox(); return t2!.y > p1!.y; }).toBe(true);
});

test("accordion: 2 cột, icon dấu cộng bên trái, thẻ tiêu đề, FAQ", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "A", type: "accordion", attrs: {}, content: [
    { id: "d1", type: "details", attrs: { summary: "Một" }, content: [{ id: "dp1", type: "paragraph", attrs: {}, inline: [] }] },
    { id: "d2", type: "details", attrs: { summary: "Hai" }, content: [{ id: "dp2", type: "paragraph", attrs: {}, inline: [] }] }] }], { focus: false }); s.select(["A"], { editing: null }); });
  await insp(page).getByRole("radio", { name: "2 cột" }).click();
  await insp(page).getByRole("radio", { name: "Dấu cộng" }).click();
  await insp(page).getByRole("radiogroup", { name: "Vị trí icon" }).getByRole("radio", { name: "Trái" }).click();
  await insp(page).getByRole("radio", { name: "h3" }).click();
  await insp(page).getByRole("checkbox", { name: /FAQ Schema/ }).check();
  expect((await find(page, "accordion")).attrs).toMatchObject({ columns: 2, icon: "plus", iconSide: "left", titleTag: "h3", faq: true });
  const acc = c.locator(".ecx-accordion.is-cols-2.has-icon-plus.is-icon-left");
  const [a, b] = [await acc.locator(".ecx-details").nth(0).boundingBox(), await acc.locator(".ecx-details").nth(1).boundingBox()];
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(2); // cùng hàng
  expect(b!.x).toBeGreaterThan(a!.x + a!.width / 2);
});

test("nút: chỉ icon, icon hiện khi rê (chỉ hiện ô khi nút có icon); nhóm nút xếp dọc", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "G", type: "buttons", attrs: {}, content: [
    { id: "B1", type: "button", attrs: { text: "Một", variant: "primary" } }, { id: "B2", type: "button", attrs: { text: "Hai", variant: "primary" } }] }], { focus: false }); s.select(["B1"], { editing: null }); });
  await expect(insp(page).getByRole("checkbox", { name: /Chỉ hiện icon/ })).toHaveCount(0);
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["B1"], { icon: "star" }));
  await insp(page).getByRole("checkbox", { name: /Chỉ hiện icon/ }).check();
  await expect(c.locator(".ecx-button.is-icon-only")).toBeVisible();
  await expect(c.locator(".ecx-button.is-icon-only")).not.toContainText("Một");
  await expect(insp(page).getByRole("checkbox", { name: "Icon chỉ hiện khi rê chuột" })).toHaveCount(0);
  await page.evaluate(() => (window as any).__ecx.store.select(["G"], { editing: null }));
  await insp(page).getByRole("radio", { name: "Dọc" }).click();
  const [a, b] = [await c.locator(".ecx-buttons-group .ecx-button").nth(0).boundingBox(), await c.locator(".ecx-buttons-group .ecx-button").nth(1).boundingBox()];
  expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
});

test("thanh tiến độ: giá trị / tối đa, hậu tố, chữ trong thanh", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "P", type: "progressBar", attrs: { label: "Đơn hàng", value: 30 } }], { focus: false }); s.select(["P"], { editing: null }); });
  await insp(page).getByRole("spinbutton", { name: "Giá trị tối đa" }).fill("60");
  await insp(page).getByRole("textbox", { name: "Hậu tố của số" }).fill(" đơn");
  await insp(page).getByRole("radio", { name: "Trong thanh" }).click();
  const bar = c.locator(".ecx-progress.is-text-inside");
  await expect(bar.locator(".ecx-progress-value")).toHaveText("30 đơn");
  await expect(bar.locator(".ecx-progress-bar")).toHaveAttribute("style", /width: 50%/);
  await expect(bar.locator("[role=progressbar]")).toHaveAttribute("aria-valuemax", "60");
});

test("đếm ngược: khung soạn chạy như website; một dòng, ẩn giây, nhãn riêng, chữ sau", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; const t = new Date(Date.now() + ((26 * 3600) + 120) * 1000).toISOString(); s.insert("root", null, 0, [{ id: "C", type: "countdown", attrs: { target: t, label: "Còn" } }], { focus: false }); s.select([]); });
  const cd = c.locator(".ecx-countdown");
  await expect(cd.locator(".ecx-countdown-d strong")).toHaveText("01");
  await expect(cd.locator(".ecx-countdown-d small")).toHaveText("ngày");
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["C"], { layout: "inline", showSeconds: false, showDays: false, hoursLabel: "tiếng", postText: "nữa là hết" }));
  await expect(c.locator(".ecx-countdown.is-inline")).toBeVisible();
  await expect(cd.locator(".ecx-countdown-s")).toHaveCount(0);
  await expect(cd.locator(".ecx-countdown-h strong")).toHaveText("26");
  await expect(cd.locator(".ecx-countdown-h small")).toHaveText("tiếng");
  await expect(cd.locator(".ecx-countdown-post")).toHaveText("nữa là hết");
});

test("hộp icon: media số, khung tròn, icon bên phải, nút Xem thêm (ô chỉ hiện khi cần)", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "I", type: "iconBox", attrs: { icon: "star", title: "Bước một", text: "" } }], { focus: false }); s.select(["I"], { editing: null }); });
  await expect(insp(page).getByRole("textbox", { name: "Số hiển thị" })).toHaveCount(0);
  await insp(page).getByRole("radio", { name: "Số" }).click();
  await insp(page).getByRole("textbox", { name: "Số hiển thị" }).fill("01");
  await insp(page).getByRole("radio", { name: "Tròn" }).click();
  await insp(page).getByRole("radio", { name: "Bên phải" }).click();
  await insp(page).getByRole("radio", { name: /Xem thêm/ }).click();
  await insp(page).getByRole("textbox", { name: "Chữ trên nút" }).fill("Chi tiết");
  const box = c.locator(".ecx-icon-box.is-right");
  await expect(box.locator(".ecx-icon-box-icon.is-number.is-circle")).toHaveText("01");
  await expect(box.locator(".ecx-icon-box-more")).toHaveText("Chi tiết");
  const [m, b] = [await box.locator(".ecx-icon-box-icon").boundingBox(), await box.locator(".ecx-icon-box-body").boundingBox()];
  expect(m!.x).toBeGreaterThan(b!.x); // số nằm bên phải
});

test("mục lục: khoảng cấp H3–H4, thu gọn, danh sách 2 cột không dấu", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [
    { id: "TOC", type: "tableOfContents", attrs: {} },
    { id: "h2", type: "heading", attrs: { level: 2 }, inline: [{ type: "text", text: "Hai" }] },
    { id: "h3", type: "heading", attrs: { level: 3 }, inline: [{ type: "text", text: "Ba" }] },
    { id: "h4", type: "heading", attrs: { level: 4 }, inline: [{ type: "text", text: "Bốn" }] }], { focus: false }); s.select(["TOC"], { editing: null }); });
  await insp(page).getByRole("combobox", { name: "Cấp nhỏ nhất" }).selectOption("3");
  await insp(page).getByRole("combobox", { name: /Cấp tối đa/ }).selectOption("4");
  await insp(page).getByRole("checkbox", { name: /Thu gọn được/ }).check();
  await insp(page).getByRole("radiogroup", { name: "Kiểu danh sách" }).getByRole("radio", { name: "Không" }).click();
  await insp(page).getByRole("radiogroup", { name: "Số cột" }).getByRole("radio", { name: "2" }).click();
  const toc = c.locator(".ecx-toc");
  await expect(toc.locator("details.ecx-toc-details > summary")).toBeVisible();
  await expect(toc.locator("ul.ecx-toc-list.is-plain.has-cols-2 > li")).toHaveText(["Ba", "Bốn"]);
});

test("form: Cc, tiêu đề email, chuyển trang; ô 1/3 hàng + tự điền", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "F", type: "form", attrs: { formId: "f_t" }, content: [
    { id: "F1", type: "formField", attrs: { kind: "text", name: "ten", label: "Tên" } }, { id: "F2", type: "formField", attrs: { kind: "text", name: "ho", label: "Họ" } }] }], { focus: false }); s.select(["F"], { editing: null }); });
  await insp(page).getByRole("textbox", { name: "Đồng gửi (Cc)" }).fill("a@x.vn, b@x.vn");
  await insp(page).getByRole("textbox", { name: "Tiêu đề email báo" }).fill("Khách hỏi giá");
  await insp(page).getByRole("textbox", { name: "Chuyển tới trang sau khi gửi" }).fill("/cam-on");
  expect((await find(page, "form")).attrs).toMatchObject({ notifyCc: "a@x.vn, b@x.vn", emailSubject: "Khách hỏi giá", redirect: "/cam-on" });
  await page.evaluate(() => (window as any).__ecx.store.select(["F1"], { editing: null }));
  await insp(page).getByRole("radio", { name: "1/3 hàng" }).click();
  await insp(page).getByRole("combobox", { name: "Trình duyệt tự điền" }).selectOption("given-name");
  expect((await find(page, "formField")).attrs).toMatchObject({ width: "third", autocomplete: "given-name" });
  const [a, b] = [await c.locator(".ecx-field").nth(0).boundingBox(), await c.locator(".ecx-form-blocks").boundingBox()];
  expect(a!.width).toBeLessThan(b!.width / 2.5);
});

test.describe("thư viện mẫu", () => {
  test("lõi không có mẫu dựng sẵn: thư viện báo trống, trình chèn không có thẻ mẫu", async ({ page }) => {
    await open(page, "?doc=post");
    await page.getByRole("button", { name: "Thư viện mẫu" }).click();
    const lib = page.getByRole("dialog", { name: "Thư viện mẫu" });
    await expect(lib).toBeVisible();
    await expect(lib.locator(".ecx-lib-card")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Thêm khối" }).first().click();
    await page.locator(".ecx-inserter-panel").getByRole("tab", { name: "Mẫu" }).click();
    await expect(page.locator(".ecx-pattern-card")).toHaveCount(0);
  });

  test("chèn mẫu đã đăng ký theo danh mục; kiểu màu tối bọc mẫu trong nhóm nền tối", async ({ page }) => {
    await open(page, "?doc=post&patterns=1");
    const before = (await state(page)).docs.root.blocks.length;
    await page.getByRole("button", { name: "Thư viện mẫu" }).click();
    const lib = page.getByRole("dialog", { name: "Thư viện mẫu" });
    await lib.getByRole("button", { name: "Bảng giá", exact: true }).click();
    await expect(lib.locator(".ecx-lib-card")).toHaveCount(3);
    await lib.getByRole("radio", { name: "Tối" }).click();
    await lib.locator(".ecx-lib-card").first().click();
    await expect(lib).toHaveCount(0);
    const blocks = (await state(page)).docs.root.blocks;
    expect(blocks.length).toBe(before + 1);
    const g = blocks.find((b: any) => b.type === "group" && b.attrs.style?.color?.background === "#0f1b24");
    expect(g?.content?.length).toBeGreaterThan(0);
  });

  test("Tạo bằng AI: viết lại chữ của mẫu đang xem, giữ bố cục", async ({ page }) => {
    await open(page, "?doc=post&ai=1&patterns=1");
    await page.getByRole("button", { name: "Thư viện mẫu" }).click();
    const lib = page.getByRole("dialog", { name: "Thư viện mẫu" });
    await lib.getByRole("radio", { name: "Tạo bằng AI" }).click();
    await lib.getByRole("button", { name: "Hỏi đáp", exact: true }).click();
    await lib.getByLabel("Tên doanh nghiệp").fill("Trà Cổ Thụ");
    await lib.getByRole("button", { name: "Viết chữ cho các mẫu đang xem" }).click();
    await expect(lib.getByRole("button", { name: "Viết chữ cho các mẫu đang xem" })).toBeEnabled();
    await lib.locator(".ecx-lib-card").first().click();
    const json = JSON.stringify((await state(page)).docs.root.blocks);
    expect(json).toContain("AI ");
  });
});

test("cấu trúc của khối chứa: thẻ HTML, z-index, thứ tự riêng trên điện thoại", async ({ page }) => {
  const c = await open(page, "?doc=rich");
  const col = await find(page, "column");
  await page.evaluate((x) => (window as any).__ecx.store.select([x]), col.id);
  await insp(page).getByRole("tab", { name: "Nâng cao" }).click();
  await insp(page).getByRole("button", { name: "Cấu trúc" }).click();
  const sec = insp(page).locator(".ecx-style-section", { hasText: "Cấu trúc" });
  await sec.getByLabel("Thẻ HTML").selectOption("section");
  await sec.getByLabel("Lớp xếp chồng (z-index)").fill("5");
  await expect(c.locator(`[data-ecx-block="${col.id}"]`)).toHaveCSS("z-index", "5");
  // Thứ tự theo khổ: chỉ đặt cho điện thoại
  await sec.getByRole("button", { name: "Điện thoại", exact: true }).first().click();
  await sec.getByLabel("Thứ tự trong khối cha").fill("-1");
  const attrs = (await find(page, "column")).attrs;
  expect(attrs.tagName).toBe("section");
  expect(attrs.style).toMatchObject({ zIndex: 5, order: { mobile: -1 } });
  await expect(c.locator(`[data-ecx-block="${col.id}"]`)).toHaveCSS("order", "-1");
});

test("icon: độ dày nét, khung tròn, liên kết (ô mở tab chỉ hiện khi có liên kết), màu khi rê chuột", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "ic1", type: "icon", attrs: { name: "heart", size: 40 } }]); s.select(["ic1"]); });
  const i = insp(page);
  await i.getByRole("radio", { name: "Tròn" }).click();
  await expect(c.locator(".ecx-icon-shape.is-circle")).toHaveCSS("padding-top", "16px");
  await i.getByRole("slider", { name: "Độ dày nét" }).fill("1");
  await expect(c.locator(".ecx-icon-block svg")).toHaveAttribute("stroke-width", "1");
  await expect(i.getByRole("radiogroup", { name: "Mở liên kết" })).toHaveCount(0);
  await i.getByRole("textbox", { name: "Liên kết" }).fill("/lien-he");
  await i.getByRole("radiogroup", { name: "Mở liên kết" }).getByRole("radio", { name: "Tab mới" }).click();
  await i.getByRole("tab", { name: "Kiểu dáng" }).click();
  await i.getByRole("tab", { name: "Rê chuột" }).click();
  await expect(i.getByText("Chữ", { exact: true })).toBeVisible();
  const attrs = (await find(page, "icon")).attrs;
  expect(attrs).toMatchObject({ iconStyle: "circle", stroke: 1, href: "/lien-he", linkTarget: "_blank" });
});

test("danh sách icon: 2 cột, khung tròn, sửa từng mục (chữ, không icon, liên kết), thêm / xoá mục", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "il1", type: "iconList", attrs: { items: [{ text: "Một" }, { text: "Hai" }] } }]); s.select(["il1"]); });
  const i = insp(page), list = c.locator(".ecx-icon-list");
  await i.getByRole("slider", { name: "Số cột" }).fill("2");
  await expect(list).toHaveClass(/is-cols-2/);
  await i.getByRole("radiogroup", { name: "Khung icon" }).getByRole("radio", { name: "Tròn" }).click();
  await expect(list).toHaveClass(/has-icon-circle/);
  await i.getByLabel("Icon 1").selectOption("none");
  await expect(list.locator(".ecx-widget-icon")).toHaveCount(1);
  await i.getByLabel("Liên kết 2").fill("/hai");
  await i.getByRole("button", { name: "Thêm mục" }).click();
  await i.getByLabel("Chữ 3").fill("Ba");
  await i.getByRole("button", { name: "Xoá mục 2" }).click();
  expect((await find(page, "iconList")).attrs).toMatchObject({ columns: 2, iconStyle: "circle", items: [{ text: "Một", icon: "none" }, { text: "Ba" }] });
});

test("nút: rộng cố định, màu icon thường / khi rê", async ({ page }) => {
  const c = await open(page, "?doc=rich");
  const btn = await find(page, "button");
  await page.evaluate((x) => { const s = (window as any).__ecx.store; s.setAttrs([x], { icon: "arrowRight" }); s.select([x]); }, btn.id);
  const i = insp(page);
  await i.getByRole("tab", { name: "Kiểu dáng" }).click();
  await i.getByRole("button", { name: /^Nút · tuỳ chọn khác/ }).click();
  await i.getByRole("spinbutton", { name: /Rộng cố định/ }).fill("240");
  await expect(c.locator(".ecx-button").first()).toHaveCSS("width", "240px");
  await i.getByRole("button", { name: /^Icon/ }).click();
  await expect(i.locator(".ecx-style-section", { hasText: "Màu icon" }).getByRole("tab", { name: "Rê chuột" })).toBeVisible();
  expect((await find(page, "button")).attrs.buttonWidth).toBe("240px");
});

test("liên kết trong đoạn văn: không gạch chân, rê chuột mới gạch", async ({ page }) => {
  await open(page, "?doc=post");
  const para = await find(page, "paragraph");
  await page.evaluate((x) => (window as any).__ecx.store.select([x]), para.id);
  const i = insp(page);
  await i.getByRole("tab", { name: "Kiểu dáng" }).click();
  await i.getByRole("button", { name: "Liên kết", exact: true }).click();
  const sec = i.locator(".ecx-style-section", { hasText: "Liên kết" }).last();
  await sec.getByRole("radiogroup", { name: "Trang trí" }).getByRole("radio").first().click();
  await sec.getByRole("tab", { name: "Rê chuột" }).click();
  await sec.getByRole("radiogroup", { name: "Trang trí" }).getByRole("radio").nth(1).click();
  expect((await find(page, "paragraph")).attrs.parts.link).toMatchObject({ style: { textDecoration: "none" }, hover: { textDecoration: "underline" } });
});

test("hộp icon: media là ảnh — ô chọn ảnh trên khối, căn dọc chỉ hiện khi ảnh nằm bên, rộng ảnh, cao bằng ô chứa; Hộp ảnh không còn trong bảng chèn", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "I", type: "iconBox", attrs: { icon: "star", title: "Dịch vụ", text: "Mô tả" } }], { focus: false }); s.select(["I"], { editing: null }); });
  await expect(insp(page).getByRole("radiogroup", { name: "Căn dọc với chữ" })).toHaveCount(0);
  await insp(page).getByRole("radio", { name: "Ảnh", exact: true }).click();
  // Chưa có ảnh: ô chọn ảnh nằm ngay trên khối; ô icon và khung icon ẩn
  await expect(c.locator(".ecx-icon-box-icon.is-image .ecx-media-pick")).toBeVisible();
  await expect(insp(page).getByRole("combobox", { name: "Icon", exact: true })).toHaveCount(0);
  await expect(insp(page).getByRole("radio", { name: "Tròn" })).toHaveCount(0);
  const src = "/uploads/dich-vu.jpg"; // đường dẫn data: bị bộ lọc URL bỏ (đúng thiết kế)
  await page.evaluate((u) => (window as any).__ecx.store.setAttrs(["I"], { src: u, alt: "Ảnh dịch vụ" }), src);
  const img = c.locator(".ecx-icon-box-icon.is-image img");
  await expect(img).toHaveAttribute("alt", "Ảnh dịch vụ");
  await insp(page).getByRole("radio", { name: "Bên trái" }).click();
  await insp(page).getByRole("radiogroup", { name: "Căn dọc với chữ" }).getByRole("radio", { name: "Giữa" }).click();
  await insp(page).getByRole("checkbox", { name: /Cao bằng ô chứa/ }).check();
  const box = c.locator(".ecx-icon-box.is-left.is-v-center.is-full-height");
  await expect(box).toBeVisible();
  expect(Math.round((await img.boundingBox())!.width)).toBe(96); // mặc định 6rem khi ảnh nằm bên
  const [m, b] = [await box.locator(".ecx-icon-box-icon").boundingBox(), await box.locator(".ecx-icon-box-body").boundingBox()];
  expect(m!.x).toBeLessThan(b!.x);
  expect(Math.abs((m!.y + m!.height / 2) - (b!.y + b!.height / 2))).toBeLessThan(2); // căn giữa theo chiều dọc
  const a = await page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.find((b: any) => b.id === "I").attrs);
  expect(a).toMatchObject({ media: "image", position: "left", verticalAlign: "center", fullHeight: true });
  // Rộng ảnh ở tab Kiểu dáng
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["I"], { iconBoxImageWidth: "160px" }));
  await expect.poll(async () => Math.round((await img.boundingBox())!.width)).toBe(160);
  await page.getByRole("button", { name: "Thêm khối" }).first().click();
  await expect(page.locator('.ecx-inserter-panel .ecx-block-tile[data-key="iconBox"]').first()).toBeVisible();
  await expect(page.locator('.ecx-inserter-panel .ecx-block-tile[data-key="imageBox"]')).toHaveCount(0);
});

test("lời chứng thực: kiểu bong bóng (khung ngoài bỏ nền, lời trích có nền + đuôi), sao đánh giá, dấu trích; phần Sao / Dấu trích ở Kiểu dáng", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "T", type: "testimonial", attrs: { quote: "Giao nhanh, đóng gói kỹ.", name: "Chị Lan", role: "Khách mua lẻ" } }], { focus: false }); s.select(["T"], { editing: null }); });
  const box = c.locator(".ecx-testimonial");
  await expect(box.locator(".ecx-testimonial-rating, .ecx-testimonial-mark")).toHaveCount(0);
  const bg = (l: any) => l.evaluate((e: Element) => getComputedStyle(e).backgroundColor);
  const cardBg = await bg(box);
  expect(cardBg).not.toBe("rgba(0, 0, 0, 0)");
  await insp(page).getByRole("radio", { name: "Bong bóng" }).click();
  await expect(c.locator(".ecx-testimonial.is-bubble")).toBeVisible();
  expect(await bg(box)).toBe("rgba(0, 0, 0, 0)");
  expect(await bg(box.locator(".ecx-testimonial-quote"))).toBe(cardBg);
  // Đuôi bong bóng lấy nền của lời trích
  expect(await box.locator(".ecx-testimonial-quote").evaluate((e) => getComputedStyle(e, "::after").backgroundColor)).toBe(cardBg);
  await insp(page).getByRole("slider", { name: "Sao đánh giá" }).fill("4");
  await insp(page).getByRole("checkbox", { name: /Hiện dấu trích/ }).check();
  await expect(box.locator(".ecx-testimonial-rating")).toHaveAttribute("aria-label", "4/5");
  await expect(box.locator(".ecx-testimonial-rating .is-on")).toHaveCount(4);
  await expect(box.locator(".ecx-testimonial-mark")).toHaveText("“");
  // Sao nằm trên lời trích, tên nằm dưới
  const y = async (sel: string) => (await box.locator(sel).boundingBox())!.y;
  expect(await y(".ecx-testimonial-rating")).toBeLessThan(await y(".ecx-testimonial-quote"));
  expect(await y(".ecx-testimonial-quote")).toBeLessThan(await y(".ecx-testimonial-name"));
  await page.locator(".ecx-inspector > .ecx-tabs [role=tab]").nth(1).click();
  await expect(insp(page).getByRole("button", { name: "Sao đánh giá" })).toBeVisible();
  await expect(insp(page).getByRole("button", { name: "Dấu trích" })).toBeVisible();
});

test("bộ đếm: số chữ thập phân và thẻ tiêu đề; thanh tiến độ: số thập phân, tắt hiệu ứng thì ẩn ô thời gian / kiểu chạy, nhãn đọc màn hình", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [
    { id: "C", type: "counter", attrs: { end: 12.5, title: "Năm kinh nghiệm" } },
    { id: "P", type: "progressBar", attrs: { label: "Đơn hàng", value: 72.25 } }], { focus: false }); s.select(["C"], { editing: null }); });
  await expect(c.locator(".ecx-counter-value")).toHaveText("12.5");
  await insp(page).getByRole("spinbutton", { name: "Số chữ thập phân" }).fill("2");
  await expect(c.locator(".ecx-counter-value")).toHaveText("12.50");
  await insp(page).getByRole("combobox", { name: "Thẻ HTML của tiêu đề" }).selectOption("h3");
  await expect(c.locator("h3.ecx-counter-title")).toHaveText("Năm kinh nghiệm");
  await page.evaluate(() => (window as any).__ecx.store.select(["P"], { editing: null }));
  const bar = c.locator(".ecx-progress");
  await expect(bar.locator(".ecx-progress-value")).toHaveText("72%");
  await insp(page).getByRole("radiogroup", { name: "Số chữ thập phân" }).getByRole("radio", { name: "0,1", exact: true }).click();
  await expect(bar.locator(".ecx-progress-value")).toHaveText("72.3%");
  await insp(page).getByRole("combobox", { name: "Kiểu chạy" }).selectOption("linear");
  expect(await bar.locator(".ecx-progress-bar").evaluate((e) => getComputedStyle(e).transitionTimingFunction)).toBe("linear");
  await insp(page).getByRole("checkbox", { name: /Chạy từ 0 khi cuộn tới/ }).uncheck();
  await expect(c.locator(".ecx-progress.ecx-in")).toHaveCount(0);
  await expect(insp(page).getByRole("combobox", { name: "Kiểu chạy" })).toHaveCount(0);
  await expect(insp(page).getByRole("spinbutton", { name: /Thời gian chạy/ })).toHaveCount(0);
  await insp(page).getByRole("textbox", { name: "Nhãn cho trình đọc màn hình" }).fill("Tiến độ đơn hàng");
  await expect(bar.locator("[role=progressbar]")).toHaveAttribute("aria-label", "Tiến độ đơn hàng");
});

test("accordion: chọn mở sẵn (ô hiện ở Cài đặt, lưu vào khối); phần Icon ở Kiểu dáng đổi màu icon thường và khi đang mở", async ({ page }) => {
  const c = await open(page, "?doc=post");
  const pane = (id: string, t: string) => ({ id, type: "details", attrs: { summary: t }, content: [{ id: `${id}p`, type: "paragraph", attrs: {}, inline: [{ type: "text", text: `Nội dung ${t}` }] }] });
  await page.evaluate((ps) => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "A", type: "accordion", attrs: {}, content: ps }], { focus: false }); s.select(["A"], { editing: null }); }, [pane("d1", "Một"), pane("d2", "Hai")]);
  const i = insp(page);
  const grp = i.getByRole("radiogroup", { name: "Mở sẵn khi tải trang" });
  await grp.getByRole("radio", { name: "Mục đầu" }).click();
  expect((await find(page, "accordion")).attrs.startOpen).toBe("first");
  await grp.getByRole("radio", { name: "Tất cả" }).click();
  expect((await find(page, "accordion")).attrs.startOpen).toBe("all");
  // Phần Icon: màu thường và màu khi đang mở
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["A"], { parts: { icon: { style: { color: { text: "#f26251" } }, active: { color: { text: "#1a597b" } } } } }));
  await i.getByRole("tab", { name: "Kiểu dáng" }).click();
  await expect(i.getByRole("button", { name: /^Icon/ })).toBeVisible();
  // Khung soạn luôn mở hết mục → icon ở trạng thái "đang mở"
  const color = () => c.locator(".ecx-accordion > details > summary").first().evaluate((e) => getComputedStyle(e, "::after").borderTopColor);
  await expect.poll(color).toBe("rgb(26, 89, 123)");
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["A"], { parts: { icon: { style: { color: { text: "#f26251" } } } } }));
  await expect.poll(color).toBe("rgb(242, 98, 81)");
});

test("tab: vị trí icon (trên / phải), chỉ hiện icon ẩn chữ của tab có icon; rộng tiêu đề và cao tối thiểu nội dung ở Kiểu dáng", async ({ page }) => {
  const c = await open(page, "?doc=post");
  const tab = (id: string, t: string, icon?: string) => ({ id, type: "tab", attrs: { title: t, ...(icon ? { icon } : {}) }, content: [{ id: `${id}p`, type: "paragraph", attrs: {}, inline: [{ type: "text", text: `Nội dung ${t}` }] }] });
  await page.evaluate((ts) => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "T", type: "tabs", attrs: {}, content: ts }], { focus: false }); s.select(["T"], { editing: null }); }, [tab("t1", "Giao hàng", "clock"), tab("t2", "Đổi trả")]);
  const i = insp(page);
  const btn = c.locator(".ecx-tabs [role=tab]").first();
  const pos = async () => { const [a, b] = [await btn.locator(".ecx-tab-icon").boundingBox(), await btn.locator(".ecx-tab-label").boundingBox()]; return { a: a!, b: b! }; };
  let p = await pos();
  expect(p.a.x).toBeLessThan(p.b.x); // mặc định: icon bên trái chữ
  await i.getByRole("radiogroup", { name: "Vị trí icon" }).getByRole("radio", { name: "Phải" }).click();
  p = await pos(); expect(p.a.x).toBeGreaterThan(p.b.x);
  await i.getByRole("radiogroup", { name: "Vị trí icon" }).getByRole("radio", { name: "Trên" }).click();
  p = await pos(); expect(p.a.y).toBeLessThan(p.b.y);
  await expect(c.locator(".ecx-tabs.has-icon-top")).toBeVisible();
  await i.getByRole("checkbox", { name: /Chỉ hiện icon/ }).check();
  await expect(c.locator(".ecx-tabs.is-icon-only")).toBeVisible();
  expect((await btn.locator(".ecx-tab-label").boundingBox())!.width).toBeLessThanOrEqual(1); // chữ của tab có icon bị ẩn
  expect((await c.locator(".ecx-tabs [role=tab]").nth(1).locator(".ecx-tab-label").boundingBox())!.width).toBeGreaterThan(20); // tab không icon vẫn hiện chữ
  expect(await find(page, "tabs")).toMatchObject({ attrs: { iconPosition: "top", iconOnly: true } });
  // Kiểu dáng: rộng tiêu đề, cao tối thiểu nội dung
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["T"], { tabsTitleWidth: { base: "40%" }, tabsPanelMinHeight: { base: "200px" } }));
  await expect.poll(async () => Math.round((await c.locator(".ecx-tabs [role=tab]").nth(1).boundingBox())!.width)).toBeGreaterThan(200);
  await expect.poll(async () => Math.round((await c.locator(".ecx-tabs [role=tabpanel]:visible").boundingBox())!.height)).toBeGreaterThanOrEqual(200);
  await i.getByRole("tab", { name: "Kiểu dáng" }).click();
  await expect(i.getByText("Rộng tiêu đề tab")).toBeVisible();
  await expect(i.getByText("Cao tối thiểu nội dung")).toBeVisible();
});

test("mục lục: công tắc Hiện tiêu đề; bật thu gọn được thì công tắc ẩn và tiêu đề luôn hiện", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [
    { id: "TOC", type: "tableOfContents", attrs: { title: "Trong bài này" } },
    { id: "h2", type: "heading", attrs: { level: 2 }, inline: [{ type: "text", text: "Giới thiệu" }] }], { focus: false }); s.select(["TOC"], { editing: null }); });
  const title = c.locator(".ecx-toc .ecx-toc-title");
  await expect(title).toHaveText("Trong bài này");
  await insp(page).getByRole("checkbox", { name: "Hiện tiêu đề" }).uncheck();
  await expect(title).toHaveCount(0);
  await expect(c.locator(".ecx-toc .ecx-toc-list")).toContainText("Giới thiệu"); // danh sách vẫn còn
  await insp(page).getByRole("checkbox", { name: /Thu gọn được/ }).check();
  await expect(insp(page).getByRole("checkbox", { name: "Hiện tiêu đề" })).toHaveCount(0);
  await expect(title).toHaveText("Trong bài này");
  expect(await find(page, "tableOfContents")).toMatchObject({ attrs: { showTitle: false, collapsible: true } });
});

test("tìm kiếm: nút icon kính lúp có nhãn đọc màn hình; phần Ô nhập / Nút đổi kiểu thật; màu chữ gợi ý và rộng tối đa ở Kiểu dáng", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "S", type: "search", attrs: { buttonText: "Tìm" } }], { focus: false }); s.select(["S"], { editing: null }); });
  const i = insp(page);
  await expect(c.locator("form.search-form button")).toHaveText("Tìm");
  await i.getByRole("radiogroup", { name: "Kiểu nút" }).getByRole("radio", { name: "Icon kính lúp" }).click();
  const btn = c.locator("form.search-form button");
  await expect(btn).toHaveAttribute("aria-label", "Tìm");
  await expect(btn.locator("svg")).toBeVisible();
  await expect(btn).toHaveText("");
  // Phần Ô nhập / Nút: ghi thẳng giá trị rồi kiểm CSS tính ra (khung soạn dùng cùng controlsCss với website)
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["S"], { searchPlaceholderColor: "#5d6a75", searchMaxWidth: { base: "20rem" },
    parts: { input: { style: { color: { background: "#f3f4f6" }, border: { color: "#1a597b" } } }, button: { style: { color: { background: "#f26251" } } } } }));
  await expect(c.locator("form.search-form input")).toHaveCSS("background-color", "rgb(243, 244, 246)");
  await expect(btn).toHaveCSS("background-color", "rgb(242, 98, 81)");
  expect(await c.locator("form.search-form input").evaluate((e) => getComputedStyle(e, "::placeholder").color)).toBe("rgb(93, 106, 117)");
  expect(Math.round((await c.locator("form.search-form").boundingBox())!.width)).toBeLessThanOrEqual(320);
  await i.getByRole("tab", { name: "Kiểu dáng" }).click();
  await expect(i.getByRole("button", { name: /^Ô nhập/ })).toBeVisible();
  await expect(i.getByRole("button", { name: /^Nút/ })).toBeVisible();
  await expect(i.getByText("Màu chữ gợi ý")).toBeVisible();
  await expect(i.getByText("Rộng tối đa của ô tìm")).toBeVisible();
});

test("thư viện ảnh: kiểu masonry (ảnh giữ tỉ lệ, chia cột), khoảng cách ảnh chỉnh được, link riêng từng ảnh nhập ở bảng phải", async ({ page }) => {
  const c = await open(page, "?doc=post");
  const im = (n: number, w: number, h: number) => ({ src: `/uploads/a${n}.jpg`, alt: `Ảnh ${n}`, width: w, height: h });
  await page.evaluate((images) => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "G", type: "gallery", attrs: { columns: 2, images } }], { focus: false }); s.select(["G"], { editing: null }); }, [im(1, 400, 300), im(2, 400, 600), im(3, 400, 300)]);
  const g = c.locator("figure.ecx-gallery");
  await expect(g).toHaveCSS("display", "grid");
  await insp(page).getByRole("radiogroup", { name: "Kiểu xếp" }).getByRole("radio", { name: "Masonry" }).click();
  await expect(c.locator("figure.ecx-gallery.is-masonry")).toHaveCSS("column-count", "2");
  await expect(g).toHaveCSS("display", "block");
  // Khoảng cách ảnh: biến CSS đi vào khoảng giữa cột
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["G"], { galleryGap: { base: "24px" } }));
  await expect(g).toHaveCSS("column-gap", "24px");
  // Link riêng của ảnh (ô trong danh sách ảnh)
  await insp(page).getByRole("textbox", { name: "Liên kết ảnh 2" }).fill("/san-pham/hai");
  expect((await find(page, "gallery")).attrs.images[1]).toMatchObject({ href: "/san-pham/hai", alt: "Ảnh 2" });
  // Về lưới đều: gap mặc định hoặc theo ô
  await insp(page).getByRole("radiogroup", { name: "Kiểu xếp" }).getByRole("radio", { name: "Lưới đều" }).click();
  await expect(g).toHaveCSS("display", "grid");
  await expect(g).toHaveCSS("column-gap", "24px");
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["G"], { galleryGap: undefined }));
  await expect(g).toHaveCSS("column-gap", "8px");
});

test("form: cỡ ô nhập S / M / L đổi chiều cao ô thật; phần Ô nhập / Dấu * / Báo lỗi / Nút ở Kiểu dáng đổi màu thật", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "F", type: "form", attrs: { formId: "f_test01" }, content: [
    { id: "f1", type: "formField", attrs: { kind: "text", name: "name", label: "Họ tên", required: true } },
    { id: "f2", type: "formField", attrs: { kind: "email", name: "email", label: "Email", help: "Không công khai" } }] }], { focus: false }); s.select(["F"], { editing: null }); });
  const input = c.locator(".ecx-form-blocks .ecx-field input").first();
  const h = async () => Math.round((await input.boundingBox())!.height);
  const md = await h();
  const size = insp(page).getByRole("radiogroup", { name: "Cỡ ô nhập" });
  await size.getByRole("radio", { name: "Lớn" }).click();
  await expect(c.locator(".ecx-form-blocks.is-size-lg")).toBeVisible();
  const lg = await h(); expect(lg).toBeGreaterThan(md);
  await size.getByRole("radio", { name: "Nhỏ" }).click();
  const sm = await h(); expect(sm).toBeLessThan(md);
  await size.getByRole("radio", { name: "Vừa" }).click();
  await expect(c.locator(".ecx-form-blocks.is-size-sm, .ecx-form-blocks.is-size-lg")).toHaveCount(0);
  expect(await h()).toBe(md);
  // Các phần của form (ghi thẳng giá trị; khung soạn dùng cùng controlsCss với website)
  await page.evaluate(() => (window as any).__ecx.store.setAttrs(["F"], { parts: {
    input: { style: { color: { background: "#f3f4f6" } }, hover: { border: { color: "#1a597b" } } },
    required: { style: { color: { text: "#f26251" } } },
    button: { style: { color: { background: "#0f1e29" } } } } }));
  await expect(input).toHaveCSS("background-color", "rgb(243, 244, 246)");
  await expect(c.locator(".ecx-field-required").first()).toHaveCSS("color", "rgb(242, 98, 81)");
  await expect(c.locator(".ecx-form-actions .ecx-button")).toHaveCSS("background-color", "rgb(15, 30, 41)");
  await insp(page).getByRole("tab", { name: "Kiểu dáng" }).click();
  for (const part of ["Nhãn", "Ô nhập", "Dấu \\* bắt buộc", "Gợi ý dưới ô", "Báo lỗi", "Báo thành công", "Nút"]) await expect(insp(page).getByRole("button", { name: new RegExp(`^${part}`) })).toBeVisible();
});

test("bản đồ: gõ địa chỉ ngay trên khối ra khung Google Maps; mức phóng, cao, kiểu vệ tinh đổi địa chỉ khung và chiều cao", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "M", type: "map", attrs: {} }], { focus: false }); s.select(["M"], { editing: null }); });
  await expect(c.locator(".ecx-map.is-empty")).toBeVisible(); // chưa có địa chỉ: ô gõ địa chỉ
  await insp(page).getByRole("textbox", { name: /^Địa chỉ/ }).fill("1 Phạm Văn Đồng, Hà Nội");
  const frame = c.locator(".ecx-map iframe");
  await expect(frame).toHaveAttribute("src", /^https:\/\/www\.google\.com\/maps\?q=1%20Ph.*&z=14&t=m&output=embed$/);
  await insp(page).getByRole("radiogroup", { name: "Kiểu bản đồ" }).getByRole("radio", { name: "Vệ tinh" }).click();
  await expect(frame).toHaveAttribute("src", /&t=k&/);
  await insp(page).getByRole("slider", { name: "Mức phóng" }).fill("17");
  await expect(frame).toHaveAttribute("src", /&z=17&/);
  await insp(page).getByRole("slider", { name: "Chiều cao" }).fill("500");
  await expect.poll(async () => Math.round((await frame.boundingBox())!.height)).toBe(500);
  expect((await find(page, "map")).attrs).toMatchObject({ address: "1 Phạm Văn Đồng, Hà Nội", mapType: "satellite", zoom: 17, height: 500 });
  // Có trong bảng chèn, phần "Khung bản đồ" ở Kiểu dáng
  await insp(page).getByRole("tab", { name: "Kiểu dáng" }).click();
  await expect(insp(page).getByRole("button", { name: /^Khung bản đồ/ })).toBeVisible();
  await page.getByRole("button", { name: "Thêm khối" }).first().click();
  await expect(page.locator('.ecx-inserter-panel .ecx-block-tile[data-key="map"]').first()).toBeVisible();
});

test("thư viện ảnh: không cắt ảnh (ảnh ngang giữ tỉ lệ) thì ô thêm ảnh không phình thành ô vuông khổng lồ", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [{ id: "G", type: "gallery", attrs: { columns: 2, imageCrop: false, images: [{ src: "/sample.svg", alt: "a", width: 900, height: 60 }] } }], { focus: false }); s.select(["G"], { editing: null }); });
  await expect(c.locator("figure.ecx-gallery.is-natural")).toBeVisible();
  const add = c.locator(".ecx-gallery-add");
  await expect(add).toBeVisible();
  expect(Math.round((await add.boundingBox())!.height)).toBeLessThan(200);
  const img = (await c.locator(".ecx-gallery-item img").boundingBox())!;
  expect(img.width / img.height).toBeGreaterThan(1.5); // giữ tỉ lệ ngang, không bị ép thành ô vuông
});

test("khách hàng: section nền màu website 40% đặt trên nền ảnh cố định — nhìn xuyên được ảnh; độ đậm chỉnh ngay trong ô chọn màu", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [
    { id: "OUT", type: "group", attrs: { style: { background: { image: "/sample.svg", fixed: true }, padding: { base: "xl" } } }, content: [
      { id: "SEC", type: "group", attrs: { style: { padding: { base: "lg" } } }, content: [{ id: "p1", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Nội dung section" }] }] }] }], { focus: false }); s.select(["SEC"], { editing: null }); });
  const i = insp(page);
  await i.locator(".ecx-style-section", { hasText: "Nền" }).first().locator(".ecx-style-section-toggle[aria-expanded=false]").click({ timeout: 1500 }).catch(() => {});
  await i.locator(".ecx-color-row-btn").first().click(); // Nền ở tab Cài đặt của Nhóm
  const pop = page.locator(".ecx-color-pop");
  await pop.getByRole("button", { name: /primary/ }).first().click();
  await i.locator(".ecx-color-row-btn").first().click(); // chọn màu đóng bảng; mở lại để chỉnh độ đậm
  await pop.getByRole("slider", { name: /Độ đậm/ }).fill("40");
  const sec = (await page.evaluate(() => (window as any).__ecx.store.getState().docs.root.blocks.find((b: any) => b.id === "OUT").content[0].attrs.style));
  expect(sec.color.background).toBe("primary/40");
  // Màu tính ra có độ trong suốt 0.4 → ảnh nền của khối ngoài nhìn xuyên được
  const bg = await c.locator('[data-type="group"] [data-type="group"]').first().evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(bg).toMatch(/0\.4\)?$/);
  const outer = await c.locator('[data-type="group"]').first().evaluate((e) => ({ img: getComputedStyle(e).backgroundImage, att: getComputedStyle(e).backgroundAttachment }));
  expect(outer.img).toContain("sample.svg");
  expect(outer.att).toBe("fixed");
});

test("nhóm: độ rộng khối + độ rộng nội dung (hết khối / theo website / tự nhập số) ở tab Cài đặt; nền phủ hết, nội dung canh giữa theo số", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, 0, [
    { id: "G", type: "group", attrs: { style: { color: { background: "#e3edf3" } } }, content: [{ id: "p1", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Nội dung section" }] }] }], { focus: false }); s.select(["G"], { editing: null }); });
  const i = insp(page);
  await expect(i.getByText("Độ rộng", { exact: true }).first()).toBeVisible();
  const box = c.locator('[data-type="group"]').first();
  const para = c.locator('[data-type="group"] p').first();
  const w = async (l: any) => Math.round((await l.boundingBox())!.width);
  const full = await w(para);
  await i.getByRole("radiogroup", { name: "Độ rộng nội dung bên trong" }).getByRole("radio", { name: "Tự nhập" }).click();
  await i.getByRole("spinbutton", { name: "Độ rộng nội dung" }).first().fill("400");
  await expect.poll(async () => w(para)).toBeLessThanOrEqual(400);
  expect(await w(box)).toBeGreaterThan(400); // khối (nền) vẫn phủ rộng hơn nội dung
  const a = (await find(page, "group")).attrs;
  expect(a.contentWidth).toBe("400px");
  // Về "Hết khối": bỏ số
  await i.getByRole("radiogroup", { name: "Độ rộng nội dung bên trong" }).getByRole("radio", { name: "Hết khối" }).click();
  expect((await find(page, "group")).attrs.contentWidth).toBeUndefined();
  await expect.poll(async () => w(para)).toBe(full);
  // Độ rộng khối
  await i.getByRole("radiogroup", { name: "Độ rộng khối" }).getByRole("radio", { name: "Đầy màn" }).click();
  expect((await find(page, "group")).attrs.align).toBe("full");
});
