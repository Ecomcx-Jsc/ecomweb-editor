/**
 * CSS của khung soạn (trong iframe): chỉ phần của trình soạn — viền chọn, chữ gợi ý, nút "+", nhãn header/footer.
 * Nạp TRƯỚC CSS của website nên không đè kiểu dáng nội dung; dùng outline (theme hầu như không dùng) để không đổi bố cục.
 */
export const CANVAS_CSS = String.raw`
:root { --ecx-ui-font: "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif; --ecx-ui: #1a597b; --ecx-ui-nested: #f26251; --ecx-ui-soft: color-mix(in srgb, var(--ecx-ui) 8%, transparent); color-scheme: light; }
html, body { margin: 0; min-height: 100%; }
body.ecx-canvas-body { padding: 0; }
/* Nền trắng chỉ là mặc định (độ ưu tiên 0): theme nền tối / có màu nền riêng trên body thì canvas phải theo theme */
:where(body.ecx-canvas-body) { background: #fff; }
/* Khung bao + vùng soạn luôn ở trạng thái cuối của hiệu ứng: theme ẩn chúng tới khi JS chạy (opacity 0, dịch chuyển…) mà khung soạn không có JS đó */
[data-ecx-wrapper], .ecx-canvas-root { opacity: 1 !important; visibility: visible !important; transform: none !important; animation: none !important; transition: none !important; clip-path: none !important; filter: none !important; }
.ecx-edit-link { display: inline-block; margin: 6px 0 0; padding: 2px 8px; border: 1px solid var(--ecx-ui, #1a597b); border-radius: 4px; background: #fff; color: var(--ecx-ui, #1a597b); font: 12px/1.6 system-ui, sans-serif; cursor: pointer; }
.ecx-edit-link:hover { background: var(--ecx-ui, #1a597b); color: #fff; }
/* HTML do website vẽ (khối theme/plugin): các lớp hiệu ứng "ẩn tới khi JS chạy" thường gặp luôn ở trạng thái cuối. Theme nên đặt trạng thái ẩn dưới html.ecx-js (chỉ có khi JS chạy) để khỏi phụ thuộc đoán tên lớp. */
.ecx-server-html [class*="stagger"], .ecx-server-html [class*="reveal"], .ecx-server-html [class*="animate"], .ecx-server-html [class*="fade-"], .ecx-server-html [class*="aos"], .ecx-server-html [data-aos] { opacity: 1 !important; visibility: visible !important; transform: none !important; animation: none !important; transition: none !important; }
.ecx-canvas-root { min-height: 100vh; padding: 52px clamp(1rem, 4vw, 3rem) 40vh; box-sizing: border-box; outline: none; }
/* --ecx-canvas-col: bề rộng cột của khung soạn; KHÔNG đổi --ecx-content-width (nhóm "giữ chữ theo cột" của nội dung dùng biến đó) */
.ecx-canvas-root > * { max-width: var(--ecx-canvas-col, var(--ecx-content-width, 760px)); margin-left: auto; margin-right: auto; }
/* Mặc định của trình soạn: độ ưu tiên chỉ bằng "1 class" (:where) — đứng sau dòng trên nên thắng nó, nhưng CSS theme nạp sau (vd .ecx-template > * { max-width: 960px }) thắng lại, như trên website */
:where(.ecx-canvas-root) > :is(.ecx-nested, .ecx-cover, [data-type="columns"], .ecx-align-wide) { max-width: var(--ecx-wide-width, 1200px); }
.ecx-canvas-root.ecx-canvas-root > .ecx-align-full { max-width: none; }
/* Header/footer trong template: mặc định rộng hết (cùng mức ưu tiên — theme giới hạn bề rộng phần con của template thì canvas theo) */
:where(.ecx-canvas-root) > .ecx-template-part { max-width: none; }
/* Template rộng (full-width / canvas có sẵn): như website — chữ vẫn ở cột chữ, khối Rộng / Toàn trang mới tràn ra */
.ecx-canvas-root.is-wide { --ecx-canvas-col: var(--ecx-content-width, 760px); }
/* Template (theme dựng bằng khối): website không giới hạn bề rộng khối con và không có lề soạn — canvas làm y hệt, theme tự quyết bằng CSS của nó
   (chỉ đổi giá trị mặc định của biến, nên CSS theme vẫn thắng nếu có đặt max-width cho .ecx-template > *). */
.ecx-canvas-root.ecx-template, .ecx-canvas-root.entry-content { --ecx-canvas-col: none; padding-left: 0; padding-right: 0; }
/* padding-top 52px (canvas mặc định + template) = chỗ cho thanh công cụ nổi (44px + 8) trên khối đầu: thiếu chỗ thì thanh đè lên chữ, bấm vào khối trúng nút của thanh.
   Bài (.entry-content): ô tiêu đề nằm trên khối đầu nên đã đủ chỗ — giữ 0 như website (thêm khoảng làm khung bao của trang bài lệch so với lúc mở) */
.ecx-canvas-root.entry-content { padding-top: 0; }
/* Vùng bài của template full-width / canvas có sẵn (.ecx-layout-constrained): cột chữ + lề hai bên như website */
.ecx-canvas-root.ecx-canvas-root.ecx-layout-constrained { --ecx-canvas-col: var(--ecx-content-width, 760px); padding-left: var(--ecx-gutter, 1.25rem); padding-right: var(--ecx-gutter, 1.25rem); }
.ecx-canvas-root.ecx-layout-constrained > :is(.ecx-nested, .ecx-cover, [data-type="columns"]):not(.ecx-align-wide, .ecx-align-full) { max-width: var(--ecx-canvas-col); }
:where(.ecx-canvas-root.ecx-template, .ecx-canvas-root.entry-content) > :is(.ecx-nested, .ecx-cover, [data-type="columns"]) { max-width: none; }
/* Khối "Rộng" / "Toàn trang" (align wide/full): bề rộng và lề âm do style.css của @ecomcx/ecomweb-content (như website), canvas chỉ bỏ giới hạn */
:where(.ecx-canvas-root.ecx-template, .ecx-canvas-root.entry-content) > :is(.ecx-align-wide, .ecx-align-full) { max-width: none; }
/* Lề tự căn giữa của khung soạn (.ecx-canvas-root > * margin auto) không được đè lề âm của khối rộng / toàn trang */
.ecx-canvas-root > :is(.ecx-align-wide, .ecx-align-full) { margin-left: calc((100% - var(--_w, 100%)) / 2); margin-right: calc((100% - var(--_w, 100%)) / 2); }
/* Soạn bài / trang trong khung của website (class entry-content do PostContent đặt): bề rộng cột do theme quyết định, không phải 760px của trình soạn */

.ecx-block { position: relative; scroll-margin: 80px; }
.ecx-block:focus { outline: none; }
.ecx-block:not([data-ecx-rich]):hover:not(:has(.ecx-block:hover)) { outline: 1px solid color-mix(in srgb, var(--ecx-ui) 40%, transparent); outline-offset: 3px; }
.ecx-block.is-selected { outline: 2px solid var(--ecx-ui) !important; outline-offset: 3px; }
/* Ô bảng đang chọn (một hoặc cả vùng): tô màu như bôi đen, không viền (viền ô chồng lên viền bảng) */
.ecx-block.is-selected:is([data-type="tableCell"], [data-type="tableHeader"]) { outline: none !important; box-shadow: inset 0 0 0 9999px color-mix(in srgb, var(--ecx-ui) 16%, transparent); }
.ecx-block.is-selected:is([data-type="tableCell"], [data-type="tableHeader"], [data-type="tableRow"])::after { display: none; }
/* Đang kéo bôi vùng ô: tắt bôi chữ của trình duyệt (chỉ tô ô) */
.ecx-cell-selecting, .ecx-cell-selecting * { user-select: none !important; -webkit-user-select: none !important; caret-color: transparent; }
/* Nhãn loại khối (chỉ khi chọn, khối cấp thường; khối lồng đã có .ecx-nested-label). Không đổi bố cục: absolute, không nhận chuột */
.ecx-block.is-selected:not(.ecx-nested):not(.ecx-column)[data-type]::after { content: attr(data-ecx-title); position: absolute; left: -2px; top: -3px; transform: translateY(-100%); padding: 1px 8px; border-radius: 4px 4px 0 0; background: var(--ecx-ui); color: #fff; font: 600 11px/1.7 var(--ecx-ui-font); letter-spacing: 0; text-transform: none; white-space: nowrap; pointer-events: none; z-index: 5; }
.ecx-block.is-selected[data-ecx-title=""]::after { content: none; }
.ecx-block.is-selected.ecx-nested { outline-color: var(--ecx-ui-nested) !important; }
[data-ecx-rich] { outline: none; white-space: pre-wrap; word-wrap: break-word; caret-color: currentColor; min-height: 1em; }
[data-ecx-rich]:focus { outline: none; }
pre [data-ecx-rich], pre[data-ecx-rich] { white-space: pre-wrap; }
[data-ecx-rich][data-empty][data-placeholder]::before { content: attr(data-placeholder); opacity: .45; pointer-events: none; position: absolute; }
[data-ecx-rich][data-empty]:not([data-placeholder-always]):not(:focus)::before { content: none; }
[data-ecx-rich][data-empty] { position: relative; }
/* min(100%, …) = 0 trong khung co theo nội dung (nút) → dùng độ dài chữ gợi ý, chặn tràn bằng max-width */
/* Chỉ ô chữ dạng span (nút, nhãn…): đoạn văn trống KHÔNG đặt max-width — luật này ưu tiên cao hơn cột chữ của khung soạn,
   đoạn trống sẽ rộng hết khung và lệch khỏi cột (gõ chữ vào mới nhảy về) */
span[data-ecx-rich][data-empty][data-placeholder] { min-width: calc(var(--ecx-ph, 0) * .6em); max-width: 100%; }
span[data-ecx-rich][data-empty][data-placeholder] { display: inline-block; vertical-align: top; }
[data-ecx-rich][data-empty][data-placeholder] { min-width: 0; } /* ô lưới/flex trống không bị chữ gợi ý (nowrap) đẩy rộng hơn khung */
[data-ecx-rich][data-empty][data-placeholder]::before { white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.ProseMirror-hideselection *::selection { background: transparent; }
.ProseMirror-selectednode { outline: 2px solid var(--ecx-ui); }
.ecx-inline-atom { padding: 0 .25em; border-radius: 4px; background: var(--ecx-ui-soft); font-size: .85em; }

.ecx-block.is-locked { pointer-events: none; }
.ecx-block.is-locked .ecx-nested:not(.is-locked), .ecx-block.is-locked [data-ecx-editable-doc] { pointer-events: auto; }

.ecx-default-appender { cursor: text; color: #5d6a75; margin-top: 0; margin-bottom: 0; padding: .25em 0; } /* lề trái/phải auto như khối khác (thẳng cột chữ) */
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
.ecx-post-preview { opacity: .8; list-style: none; transition: opacity .15s ease; }
.ecx-post-preview:hover { opacity: 1; }
.ecx-preview-bar { height: 1em; margin: .5em 0; border-radius: 3px; background: color-mix(in srgb, currentColor 15%, transparent); }
.ecx-preview-bar.is-short { width: 60%; }

.ecx-drop-indicator { position: absolute; z-index: 50; background: var(--ecx-ui); border-radius: 2px; pointer-events: none; }
body.is-dragging, body.is-dragging * { cursor: grabbing !important; user-select: none !important; }
.ecx-block.is-dragging-source { opacity: .35; }

/* Làm nổi khối đang sửa: các khối cấp cao nhất khác mờ đi */
.is-spotlight > .ecx-block:not(.is-selected):not(.is-editing):not(:has(.is-selected, .is-editing)) { opacity: .3; transition: opacity .2s ease; }
/* Ô tiêu đề bài trong khung soạn: kiểu chữ của h1 theme */
.ecx-doc-title { margin-top: 0; }
.ecx-doc-title-input { display: block; width: 100%; margin: 0; padding: 0; border: 0; outline: none; resize: none; overflow: hidden; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; line-height: inherit; text-align: inherit; }
.ecx-doc-title-input::placeholder { color: inherit; opacity: .35; }
/* Theme thường tạo kiểu mọi ô nhập (textarea { border; padding } textarea:focus { outline }) — ô tiêu đề không được mang khung ô nhập */
.ecx-doc-title .ecx-doc-title-input, .ecx-doc-title .ecx-doc-title-input:focus { border: 0; border-radius: 0; outline: none; box-shadow: none; padding: 0; background: transparent; min-height: 0; }
.ecx-col-handles { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
.ecx-col-handle { position: absolute; width: 12px; margin-left: -6px; cursor: col-resize; pointer-events: auto; touch-action: none; }
.ecx-col-handle::after { content: ""; position: absolute; left: 5px; top: 0; bottom: 0; width: 2px; background: var(--ecx-ui); opacity: .35; border-radius: 1px; }
.ecx-col-handle:hover::after { opacity: 1; }
.ecx-image-handle { position: absolute; z-index: 6; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; background: var(--ecx-ui); cursor: nwse-resize; touch-action: none; box-shadow: 0 0 0 1px var(--ecx-ui); }

.ecx-block.ecx-frame-content { outline: 1px dashed color-mix(in srgb, var(--ecx-ui) 50%, transparent); outline-offset: 4px; pointer-events: auto; }
.ecx-block.is-locked:not(.ecx-frame-content) { cursor: default; }

[data-ecx-bound] { cursor: default; }
.ecx-bound { box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--ecx-ui) 55%, transparent); }
.ecx-bound.is-empty { color: color-mix(in srgb, currentColor 55%, transparent); font-style: italic; }
.ecx-bound-media { display: flex; align-items: center; justify-content: center; min-height: 160px; border: 1px dashed color-mix(in srgb, var(--ecx-ui) 60%, transparent); border-radius: 8px; box-shadow: none; }
img[data-ecx-bound] { outline: 2px solid color-mix(in srgb, var(--ecx-ui) 45%, transparent); outline-offset: -2px; }

.is-zoomed-out .ecx-block, .is-zoomed-out [data-ecx-rich] { cursor: pointer; caret-color: transparent; }
.is-zoomed-out .ecx-appender, .is-zoomed-out .ecx-default-appender, .is-zoomed-out .ecx-image-handle, .is-zoomed-out .ecx-col-handles { display: none !important; }
.is-zoomed-out .ecx-block.is-selected { outline-width: 4px; }

::highlight(ecx-range) { background-color: color-mix(in srgb, var(--ecx-ui) 28%, transparent); }
.has-text-range [data-ecx-rich] { user-select: none; -webkit-user-select: none; caret-color: transparent; }
.ecx-block.is-in-range { background: color-mix(in srgb, var(--ecx-ui) 14%, transparent); outline: 2px solid color-mix(in srgb, var(--ecx-ui) 45%, transparent); }

.ecx-post.is-active { outline: 1px dashed color-mix(in srgb, var(--ecx-ui) 55%, transparent); outline-offset: 6px; }
.ecx-post-preview { cursor: pointer; }
.ecx-post-preview:hover { outline: 1px solid color-mix(in srgb, var(--ecx-ui) 35%, transparent); outline-offset: 6px; }
.ecx-post-preview .ecx-block { pointer-events: none; }
.ecx-post-none { font-size: .85em; opacity: .7; }

/* Chỉ trong trình soạn: khối "vô hình" trên website vẫn thấy được để chọn / sửa */
.ecx-spacer { background: repeating-linear-gradient(-45deg, transparent 0 6px, color-mix(in srgb, var(--ecx-ui) 8%, transparent) 6px 7px); }
.ecx-block.ecx-column:not(.is-selected):not(.is-editing) { outline: 1px dashed color-mix(in srgb, currentColor 16%, transparent); outline-offset: -1px; min-height: 48px; }
.ecx-block.ecx-column:not(.is-selected):hover { outline-color: color-mix(in srgb, var(--ecx-ui) 55%, transparent); }
.ecx-media-placeholder.is-drop-target { outline: 2px dashed var(--ecx-ui); background: color-mix(in srgb, var(--ecx-ui) 6%, transparent); }
.ecx-placeholder-hint { margin: 4px 0 10px; font: 13px/1.5 var(--ecx-ui-font); opacity: .75; }
.ecx-media-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.ecx-media-actions form { display: flex; gap: 6px; margin-top: 8px; }
.ecx-media-actions form .ecx-input { flex: 1; }
.ecx-media-error { color: #b42318; font: 12px var(--ecx-ui-font); margin: 6px 0 0; }
.ecx-cover-placeholder { min-height: 220px; }
/* Bảng: ô trống vẫn thấy lưới + có chỗ bấm dù theme bỏ viền bảng (chỉ trong trình soạn — outline không đổi bố cục) */
.ecx-canvas-root .ecx-table table { width: 100%; border-collapse: collapse; }
.ecx-canvas-root .ecx-table :is(td, th) { min-width: 3em; height: 2.5em; outline: 1px dashed color-mix(in srgb, currentColor 22%, transparent); outline-offset: -1px; }
/* Tabs: thanh tiêu đề luôn thấy và bấm được (thẻ đang ẩn: display none inline) */
.ecx-canvas-root .ecx-tabs-list { display: flex; flex-wrap: wrap; min-height: 2.5em; }
.ecx-canvas-root .ecx-tab-button { cursor: pointer; }
.ecx-canvas-root .ecx-tab-button [data-ecx-rich] { display: inline-block; min-width: 3em; }
.ecx-btn-ghost { background: none; border-color: transparent; }
/* tay nắm cột / nút thêm cột định vị theo khối cột (website không cần); nút nằm trong khối cột, góc dưới phải: không tràn khung canvas (thanh cuộn ngang) và không bị thanh công cụ nổi (ở trên khối đang chọn) che */
.ecx-canvas-root .ecx-columns { position: relative; }
.ecx-add-column { position: absolute; right: 4px; bottom: 4px; z-index: 7; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: #0f1e29; color: #fff; font: 600 18px/1 var(--ecx-ui-font); cursor: pointer; box-shadow: 0 2px 6px rgb(0 0 0 / .2); }
.ecx-add-column:hover { background: var(--ecx-ui); }
.is-zoomed-out .ecx-add-column { display: none; }
`;
