import { Extension } from "@tiptap/core";
import { registerEditorExtension, unregisterEditorExtension } from "./registry";
import { dropPanel, storePanel, type BlockPanel } from "./panelstore";
export { blockPanelsFor, blockPanels, onBlockPanelsChange, type BlockPanel, type BlockPanelProps } from "./panelstore";

/** Thêm panel vào tab "Khối" (BlockInspector) cho một số loại khối hoặc mọi khối. */
export function registerBlockPanel(panel: BlockPanel) {
  storePanel(panel);
  if (panel.attributes && panel.blocks?.length) {
    const attrs = Object.fromEntries(Object.entries(panel.attributes).map(([k, spec]) => [k, { default: spec.default ?? null, renderHTML: () => ({}), parseHTML: () => spec.default ?? null }]));
    registerEditorExtension({
      name: `panel:${panel.id}`,
      extensions: [Extension.create({ name: `cmsPanel_${panel.id.replace(/[^\w]/g, "_")}`, addGlobalAttributes: () => [{ types: panel.blocks!, attributes: attrs }] })],
    });
  }
}

export function unregisterBlockPanel(id: string) {
  if (!dropPanel(id)) return;
  unregisterEditorExtension(`panel:${id}`);
}

