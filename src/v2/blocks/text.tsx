import { Code, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, List, ListChecks, ListOrdered, Pilcrow, Quote, SquareCode, TextQuote, Type } from "lucide-react";
import type { CSSProperties } from "react";
import { InnerBlocks } from "../canvas/block-list";
import { inlineText, makeBlock, type BNode } from "../core/model";
import { flatten } from "../core/ops";
import type { BlockEditProps, BlockTransform, BlockType } from "../core/registry";
import { RichText } from "../text/rich-text";
import { BoundText, useBindingPreview } from "../ui/bindings";

const align = (a: Record<string, unknown>): CSSProperties | undefined => (typeof a.textAlign === "string" ? { textAlign: a.textAlign as CSSProperties["textAlign"] } : undefined);
const HEADING_ICONS = [Heading1, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6];

function ParagraphEdit({ block, blockProps, editable, labels }: BlockEditProps) {
  const bound = useBindingPreview(block, "content");
  if (bound.bound) return <BoundText tagName="p" preview={bound} blockProps={blockProps} style={align(block.attrs)} />;
  return <RichText blockId={block.id} value={block.inline} tagName="p" blockProps={blockProps} style={align(block.attrs)} placeholder={labels.typeSlash} editable={editable} />;
}

function HeadingEdit({ block, blockProps, editable, labels }: BlockEditProps) {
  const level = Math.min(6, Math.max(1, Number(block.attrs.level) || 2));
  const bound = useBindingPreview(block, "content");
  if (bound.bound) return <BoundText tagName={`h${level}`} preview={bound} blockProps={blockProps} style={align(block.attrs)} />;
  return <RichText blockId={block.id} value={block.inline} tagName={`h${level}`} blockProps={blockProps} style={align(block.attrs)} placeholder={labels.heading} placeholderAlways editable={editable} />;
}

function CodeEdit({ block, blockProps, editable, labels }: BlockEditProps) {
  const lang = typeof block.attrs.language === "string" ? block.attrs.language : undefined;
  return (
    <pre {...blockProps}>
      <RichText blockId={block.id} value={block.inline} tagName="code" className={lang ? `language-${lang}` : undefined} multiline plain placeholder={labels.codeBlock} placeholderAlways editable={editable} />
    </pre>
  );
}

function PreformattedEdit({ block, blockProps, editable, labels }: BlockEditProps) {
  return <RichText blockId={block.id} value={block.inline} tagName="pre" className="ecx-pre" blockProps={blockProps} breakOnEnter placeholder={labels.preformatted} placeholderAlways editable={editable} />;
}

function PullquoteEdit({ block, blockProps, editable, labels, setAttrs }: BlockEditProps) {
  return (
    <figure {...blockProps} className={`${blockProps.className} ecx-pullquote`}>
      <blockquote><RichText blockId={block.id} value={block.inline} tagName="p" placeholder={labels.pullquote} placeholderAlways editable={editable} /></blockquote>
      <RichText blockId={block.id} field="citation" tagName="figcaption" value={String(block.attrs.citation ?? "")} onChange={(v) => setAttrs({ citation: v })} placeholder={labels.caption} editable={editable} />
    </figure>
  );
}

function ListEdit({ block, blockProps }: BlockEditProps) {
  const Tag = block.type === "orderedList" ? "ol" : "ul";
  const start = Number(block.attrs.start);
  return (
    <Tag {...(blockProps as object)} className={`${blockProps.className}${block.type === "taskList" ? " ecx-task-list task-list" : ""}`} start={Tag === "ol" && start > 1 ? start : undefined}>
      <InnerBlocks parent={block} appender="none" />
    </Tag>
  );
}

function ListItemEdit({ block, blockProps }: BlockEditProps) {
  return <li {...(blockProps as object)}><InnerBlocks parent={block} appender="none" /></li>;
}

function TaskItemEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  return (
    <li {...(blockProps as object)} className={`${blockProps.className} ecx-task-item task-item`}>
      <input type="checkbox" checked={!!block.attrs.checked} disabled={!editable} onChange={(e) => setAttrs({ checked: e.target.checked || undefined })} contentEditable={false} />{" "}
      <InnerBlocks parent={block} appender="none" />
    </li>
  );
}

function QuoteEdit({ block, blockProps }: BlockEditProps) {
  return <blockquote {...blockProps}><InnerBlocks parent={block} /></blockquote>;
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
  { to: "preformatted", convert: toTextBlocks("preformatted") },
].filter((t) => t.to !== except || t.to === "heading");

export function textBlocks(): BlockType[] {
  return [
    {
      name: "paragraph", title: "Đoạn văn", icon: Pilcrow, category: "text", keywords: "doan van text paragraph p", kind: "text", edit: ParagraphEdit,
      attributes: { textAlign: { type: "string", enum: ["left", "center", "right", "justify"] } },
      supports: { style: true, anchor: true, className: true }, transforms: textTransforms("paragraph"),
    },
    {
      name: "heading", title: "Tiêu đề", icon: Heading2, category: "text", keywords: "tieu de heading h1 h2 h3 h4", kind: "text", edit: HeadingEdit,
      attributes: { level: { type: "integer", default: 2, min: 1, max: 6 }, textAlign: { type: "string", enum: ["left", "center", "right", "justify"] } },
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
      attributes: { start: { type: "integer", default: 1, min: 1 } },
      create: () => makeBlock("orderedList", {}, [makeBlock("listItem", {}, [makeBlock("paragraph")])]),
      supports: { style: true, anchor: true, className: true }, transforms: textTransforms("orderedList"),
    },
    { name: "listItem", title: "Mục danh sách", icon: List, kind: "container", edit: ListItemEdit, hidden: true },
    {
      name: "taskList", title: "Danh sách việc", icon: ListChecks, category: "text", keywords: "viec can lam todo task checklist", kind: "container", edit: ListEdit,
      create: () => makeBlock("taskList", {}, [makeBlock("taskItem", { checked: false }, [makeBlock("paragraph")])]),
    },
    { name: "taskItem", title: "Việc", icon: ListChecks, kind: "container", edit: TaskItemEdit, hidden: true, attributes: { checked: { type: "boolean", default: false } } },
    {
      name: "blockquote", title: "Trích dẫn", icon: Quote, category: "text", keywords: "trich dan quote blockquote", kind: "container", edit: QuoteEdit,
      create: () => makeBlock("blockquote", {}, [makeBlock("paragraph")]),
      supports: { style: true, anchor: true, className: true, blockStyle: true },
      transforms: [{ to: "paragraph", convert: toTextBlocks("paragraph"), multiple: true }, { to: "pullquote", convert: (b) => [makeBlock("pullquote", {}, textsOf(b)[0] ?? [])] }],
    },
    {
      name: "codeBlock", title: "Mã nguồn", icon: SquareCode, category: "text", keywords: "ma code nguon", kind: "text", edit: CodeEdit, multiline: true, plain: true,
      attributes: { language: { type: "string", label: "Ngôn ngữ" } },
      transforms: [{ to: "paragraph", convert: (b) => textsOf(b).map((i) => makeBlock("paragraph", {}, inlineText(i))) }, { to: "preformatted", convert: toTextBlocks("preformatted") }],
    },
    {
      name: "preformatted", title: "Định dạng sẵn", icon: Code, category: "text", keywords: "dinh dang san preformatted pre khoang trang", kind: "text", edit: PreformattedEdit,
      supports: { style: true, anchor: true, className: true }, transforms: textTransforms("preformatted"),
    },
    {
      name: "pullquote", title: "Trích dẫn nổi bật", icon: TextQuote, category: "text", keywords: "trich dan noi bat pullquote", kind: "text", edit: PullquoteEdit,
      attributes: { citation: { type: "string" } }, supports: { style: true, anchor: true, className: true },
      transforms: [{ to: "blockquote", convert: toQuote }, { to: "paragraph", convert: toTextBlocks("paragraph") }],
    },
  ];
}
export const TextIcon = Type;
