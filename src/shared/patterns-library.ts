import { msgs } from "../i18n";
import type { Pattern } from "./patterns";
import { btn, buttons, h, p, text } from "./patterns-kit";

/**
 * Thư viện mẫu section của lõi (ngoài 8 mẫu cơ bản trong patterns.ts): hero, tính năng, số liệu, quy trình, bảng giá, cảm nhận,
 * hỏi đáp, kêu gọi, đội ngũ, đối tác, liên hệ, nội dung, chân trang. Chỉ dùng khối và kiểu dáng của @ecomcx/ecomweb-content nên
 * mọi theme hiển thị được; người soạn chèn một cú bấm rồi chỉ sửa chữ. Hiệu ứng chuyển động (1.16) có sẵn ở các mẫu hợp lý.
 */
type L = Record<string, string>;

// ---------------------------------------------------------------------------
// Khối dựng sẵn dùng lại
// ---------------------------------------------------------------------------
type Node = Record<string, unknown>;
const GRADIENT = "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)";
const WHITE_BTN = (s: string) => ({ type: "button", attrs: { text: s, href: "#", variant: "primary", style: { color: { background: "#ffffff", text: "#1e3a8a" } } } });
const GHOST_BTN = (s: string) => ({ type: "button", attrs: { text: s, href: "#", variant: "outline", style: { color: { text: "#ffffff" }, border: { color: "#ffffff" } } } });
const center = { textAlign: { base: "center" } };
const section = (content: Node[], style: Record<string, unknown> = {}): Node => ({ type: "group", attrs: { style: { padding: { base: "2xl", mobile: "xl" }, ...style } }, content });
const grid = (cols: number, content: Node[], style: Record<string, unknown> = {}): Node => ({ type: "group", attrs: { style: { layout: { type: "grid", columns: { base: cols, tablet: Math.min(cols, 2), mobile: 1 } }, gap: "lg", ...style } }, content });
const card = (content: Node[], style: Record<string, unknown> = {}): Node => ({ type: "group", attrs: { blockStyle: "card", style: { motion: { hover: "lift" }, ...style } }, content });
const eyebrow = (s: string, c = false): Node => p(s, { style: { textTransform: "uppercase", letterSpacing: "0.1em", fontSize: { base: "sm" }, fontWeight: "700", color: { text: "primary" }, ...(c ? center : {}) } });
const muted = (s: string, extra: Record<string, unknown> = {}): Node => p(s, { style: { color: { text: "muted" }, ...extra } });
const big = (s: string): Node => ({ type: "heading", attrs: { level: 2, style: { fontSize: { base: "3xl" }, ...center } }, content: [text(s)] });
const link = (s: string, href = "#") => text(s, [{ type: "link", attrs: { href } } as never]);
const li = (s: string): Node => ({ type: "listItem", content: [p(s)] });
const img = (alt: string): Node => ({ type: "image", attrs: { src: "", alt } });
const slideUp = (extra: Record<string, unknown> = {}) => ({ motion: { in: "slide-up", stagger: true }, ...extra });
const table = (rows: string[][]): Node => ({ type: "table", content: rows.map((r, i) => ({ type: "tableRow", content: r.map((c) => ({ type: i === 0 ? "tableHeader" : "tableCell", content: [p(c)] })) })) });

function library(t: L): Pattern[] {
  const feat = (title: string): Node => card([h(3, title), muted(t.fText)], { padding: { base: "lg" } });
  const stat = (n: string, l: string): Node => ({ type: "group", attrs: { style: center }, content: [h(2, n, { style: { fontSize: { base: "4xl" }, color: { text: "primary" } } }), muted(l, center)] });
  const step = (n: number, title: string): Node => card([h(2, String(n), { style: { color: { text: "primary" } } }), h(3, title), muted(t.sText)], { padding: { base: "lg" } });
  const plan = (name: string, price: string, highlight: boolean): Node => card([
    ...(highlight ? [eyebrow(t.popular)] : []), h(3, name), h(2, price, { style: { fontSize: { base: "3xl" } } }),
    { type: "bulletList", content: [1, 2, 3, 4].map((n) => li(`${t.item} ${n}`)) },
    buttons("left", btn(t.choose, highlight ? "primary" : "outline")),
  ], { padding: { base: "lg" }, ...(highlight ? { shadow: "lg", border: { width: "2px", style: "solid", color: "primary" } } : {}) });
  const quoteCard = (q: string, who: string): Node => card([{ type: "blockquote", attrs: { citation: who }, content: [p(q)] }], { padding: { base: "lg" } });
  const member = (): Node => card([img(t.member), h(3, t.member), muted(t.role), p(t.bio)], { padding: { base: "lg" }, textAlign: { base: "center" } });
  const info = (label: string, value: string): Node => card([h(3, label), p(value)], { padding: { base: "lg" } });
  const links = (title: string, items: string[]): Node => ({ type: "column", content: [h(4, title), { type: "bulletList", content: items.map((s) => ({ type: "listItem", content: [{ type: "paragraph", content: [link(s)] }] })) }] });
  // Form cơ bản của lõi (khối form): formId để trống — trình soạn tạo mã khi mẫu được chèn
  const fld = (kind: string, name: string, label: string, extra: Record<string, unknown> = {}): Node => ({ type: "formField", attrs: { kind, name, label, ...extra } });
  const contactForm = (topics = false): Node => ({ type: "form", attrs: { submitText: t.fSend, successMessage: t.fThanks }, content: [
    fld("text", "name", t.fName, { required: true, width: "half" }), fld("tel", "phone", t.fPhone, { required: true, width: "half" }),
    fld("email", "email", t.fEmail),
    ...(topics ? [fld("select", "topic", t.fTopic, { options: [t.topic1, t.topic2, t.topic3] })] : []),
    fld("textarea", "message", t.fMessage, { required: true, placeholder: t.fMessageP }),
    fld("consent", "consent", t.fConsent, { required: true }),
  ] });
  const infoRow = (icon: string, label: string, value: string): Node => ({ type: "group", attrs: { style: { layout: { type: "flex", direction: { base: "row" }, align: { base: "start" }, wrap: false }, gap: "md" } }, content: [
    { type: "icon", attrs: { name: icon, size: 22, style: { color: { text: "primary" } } } },
    { type: "group", content: [p(label, { style: { fontWeight: "600", margin: { base: "0" } } }), muted(value, { margin: { base: "0" } })] }] });
  const m = (id: string, category: string, keywords: string, content: Node[]): Pattern => ({ name: `core/${id}`, category, title: t[id.replace(/-/g, "_")], description: t[`${id.replace(/-/g, "_")}D`], keywords, content });

  return [
    // ---------------- hero ----------------
    m("hero-split", "hero", "hero banner anh chu split", [
      section([{ type: "mediaText", attrs: { position: "right", width: 45, verticalAlign: "center" }, content: [
        eyebrow(t.eyebrow), h(1, t.title), p(t.sub), buttons("left", btn(t.start), btn(t.demo, "outline"))] }], { motion: { in: "fade" } })]),
    m("hero-gradient", "hero", "hero gradient nen chuyen mau gradient", [
      section([h(1, t.title, { style: { ...center, color: { text: "#ffffff" } } }), p(t.sub, { style: { ...center, color: { text: "#ffffff" } } }), buttons("center", WHITE_BTN(t.start), GHOST_BTN(t.learn))],
        { gradient: GRADIENT, padding: { base: "3xl", mobile: "2xl" }, radius: "16px", motion: { in: "slide-up" } })]),
    m("hero-minimal", "hero", "hero toi gian minimal", [
      section([eyebrow(t.eyebrow), h(1, t.title, { style: { fontSize: { base: "4xl", mobile: "3xl" } } }), muted(t.sub, { fontSize: { base: "lg" } }), buttons("left", btn(t.start), btn(t.learn, "outline"))],
        { padding: { base: "3xl", mobile: "2xl" }, maxWidth: { base: "720px" }, motion: { in: "fade" } })]),
    m("hero-bottom", "hero", "hero anh bia cover chu duoi", [
      { type: "cover", attrs: { overlay: "#000000", opacity: 45, minHeight: "75vh", contentAlign: "bottom" }, content: [
        h(1, t.title), p(t.sub), buttons("left", btn(t.start))] }]),
    m("hero-badge", "hero", "hero nhan badge moi", [
      section([p(`● ${t.badge}`, { style: { ...center, fontWeight: "700", color: { text: "primary" } } }), h(1, t.title, { style: center }), muted(t.sub, center), buttons("center", btn(t.start), btn(t.learn, "outline"))],
        { padding: { base: "3xl", mobile: "2xl" }, motion: { in: "slide-up" } })]),

    // ---------------- features ----------------
    m("feat-grid6", "features", "tinh nang luoi features grid 6", [
      section([eyebrow(t.eyebrow, true), big(t.title), { type: "spacer", attrs: { height: "md" } }, grid(3, [t.f1, t.f2, t.f3, t.f4, t.f5, t.f6].map(feat), slideUp())])]),
    m("feat-cards4", "features", "the noi hover card 4", [
      section([big(t.title), { type: "spacer", attrs: { height: "md" } }, grid(4, [t.f1, t.f2, t.f3, t.f4].map(feat), slideUp())])]),
    m("feat-list", "features", "tinh nang danh sach list diem manh", [
      section([{ type: "columns", content: [
        { type: "column", content: [eyebrow(t.eyebrow), h(2, t.title), muted(t.sub)] },
        { type: "column", content: [{ type: "bulletList", content: [t.f1, t.f2, t.f3, t.f4, t.f5].map((s) => li(`${s} — ${t.fText}`)) }] }] }])]),
    m("feat-alt", "features", "tinh nang xen ke anh alternating", [
      section([
        { type: "mediaText", attrs: { position: "left", width: 45, verticalAlign: "center" }, content: [h(2, t.f1), p(t.fText), buttons("left", btn(t.more, "outline"))] },
        { type: "spacer", attrs: { height: "xl" } },
        { type: "mediaText", attrs: { position: "right", width: 45, verticalAlign: "center" }, content: [h(2, t.f2), p(t.fText), buttons("left", btn(t.more, "outline"))] }])]),

    // ---------------- stats / steps ----------------
    m("stats4", "stats", "so lieu con so stats numbers", [
      section([grid(4, [stat(t.n1, t.l1), stat(t.n2, t.l2), stat(t.n3, t.l3), stat(t.n4, t.l4)], { motion: { in: "zoom-in", stagger: true } })])]),
    m("stats-band", "stats", "dai so lieu stats band", [
      section([grid(3, [stat(t.n1, t.l1), stat(t.n2, t.l2), stat(t.n3, t.l3)], { motion: { in: "fade", stagger: true } })], { color: { background: "surface" }, radius: "16px" })]),
    m("steps3", "steps", "quy trinh buoc process steps", [
      section([big(t.title), { type: "spacer", attrs: { height: "md" } }, grid(3, [step(1, t.s1), step(2, t.s2), step(3, t.s3)], slideUp())])]),
    m("steps-v", "steps", "quy trinh doc timeline vertical", [
      section([h(2, t.title), { type: "orderedList", content: [t.s1, t.s2, t.s3, t.s4].map((s) => ({ type: "listItem", content: [{ type: "paragraph", content: [text(s, [{ type: "bold" }])] }, p(t.sText)] })) }], { maxWidth: { base: "720px" } })]),

    // ---------------- pricing ----------------
    m("price2", "pricing", "bang gia 2 goi pricing", [
      section([big(t.title), { type: "spacer", attrs: { height: "md" } }, grid(2, [plan(t.plan1, "199k", false), plan(t.plan2, `499k${t.perMonth}`, true)], { maxWidth: { base: "860px" }, margin: { base: { left: "auto", right: "auto" } } })])]),
    m("price-table", "pricing", "bang so sanh goi comparison table", [
      section([h(2, t.title, center), table([[t.feature, t.plan1, t.plan2, t.plan3], [`${t.item} 1`, t.yes, t.yes, t.yes], [`${t.item} 2`, t.no, t.yes, t.yes], [`${t.item} 3`, t.no, t.no, t.yes]])])]),

    // ---------------- testimonials ----------------
    m("test3", "testimonials", "cam nhan khach hang testimonials 3", [
      section([big(t.title), { type: "spacer", attrs: { height: "md" } }, grid(3, [quoteCard(t.quote1, t.who1), quoteCard(t.quote2, t.who2), quoteCard(t.quote3, t.who3)], slideUp())])]),
    m("test-big", "testimonials", "cam nhan lon trich dan quote big", [
      section([{ type: "pullquote", attrs: { citation: t.who1, style: { fontSize: { base: "xl" } } }, content: [text(t.bigQuote)] }], { padding: { base: "2xl" }, motion: { in: "fade" } })]),

    // ---------------- faq ----------------
    m("faq2", "faq", "hoi dap 2 cot faq", [
      section([{ type: "columns", content: [
        { type: "column", content: [eyebrow(t.eyebrow), h(2, t.title), muted(t.sub)] },
        { type: "column", content: [t.q1, t.q2, t.q3].map((q) => ({ type: "details", attrs: { summary: q }, content: [p(t.a)] })) }] }])]),
    m("faq5", "faq", "hoi dap thuong gap faq 5", [
      section([h(2, t.title, center), ...[t.q1, t.q2, t.q3, t.q4, t.q5].map((q) => ({ type: "details", attrs: { summary: q }, content: [p(t.a)] }))], { maxWidth: { base: "760px" } })]),

    // ---------------- cta ----------------
    m("cta-band", "cta", "keu goi nen mau cta band gradient", [
      section([h(2, t.title, { style: { ...center, color: { text: "#ffffff" } } }), p(t.sub, { style: { ...center, color: { text: "#ffffff" } } }), buttons("center", WHITE_BTN(t.start))],
        { gradient: GRADIENT, radius: "16px", padding: { base: "2xl", mobile: "xl" }, motion: { in: "zoom-in" } })]),
    m("cta-split", "cta", "keu goi chia doi cta split", [
      section([{ type: "columns", attrs: { verticalAlign: "center" }, content: [
        { type: "column", attrs: { width: 65 }, content: [h(2, t.title), muted(t.sub)] },
        { type: "column", attrs: { width: 35 }, content: [buttons("right", btn(t.start))] }] }], { color: { background: "surface" }, radius: "16px" })]),
    m("cta-contact", "cta", "goi dien zalo lien he nhanh cta", [
      section([h(2, t.title, center), muted(t.sub, center), buttons("center", btn(t.call), btn(t.chat, "outline"))], { motion: { in: "slide-up" } })]),

    // ---------------- team / logos ----------------
    m("team4", "team", "doi ngu thanh vien team 4", [
      section([big(t.title), { type: "spacer", attrs: { height: "md" } }, grid(4, [member(), member(), member(), member()], slideUp())])]),
    m("team-intro", "team", "gioi thieu doi ngu anh nhom team intro", [
      section([{ type: "mediaText", attrs: { position: "left", width: 50, verticalAlign: "center" }, content: [eyebrow(t.eyebrow), h(2, t.title), p(t.sub), buttons("left", btn(t.more, "outline"))] }])]),
    m("logos", "logos", "doi tac logo khach hang logos", [
      section([muted(t.trusted, { ...center, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: { base: "sm" } }), grid(5, [1, 2, 3, 4, 5].map(() => img(t.logo)), { motion: { in: "fade", stagger: true } })])]),

    // ---------------- contact ----------------
    m("contact-form", "contact", "lien he form gui tin nhan contact form", [
      section([{ type: "columns", attrs: { verticalAlign: "top" }, content: [
        { type: "column", attrs: { width: 40 }, content: [eyebrow(t.l_contact), h(2, t.contactTitle), muted(t.contactSub, { fontSize: { base: "lg" } }), { type: "spacer", attrs: { height: "sm" } },
          { type: "group", attrs: { style: { layout: { type: "flex", direction: { base: "column" } }, gap: "lg" } }, content: [
            infoRow("phone", t.phone, t.phoneV), infoRow("mail", t.email, t.emailV), infoRow("mapPin", t.address, t.addressV), infoRow("clock", t.hours, t.hoursV)] }] },
        { type: "column", attrs: { width: 60 }, content: [card([contactForm(true)], { padding: { base: "xl", mobile: "lg" }, shadow: "md", motion: undefined })] }] }],
        { motion: { in: "fade" } })]),
    m("contact-split", "contact", "lien he chia doi contact split", [
      section([{ type: "columns", content: [
        { type: "column", content: [h(2, t.contactTitle), muted(t.contactSub), p(`${t.address}: ${t.addressV}`), p(`${t.phone}: ${t.phoneV}`), p(`${t.email}: ${t.emailV}`),
          { type: "socialLinks", attrs: { links: [{ service: "facebook", url: "https://facebook.com" }, { service: "zalo", url: "https://zalo.me" }, { service: "email", url: "mailto:hello@example.com" }] } }] },
        { type: "column", content: [contactForm()] }] }])]),
    m("contact-cards", "contact", "the lien he dia chi dien thoai email contact cards", [
      section([h(2, t.contactTitle, center), muted(t.contactSub, center), { type: "spacer", attrs: { height: "md" } }, grid(3, [info(t.address, t.addressV), info(t.phone, t.phoneV), info(t.email, t.emailV)], slideUp())])]),

    // ---------------- text ----------------
    m("text-cols", "text", "hai cot chu text columns", [
      section([h(2, t.title), { type: "columns", content: [{ type: "column", content: [h(3, t.twoColA), p(t.body), p(t.body)] }, { type: "column", content: [h(3, t.twoColB), p(t.body), p(t.body)] }] }])]),
    m("text-note", "text", "ghi chu luu y callout note", [
      section([{ type: "callout", attrs: { tone: "info", title: t.note }, content: [p(t.noteText)] }, p(t.body)], { maxWidth: { base: "760px" } })]),

    // ---------------- footer ----------------
    m("footer-simple", "footer", "chan trang gon footer", [
      section([p(t.copyright, { style: { ...center, color: { text: "muted" }, fontSize: { base: "sm" } } }), { type: "socialLinks", attrs: { align: "center", links: [{ service: "facebook", url: "https://facebook.com" }, { service: "youtube", url: "https://youtube.com" }, { service: "zalo", url: "https://zalo.me" }] } }], { padding: { base: "xl" } })]),
    m("footer-cols", "footer", "chan trang 3 cot footer links", [
      section([{ type: "columns", content: [links(t.footerAbout, [t.l_about, t.l_news, t.l_jobs]), links(t.footerHelp, [t.l_faq, t.l_guide, t.l_contact]), links(t.footerLegal, [t.l_terms, t.l_privacy, t.l_refund])] },
        p(t.copyright, { style: { color: { text: "muted" }, fontSize: { base: "sm" } } })], { padding: { base: "xl" } })]),
  ];
}

export const libraryPatterns = (locale: string): Pattern[] => library(msgs("patternLib", locale));
