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
  test("chèn mẫu theo danh mục; kiểu màu tối bọc mẫu trong nhóm nền tối; trang = nhiều mẫu", async ({ page }) => {
    await open(page, "?doc=post");
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
    await page.getByRole("button", { name: "Thư viện mẫu" }).click();
    await lib.getByRole("tab", { name: "Trang" }).click();
    await lib.locator(".ecx-lib-card[data-page=contact]").click();
    expect((await state(page)).docs.root.blocks.length).toBeGreaterThan(before + 3);
  });

  test("Tạo bằng AI: viết lại chữ của mẫu đang xem, giữ bố cục", async ({ page }) => {
    await open(page, "?doc=post&ai=1");
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
