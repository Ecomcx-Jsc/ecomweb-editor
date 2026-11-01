import { expect, test } from "@playwright/test";
import { canvas, clickEnd, imeType, mod, open, shape, state, texts } from "./helpers";

test.describe("gõ chữ", () => {
  test("gõ tiếng Việt có dấu vào đoạn văn, store cập nhật", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Đây là đoạn văn đầu tiên.");
    await page.keyboard.type(" Tiếng Việt có dấu: ắ ặ ồ ữ đ.");
    expect(await texts(page)).toContain("paragraph:Đây là đoạn văn đầu tiên. Tiếng Việt có dấu: ắ ặ ồ ữ đ.");
  });

  test("bộ gõ ghép chữ (IME/Telex) không mất dấu, không lặp chữ", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await page.keyboard.type(" ");
    await imeType(page, ["v", "vi", "vie", "viê", "việ", "việt"], "việt");
    await page.keyboard.type(" ");
    await imeType(page, ["n", "na", "nam"], "nam");
    expect(await texts(page)).toContain("paragraph:Nội dung bài viết. việt nam");
  });

  test("Enter giữa đoạn tách đôi, con trỏ sang đoạn mới và gõ tiếp vào đó", async ({ page }) => {
    const c = await open(page, "?doc=post");
    const el = c.locator("[data-ecx-rich]", { hasText: "Nội dung bài viết." });
    await el.click();
    await el.press("Home");
    for (let i = 0; i < 8; i++) await el.press("ArrowRight");
    await page.keyboard.press("Enter");
    await page.keyboard.type("XY");
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung", "paragraph:XY bài viết.", "paragraph:Đoạn thứ hai."]);
  });

  test("Enter cuối tiêu đề tạo đoạn văn; Backspace ở đoạn trống nối ngược về tiêu đề", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Tiêu đề bài");
    await page.keyboard.press("Enter");
    expect((await state(page)).docs.root.blocks[1].type).toBe("paragraph");
    await page.keyboard.press("Backspace");
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai."]);
    await page.keyboard.type("!");
    expect((await texts(page))[0]).toBe("heading:Tiêu đề bài!");
  });

  test("Backspace đầu đoạn nối vào đoạn trước, con trỏ ở chỗ nối", async ({ page }) => {
    const c = await open(page, "?doc=post");
    const el = c.locator("[data-ecx-rich]", { hasText: "Đoạn thứ hai." });
    await el.click();
    await el.press("Home");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("|");
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.|Đoạn thứ hai."]);
  });

  test("Delete cuối đoạn kéo đoạn sau lên", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Nội dung bài viết.");
    await page.keyboard.press("Delete");
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.Đoạn thứ hai."]);
  });

  test("phím mũi tên đi qua lại giữa các khối", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Tiêu đề bài");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Home");
    await page.keyboard.type(">");
    await page.keyboard.press("ArrowRight");
    expect((await texts(page))[1]).toBe("paragraph:>Nội dung bài viết.");
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("<");
    expect((await texts(page))[2]).toBe("paragraph:<Đoạn thứ hai.");
  });

  test("Shift+Enter xuống dòng trong cùng đoạn", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("dòng 2");
    expect((await texts(page))[2]).toBe("paragraph:Đoạn thứ hai.\ndòng 2");
    const st = await state(page);
    expect(st.docs.root.blocks[2].inline.some((n: { type: string }) => n.type === "hardBreak")).toBe(true);
  });

  test("hoàn tác / làm lại: gõ liên tục là một bước, Enter là bước riêng, con trỏ trở về", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.type(" abc");
    await page.keyboard.press("Enter");
    await page.keyboard.type("mới");
    await page.keyboard.press(`${mod}+z`);
    await page.keyboard.press(`${mod}+z`);
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai. abc"]);
    await page.keyboard.press(`${mod}+z`);
    expect((await texts(page))[2]).toBe("paragraph:Đoạn thứ hai.");
    await page.keyboard.press(`${mod}+Shift+z`);
    await page.keyboard.press(`${mod}+Shift+z`);
    expect(await texts(page)).toEqual(["heading:Tiêu đề bài", "paragraph:Nội dung bài viết.", "paragraph:Đoạn thứ hai. abc", "paragraph:"]);
  });
});

test.describe("gõ tắt", () => {
  const cases: Array<[string, string, unknown]> = [
    ["## ", "heading", ["heading"]],
    ["- ", "bulletList", [{ bulletList: [{ listItem: ["paragraph"] }] }]],
    ["1. ", "orderedList", [{ orderedList: [{ listItem: ["paragraph"] }] }]],
    ["> ", "blockquote", [{ blockquote: ["paragraph"] }]],
    ["[] ", "taskList", [{ taskList: [{ taskItem: ["paragraph"] }] }]],
  ];
  for (const [typed, name, expected] of cases) {
    test(`"${typed.trim()}" + dấu cách → ${name}`, async ({ page }) => {
      const c = await open(page, "?doc=post");
      await clickEnd(c, "Đoạn thứ hai.");
      await page.keyboard.press("Enter");
      await page.keyboard.type(typed);
      await page.keyboard.type("chữ");
      const sh = (await shape(page)) as unknown[];
      expect(sh.slice(3)).toEqual(expected);
      expect((await texts(page)).at(-1)).toMatch(/:chữ$/);
    });
  }

  test("``` → khối mã; Enter trong mã xuống dòng; hai dòng trống thoát ra", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("```");
    await page.keyboard.type("const a = 1;");
    await page.keyboard.press("Enter");
    await page.keyboard.type("a++;");
    expect((await texts(page)).at(-1)).toBe("codeBlock:const a = 1;\na++;");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("sau");
    expect((await texts(page)).slice(-2)).toEqual(["codeBlock:const a = 1;\na++;", "paragraph:sau"]);
  });

  test("--- + Enter → đường kẻ", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.press("Enter");
    await page.keyboard.type("---");
    await page.keyboard.press("Enter");
    expect(((await shape(page)) as unknown[]).slice(3)).toEqual(["horizontalRule", "paragraph"]);
  });

  test("**đậm** và *nghiêng* và `mã` khi gõ dấu đóng", async ({ page }) => {
    const c = await open(page, "?doc=post");
    await clickEnd(c, "Đoạn thứ hai.");
    await page.keyboard.type(" **đậm** *nghiêng* `mã`");
    const inline = (await state(page)).docs.root.blocks[2].inline;
    expect(inline).toEqual([
      { type: "text", text: "Đoạn thứ hai. " },
      { type: "text", text: "đậm", marks: [{ type: "bold" }] },
      { type: "text", text: " " },
      { type: "text", text: "nghiêng", marks: [{ type: "italic" }] },
      { type: "text", text: " " },
      { type: "text", text: "mã", marks: [{ type: "code" }] },
    ]);
  });
});

test.describe("danh sách", () => {
  test("Enter tạo mục, Tab lồng, Shift+Tab đưa ra, Enter ở mục trống thoát", async ({ page }) => {
    const c = await open(page);
    await clickEnd(c, "Mục hai");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Mục ba");
    await page.keyboard.press("Tab");
    let sh = (await shape(page)) as any[];
    expect(sh[3]).toEqual({ bulletList: [{ listItem: ["paragraph"] }, { listItem: ["paragraph", { bulletList: [{ listItem: ["paragraph"] }] }] }] });
    await page.keyboard.press("Shift+Tab");
    sh = (await shape(page)) as any[];
    expect(sh[3]).toEqual({ bulletList: [{ listItem: ["paragraph"] }, { listItem: ["paragraph"] }, { listItem: ["paragraph"] }] });
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("ra ngoài");
    sh = (await shape(page)) as any[];
    expect(sh[3]).toEqual({ bulletList: [{ listItem: ["paragraph"] }, { listItem: ["paragraph"] }, { listItem: ["paragraph"] }] });
    expect(sh[4]).toBe("paragraph");
    expect(await texts(page)).toContain("paragraph:ra ngoài");
  });

  test("Backspace đầu mục nối vào mục trước", async ({ page }) => {
    const c = await open(page);
    const el = c.locator("[data-ecx-rich]", { hasText: "Mục hai" });
    await el.click();
    await el.press("Home");
    await page.keyboard.press("Backspace");
    expect(await texts(page)).toContain("paragraph:Mục mộtMục hai");
  });
});
