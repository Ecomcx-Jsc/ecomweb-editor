import { blockDefaults, isSafeUrl, type BlockAttrSpec, type BlockDefinition } from "@ecomcx/ecomweb-content";
import { Blocks, X } from "lucide-react";
import { useId, type ComponentType, type ReactNode } from "react";
import { useEditor } from "../context";
import { useMsgs } from "../i18n";
import { attrLabel, controlOf } from "../ui/attr-form";
import { MediaPlaceholder, MissingNote, TextPlaceholder } from "../ui/placeholders";
import { blockOptions, onBlockDefinitionsChange, registeredBlocks, type BlockEditProps as V1EditProps } from "../../shared/block-defs";
import { InnerBlocks } from "../canvas/block-list";
import { fromRich, makeBlock } from "../core/model";
import type { BlockEditProps, BlockTypeRegistry } from "../core/registry";
import { RichText } from "../text/rich-text";

const cx = (...c: unknown[]) => c.filter((x): x is string => typeof x === "string" && x !== "").join(" ");

/** Phần xem trước của khối plugin viết cho bản 1.x (attrs, setAttrs, selected, children) chạy trong v2. */
function wrapV1Edit(Edit: ComponentType<V1EditProps>): ComponentType<BlockEditProps> {
  return function PluginEdit({ block, attrs, setAttrs, blockProps, selected, editable }: BlockEditProps) {
    const children = block.content
      ? <InnerBlocks parent={block} />
      : block.inline ? <RichText blockId={block.id} value={block.inline} tagName="div" editable={editable} /> : undefined;
    return <div {...blockProps} className={cx(blockProps.className, "ecx-plugin-block")}><Edit attrs={attrs} setAttrs={setAttrs} selected={selected}>{children}</Edit></div>;
  };
}

/** Loại ô core tự vẽ trong khối plugin; select / checkbox / color là tuỳ chọn → ở thanh bên. */
const INLINE_CONTROLS = new Set(["media", "text", "textarea", "url", "number"]);
const TECH_ATTRS = new Set(["_v", "style", "className", "anchor", "blockStyle", "mediaId", "id", "lock", "templateLock", "bindings", "metadata"]);
const empty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && !v.length);

/** Ô của khối plugin theo `placeholder.fields` (mặc định: mọi thuộc tính media / text / textarea / url / number). */
export function placeholderFields(def: Pick<BlockDefinition, "attributes"> & { placeholder?: { fields?: string[]; required?: string[] } }): { fields: string[]; required: string[] } {
  const attrs = def.attributes ?? {};
  const auto = Object.keys(attrs).filter((k) => !TECH_ATTRS.has(k) && INLINE_CONTROLS.has(controlOf(attrs[k])));
  const fields = (def.placeholder?.fields ?? auto).filter((k) => attrs[k]);
  return { fields, required: (def.placeholder?.required ?? []).filter((k) => attrs[k]) };
}

/** Một ô giữ chỗ tự sinh (có <label> cho trình đọc màn hình). */
function AutoField({ name, spec, label, value, required, set }: { name: string; spec: BlockAttrSpec; label: string; value: unknown; required: boolean; set(v: unknown): void }) {
  const id = useId();
  const tp = useMsgs("placeholders");
  const control = controlOf(spec);
  const head = <span className="ecx-ph-label">{label}{required && <span className="ecx-ph-req" aria-hidden> *</span>}</span>;
  if (control === "media") {
    const url = typeof value === "string" && isSafeUrl(value) ? value : "";
    return (
      <div className="ecx-ph-field is-media" role="group" aria-label={label} data-field={name}>
        {head}
        {url ? (
          <span className="ecx-ph-thumb" contentEditable={false}>
            <img src={url} alt="" draggable={false} />
            <button type="button" className="ecx-tool" aria-label={`${label}: ×`} onMouseDown={(e) => e.stopPropagation()} onClick={() => set(undefined)}><X className="ecx-icon ecx-icon-sm" /></button>
          </span>
        ) : <MediaPlaceholder kind="image" compact title={tp.drop.image} onSelect={(items) => set(items[0].url)} onUrl={(u) => set(u)} />}
      </div>
    );
  }
  const num = control === "number";
  const bad = control === "url" && typeof value === "string" && value !== "" && !isSafeUrl(value);
  return (
    <label className="ecx-ph-field" htmlFor={id} data-field={name} contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
      {head}
      {control === "text" || control === "textarea"
        ? <TextPlaceholder id={id} value={String(value ?? "")} onChange={(v) => set(v)} placeholder={`${label}…`} multiline={control === "textarea"} required={required} label={label} className="ecx-input" />
        : <input id={id} className="ecx-input" type={num ? "number" : "url"} inputMode={num ? "decimal" : "url"} min={spec.min} max={spec.max} placeholder={num ? "0" : "https://…"} required={required}
            value={value == null ? "" : String(value)} aria-invalid={bad || undefined} onChange={(e) => set(e.target.value === "" ? undefined : num ? Number(e.target.value) : e.target.value.trim())} />}
      {bad && <span className="ecx-media-error" role="alert">{tp.linkInvalid}</span>}
    </label>
  );
}

/**
 * Khối plugin không có giao diện riêng: core tự vẽ ô giữ chỗ từ `attributes` (ô thả media, ô gõ, ô link, ô số; khối chứa → "+ Thêm khối").
 * Đang chọn / website chưa vẽ được → các ô này; bấm ra ngoài và website vẽ được → bản website vẽ (ServerBlock).
 */
function autoEdit(def: BlockDefinition, translate: (s: string) => string, Icon: ComponentType<{ className?: string }>): ComponentType<BlockEditProps> {
  const { fields, required } = placeholderFields(def as never);
  return function AutoPlaceholderEdit({ block, blockProps, setAttrs, editable, labels }: BlockEditProps) {
    const { store } = useEditor();
    const tp = useMsgs("placeholders");
    const label = (k: string) => attrLabel(k, def.attributes[k], labels.lang, translate);
    const missing = required.filter((k) => empty(block.attrs[k]));
    const others = Object.keys(def.attributes).some((k) => !TECH_ATTRS.has(k) && !fields.includes(k) && controlOf(def.attributes[k]) !== "hidden");
    let body: ReactNode = null;
    if (editable && fields.length) body = (
      // Gõ vào ô của khối → chọn khối (thanh công cụ + bảng cài đặt đúng khối)
      <div className="ecx-ph-fields" onFocusCapture={() => { if (!store.getState().selection.ids.includes(block.id)) store.select([block.id], { editing: null }); }}>
        {fields.map((k) => <AutoField key={k} name={k} spec={def.attributes[k]} label={label(k)} value={block.attrs[k]} required={required.includes(k)} set={(v) => setAttrs({ [k]: v })} />)}
      </div>
    );
    return (
      <div {...blockProps} className={cx(blockProps.className, "ecx-placeholder-block ecx-ph-auto", missing.length && "is-missing")} data-ecx-placeholder="auto">
        <span className="ecx-placeholder-title"><Icon className="ecx-icon" />{translate(def.title)}</span>
        {body}
        {block.inline && <RichText blockId={block.id} value={block.inline} tagName="div" placeholder={`${translate(def.title)}…`} placeholderAlways editable={editable} />}
        {editable && <MissingNote fields={missing.map(label)} />}
        {editable && others && <span className="ecx-placeholder-summary">{tp.otherSettings}</span>}
        {block.content && <InnerBlocks parent={block} />}
      </div>
    );
  };
}

/**
 * Khối plugin đăng ký bằng registerBlock(defineBlock(...)) → khối v2 (form cài đặt tự sinh, xem trước của plugin nếu có).
 * Plugin cài sau khi mở trình soạn vẫn hiện (theo dõi thay đổi). Trả về hàm huỷ theo dõi.
 */
export function syncPluginBlocks(registry: BlockTypeRegistry): () => void {
  // Chỉ thêm / cập nhật khối do chính đồng bộ này tạo: khối lõi của v2 (cùng tên với khối 1.x như templatePart, cover) giữ nguyên
  const synced = new Set<string>();
  const sync = () => {
    for (const def of registeredBlocks()) {
      if (registry.get(def.name) && !synced.has(def.name)) continue;
      synced.add(def.name);
      const o = blockOptions(def.name);
      const t = o.translate ?? ((s: string) => s);
      registry.registerDefinition(def, {
        title: t(def.title),
        description: def.description ? t(def.description) : undefined,
        icon: o.icon ?? Blocks,
        templateOnly: o.templateOnly,
        ...(o.styleGroups ? { supports: { style: o.styleGroups.length ? o.styleGroups : false } } : {}),
        // Không có xem trước riêng: core tự sinh ô giữ chỗ từ thuộc tính (plugin cũ không sửa gì vẫn có)
        edit: o.edit ? wrapV1Edit(o.edit) : autoEdit(def, t, o.icon ?? Blocks),
        // Không có xem trước riêng và không chứa khối con → website vẽ bằng renderer của theme/plugin (viết khối một lần);
        // đang chọn khối → ô giữ chỗ để nhập ngay trên khối
        serverRender: !o.edit && def.content !== "blocks",
        editWhenSelected: !o.edit,
        create: (attrs) => {
          // blockDefaults kèm "_v" = phiên bản khối: thiếu nó website coi dữ liệu mới là bản 1 rồi chạy migrate lên dữ liệu đã ở bản mới
          const defaults = blockDefaults(def);
          const content = def.content === "blocks" ? (o.initialContent?.() ?? [{ type: "paragraph" }]).map((n) => fromRich(n as never)) : undefined;
          return makeBlock(def.name, { ...defaults, ...attrs }, content);
        },
      });
    }
  };
  sync();
  return onBlockDefinitionsChange(sync);
}

export { registeredPatterns, onPatternsChange, type Pattern } from "../../shared/patterns";
