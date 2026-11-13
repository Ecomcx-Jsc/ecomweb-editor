import { CORE_NODES, FORM_FIELD_NAME, blockShell } from "@ecomcx/ecomweb-content";
import { ClipboardList, TextCursorInput } from "lucide-react";
import { useEffect, type CSSProperties } from "react";
import { InnerBlocks } from "../canvas/block-list";
import { makeBlock } from "../core/model";
import type { BlockEditProps, BlockType } from "../core/registry";
import { useMsgs } from "../i18n";
import { messages } from "../../i18n";
import { RichText } from "../text/rich-text";
import { Field } from "../ui/attr-form";
import { useEditor } from "../context";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");
const merge = (bp: BlockEditProps["blockProps"], className: string, style?: CSSProperties) => ({ ...bp, className: cx(bp.className, className), style: { ...(bp.style ?? {}), ...style } });
/** Mã form: máy chủ tìm lại định nghĩa form (các ô) theo mã này trong trang / template chứa nó. */
export const newFormId = () => `f_${Math.random().toString(36).slice(2, 10)}`;
const optionsOf = (a: Record<string, unknown>): string[] => (Array.isArray(a.options) ? a.options.filter((x): x is string => typeof x === "string") : []);

/** Tên ô hợp lệ (khoá trong bài gửi) từ nhãn: bỏ dấu, chữ thường, gạch dưới. */
export function fieldNameFrom(label: string, taken: string[] = []): string {
  const base = label.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1").slice(0, 32) || "field";
  let name = FORM_FIELD_NAME.test(base) ? base : "field", n = 2;
  while (taken.includes(name)) name = `${base}_${n++}`;
  return name;
}

function FormEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const t = useMsgs("blocks");
  const a = block.attrs;
  // Mẫu (pattern) chèn vào chưa có mã: tạo một lần để máy chủ nhận ra form này
  useEffect(() => { if (editable && !a.formId) setAttrs({ formId: newFormId() }); }, [editable, a.formId, setAttrs]);
  return (
    <div {...merge(blockProps, "ecx-form-blocks")} data-form-id={String(a.formId ?? "")}>
      <InnerBlocks parent={block} />
      <div className="ecx-form-actions">
        <span className={blockShell("button", { variant: "primary" })?.className} style={blockShell("button", { variant: "primary" })?.style as CSSProperties} role="presentation">
          <RichText blockId={block.id} field="submitText" tagName="span" value={String(a.submitText ?? "")} onChange={(v) => setAttrs({ submitText: v })} placeholder={t.formSubmit} placeholderAlways editable={editable} />
        </span>
      </div>
    </div>
  );
}

/** Ô nhập trên khung soạn: đúng markup website (nhãn + ô), ô bị khoá — sửa nhãn ngay trên ô, phần còn lại ở bảng cài đặt. */
function FieldEdit({ block, blockProps, setAttrs, editable }: BlockEditProps) {
  const t = useMsgs("blocks");
  const { store } = useEditor();
  const a = block.attrs;
  // Tên ô = khoá trong bài gửi: phải hợp lệ và không trùng ô đứng trước trong cùng form (chèn hai ô cùng loại, chép / dán ô)
  const siblings = (store.locate(block.id)?.parent?.content ?? []).filter((b) => b.type === "formField");
  const sibKey = siblings.map((b) => `${b.id}:${String(b.attrs.name ?? "")}`).join("|");
  useEffect(() => {
    if (!editable) return;
    const name = String(a.name ?? "");
    const before = siblings.slice(0, siblings.findIndex((b) => b.id === block.id)).map((b) => String(b.attrs.name ?? ""));
    if (!FORM_FIELD_NAME.test(name) || before.includes(name)) setAttrs({ name: fieldNameFrom(name || String(a.label ?? ""), siblings.filter((b) => b.id !== block.id).map((b) => String(b.attrs.name ?? ""))) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, a.name, sibKey]);
  const kind = String(a.kind ?? "text");
  const label = <RichText blockId={block.id} field="label" tagName="span" value={String(a.label ?? "")} onChange={(v) => setAttrs({ label: v })} placeholder={t.fieldLabel} placeholderAlways editable={editable} />;
  const star = a.required ? <span className="ecx-field-required" aria-hidden> *</span> : null;
  const opts = optionsOf(a);
  const ph = String(a.placeholder ?? "");
  const check = kind === "checkbox" || kind === "consent";
  return (
    <div {...merge(blockProps, cx("ecx-field", `is-${kind}`, a.width === "half" && "is-half", check && "is-check"))}>
      {check ? <label><input type="checkbox" disabled tabIndex={-1} /> <span>{label}{star}</span></label> : <label>{label}{star}</label>}
      {kind === "textarea" ? <textarea disabled tabIndex={-1} placeholder={ph} />
        : kind === "select" ? <select disabled tabIndex={-1}><option>{opts[0] ?? ph ?? "—"}</option></select>
        : kind === "radio" ? <div className="ecx-field-options">{(opts.length ? opts : ["…"]).map((o, i) => <label key={i}><input type="radio" disabled tabIndex={-1} /> {o}</label>)}</div>
        : check ? null
        : <input disabled tabIndex={-1} placeholder={ph} type={kind === "number" ? "number" : kind === "date" ? "date" : "text"} />}
      {a.help ? <span className="ecx-field-help">{String(a.help)}</span> : null}
    </div>
  );
}

/** Bảng cài đặt thêm của ô: danh sách lựa chọn (mỗi dòng một lựa chọn) cho ô chọn / chọn một, và tên ô (khoá trong bài gửi). */
function FieldInspector({ attrs, setAttrs }: BlockEditProps) {
  const t = useMsgs("blocks");
  const kind = String(attrs.kind ?? "text");
  const name = String(attrs.name ?? "");
  return (
    <>
      {(kind === "select" || kind === "radio") && (
        <Field label={t.fieldOptions}>
          <textarea className="ecx-input" rows={4} value={optionsOf(attrs).join("\n")} data-field-options
            onChange={(e) => setAttrs({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 30) })} />
        </Field>
      )}
      {name && !FORM_FIELD_NAME.test(name) && <p className="ecx-muted" role="alert">{t.fieldNameInvalid}</p>}
    </>
  );
}

const spec = (name: string) => CORE_NODES[name]?.attrs;

/** Khối form cơ bản; `lang` = ngôn ngữ của trình soạn (nhãn mặc định của ô mới). */
export function formBlocks(lang?: string): BlockType[] {
  const m = messages("blocks", lang) as Record<string, string>;
  const field = (kind: string, name: string, label: string, extra: Record<string, unknown> = {}) => makeBlock("formField", { kind, name, label, ...extra });
  const KINDS: Array<[string, string, string, Record<string, unknown>?]> = [
    ["text", "text", m.fieldText], ["email", "email", m.fieldEmail], ["tel", "phone", m.fieldPhone], ["textarea", "message", m.fieldMessage],
    ["select", "topic", m.fieldSelect, { options: [m.option1, m.option2] }], ["radio", "choice", m.fieldRadio, { options: [m.option1, m.option2] }],
    ["checkbox", "subscribe", m.fieldCheckbox], ["consent", "consent", m.fieldConsent, { required: true }], ["number", "quantity", m.fieldNumber], ["date", "date", m.fieldDate],
  ];
  return [
    {
      name: "form", title: "Form", icon: ClipboardList, category: "widgets", keywords: "form lien he contact dang ky gui bieu mau", kind: "container", edit: FormEdit,
      attributes: { ...spec("form"), formId: { type: "string" } },
      structure: { allowedChildren: ["formField", "paragraph", "heading"] },
      create: () => makeBlock("form", { formId: newFormId() }, [
        field("text", "name", m.fieldName, { required: true, width: "half" }),
        field("tel", "phone", m.fieldPhone, { required: true, width: "half" }),
        field("email", "email", m.fieldEmail),
        field("textarea", "message", m.fieldMessage, { required: true }),
      ]),
      supports: { style: true, anchor: true, className: true },
    },
    {
      name: "formField", title: "Ô nhập", icon: TextCursorInput, category: "widgets", keywords: "o nhap truong field input", kind: "atom", edit: FieldEdit, inspector: FieldInspector,
      // Chỉ hiện trong trình chèn khi đang ở trong một form (structure.parents)
      attributes: spec("formField"), structure: { parents: ["form"] },
      create: (attrs) => field("text", "text", m.fieldText, attrs ?? {}),
      variations: KINDS.map(([kind, name, title, extra]) => ({ name: kind, title, attrs: { kind }, create: () => field(kind, name, title, extra), isActive: (a) => (a.kind ?? "text") === kind })),
      supports: { style: true, className: true }, summary: (a) => a.label,
    },
  ];
}
