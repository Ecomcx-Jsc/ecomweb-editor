import { expect, test, type Page } from "@playwright/test";
import { clickEnd, mod, open, state } from "./helpers";

/**
 * Vòng 2: thao tác trên từng khối của thư viện (nhân đôi, lên / xuống, gom nhóm, xoá, hoàn tác / làm lại hết, chuyển khổ màn hình).
 * Sau mỗi bước kiểm: không lỗi console / pageerror, `__ecx.check()` (cây hợp lệ, id duy nhất, chữ trên màn hình = dữ liệu), không tràn ngang canvas.
 * ECX_SWEEP_ONLY=a,b chỉ chạy các khối đó.
 */
test.use({ actionTimeout: 6000 });

async function tileKeys(page: Page): Promise<string[]> {
  await page.getByRole("button", { name: "Thêm khối" }).first().click();
  await page.locator(".ecx-block-tile").first().waitFor();
  return [...new Set(await page.locator(".ecx-block-tile[data-key]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key!)))];
}

test("thao tác trên mọi khối: nhân đôi, di chuyển, gom nhóm, xoá, hoàn tác / làm lại, đổi khổ — gom hết lỗi", async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  let current = "";
  page.on("pageerror", (e) => errors.push(`[${current}] pageerror: ${e.message.split("\n")[0]}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|net::ERR/.test(m.text())) errors.push(`[${current}] console.error: ${m.text().slice(0, 160)}`); });
  await open(page, "?doc=post");
  let keys = await tileKeys(page);
  if (process.env.ECX_SWEEP_ONLY) keys = keys.filter((k) => process.env.ECX_SWEEP_ONLY!.split(",").includes(k));
  const ids = async () => (await state(page)).docs.root.blocks.map((b: { id: string }) => b.id);
  for (const key of keys) {
    current = key;
    let step = "mở";
    try {
      const c = await open(page, "?doc=post");
      const verify = async (what: string) => {
        step = what;
        const bad: string[] = await page.evaluate(() => (window as any).__ecx.check());
        if (bad.length) errors.push(`[${key}] sau "${what}": ${bad.slice(0, 2).join(" | ")}`);
        const over = await c.locator("body").evaluate((b) => {
          const d = b.ownerDocument.scrollingElement!, W = d.clientWidth;
          const bad = [...b.ownerDocument.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().right > W + 1 && getComputedStyle(e).position !== "fixed").slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`);
          return { px: d.scrollWidth - d.clientWidth, bad };
        });
        if (over.px > 1) errors.push(`[${key}] sau "${what}": canvas tràn ngang ${over.px}px (${over.bad.join(", ")})`);
        if (await c.locator(".ecx-block-error").count()) errors.push(`[${key}] sau "${what}": có khối báo lỗi`);
      };
      await clickEnd(c, "Đoạn thứ hai.");
      const base = await ids();
      await page.getByRole("button", { name: "Thêm khối" }).first().click();
      const tile = page.locator(`.ecx-block-tile[data-key='${key}']`);
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
      await page.waitForTimeout(150);
      const added = (await ids()).filter((i: string) => !base.includes(i));
      if (!added.length) { errors.push(`[${key}] chèn xong nhưng không có khối mới trong cây`); continue; }
      // Chọn khối vừa chèn rồi đưa tiêu điểm vào khung soạn như người dùng bấm ra canvas (thanh chèn cố ý giữ tiêu điểm để chèn liên tiếp)
      await page.evaluate((id) => { const st = (window as any).__ecx.store; st.select([id]); (document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement).contentDocument!.querySelector<HTMLElement>(".ecx-canvas-root")!.focus(); }, added[0]);
      await page.waitForTimeout(80);
      await verify("chèn");
      const n0 = (await ids()).length;
      await page.keyboard.press(`${mod}+Shift+d`);
      await page.waitForTimeout(100);
      if ((await ids()).length !== n0 + 1) errors.push(`[${key}] ⌘⇧D không nhân đôi khối (${n0} → ${(await ids()).length})`);
      await verify("nhân đôi");
      await page.keyboard.press("Alt+Shift+ArrowUp");
      await verify("lên");
      await page.keyboard.press("Alt+Shift+ArrowDown");
      await verify("xuống");
      await page.keyboard.press("Delete");
      await page.waitForTimeout(100);
      await verify("xoá");
      for (let i = 0; i < 6; i++) await page.keyboard.press(`${mod}+z`);
      await page.waitForTimeout(100);
      await verify("hoàn tác nhiều lần");
      if (JSON.stringify(await ids()) !== JSON.stringify(base)) errors.push(`[${key}] hoàn tác hết không về đúng trạng thái đầu`);
      for (let i = 0; i < 6; i++) await page.keyboard.press(`${mod}+Shift+z`);
      await page.waitForTimeout(100);
      await verify("làm lại nhiều lần");
      for (const dev of ["Máy tính bảng", "Điện thoại"]) {
        await page.getByRole("button", { name: dev, exact: true }).first().click();
        await page.waitForTimeout(150);
        await verify(`khổ ${dev}`);
      }
    } catch (e) {
      errors.push(`[${key}] ngoại lệ ở bước "${step}": ${(e as Error).message.split("\n")[0].slice(0, 140)}`);
    }
  }
  expect(errors, "\n" + errors.join("\n")).toEqual([]);
});
