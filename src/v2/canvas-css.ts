/**
 * CSS của khung soạn (trong iframe): chỉ phần của trình soạn — viền chọn, chữ gợi ý, nút "+", nhãn header/footer.
 * Nạp TRƯỚC CSS của website nên không đè kiểu dáng nội dung; dùng outline (theme hầu như không dùng) để không đổi bố cục.
 */
export const CANVAS_CSS = String.raw`
:root { --ecx-ui-font: "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif; --ecx-ui: #1a597b; --ecx-ui-nested: #f26251; --ecx-ui-soft: color-mix(in srgb, var(--ecx-ui) 8%, transparent); color-scheme: light; }
html, body { margin: 0; min-height: 100%; }
body.ecx-canvas-body { padding: 0; background: #fff; }
.ecx-canvas-root { min-height: 100vh; padding: 2rem clamp(1rem, 4vw, 3rem) 40vh; box-sizing: border-box; outline: none; }
.ecx-canvas-root > * { max-width: var(--ecx-content-width, 760px); margin-left: auto; margin-right: auto; }
.ecx-canvas-root > .ecx-nested, .ecx-canvas-root > .ecx-cover, .ecx-canvas-root > [data-type="columns"], .ecx-canvas-root > .ecx-align-wide { max-width: var(--ecx-wide-width, 1200px); }
.ecx-canvas-root > .ecx-align-full, .ecx-canvas-root > .ecx-template-part { max-width: none; }

.ecx-block { position: relative; scroll-margin: 80px; }
.ecx-block:focus { outline: none; }
.ecx-block:not([data-ecx-rich]):hover:not(:has(.ecx-block:hover)) { outline: 1px solid color-mix(in srgb, var(--ecx-ui) 45%, transparent); outline-offset: 1px; }
.ecx-block.is-selected { outline: 2px solid var(--ecx-ui) !important; outline-offset: 1px; }
.ecx-block.is-selected.ecx-nested { outline-color: var(--ecx-ui-nested) !important; }
[data-ecx-rich] { outline: none; white-space: pre-wrap; word-wrap: break-word; caret-color: currentColor; min-height: 1em; }
[data-ecx-rich]:focus { outline: none; }
pre [data-ecx-rich], pre[data-ecx-rich] { white-space: pre-wrap; }
[data-ecx-rich][data-empty][data-placeholder]::before { content: attr(data-placeholder); opacity: .45; pointer-events: none; position: absolute; }
[data-ecx-rich][data-empty]:not([data-placeholder-always]):not(:focus)::before { content: none; }
[data-ecx-rich][data-empty] { position: relative; }
.ProseMirror-hideselection *::selection { background: transparent; }
.ProseMirror-selectednode { outline: 2px solid var(--ecx-ui); }
.ecx-inline-atom { padding: 0 .25em; border-radius: 4px; background: var(--ecx-ui-soft); font-size: .85em; }

.ecx-block.is-locked { pointer-events: none; }
.ecx-block.is-locked .ecx-nested:not(.is-locked), .ecx-block.is-locked [data-ecx-editable-doc] { pointer-events: auto; }

.ecx-default-appender { cursor: text; opacity: .5; margin: 0; padding: .25em 0; }
.ecx-default-appender:focus { outline: none; }
.ecx-appender { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; margin: 0; border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); border-radius: 4px; background: transparent; color: inherit; font: 600 20px/1 var(--ecx-ui-font); cursor: pointer; opacity: .6; }
.ecx-appender:hover { opacity: 1; border-color: var(--ecx-ui); color: var(--ecx-ui); }

.ecx-placeholder-block, .ecx-media-placeholder { display: flex; flex-direction: column; gap: .5rem; padding: 1rem; border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); border-radius: 6px; font: 14px/1.4 var(--ecx-ui-font); }
.ecx-placeholder-block.is-unknown { border-color: #d97706; background: rgba(217, 119, 6, .05); }
.ecx-placeholder-title { display: inline-flex; align-items: center; gap: .4rem; font-weight: 600; }
.ecx-placeholder-summary { opacity: .65; font-size: 12px; }
.ecx-icon { width: 1em; height: 1em; flex: none; }
.ecx-media-actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.ecx-media-actions form { display: flex; gap: .5rem; flex: 1; min-width: 220px; }
.ecx-input { flex: 1; min-width: 0; height: 32px; padding: 0 .6rem; border: 1px solid #e2e6ea; border-radius: 6px; font: 13px var(--ecx-ui-font); }
.ecx-btn { height: 32px; padding: 0 .8rem; border: 1px solid #e2e6ea; border-radius: 6px; background: #fff; color: #0f1e29; font: 500 13px var(--ecx-ui-font); cursor: pointer; }
.ecx-btn-primary { background: var(--ecx-ui); border-color: var(--ecx-ui); color: #fff; }
.ecx-media-pick { display: inline-flex; align-items: center; gap: .4rem; padding: 2rem; width: 100%; justify-content: center; border: 1px dashed #c9d0d7; border-radius: 8px; background: #f5f6f8; color: #475561; font: 500 13px var(--ecx-ui-font); cursor: pointer; }
.ecx-code-input { width: 100%; box-sizing: border-box; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; padding: .75rem; border: 1px solid #e2e6ea; border-radius: 6px; }
.ecx-html-preview { width: 100%; min-height: 80px; border: 0; pointer-events: none; }
.ecx-embed-preview { display: flex; align-items: center; gap: .5rem; padding: 1rem; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 6px; font: 14px var(--ecx-ui-font); }
.ecx-embed-url { opacity: .6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ecx-block-error { padding: .75rem; border: 1px solid #dc2626; color: #dc2626; border-radius: 6px; font: 13px var(--ecx-ui-font); }

.ecx-nested { position: relative; }
.ecx-nested-label { position: absolute; top: 0; left: 0; transform: translateY(-100%); display: none; align-items: center; gap: .3rem; padding: 2px 8px; background: var(--ecx-ui-nested); color: #fff; font: 600 11px/1.6 var(--ecx-ui-font); border-radius: 6px 6px 0 0; z-index: 5; white-space: nowrap; pointer-events: none; }
.ecx-nested:hover:not(:has(.ecx-block:hover)) { outline: 1px solid var(--ecx-ui-nested) !important; }
.ecx-nested:hover > .ecx-nested-label, .ecx-nested.is-selected > .ecx-nested-label { display: inline-flex; }
.ecx-nested.is-pending { min-height: 48px; }
.ecx-nested-note { padding: .75rem; font: 13px var(--ecx-ui-font); opacity: .6; }
.is-focus-mode { background: #f3f4f6; padding-top: 1rem; }
.is-focus-mode > .ecx-block { background: #fff; }
.ecx-focus-bar { display: flex; align-items: center; gap: .75rem; max-width: none !important; margin: 0 0 1rem; font: 13px var(--ecx-ui-font); color: #475561; }
.ecx-focus-back { border: 0; background: none; color: var(--ecx-ui); font: 600 13px var(--ecx-ui-font); cursor: pointer; padding: 0; }

.ecx-logo-placeholder, .ecx-image-placeholder { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; width: 100%; height: 100%; background: color-mix(in srgb, currentColor 8%, transparent); }
.ecx-content-placeholder { display: flex; align-items: center; gap: .5rem; padding: 2rem; border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); border-radius: 6px; }
.ecx-post-preview { opacity: .45; pointer-events: none; list-style: none; }
.ecx-preview-bar { height: 1em; margin: .5em 0; border-radius: 3px; background: color-mix(in srgb, currentColor 15%, transparent); }
.ecx-preview-bar.is-short { width: 60%; }
.ecx-post-template { list-style: none; padding: 0; }

.ecx-drop-indicator { position: absolute; z-index: 50; background: var(--ecx-ui); border-radius: 2px; pointer-events: none; }
body.is-dragging, body.is-dragging * { cursor: grabbing !important; user-select: none !important; }
.ecx-block.is-dragging-source { opacity: .35; }

.ecx-col-handles { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
.ecx-col-handle { position: absolute; width: 12px; margin-left: -6px; cursor: col-resize; pointer-events: auto; touch-action: none; }
.ecx-col-handle::after { content: ""; position: absolute; left: 5px; top: 0; bottom: 0; width: 2px; background: var(--ecx-ui); opacity: .35; border-radius: 1px; }
.ecx-col-handle:hover::after { opacity: 1; }
.ecx-image-handle { position: absolute; z-index: 6; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; background: var(--ecx-ui); cursor: nwse-resize; touch-action: none; box-shadow: 0 0 0 1px var(--ecx-ui); }

.ecx-block.ecx-frame-content { outline: 1px dashed color-mix(in srgb, var(--ecx-ui) 50%, transparent); outline-offset: 4px; pointer-events: auto; }
.ecx-block.is-locked:not(.ecx-frame-content) { cursor: default; }
`;
