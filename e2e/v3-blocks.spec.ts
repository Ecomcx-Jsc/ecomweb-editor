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
  test("dòng cây khối: nút ⋮ mở menu khối; đổi tên, ẩn, cắt", async ({ page }) => {
    await open(page, "?doc=post");
    await page.getByRole("button", { name: "Cây khối" }).first().click();
    const tree = page.getByRole("tree", { name: "Cây khối" });
    const row = tree.locator(".ecx-list-row").nth(1);
    await row.hover();
    await row.getByRole("button", { name: "Tuỳ chọn" }).click();
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
    expect((await state(page)).docs.root.blocks.length).toBe(before - 1);
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
