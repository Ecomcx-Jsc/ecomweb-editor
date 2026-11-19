import { expect, test, type Page } from "@playwright/test";
import { mod, open } from "./helpers";

/**
 * Phối khối: đặt MỌI loại khối vào MỌI loại khung chứa (cột, tab, accordion, slide, nhóm, ảnh + chữ, ảnh bìa, hộp lưu ý, chi tiết, trích dẫn…) bằng bảng chèn thật,
 * rồi gom mọi bất thường: lỗi console / pageerror, khối báo lỗi, tràn ngang khung soạn, khối không nằm trong khung chứa, hoàn tác không gỡ sạch.
 * ECX_COMPOSE_ONLY=cot,tab chỉ chạy các khung đó; ECX_COMPOSE_KEYS=iconBox,form chỉ chạy các khối con đó.
 */
type B = Record<string, unknown>;
let n = 0;
const id = () => `C${++n}`;
const slot = (): B => ({ id: "slot", type: "paragraph", attrs: {}, inline: [{ type: "text", text: "Đoạn trong khung" }] });
const p = (t: string): B => ({ id: id(), type: "paragraph", attrs: {}, inline: [{ type: "text", text: t }] });
const wrap = (type: string, attrs: B, content: B[]): B => ({ id: id(), type, attrs, content });

const CONTAINERS: Record<string, () => { root: B[]; type: string }> = {
  nhom: () => ({ type: "group", root: [wrap("group", { padding: "medium" }, [slot()])] }),
  nhom_full_nen: () => ({ type: "group", root: [wrap("group", { align: "full", padding: "large", style: { color: { background: "primary/15" } } }, [slot()])] }),
  cot_giua: () => ({ type: "column", root: [wrap("columns", {}, [wrap("column", {}, [p("Cột 1")]), wrap("column", {}, [slot()]), wrap("column", {}, [p("Cột 3")])])] }),
  cot_hep: () => ({ type: "column", root: [wrap("columns", {}, [wrap("column", { width: 20 }, [slot()]), wrap("column", { width: 80 }, [p("Rộng")])])] }),
  tab: () => ({ type: "tab", root: [wrap("tabs", {}, [wrap("tab", { title: "Một" }, [slot()]), wrap("tab", { title: "Hai" }, [p("Nội dung 2")])])] }),
  accordion: () => ({ type: "details", root: [wrap("accordion", {}, [wrap("details", { summary: "Câu hỏi", open: true }, [slot()]), wrap("details", { summary: "Câu 2" }, [p("Trả lời")])])] }),
  carousel: () => ({ type: "carousel", root: [wrap("carousel", { slidesPerView: 2 }, [wrap("group", {}, [slot()]), wrap("group", {}, [p("Slide 2")]), wrap("group", {}, [p("Slide 3")])])] }),
  anh_chu: () => ({ type: "mediaText", root: [wrap("mediaText", { position: "left" }, [slot()])] }),
  anh_bia: () => ({ type: "cover", root: [wrap("cover", { overlay: "primary", opacity: 50, minHeight: "280px", align: "full" }, [slot()])] }),
  hop_luu_y: () => ({ type: "callout", root: [wrap("callout", { tone: "info" }, [slot()])] }),
  chi_tiet: () => ({ type: "details", root: [wrap("details", { summary: "Chi tiết", open: true }, [slot()])] }),
  trich_dan: () => ({ type: "blockquote", root: [wrap("blockquote", {}, [slot()])] }),
  luoi: () => ({ type: "group", root: [wrap("group", { style: { layout: { type: "grid", columns: { base: 3, tablet: 2, mobile: 1 } } } }, [slot(), p("b"), p("c")])] }),
  hang_ngang: () => ({ type: "group", root: [wrap("group", { style: { layout: { type: "flex", direction: { base: "row" } } } }, [slot(), p("b")])] }),
};

const CHILD_KEYS = ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "pullquote", "codeBlock", "preformatted", "image", "gallery", "cover", "mediaText", "group", "horizontalRule", "spacer", "details", "table", "buttons", "columns/50-50", "accordion", "tabs", "countdown", "counter", "iconList", "iconBox", "testimonial", "progressBar", "map", "form", "tableOfContents", "socialLinks", "video", "customHtml", "callout", "carousel", "file"];
const TYPE_OF: Record<string, string> = { "columns/50-50": "columns", tableOfContents: "tableOfContents" };

test.use({ actionTimeout: 6000 });

async function resetTo(page: Page, root: B[]) {
  await page.evaluate((blocks) => {
    const st = (window as any).__ecx.store;
    const ids = st.getState().docs.root.blocks.map((b: { id: string }) => b.id);
    if (ids.length) st.remove(ids, { focusNeighbor: false });
    st.insert("root", null, 0, blocks);
  }, root);
}
const findType = (page: Page, t: string) => page.evaluate((type) => {
  const hits: string[][] = [];
  const w = (l: any[], chain: string[]) => l.forEach((b) => { if (b.type === type) hits.push(chain); if (b.content) w(b.content, [...chain, b.type]); });
  w((window as any).__ecx.store.getState().docs.root.blocks, []);
  return hits;
}, t);
const count = (page: Page) => page.evaluate(() => { let c = 0; const w = (l: any[]) => l.forEach((b) => { c++; b.content && w(b.content); }); w((window as any).__ecx.store.getState().docs.root.blocks); return c; });

test("phối khối: mọi khối vào mọi khung chứa — không lỗi, không tràn, hoàn tác sạch", async ({ page }) => {
  test.setTimeout(1_500_000);
  const problems: string[] = [];
  let cur = "";
  page.on("pageerror", (e) => problems.push(`[${cur}] pageerror: ${e.message.split("\n")[0].slice(0, 120)}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|net::ERR|React keys must be passed/.test(m.text())) problems.push(`[${cur}] console.error: ${m.text().slice(0, 140)}`); });
  const c = await open(page, "?doc=empty");
  const only = process.env.ECX_COMPOSE_ONLY?.split(","), onlyKeys = process.env.ECX_COMPOSE_KEYS?.split(",");
  for (const [cname, make] of Object.entries(CONTAINERS)) {
    if (only && !only.includes(cname)) continue;
    for (const key of CHILD_KEYS) {
      if (onlyKeys && !onlyKeys.includes(key)) continue;
      cur = `${cname} ← ${key}`;
      const { root, type: ctype } = make();
      try {
        await resetTo(page, root);
        await page.waitForTimeout(60);
        await page.evaluate(() => (window as any).__ecx.store.select(["slot"]));
        const before = await count(page);
        await page.getByRole("button", { name: /Thêm khối/ }).first().click();
        const tile = page.locator(`.ecx-block-tile[data-key='${key}']`).first();
        if (!(await tile.count())) { await page.keyboard.press("Escape"); continue; } // khung này không nhận khối đó (đúng luật)
        await tile.scrollIntoViewIfNeeded();
        await tile.click();
        await page.waitForTimeout(120);
        const skip = c.locator(".ecx-variation-skip");
        if (await skip.count()) await skip.click();
        await page.waitForTimeout(80);
        const type = TYPE_OF[key] ?? key;
        const chains = await findType(page, type);
        const inside = chains.some((ch) => ch.includes(ctype));
        if (!chains.length) problems.push(`[${cur}] khối không xuất hiện`);
        else if (!inside && ctype !== type) problems.push(`[${cur}] khối không nằm trong khung chứa (${JSON.stringify(chains)})`);
        if (await c.locator(".ecx-block-error").count()) problems.push(`[${cur}] khối báo lỗi (.ecx-block-error)`);
        const over = await page.evaluate(() => { const f = document.querySelector("iframe[data-ecx-canvas]") as HTMLIFrameElement; const d = f.contentDocument!; return d.documentElement.scrollWidth - d.documentElement.clientWidth; });
        if (over > 1) problems.push(`[${cur}] khung soạn tràn ngang ${over}px`);
        // đổi chữ trong khối vừa chèn không làm hỏng khung (gõ tiếp ngay sau khi chèn)
        await page.keyboard.type("x");
        // hoàn tác: tối đa 4 lần (chèn khối + chữ vừa gõ) phải về đúng số khối ban đầu
        let after = await count(page);
        for (let k = 0; k < 4 && after > before; k++) { await page.keyboard.press(`${mod}+z`); await page.waitForTimeout(50); after = await count(page); }
        if (after > before) problems.push(`[${cur}] hoàn tác 4 lần vẫn không gỡ sạch (${before} → ${after})`);
      } catch (e) {
        problems.push(`[${cur}] ngoại lệ: ${(e as Error).message.split("\n")[0].slice(0, 120)}`);
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
  }
  const uniq = [...new Set(problems)];
  console.log(`COMPOSE ${uniq.length} bất thường`);
  expect(uniq, "\n" + uniq.join("\n")).toEqual([]);
});
