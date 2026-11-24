import { blockCitation, blockShell , typedConfig } from "@ecomcx/ecomweb-content";
import { Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, List, ListOrdered, Pilcrow, Quote, SquareCode, Type } from "lucide-react";
import type { CSSProperties } from "react";
import { InnerBlocks } from "../canvas/block-list";
import { inlineText, makeBlock, type BNode } from "../core/model";
import { flatten } from "../core/ops";
import type { BlockEditProps, BlockTransform, BlockType } from "../core/registry";
import { RichText } from "../text/rich-text";
import { useActiveWithin } from "./resize";
import { BoundText, useBindingPreview } from "../ui/bindings";
import { useMsgs } from "../i18n";
import { useEditor } from "../context";
import { withoutOverridden } from "./inline-style";

// Căn chữ lấy từ vỏ dùng chung với website: căn trái không in style (trước đây canvas in thừa)
// Căn chữ của thuộc tính (Cài đặt) mà Kiểu dáng › Căn chữ đã đặt thì bỏ phần inline — giống renderer website (inline luôn thắng class kiểu dáng)
const align = (a: Record<string, unknown>, type = "paragraph"): CSSProperties | undefined => {
  const st = blockShell(type, a)?.style as CSSProperties | undefined;
  return st && a.style ? withoutOverridden(st, a.style) : st;
};
/** Class + chú thích của icon cạnh chữ (cùng vỏ với website). */
const iconProps = (a: Record<string, unknown>, type = "paragraph") => { const sh = blockShell(type, a); return { className: sh?.className, title: sh?.attrs?.title }; };
const HEADING_ICONS = [Heading1, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6];

function ParagraphEdit({ block, blockProps, editable }: BlockEditProps) {
  const bound = useBindingPreview(block, "content");
  const tp = useMsgs("placeholders");
  const { store } = useEditor();
  if (bound.bound) return <BoundText tagName="p" preview={bound} blockProps={blockProps} style={align(block.attrs)} />;
  // Gợi ý theo vai trò: mục danh sách / việc khác đoạn văn thường
  const parent = store.locate(block.id)?.parent?.type;
  const ph = parent === "listItem" ? tp.listItem : tp.paragraph;
  return <RichText blockId={block.id} value={block.inline} tagName="p" blockProps={{ ...blockProps, title: iconProps(block.attrs).title }} className={iconProps(block.attrs).className} style={align(block.attrs)} placeholder={ph} placeholderAlways editable={editable} />;
}

function HeadingEdit({ block, blockProps, editable }: BlockEditProps) {
  const tp = useMsgs("placeholders");
  const level = Math.min(6, Math.max(1, Number(block.attrs.level) || 2));
  const tag = block.attrs.htmlTag === "p" || block.attrs.htmlTag === "span" || block.attrs.htmlTag === "div" ? block.attrs.htmlTag : `h${level}`;
  const bound = useBindingPreview(block, "content");
  if (bound.bound) return <BoundText tagName={tag} preview={bound} blockProps={blockProps} style={align(block.attrs, "heading")} />;
  return <RichText blockId={block.id} value={block.inline} tagName={tag} blockProps={{ ...blockProps, title: iconProps(block.attrs, "heading").title, ...(typedConfig(block.attrs) ? { "data-ecx-typed": typedConfig(block.attrs)!.words[0] } : {}) } as typeof blockProps} className={iconProps(block.attrs, "heading").className} style={align(block.attrs, "heading")} placeholder={tp.heading} placeholderAlways editable={editable} />;
}

const CODE_LANGS = ["html", "css", "javascript", "typescript", "json", "bash", "python", "php", "sql", "csharp", "yaml", "markdown"];
function CodeEdit({ block, blockProps, editable, setAttrs }: BlockEditProps) {
  const lang = typeof block.attrs.language === "string" ? block.attrs.language : undefined;
  const tp = useMsgs("placeholders");
  const active = useActiveWithin(block.id);
  return (
    <pre {...blockProps}>
      {/* Chọn ngôn ngữ ngay trên khối (chỉ trình soạn) */}
      {editable && active && (
        <label className="ecx-ph-corner" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
          <span className="ecx-ph-label">{tp.language}</span>
          <select className="ecx-input" value={lang ?? ""} onChange={(e) => setAttrs({ language: e.target.value || undefined })}>
            <option value="">{tp.languageAuto}</option>
            {[...new Set([...(lang ? [lang] : []), ...CODE_LANGS])].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      )}
      <RichText blockId={block.id} value={block.inline} tagName="code" className={lang ? `language-${lang}` : undefined} multiline plain placeholder={tp.code} placeholderAlways editable={editable} />
    </pre>
  );
}

function ListEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const Tag = block.type === "orderedList" ? "ol" : "ul";
  const start = Number(block.attrs.start);
  const tp = useMsgs("placeholders");
  const active = useActiveWithin(block.id);
  return (
    <Tag {...(blockProps as object)} className={`${blockProps.className}${block.type === "taskList" ? " ecx-task-list task-list" : ""}`} start={Tag === "ol" && start > 1 ? start : undefined}>
      <InnerBlocks parent={block} appender="none" />
      {/* Số bắt đầu chỉnh ngay trên khối (chỉ khi đang thao tác trong danh sách số) */}
      {Tag === "ol" && editable && active && (
        <li className="ecx-ph-corner is-list" contentEditable={false} onMouseDown={(e) => e.stopPropagation()} role="presentation">
          <label><span className="ecx-ph-label">{tp.startAt}</span> <input className="ecx-input" type="number" min={1} value={start > 0 ? start : 1} onChange={(e) => setAttrs({ start: Math.max(1, Number(e.target.value) || 1) })} /></label>
        </li>
      )}
    </Tag>
  );
}

function ListItemEdit({ block, blockProps }: BlockEditProps) {
  return <li {...(blockProps as object)}><InnerBlocks parent={block} appender="none" /></li>;
}

function QuoteEdit({ block, blockProps, editable, setAttrs }: BlockEditProps) {
  const cite = blockCitation(block.attrs);
  const tp = useMsgs("placeholders");
  const active = useActiveWithin(block.id);
  // Website in <cite> sau nội dung khi có nguồn. Trình soạn chỉ hiện ô nguồn trống ("— Thêm nguồn…") khi đang chọn / gõ trong khối
  // (như WordPress) — luôn hiện thì khung soạn cao hơn website một dòng
  return (
    <blockquote {...blockProps}>
      <InnerBlocks parent={block} />
      {(cite !== undefined || (editable && active)) && <RichText blockId={block.id} field="citation" tagName="cite" value={cite ?? ""} onChange={(v) => setAttrs({ citation: v || undefined })} placeholder={tp.citation} placeholderAlways editable={editable} />}
    </blockquote>
  );
}

// ---------------------------------------------------------------------------
// Đổi loại khối
// ---------------------------------------------------------------------------
/** Gom chữ của các khối (đoạn, tiêu đề, mục danh sách) — đổi loại giữ chữ. */
const textsOf = (blocks: BNode[]) => blocks.flatMap((b) => flatten([b]).filter((x) => x.inline)).map((x) => x.inline!);
const toTextBlocks = (type: string, attrs: Record<string, unknown> = {}): BlockTransform["convert"] => (blocks) => textsOf(blocks).map((inline) => makeBlock(type, attrs, inline));
const toList = (type: "bulletList" | "orderedList"): BlockTransform["convert"] => (blocks) => [makeBlock(type, {}, textsOf(blocks).map((inline) => makeBlock("listItem", {}, [makeBlock("paragraph", {}, inline)])))];
const toQuote: BlockTransform["convert"] = (blocks) => [makeBlock("blockquote", {}, textsOf(blocks).map((inline) => makeBlock("paragraph", {}, inline)))];
const toCode: BlockTransform["convert"] = (blocks) => [makeBlock("codeBlock", {}, textsOf(blocks).map((i) => inlineText(i)).join("\n"))];

const textTransforms = (except: string): BlockTransform[] => [
  { to: "paragraph", convert: toTextBlocks("paragraph"), multiple: true },
  ...[1, 2, 3, 4].map((level) => ({ to: "heading", title: `H${level}`, convert: toTextBlocks("heading", { level }), multiple: true })),
  { to: "bulletList", convert: toList("bulletList"), multiple: true },
  { to: "orderedList", convert: toList("orderedList"), multiple: true },
  { to: "blockquote", convert: toQuote, multiple: true },
  { to: "codeBlock", convert: toCode, multiple: true },
].filter((t) => t.to !== except || t.to === "heading");

export function textBlocks(): BlockType[] {
  return [
    {
      name: "paragraph", title: "Đoạn văn", icon: Pilcrow, category: "text", keywords: "doan van text paragraph p", kind: "text", edit: ParagraphEdit,
      attributes: { textAlign: { type: "string", enum: ["left", "center", "right", "justify"] }, icon: { type: "string" }, iconPosition: { type: "string", enum: ["left", "right"], default: "left" }, iconTitle: { type: "string" } },
      supports: { style: true, anchor: true, className: true }, transforms: textTransforms("paragraph"),
    },
    {
      name: "heading", title: "Tiêu đề", icon: Heading2, category: "text", keywords: "tieu de heading h1 h2 h3 h4", kind: "text", edit: HeadingEdit,
      attributes: { htmlTag: { type: "string", enum: ["p", "span", "div"] }, level: { type: "integer", default: 2, min: 1, max: 6 }, textAlign: { type: "string", enum: ["left", "center", "right", "justify"] }, icon: { type: "string" }, iconPosition: { type: "string", enum: ["left", "right"], default: "left" }, iconTitle: { type: "string" }, tocTitle: { type: "string" },
        href: { type: "url" }, linkTarget: { type: "string", enum: ["_self", "_blank"] }, linkRel: { type: "string" },
        typedWords: { type: "string" }, typedSpeed: { type: "integer", default: 80, min: 30, max: 200 }, typedPause: { type: "integer", default: 1800, min: 600, max: 6000 }, typedLoop: { type: "boolean", default: true } },
      create: (attrs) => makeBlock("heading", { level: 2, ...attrs }),
      variations: [1, 2, 3, 4, 5, 6].map((level) => ({ name: `h${level}`, title: `H${level}`, icon: HEADING_ICONS[level], keywords: `h${level}`, attrs: { level }, isActive: (a) => Number(a.level) === level })),
      supports: { style: true, anchor: true, className: true }, transforms: textTransforms("heading"),
      summary: (a) => `H${a.level ?? 2}`,
    },
    {
      name: "bulletList", title: "Danh sách", icon: List, category: "text", keywords: "danh sach list bullet ul", kind: "container", edit: ListEdit,
      create: () => makeBlock("bulletList", {}, [makeBlock("listItem", {}, [makeBlock("paragraph")])]),
      supports: { style: true, anchor: true, className: true }, transforms: textTransforms("bulletList"),
    },
    {
      name: "orderedList", title: "Danh sách số", icon: ListOrdered, category: "text", keywords: "danh sach so ordered number ol", kind: "container", edit: ListEdit,
      attributes: { start: { type: "integer", default: 1, min: 1 }, reversed: { type: "boolean", default: false } },
      create: () => makeBlock("orderedList", {}, [makeBlock("listItem", {}, [makeBlock("paragraph")])]),
      supports: { style: true, anchor: true, className: true }, transforms: textTransforms("orderedList"),
    },
    { name: "listItem", title: "Mục danh sách", icon: List, kind: "container", edit: ListItemEdit, hidden: true },
    {
      name: "blockquote", title: "Trích dẫn", icon: Quote, category: "text", keywords: "trich dan quote blockquote", kind: "container", edit: QuoteEdit,
      attributes: { citation: { type: "string" } },
      create: () => makeBlock("blockquote", {}, [makeBlock("paragraph")]),
      supports: { style: true, anchor: true, className: true, blockStyle: true },
      transforms: [{ to: "paragraph", convert: toTextBlocks("paragraph"), multiple: true }],
    },
    {
      name: "codeBlock", title: "Mã nguồn", icon: SquareCode, category: "text", keywords: "ma code nguon", kind: "text", edit: CodeEdit, multiline: true, plain: true,
      attributes: { language: { type: "string" } }, // nhãn lấy từ locales/*/attrs.ts (language) theo ngôn ngữ đang dùng
      transforms: [{ to: "paragraph", convert: (b) => textsOf(b).map((i) => makeBlock("paragraph", {}, inlineText(i))) }],
    },
  ];
}
export const TextIcon = Type;
