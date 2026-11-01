/**
 * @ecomcx/ecomweb-editor/v2 — trình soạn dạng cây khối (không phải một tài liệu văn bản liền):
 * khung soạn là iframe mang CSS của website, sửa header/footer ngay trong template, một lịch sử hoàn tác xuyên tài liệu,
 * mỗi khối chữ là một ProseMirror nhỏ (gõ tiếng Việt ổn định). Đọc/ghi đúng định dạng của @ecomcx/ecomweb-content.
 */
export { BlockEditor, EditorProvider, EditorOverlays, saveAll, blocksFromContent, contentFromBlocks, splitContent, type BlockEditorProps, type EditorProviderProps } from "./editor";
export { Canvas, DEVICE_WIDTH, type CanvasProps, type Device } from "./canvas";
export { BlockToolbar, DropIndicator, ToolButton, Dropdown, MenuItem } from "./toolbar";
export { InserterPanel, InserterPopover, rankOptions, useInsertOptions, type InsertOption } from "./inserter";
export { Inspector, ListView, AttrForm, blockLabel } from "./sidebar";
export { Block, InnerBlocks, NestedDoc, DocBlocks, Appender, FallbackEdit, useBlockProps } from "./blocklist";
export { RichText, richViews, type RichTextProps } from "./richtext";
export { EditorContext, EditorUi, useEditor, useEditorState, useUiTick, useDocScope, type EditorContextValue } from "./context";
export { EditorStore, type DocRecord, type EditorState, type EditingMode, type Selection, type Caret } from "./store";
export { BlockTypeRegistry, type BlockType, type BlockEditProps, type BlockProps, type BlockVariation, type BlockTransform, type BlockCategory } from "./registry";
export { registerCoreBlocks, coreBlockTypes } from "./blocks";
export { blocksFromDoc, docFromBlocks, fromRich, toRich, makeBlock, cloneBlock, newId, kindOf, setBlockKind, setInlineType, inlineText, type BNode, type BlockKind } from "./model";
export { findBlock, flatten, mapBlock, insertBlocks, removeBlocks, moveBlocks } from "./ops";
export { canContain, fixTree, setStructureRule, type StructureRule } from "./structure";
export { htmlToRich, textToRich, richToHtml, BLOCKS_MIME } from "./clipboard";
export { viV2, enV2, type V2Labels } from "./labels";
export type { EditorHost, DocumentHost, DynamicData, NestedDocRef, LoadedDoc, SavedContent } from "./host";
export { MoreMenu, PreferencesModal, ShortcutsModal, CodeEditor, Breadcrumbs } from "./options";
export { PrefsStore, localPrefsStorage, usePrefs, DEFAULT_PREFS, type EditorPrefs, type PrefsStorage } from "./prefs";
export { DocTitle } from "./doctitle";
