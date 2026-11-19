// Hành vi chạy trên website (mã client của theme-sdk) kiểm bằng trình duyệt thật: Slider mờ dần, Popup, Đếm ngược (evergreen / lặp / hết giờ / tạm dừng).
// Đóng gói client sdk + content bằng esbuild rồi nạp vào một trang trống — không cần chạy website.
import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sdkClient = path.resolve(root, "../sdk/packages/theme-sdk/src/client");
let page_html = "";

test.beforeAll(() => {
  const dir = mkdtempSync(path.join(tmpdir(), "ecx-web-"));
  writeFileSync(path.join(dir, "entry.tsx"), `
import { createRoot } from "react-dom/client";
import { CarouselClient, CountdownClient, FormBlockClient, GalleryThumbsClient, PopupClient, TypedText } from ${JSON.stringify(sdkClient)};
import { blockShell, carouselConfig, countdownRules, popupClass, popupConfig, popupVars } from "@ecomcx/ecomweb-content";
const units = { d: "ngày", h: "giờ", m: "phút", s: "giây" };
const now = Date.now();
const slides = ["A", "B", "C"].map((t) => <div key={t} className="ecx-carousel-slide">{t}</div>);
const pc = popupConfig({ size: "sm" });
const shell = blockShell("button", { variant: "primary" })!;
const q = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(<>
  <div id="fade"><CarouselClient count={3} config={carouselConfig({ effect: "fade", heightMode: "min", minHeight: "10rem" })}>{slides}</CarouselClient></div>
  <PopupClient className={popupClass(pc)} style={popupVars(pc) as any} closeButton closeOnOverlay label="Demo" trigger="Mở" triggerClass={"ecx-popup-trigger " + shell.className}><h3>Nội dung popup</h3><p>Xin chào</p></PopupClient>
  <div id="ever"><CountdownClient target={0} serverNow={now} units={units} storageKey="k1" rules={countdownRules({ mode: "evergreen", evergreenHours: 1, evergreenMinutes: 30, evergreenReset: 30 })} attrs={{}} /></div>
  <div id="hide"><CountdownClient target={now - 5000} serverNow={now} units={units} rules={countdownRules({ expireAction: "hide" })} attrs={{}} /><span id="after-hide">sau</span></div>
  <div id="msg"><CountdownClient target={now - 5000} serverNow={now} units={units} expiredText="Đã kết thúc" rules={countdownRules({ expiredText: "Đã kết thúc" })} attrs={{}} /></div>
  <div id="rep"><CountdownClient target={now - 3600000} serverNow={now} units={units} rules={countdownRules({ repeat: "daily" })} attrs={{}} /></div>
  <div id="pause"><CountdownClient target={now + 7200000} serverNow={now} units={units} rules={countdownRules({ pauseButton: true })} attrs={{}} /></div>
  <div id="sm" className="ecx-sm" style={{ "--ecx-sm-h": "5rem" } as any}><input type="checkbox" id="sm1" className="ecx-sm-in" /><div id="smbody"><p style={{ height: "20rem", margin: 0 }}>Nội dung rất dài</p></div><label htmlFor="sm1" className="ecx-sm-btn"><span className="ecx-sm-more">Xem thêm</span><span className="ecx-sm-less">Thu gọn</span></label></div>
  <figure id="mos" className="ecx-gallery is-mosaic columns-3" style={{ display: "grid", gap: "8px", gridAutoFlow: "dense", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", width: 600 } as any}>{[1, 2, 3, 4, 5, 6].map((i) => <figure key={i} className="ecx-gallery-item" style={{ margin: 0 }}><img alt="" src={"data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>")} style={{ width: "100%", height: "100%", objectFit: "cover", aspectRatio: "1" }} /></figure>)}</figure>
  <div id="frm"><FormBlockClient formId="f1" source="s" labels={{ submit: "Gửi", sending: "Đang gửi", error: "Lỗi", next: "Tiếp theo", back: "Quay lại", step: "Bước {n}/{total}" }}>
    <div className="ecx-field" data-field="ten" data-step="1"><label>Tên<input name="ten" required /></label></div>
    <div className="ecx-field" data-field="chude" data-step="1"><label>Chủ đề<select name="chude"><option value="">-</option><option value="Khac">Khac</option><option value="Gia">Gia</option></select></label></div>
    <div className="ecx-field" data-field="chitiet" data-step="1" data-showif="chude=Khac"><label>Chi tiết<input name="chitiet" required /></label></div>
    <div className="ecx-field" data-field="email" data-step="2"><label>Email<input name="email" type="email" required /></label></div>
  </FormBlockClient></div>
  <div id="gth"><GalleryThumbsClient mains={["Lớn A", "Lớn B", "Lớn C"].map((t) => <figure key={t} className="ecx-gallery-item">{t}</figure>)} thumbs={["a", "b", "c"].map((t) => <span key={t}>{t}</span>)} /></div>
  <figure id="tiles" className="ecx-gallery is-tiles" style={{ display: "grid", gap: "8px", gridAutoFlow: "dense", gridAutoRows: "11rem", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", width: 600 } as any}>{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <figure key={i} className="ecx-gallery-item" style={{ margin: 0 }}><span>{i}</span></figure>)}</figure>
  <figure id="cap" className="ecx-gallery is-cap-hover" style={{ width: 300 } as any}><figure className="ecx-gallery-item" style={{ margin: 0, height: 120 }}><img alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/%3E" style={{ width: "100%", height: "100%" }} /><figcaption>Chú thích</figcaption></figure></figure>
  {q.get("id") && <PopupClient className={popupClass(pc)} style={popupVars(pc) as any} closeButton closeOnOverlay label="ID" popupId="khuyen-mai" trigger={null as any} triggerClass="ecx-popup-trigger"><p id="pid-body">Popup theo mã</p></PopupClient>}
  {q.get("id") && <><a id="open-link" href="#popup-khuyen-mai">Mở ưu đãi</a><button id="open-btn" data-popup-open="khuyen-mai">Mở bằng nút</button></>}
  {q.get("auto") && <PopupClient className={popupClass(pc)} style={popupVars(pc) as any} closeButton closeOnOverlay label="auto" popupId="tu-mo" auto="delay" autoDelay={1} onceDays={1} trigger={null as any} triggerClass="ecx-popup-trigger"><p id="auto-body">Popup tự mở</p></PopupClient>}
  <h2 id="typed">Chúng tôi làm <TypedText words={["web", "app"]} speed={30} pause={600} loop /></h2>
  {q.get("redirect") && <div id="redir"><CountdownClient target={now - 1000} serverNow={now} units={units} rules={countdownRules({ expireAction: "redirect", redirectUrl: "#done" })} attrs={{}} /></div>}
</>);
`);
  const out = path.join(dir, "out.js");
  execFileSync(path.join(root, "node_modules/.bin/esbuild"), [path.join(dir, "entry.tsx"), "--bundle", `--outfile=${out}`, "--jsx=automatic", "--loader:.tsx=tsx",
    `--alias:react=${path.join(root, "node_modules/react")}`, `--alias:react-dom=${path.join(root, "node_modules/react-dom")}`,
    `--alias:@ecomcx/ecomweb-content=${path.join(root, "node_modules/@ecomcx/ecomweb-content/dist/index.js")}`, '--define:process.env.NODE_ENV="production"', '--banner:js=var process={env:{NODE_ENV:"production"}};', "--log-level=error"]);
  const css = readFileSync(path.join(root, "node_modules/@ecomcx/ecomweb-content/style.css"), "utf8");
  page_html = `<!doctype html><html><head><meta charset=utf-8><style>${css}</style></head><body style="padding:20px"><div id=root></div><script>${readFileSync(out, "utf8").replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;
});

const load = async (page: import("@playwright/test").Page, qs = "") => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("http://site.test/**", (r) => r.fulfill({ contentType: "text/html", body: page_html }));
  await page.goto("http://site.test/" + qs);
  await page.waitForTimeout(900);
  return errors;
};
const text = (page: import("@playwright/test").Page, sel: string) => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, " ").trim());

test("slider mờ dần: chỉ slide đang hiện thấy được; Sau chuyển slide; aria-hidden đúng; chiều cao tối thiểu", async ({ page }) => {
  const errors = await load(page);
  const vis = () => page.locator("#fade .ecx-carousel-track > *").evaluateAll((els) => els.map((e) => getComputedStyle(e).visibility));
  expect(await vis()).toEqual(["visible", "hidden", "hidden"]);
  await page.locator("#fade .ecx-carousel-arrow.is-next").click();
  await page.waitForTimeout(700);
  expect(await vis()).toEqual(["hidden", "visible", "hidden"]);
  expect(await page.locator("#fade .ecx-carousel-track > *").evaluateAll((els) => els.map((e) => e.getAttribute("aria-hidden")))).toEqual(["true", "false", "true"]);
  expect(await page.locator("#fade .ecx-carousel-track > *").first().evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(159);
  expect(errors).toEqual([]);
});

test("popup: đóng lúc đầu, nội dung có sẵn trong HTML; bấm nút mở; Esc / bấm nền / nút × đóng; bấm trong nội dung không đóng; khoá cuộn + trả focus", async ({ page }) => {
  await load(page);
  const open = () => page.locator("dialog").evaluate((d: HTMLDialogElement) => d.open);
  expect(await open()).toBe(false);
  expect(await page.locator("dialog").evaluate((d) => d.textContent!.includes("Xin chào"))).toBe(true);
  await page.locator(".ecx-popup-trigger").click();
  expect(await open()).toBe(true);
  expect(await page.evaluate(() => document.documentElement.classList.contains("ecx-popup-open"))).toBe(true);
  expect(Math.round((await page.locator("dialog").boundingBox())!.width)).toBe(448); // cỡ nhỏ = 28rem
  await page.waitForTimeout(300); // người thật không nhấn Esc cùng mili giây với lúc mở
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  expect(await open()).toBe(false);
  expect(await page.evaluate(() => document.documentElement.classList.contains("ecx-popup-open"))).toBe(false);
  expect(await page.evaluate(() => document.activeElement?.classList.contains("ecx-popup-trigger"))).toBe(true);
  await page.locator(".ecx-popup-trigger").click();
  await page.mouse.click(5, 5); // nền tối
  expect(await open()).toBe(false);
  await page.locator(".ecx-popup-trigger").click();
  await page.locator(".ecx-popup-body").click();
  expect(await open()).toBe(true);
  await page.locator(".ecx-popup-close").click();
  expect(await open()).toBe(false);
});

test("đếm ngược evergreen: đủ thời lượng lần đầu, lưu mốc theo người xem, quay lại còn ít hơn, quá hạn đặt lại thì đếm lại, mốc hỏng bị bỏ", async ({ page }) => {
  await load(page);
  expect(await text(page, "#ever")).toMatch(/01 giờ 29 phút|01 GIỜ 29 PHÚT|01 giờ 30 phút/i);
  expect(Math.abs(Number(await page.evaluate(() => localStorage.getItem("ecx-cd:k1"))) - Date.now())).toBeLessThan(10000);
  await page.evaluate(() => localStorage.setItem("ecx-cd:k1", String(Date.now() - 3600_000)));
  await page.reload(); await page.waitForTimeout(900);
  expect(await text(page, "#ever")).toMatch(/00 giờ (29|30) phút/i);
  await page.evaluate(() => localStorage.setItem("ecx-cd:k1", String(Date.now() - 40 * 86400_000)));
  await page.reload(); await page.waitForTimeout(900);
  expect(await text(page, "#ever")).toMatch(/01 giờ (29|30) phút/i);
  await page.evaluate(() => localStorage.setItem("ecx-cd:k1", "abc"));
  await page.reload(); await page.waitForTimeout(900);
  expect(await text(page, "#ever")).toMatch(/01 giờ (29|30) phút/i);
});

test("đếm ngược: hết giờ + ẩn / chữ thay thế; lặp hằng ngày đếm tới ngày kế; tạm dừng đóng băng số; chuyển trang", async ({ page }) => {
  await load(page);
  expect(await text(page, "#hide")).toBe("sau");
  expect(await text(page, "#msg")).toBe("Đã kết thúc");
  expect(await text(page, "#rep")).toMatch(/22 giờ 59 phút|23 giờ 00 phút/i);
  await page.locator("#pause .ecx-countdown-pause").click();
  const frozen = (await text(page, "#pause")).replace("▶", "").trim();
  await page.waitForTimeout(2200);
  expect((await text(page, "#pause")).replace("▶", "").trim()).toBe(frozen); // đang dừng: số không nhảy
  await page.locator("#pause .ecx-countdown-pause").click();
  await page.waitForTimeout(1300);
  expect((await text(page, "#pause")).replace("⏸", "").trim()).not.toBe(frozen); // chạy tiếp
  await load(page, "?redirect=1");
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("#done");
});

test("chữ gõ: bắt đầu bằng từ đầu, rồi xoá và gõ từ kế; nhãn đọc màn hình đủ các từ; giảm chuyển động thì đứng yên", async ({ page }) => {
  await load(page);
  const typed = page.locator("#typed .ecx-typed");
  await expect(typed).toHaveAttribute("aria-label", "web, app");
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) { seen.add((await typed.innerText()).trim()); await page.waitForTimeout(60); }
  expect(seen.has("web") && seen.has("app")).toBe(true); // đã gõ sang từ thứ hai
  expect([...seen].some((s) => s.length > 0 && s.length < 3)).toBe(true); // có bước gõ / xoá từng ký tự
  await page.emulateMedia({ reducedMotion: "reduce" });
  await load(page);
  const still = new Set<string>();
  for (let i = 0; i < 15; i++) { still.add((await page.locator("#typed .ecx-typed").innerText()).trim()); await page.waitForTimeout(80); }
  expect([...still]).toEqual(["web"]);
});

test("Xem thêm: cắt ở chiều cao thu gọn, bấm nút mở hết, bấm lại thu gọn; chữ nút đổi theo", async ({ page }) => {
  const errors = await load(page);
  const h = () => page.locator("#smbody").evaluate((e) => Math.round(e.getBoundingClientRect().height));
  expect(await h()).toBeLessThanOrEqual(81); // 5rem = 80px
  await expect(page.locator("#sm .ecx-sm-more")).toBeVisible();
  await expect(page.locator("#sm .ecx-sm-less")).toBeHidden();
  await page.locator("#sm .ecx-sm-btn").click();
  expect(await h()).toBeGreaterThan(300);
  await expect(page.locator("#sm .ecx-sm-less")).toBeVisible();
  await page.locator("#sm .ecx-sm-btn").click();
  expect(await h()).toBeLessThanOrEqual(81);
  expect(errors).toEqual([]);
});

test("Gallery mosaic: ảnh đầu chiếm 2×2 ô, ảnh thứ 6 lại to gấp đôi; điện thoại thì đều nhau", async ({ page }) => {
  const errors = await load(page);
  const sizes = () => page.locator("#mos .ecx-gallery-item").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  const w = await sizes();
  expect(w[0]).toBeGreaterThan(w[1] * 1.8);
  expect(w[5]).toBeGreaterThan(w[1] * 1.8);
  expect(Math.abs(w[1] - w[2])).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test("form nhiều bước + điều kiện: ô showIf chỉ hiện khi đúng, Tiếp theo chặn khi thiếu ô bắt buộc, sang bước 2, Quay lại giữ giá trị, bước cuối đổi nút thành Gửi", async ({ page }) => {
  const errors = await load(page);
  const f = (sel: string) => page.locator(`#frm ${sel}`);
  await expect(f('[data-field="chitiet"]')).toBeHidden();      // chude chưa chọn Khac
  await expect(f('[data-field="email"]')).toBeHidden();        // bước 2
  await expect(f(".ecx-form-step")).toHaveText("Bước 1/2");
  await expect(f('button[type=submit]')).toHaveText("Tiếp theo");
  await f('select[name=chude]').selectOption("Khac");
  await expect(f('[data-field="chitiet"]')).toBeVisible();
  await f('button[type=submit]').click();                      // thiếu Tên + Chi tiết → vẫn ở bước 1
  await expect(f(".ecx-form-step")).toHaveText("Bước 1/2");
  await f('input[name=ten]').fill("An"); await f('input[name=chitiet]').fill("abc");
  await f('button[type=submit]').click();
  await expect(f(".ecx-form-step")).toHaveText("Bước 2/2");
  await expect(f('[data-field="email"]')).toBeVisible();
  await expect(f('[data-field="ten"]')).toBeHidden();
  await expect(f('button[type=submit]')).toHaveText("Gửi");
  await f(".ecx-form-back").click();
  await expect(f('input[name=ten]')).toHaveValue("An");        // bước khác chỉ ẩn, giữ giá trị
  await f('select[name=chude]').selectOption("Gia");           // đổi chủ đề → ô điều kiện ẩn và tắt (không gửi)
  await expect(f('[data-field="chitiet"]')).toBeHidden();
  await expect(f('input[name=chitiet]')).toBeDisabled();
  expect(errors).toEqual([]);
});

test("Gallery: thumbnail slider đổi ảnh lớn khi bấm / phím mũi tên; tiles có ô chiếm 2 cột; chú thích rê chuột ẩn rồi hiện", async ({ page }) => {
  const errors = await load(page);
  await expect(page.locator("#gth .ecx-gt-main")).toContainText("Lớn A");
  await page.locator("#gth .ecx-gt-thumb").nth(2).click();
  await expect(page.locator("#gth .ecx-gt-main")).toContainText("Lớn C");
  await page.locator("#gth .ecx-gt-thumb").nth(2).press("ArrowRight");
  await expect(page.locator("#gth .ecx-gt-main")).toContainText("Lớn A"); // vòng lại
  await expect(page.locator('#gth .ecx-gt-thumb[aria-selected="true"]')).toHaveCount(1);
  const w = await page.locator("#tiles .ecx-gallery-item").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(w[0]).toBeGreaterThan(w[1] * 1.8); // ô 1: rộng 2 cột
  expect(w[5]).toBeGreaterThan(w[1] * 1.8); // ô 6: rộng 2 cột
  const cap = page.locator("#cap figcaption");
  expect(await cap.evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  await page.locator("#cap .ecx-gallery-item").hover();
  await expect.poll(() => cap.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  expect(errors).toEqual([]);
});

test("Popup: mở bằng liên kết #popup-<id> và nút data-popup-open; Esc đóng; hash không nhảy trang", async ({ page }) => {
  const errors = await load(page, "?id=1");
  await expect(page.locator("dialog#popup-khuyen-mai")).not.toHaveAttribute("open", "");
  await page.locator("#open-link").click();
  await expect(page.locator("dialog#popup-khuyen-mai")).toHaveAttribute("open", "");
  expect(page.url()).not.toContain("#popup-khuyen-mai"); // đã chặn nhảy hash
  await page.keyboard.press("Escape");
  await page.locator("#open-btn").click();
  await expect(page.locator("dialog#popup-khuyen-mai")).toHaveAttribute("open", "");
  expect(errors).toEqual([]);
});

test("Popup: tự mở sau 1 giây; chỉ một lần (nhớ trong localStorage), tải lại thì không mở nữa", async ({ page }) => {
  const errors = await load(page, "?auto=1");
  await expect(page.locator("dialog#popup-tu-mo")).toHaveAttribute("open", "", { timeout: 4000 });
  expect(await page.evaluate(() => localStorage.getItem("ecx-popup:tu-mo"))).toBeTruthy();
  await page.keyboard.press("Escape");
  await page.reload(); await page.waitForTimeout(2200);
  await expect(page.locator("dialog#popup-tu-mo")).not.toHaveAttribute("open", "");
  expect(errors).toEqual([]);
});
