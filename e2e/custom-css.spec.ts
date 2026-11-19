// CSS riêng của khối (tab Nâng cao): áp vào đúng khối, giữ sau khi lưu, phần nguy hiểm bị lọc và báo cho người soạn; không tác động khối khác.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("CSS riêng: viết với selector áp đúng khối, không đụng khối khác; phần nguy hiểm bị báo và không chạy", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => {
    const s = (window as any).__ecx.store;
    s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "ca", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Đoạn A" }] }, { id: "cb", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Đoạn B" }] }]);
    s.select(["ca"]);
  });
  await page.waitForTimeout(400);
  const insp = page.locator(".ecx-inspector");
  await insp.getByRole("tab", { name: "Nâng cao" }).click();
  const area = insp.getByLabel("CSS riêng của khối");
  if (!(await area.isVisible())) await insp.getByRole("button", { name: "CSS riêng của khối" }).click();
  await expect(area).toBeVisible();
  await area.fill("selector { letter-spacing: 3px; border-left: 6px solid #1a597b }\nbody { display: none }\nselector { width: expression(alert(1)) }");
  await area.blur();
  await page.waitForTimeout(400);
  await expect(insp.getByRole("alert")).toContainText("Đã bỏ phần không an toàn");
  const style = (id: string) => c.locator(`[data-ecx-block="${id}"]`).evaluate((e) => { const cs = getComputedStyle(e); return [cs.letterSpacing, cs.borderLeftWidth]; });
  expect(await style("ca")).toEqual(["3px", "6px"]);
  expect(await style("cb")).not.toEqual(["3px", "6px"]); // khối khác không bị ảnh hưởng
  expect(await c.locator("body").evaluate((b) => getComputedStyle(b).display)).not.toBe("none"); // quy tắc body bị bỏ
  const saved = await page.evaluate(() => JSON.stringify((window as any).__ecx.content()));
  expect(saved).toContain("letter-spacing: 3px"); // lưu nguyên văn người dùng viết (lọc ở lúc dựng CSS)
  // xoá hết → bỏ thuộc tính, hết cảnh báo
  await area.fill(""); await area.blur(); await page.waitForTimeout(300);
  expect(await style("ca")).not.toEqual(["3px", "6px"]);
  await expect(insp.getByRole("alert")).toHaveCount(0);
  await expect(c.locator(".ecx-block-error")).toHaveCount(0);
});

test("CSS riêng: hover và @media áp thật trên khung soạn", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => {
    const s = (window as any).__ecx.store;
    s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "cc", type: "paragraph", attrs: { style: { customCss: "selector { opacity: 1 } selector:hover { opacity: .5 } @media (max-width: 4000px) { selector { text-decoration: underline } }" } }, inline: [{ type: "text", text: "Đoạn C" }] }]);
  });
  await page.waitForTimeout(400);
  const el = c.locator('[data-ecx-block="cc"]');
  expect(await el.evaluate((e) => getComputedStyle(e).textDecorationLine)).toBe("underline");
  const box = await el.boundingBox();
  await page.mouse.move(box!.x + 20, box!.y + box!.height / 2);
  await expect.poll(() => el.evaluate((e) => getComputedStyle(e).opacity)).toBe("0.5");
});

test("lịch hiển thị: đặt hiện từ / đến ở tab Nâng cao lưu ISO UTC; trình soạn vẫn hiện khối; xoá thì bỏ thuộc tính", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "sc", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Khuyến mãi" }] }]); s.select(["sc"]); });
  await page.waitForTimeout(400);
  const insp = page.locator(".ecx-inspector");
  await insp.getByRole("tab", { name: "Nâng cao" }).click();
  if (!(await insp.getByLabel("Hiện từ").isVisible())) await insp.getByRole("button", { name: "Lịch hiển thị" }).click();
  await insp.getByLabel("Hiện từ").fill("2099-01-01T08:00");
  await insp.getByLabel("Hiện đến").fill("2099-02-01T08:00");
  const st = await page.evaluate(() => (window as any).__ecx.store.block("sc").attrs.style);
  expect(st.schedule.from).toBe(new Date("2099-01-01T08:00").toISOString());
  expect(st.schedule.until).toBe(new Date("2099-02-01T08:00").toISOString());
  await expect(c.locator('[data-ecx-block="sc"]')).toBeVisible(); // chưa tới lịch nhưng trình soạn vẫn hiện để sửa
  await insp.getByLabel("Hiện từ").fill(""); await insp.getByLabel("Hiện đến").fill("");
  expect(await page.evaluate(() => JSON.stringify((window as any).__ecx.store.block("sc").attrs.style ?? {}))).not.toContain("schedule");
});

test("nhóm người xem: chọn Chỉ khách / Chỉ thành viên ở tab Nâng cao lưu style.audience; Mọi người thì bỏ; trình soạn vẫn hiện khối", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "au", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Ưu đãi thành viên" }] }]); s.select(["au"]); });
  await page.waitForTimeout(400);
  const insp = page.locator(".ecx-inspector");
  await insp.getByRole("tab", { name: "Nâng cao" }).click();
  if (!(await insp.getByRole("radio", { name: "Chỉ thành viên đã đăng nhập" }).isVisible())) await insp.getByRole("button", { name: "Ai xem được" }).click();
  await insp.getByRole("radio", { name: "Chỉ thành viên đã đăng nhập" }).check();
  expect(await page.evaluate(() => (window as any).__ecx.store.block("au").attrs.style.audience)).toBe("user");
  await insp.getByRole("radio", { name: "Chỉ khách (chưa đăng nhập)" }).check();
  expect(await page.evaluate(() => (window as any).__ecx.store.block("au").attrs.style.audience)).toBe("guest");
  await expect(c.locator('[data-ecx-block="au"]')).toBeVisible();
  await insp.getByRole("radio", { name: "Mọi người" }).check();
  expect(await page.evaluate(() => JSON.stringify((window as any).__ecx.store.block("au").attrs.style ?? {}))).not.toContain("audience");
});

test("Xem thêm: ô Thu gọn còn cao ở Cài đặt Section; chữ nút chỉ hiện khi có chiều cao; khung soạn vẫn hiện đủ", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "sm", type: "group", attrs: {}, content: [{ id: "smp", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Bài dài" }] }] }]); });
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__ecx.store.select(["sm"]));
  const insp = page.locator(".ecx-inspector");
  await expect(insp.getByLabel("Chữ nút mở rộng")).toHaveCount(0);
  await insp.getByLabel("Thu gọn còn cao (Xem thêm)").fill("12rem");
  await expect(insp.getByLabel("Chữ nút mở rộng")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__ecx.store.block("sm").attrs.collapseHeight)).toBe("12rem");
  await expect(c.locator('[data-ecx-block="sm"] .ecx-sm-in')).toHaveCount(0);
});

test("Ảnh bìa: video nền hiện <video> tự phát tắt tiếng lặp, thay ảnh; địa chỉ lạ bị bỏ; ô nhập ở bảng phải", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "cv", type: "cover", attrs: { src: `${location.origin}/sample.svg`, minHeight: "300px" }, content: [{ id: "cvh", type: "heading", attrs: { level: 2 }, inline: [{ type: "text", text: "Hero" }] }] }]); s.select(["cv"]); });
  await page.waitForTimeout(700);
  await page.evaluate(() => (window as any).__ecx.store.select(["cv"])); // con trỏ có thể đã vào tiêu đề bên trong: chọn lại cả khối Ảnh bìa
  await page.waitForTimeout(300);
  const insp = page.locator(".ecx-inspector");
  await expect(c.locator("[data-ecx-block=cv] video")).toHaveCount(0);
  const field = insp.getByRole("textbox", { name: /Video nền/ });
  await field.fill("javascript:alert(1)"); await field.blur();
  await expect(c.locator("[data-ecx-block=cv] video")).toHaveCount(0);
  await field.fill("/clip.mp4"); await field.blur();
  const v = c.locator("[data-ecx-block=cv] video");
  await expect(v).toHaveCount(1);
  expect(await v.evaluate((e: HTMLVideoElement) => [e.muted, e.loop, e.autoplay, e.getAttribute("poster")?.endsWith("/sample.svg")])).toEqual([true, true, true, true]);
  await expect(c.locator("[data-ecx-block=cv] img.ecx-cover-img")).toHaveCount(0);
});

test("Nút: tooltip ở bảng phải thành title của nút trên khung soạn", async ({ page }) => {
  const c = await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "bt", type: "buttons", attrs: {}, content: [{ id: "b1", type: "button", attrs: { text: "Mua", variant: "primary" } }] }]); s.select(["b1"]); });
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as any).__ecx.store.select(["b1"]));
  await page.waitForTimeout(300);
  const f = page.locator(".ecx-inspector").getByRole("textbox", { name: /Chú thích khi rê chuột/ });
  await f.fill("Giao trong 24 giờ"); await f.blur();
  await expect(c.locator('[data-ecx-block="b1"], [data-ecx-block="b1"] a').first()).toHaveAttribute("title", "Giao trong 24 giờ");
});

test("Ô nhập: Chỉ hiện khi (điều kiện) và Bước (form nhiều bước) lưu vào thuộc tính", async ({ page }) => {
  await open(page, "?doc=post");
  await page.evaluate(() => { const s = (window as any).__ecx.store; s.insert("root", null, s.getState().docs.root.blocks.length, [{ id: "fm", type: "form", attrs: { formId: "f1" }, content: [{ id: "ff", type: "formField", attrs: { kind: "text", name: "ten", label: "Tên" } }] }]); });
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__ecx.store.select(["ff"]));
  const insp = page.locator(".ecx-inspector");
  await insp.getByLabel("Chỉ hiện khi").fill("chude=Khac");
  await insp.getByLabel("Bước (form nhiều bước)").fill("2");
  const at = await page.evaluate(() => (window as any).__ecx.store.block("ff").attrs);
  expect([at.showIf, at.step]).toEqual(["chude=Khac", 2]);
});
