import { Blocks } from "lucide-react";
import type { ComponentType } from "react";
import { blockOptions, onBlockDefinitionsChange, registeredBlocks, type BlockEditProps as V1EditProps } from "../blockdefs";
import { onPatternsChange, patternNodes, registeredPatterns, type Pattern } from "../patterns";
import { InnerBlocks } from "./blocklist";
import { fromRich, makeBlock, type BNode } from "./model";
import type { BlockEditProps, BlockTypeRegistry } from "./registry";
import { RichText } from "./richtext";

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

/**
 * Khối plugin đăng ký bằng registerBlock(defineBlock(...)) → khối v2 (form cài đặt tự sinh, xem trước của plugin nếu có).
 * Plugin cài sau khi mở trình soạn vẫn hiện (theo dõi thay đổi). Trả về hàm huỷ theo dõi.
 */
export function syncPluginBlocks(registry: BlockTypeRegistry): () => void {
  const sync = () => {
    for (const def of registeredBlocks()) {
      const o = blockOptions(def.name);
      const t = o.translate ?? ((s: string) => s);
      registry.registerDefinition(def, {
        title: t(def.title),
        description: def.description ? t(def.description) : undefined,
        icon: o.icon ?? Blocks,
        edit: o.edit ? wrapV1Edit(o.edit) : undefined,
        create: (attrs) => {
          const defaults = Object.fromEntries(Object.entries(def.attributes).filter(([, s]) => s.default !== undefined).map(([k, s]) => [k, s.default]));
          const content = def.content === "blocks" ? (o.initialContent?.() ?? [{ type: "paragraph" }]).map((n) => fromRich(n as never)) : undefined;
          return makeBlock(def.name, { ...defaults, ...attrs }, content);
        },
      });
    }
  };
  sync();
  return onBlockDefinitionsChange(sync);
}

/** Khối của một mẫu: mẫu đồng bộ → tham chiếu; mẫu thường → chép khối. */
export function patternBlocks(p: Pattern): BNode[] {
  if (p.synced && p.ref) return [makeBlock("syncedPattern", { ref: p.ref })];
  return patternNodes(p).map((n) => fromRich(n as never));
}

export { registeredPatterns, onPatternsChange, type Pattern };
