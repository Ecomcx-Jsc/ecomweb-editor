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
.ecx-block.is-selected.ecx-nested { outline-color: var(--ecx-ui-nested) !important; }
[data-ecx-rich] { outline: none; white-space: pre-wrap; word-wrap: break-word; caret-color: currentColor; min-height: 1em; }
[data-ecx-rich]:focus { outline: none; }
pre [data-ecx-rich], pre[data-ecx-rich] { white-space: pre-wrap; }
/* Ô chữ rỗng luôn hiện gợi ý theo vai trò (cả khi chưa chọn khối), cỡ chữ = cỡ chữ thật của ô; độ đậm .7 giữ tương phản ≥ 4.5:1 với màu chữ của theme */
[data-ecx-rich][data-empty][data-placeholder]::before { content: attr(data-placeholder); opacity: .85; pointer-events: none; position: absolute; }
[data-ecx-rich][data-empty]:not([data-placeholder-always]):not(:focus)::before, [data-ecx-rich][contenteditable="false"][data-empty]::before { content: none; }
[data-ecx-rich][data-empty] { position: relative; }
/* min(100%, …) = 0 trong khung co theo nội dung (nút) → dùng độ dài chữ gợi ý, chặn tràn bằng max-width */
/* Chỉ ô chữ dạng span (nút, nhãn…): đoạn văn trống KHÔNG đặt max-width — luật này ưu tiên cao hơn cột chữ của khung soạn,
   đoạn trống sẽ rộng hết khung và lệch khỏi cột (gõ chữ vào mới nhảy về) */
span[data-ecx-rich][data-empty][data-placeholder] { min-width: calc(var(--ecx-ph, 0) * .6em); max-width: 100%; }
span[data-ecx-rich][data-empty][data-placeholder] { display: inline-block; vertical-align: top; }
[data-ecx-rich][data-empty][data-placeholder] { min-width: 0; } /* ô lưới/flex trống không bị chữ gợi ý (nowrap) đẩy rộng hơn khung */
[data-ecx-rich][data-empty][data-placeholder][contenteditable="true"] { opacity: 1 !important; } /* phần tử vốn mờ (chức danh, chú thích): gợi ý không mờ chồng mờ */
.ecx-button [data-ecx-rich][data-empty][data-placeholder]::before { opacity: .8; font-style: normal; left: 0; right: 0; text-align: center; } /* chữ gợi ý trên nền màu nút: sáng vừa đủ tương phản, không nghiêng */
.ecx-button span[data-ecx-rich][data-empty][data-placeholder] { min-width: calc(var(--ecx-ph, 0) * .75em); } /* chữ đậm của nút rộng hơn chữ thường: chừa chỗ để gợi ý không bị cắt */
[data-ecx-rich][data-empty][data-placeholder] { flex: 1 1 8em; } /* trong hàng ngang (flex): ô trống không co về 0px (gợi ý là ::before absolute) */
[data-ecx-rich][data-empty][data-placeholder]::before { white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; left: 0; right: 0; } /* bám hai mép của ô (căn giữa / cỡ chữ lớn: không tràn ra ngoài khối) */
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
.ecx-variation-chooser { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); border-radius: 8px; font: 14px/1.4 var(--ecx-ui-font); }
.ecx-variation-title { font-weight: 600; text-transform: uppercase; letter-spacing: .04em; font-size: 12px; text-align: center; }
.ecx-variation-chooser .ecx-variations { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; max-width: 640px; width: 100%; margin: 0 auto; }
.ecx-variation-chooser .ecx-variation { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 8px 8px; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 8px; background: transparent; color: inherit; font: 12px/1.25 var(--ecx-ui-font); cursor: pointer; }
.ecx-variation-chooser .ecx-variation:hover, .ecx-variation-chooser .ecx-variation:focus-visible { border-color: var(--ecx-ui); outline: none; box-shadow: 0 0 0 1px var(--ecx-ui); }
.ecx-variation-chooser .ecx-vthumb { width: 100%; height: auto; }
.ecx-variation-chooser .ecx-vthumb rect { fill: color-mix(in srgb, currentColor 18%, transparent); }
.ecx-variation-chooser .ecx-vthumb rect.is-box, .ecx-variation-chooser .ecx-vthumb polygon.is-box { fill: transparent; stroke: color-mix(in srgb, currentColor 32%, transparent); stroke-width: 1.2; }
.ecx-variation-chooser .ecx-vthumb .is-accent { fill: var(--ecx-ui); stroke: none; }
.ecx-variation-chooser .ecx-vthumb rect.is-box.is-accent { fill: transparent; stroke: var(--ecx-ui); }
.ecx-variation-chooser .ecx-vthumb path.is-line { fill: none; stroke: var(--ecx-ui); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.ecx-variation-skip { align-self: center; border: 0; background: none; color: inherit; opacity: .7; text-decoration: underline; font: 13px var(--ecx-ui-font); cursor: pointer; }
.ecx-variation-skip:hover { opacity: 1; }
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
/* Tô vùng đệm (trong) / lề (ngoài) khi rê ô Đệm / Lề ở bảng bên phải */
.ecx-spacing-viz { position: fixed; z-index: 60; pointer-events: none; display: grid; place-items: center; overflow: hidden; background: rgb(74 163 120 / .22); box-shadow: inset 0 0 0 1px rgb(46 125 90 / .45); }
.ecx-spacing-viz.is-margin { background: rgb(232 137 12 / .18); box-shadow: inset 0 0 0 1px rgb(184 104 0 / .45); }
.ecx-spacing-viz span { padding: 1px 6px; border-radius: 4px; background: rgb(255 255 255 / .9); color: #1f6b47; font: 600 11px/1.4 system-ui, sans-serif; white-space: nowrap; }
.ecx-spacing-viz.is-margin span { color: #8a4b00; }
/* Khối chứa sắp nhận khối thả: nền + viền nhẹ, trễ 100ms để lướt chuột qua không nháy */
.ecx-block.is-drop-parent { outline: 1px dashed color-mix(in srgb, var(--ecx-ui) 55%, transparent); outline-offset: 2px; box-shadow: inset 0 0 0 100vmax color-mix(in srgb, var(--ecx-ui) 6%, transparent); transition: outline-color .1s linear .1s, box-shadow .1s linear .1s; }
@media (prefers-reduced-motion: reduce) { .ecx-block.is-drop-parent { transition: none; } }

/* Làm nổi khối đang sửa: các khối cấp cao nhất khác mờ đi */
.is-spotlight > .ecx-block:not(.is-selected):not(.is-editing):not(:has(.is-selected, .is-editing)) { opacity: .3; transition: opacity .2s ease; }
/* Ô tiêu đề bài trong khung soạn: kiểu chữ của h1 theme */
.ecx-doc-title { margin-top: 0; }
.ecx-doc-title-input { display: block; width: 100%; margin: 0; padding: 0; border: 0; outline: none; resize: none; overflow: hidden; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; line-height: inherit; text-align: inherit; }
.ecx-doc-title-input::placeholder { color: inherit; opacity: .35; }
/* Theme thường tạo kiểu mọi ô nhập (textarea { border; padding } textarea:focus { outline }) — ô tiêu đề không được mang khung ô nhập */
.ecx-doc-title .ecx-doc-title-input, .ecx-doc-title .ecx-doc-title-input:focus { border: 0; border-radius: 0; outline: none; box-shadow: none; padding: 0; background: transparent; min-height: 0; }
.ecx-col-handles { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
/* Dải kéo đệm trên / dưới của khối bố cục đang chọn */
:where(.ecx-block.is-selected:has(> .ecx-pad-handles)) { position: relative; }
/* Khối bố cục đang chọn: chỗ trống nắm được để kéo đổi chỗ; khối con / chữ giữ con trỏ thường */
.ecx-block[data-ecx-grab] { cursor: grab; }
.ecx-block[data-ecx-grab] .ecx-block, .ecx-block[data-ecx-grab] [data-ecx-rich] { cursor: auto; }
.ecx-pad-handles { position: absolute; inset: 0; max-width: none; margin: 0; pointer-events: none; z-index: 7; }
:where(.ecx-block.is-selected:has(> .ecx-cw-handles)) { position: relative; }
.ecx-cw-handles { position: absolute; inset: 0; max-width: none; margin: 0; pointer-events: none; z-index: 8; }
.ecx-cw-guide { position: absolute; top: 0; bottom: 0; border-left: 1px dashed var(--ecx-ui); border-right: 1px dashed var(--ecx-ui); background: color-mix(in srgb, var(--ecx-ui) 6%, transparent); pointer-events: none; opacity: .7; }
.ecx-cw-guide.is-dragging { background: color-mix(in srgb, var(--ecx-ui) 14%, transparent); opacity: 1; }
.ecx-cw-handle { position: absolute; top: 50%; width: 10px; height: 44px; margin: -22px 0 0 4px; border-radius: 6px; background: var(--ecx-ui); box-shadow: 0 0 0 2px #fff; cursor: ew-resize; pointer-events: auto; opacity: .55; touch-action: none; }
.ecx-cw-handle.is-left { margin-left: -14px; }
.ecx-cw-handle:hover, .ecx-cw-handle.is-dragging { opacity: 1; }
.ecx-cw-tip { position: absolute; top: -28px; left: 50%; transform: translateX(-50%); padding: 2px 8px; border-radius: 4px; background: var(--ecx-ui); color: #fff; font: 600 12px/1.4 system-ui, sans-serif; white-space: nowrap; pointer-events: none; }
.ecx-pad-handle { position: absolute; left: 0; width: min(40%, 320px); height: 12px; cursor: ns-resize; pointer-events: auto; touch-action: none; }
/* vắt qua mép: khối không đệm thì tay nắm chỉ lấn 6px, không che chữ của khối con */
.ecx-pad-handle.is-top { top: -6px; }
.ecx-pad-handle.is-bottom { bottom: -6px; }
.ecx-pad-handle::after { content: ""; position: absolute; left: 16px; width: 36px; height: 4px; border-radius: 3px; background: var(--ecx-ui); opacity: 0; transition: opacity .1s linear; }
.ecx-pad-handle.is-top::after { top: 4px; }
.ecx-pad-handle.is-bottom::after { bottom: 4px; }
.ecx-pad-handle:hover::after, .ecx-pad-handle.is-dragging::after { opacity: 1; }
/* Vùng kéo đệm / lề của khối bố cục đang chọn: rộng hết khối, cao bằng giá trị thật — kéo ở đâu trong vùng cũng được */
.ecx-pad-zone { position: absolute; left: 0; right: 0; cursor: ns-resize; pointer-events: auto; touch-action: none; }
/* vạch kéo ở 1/4 bề rộng: giữa mép dưới là nút "+ Thêm section" */
.ecx-pad-zone::after { content: ""; position: absolute; left: 25%; width: 36px; height: 4px; margin-left: -18px; border-radius: 3px; background: var(--ecx-ui); opacity: 0; transition: opacity .1s linear; }
.ecx-pad-zone.is-top::after { top: calc(50% - 2px); }
.ecx-pad-zone.is-bottom::after { bottom: calc(50% - 2px); }
.ecx-pad-zone:hover::after, .ecx-pad-zone.is-dragging::after { opacity: 1; }
/* Hai cạnh trái / phải: dải đứng, kéo ngang */
.ecx-pad-zone.is-left, .ecx-pad-zone.is-right { top: 0; bottom: 0; left: auto; right: auto; cursor: ew-resize; }
.ecx-pad-zone.is-left { left: 0; } .ecx-pad-zone.is-right { right: 0; }
.ecx-pad-zone.is-left::after, .ecx-pad-zone.is-right::after { top: 50%; left: 50%; width: 4px; height: 36px; margin: -18px 0 0 -2px; }
.ecx-col-handle { position: absolute; width: 12px; margin-left: -6px; cursor: col-resize; pointer-events: auto; touch-action: none; }
.ecx-col-handle.is-dragging::before, .ecx-col-handle.is-dragging::after { position: absolute; top: 8px; padding: 1px 6px; border-radius: 4px; background: var(--ecx-ui); color: #fff; font: 600 11px/1.5 system-ui, sans-serif; white-space: nowrap; pointer-events: none; }
.ecx-col-handle.is-dragging::before { content: attr(data-left); right: 14px; }
.ecx-col-handle.is-dragging::after { content: attr(data-right); left: 14px; width: auto; bottom: auto; opacity: 1; } /* ghi đè vạch 2px của ::after thường: nhãn % bên phải không bị cắt */
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
.ecx-block.ecx-column:not(.is-selected):not(.is-editing) { outline: 1px dashed color-mix(in srgb, currentColor 16%, transparent); outline-offset: -1px; }
/* Chỉ cột TRỐNG mới cần chỗ để thả / thêm khối; cột có nội dung cao đúng như ngoài website */
.ecx-block.ecx-column:not(.is-selected):not(.is-editing):not(:has(> [data-ecx-block])) { min-height: 96px; }
/* Nút + cuối khối chứa (Cột, Nhóm, Tab, Hộp lưu ý): hiện khi rê chuột vào khối trong cùng / khi đang chọn hoặc gõ trong khối */
.ecx-tail-appender { display: none; align-items: center; justify-content: center; width: 100%; height: 26px; margin: 6px 0 0; padding: 0; border: 1px dashed color-mix(in srgb, var(--ecx-ui) 55%, transparent); border-radius: 6px; background: transparent; color: var(--ecx-ui); font: 600 16px/1 var(--ecx-ui-font); cursor: pointer; opacity: 0; pointer-events: none; transition: opacity .12s ease; }
.ecx-tail-appender:hover { background: color-mix(in srgb, var(--ecx-ui) 8%, transparent); border-style: solid; }
.ecx-block:hover:not(:has(.ecx-block:hover > .ecx-tail-appender)) > .ecx-tail-appender, .ecx-block.is-selected > .ecx-tail-appender, .ecx-block:has(> * > .is-editing, > .is-editing, > .is-selected) > .ecx-tail-appender { display: flex; opacity: 1; pointer-events: auto; }
.is-zoomed-out .ecx-tail-appender, [data-ecx-preview] .ecx-tail-appender { display: none !important; }
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
.ecx-canvas-root .ecx-tabs-list { min-height: 2.5em; }
.ecx-canvas-root .ecx-tab-button { cursor: pointer; }
.ecx-canvas-root .ecx-tab-button [data-ecx-rich] { display: inline-block; min-width: 3em; }
.ecx-btn-ghost { background: none; border-color: transparent; }
/* tay nắm cột / nút thêm cột định vị theo khối cột (website không cần); nút nằm trong khối cột, góc dưới phải: không tràn khung canvas (thanh cuộn ngang) và không bị thanh công cụ nổi (ở trên khối đang chọn) che */
.ecx-canvas-root .ecx-columns { position: relative; }
.ecx-add-column { position: absolute; right: 4px; bottom: 4px; z-index: 7; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: #0f1e29; color: #fff; font: 600 18px/1 var(--ecx-ui-font); cursor: pointer; box-shadow: 0 2px 6px rgb(0 0 0 / .2); }
.ecx-add-column:hover { background: var(--ecx-ui); }
.is-zoomed-out .ecx-add-column { display: none; }

/* ===== Ô giữ chỗ (chỉ trình soạn; website không vẽ gì khi ô trống) ===== */
.ecx-ph-drop { align-items: center; justify-content: center; text-align: center; gap: 6px; min-height: 168px; padding: 24px 16px; box-sizing: border-box; border: 2px dashed #b8c2cc; border-radius: 10px; background: #f7f9fb; color: #33414d; transition: border-color .15s, color .15s, background .15s; }
.ecx-ph-drop.is-compact { min-height: 112px; padding: 14px 12px; }
.ecx-ph-drop:hover { border-color: var(--ecx-ui); color: var(--ecx-ui); }
.ecx-ph-drop.is-drop-target, .ecx-media-placeholder.is-drop-target { border-style: solid; border-color: var(--ecx-ui); background: color-mix(in srgb, var(--ecx-ui) 12%, #fff); color: var(--ecx-ui); outline: none; }
.ecx-ph-icon { width: 28px; height: 28px; }
.ecx-ph-title { display: inline-flex; align-items: center; justify-content: center; gap: 6px; margin: 0; font: 600 15px/1.4 var(--ecx-ui-font); }
.ecx-ph-drop .ecx-placeholder-hint { margin: 0 0 6px; color: #4a5763; opacity: 1; }
.ecx-ph-drop .ecx-media-actions { justify-content: center; }
.ecx-ph-drop .ecx-media-buttons { justify-content: center; }
.ecx-media-placeholder { color: #33414d; background: #f7f9fb; border-color: #b8c2cc; }
.ecx-ph-link, .ecx-ph-pick, .ecx-ph-choose, .ecx-ph-table, .ecx-ph-inline { border: 2px dashed #b8c2cc; border-radius: 10px; padding: 16px; gap: 8px; }
.ecx-ph-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; font: 13px/1.4 var(--ecx-ui-font); }
.ecx-ph-row .ecx-input { min-width: 0; }
.ecx-ph-link .ecx-ph-row .ecx-input { flex: 1 1 220px; }
.ecx-ph-label { font: 600 12px/1.4 var(--ecx-ui-font); color: #33414d; }
.ecx-ph-field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 140px; min-width: 0; }
.ecx-ph-field .ecx-input { height: 36px; flex: none; width: 100%; box-sizing: border-box; }
.ecx-ph-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.ecx-ph-fields .is-media { grid-column: 1 / -1; }
.ecx-ph-req { color: #b42318; }
.ecx-ph-thumb { position: relative; display: inline-block; }
.ecx-ph-thumb img { display: block; max-width: 160px; max-height: 120px; border-radius: 6px; }
.ecx-ph-thumb .ecx-tool { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / .3); cursor: pointer; }
.ecx-ph-auto { align-items: stretch; }
.ecx-ph-auto.is-missing, .ecx-ph-theme.is-missing { border: 2px solid #f59e0b; }
.ecx-ph-missing { margin: 0; padding: 6px 10px; border-radius: 6px; background: #fff4e5; color: #8a2c0d; font: 600 12px/1.4 var(--ecx-ui-font); }
.ecx-ph-missing.is-note { margin-top: 6px; }
.ecx-ph-badge { display: inline-flex; align-self: flex-start; align-items: center; padding: 2px 8px; border-radius: 999px; font: 600 11px/1.6 var(--ecx-ui-font); }
.ecx-ph-badge.is-missing { background: #fff4e5; color: #8a2c0d; border: 1px solid #f59e0b; }
.ecx-ph-theme { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px; border-radius: 8px; background: #fffaf3; color: #33414d; font: 13px/1.4 var(--ecx-ui-font); }
.ecx-featured-image .ecx-ph-theme { height: 100%; box-sizing: border-box; justify-content: center; align-items: center; text-align: center; }
.ecx-ph-choices { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.ecx-ph-choice { display: inline-flex; flex-direction: column; align-items: center; gap: 6px; min-width: 96px; padding: 14px 12px; border: 1px solid #c9d0d7; border-radius: 8px; background: #fff; color: #1f2d38; font: 600 13px var(--ecx-ui-font); cursor: pointer; }
.ecx-ph-choice:hover, .ecx-ph-choice:focus-visible { border-color: var(--ecx-ui); color: var(--ecx-ui); }
.ecx-ph-choice .ecx-icon { width: 24px; height: 24px; }
.ecx-ph-choose { align-items: center; text-align: center; }
/* Lưới chọn bố cục cột khi vừa chèn Bộ cột: mỗi ô vẽ tỉ lệ các cột */
.ecx-col-layouts { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; width: 100%; max-width: 640px; }
.ecx-col-layout { display: flex; gap: 3px; height: 44px; padding: 6px; border: 1px solid #c9d0d7; border-radius: 6px; background: #fff; cursor: pointer; }
.ecx-col-layout span { flex-basis: 0; border-radius: 2px; background: #c3ccd5; }
.ecx-col-layout:hover, .ecx-col-layout:focus-visible { border-color: var(--ecx-ui); outline: none; }
.ecx-col-layout:hover span, .ecx-col-layout:focus-visible span { background: var(--ecx-ui); }
.ecx-ph-skip { border: 0; background: none; padding: 2px 4px; color: #4a5a68; font: 13px var(--ecx-ui-font); text-decoration: underline; cursor: pointer; }
.ecx-ph-skip:hover { color: var(--ecx-ui); }
/* Ô gõ của plugin / icon list: kế thừa phông + cỡ chữ của chỗ đặt ô */
.ecx-ph-text { box-sizing: border-box; width: 100%; min-width: 4em; margin: 0; padding: 0 0 1px; border: 0; border-bottom: 1px dashed color-mix(in srgb, currentColor 35%, transparent); border-radius: 0; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; line-height: inherit; resize: vertical; outline: none; field-sizing: content; }
.ecx-icon-list .ecx-ph-text { height: 1lh; padding-bottom: 0; } /* hàng danh sách cao bằng dòng chữ ngoài website */
.ecx-ph-text::placeholder { color: inherit; opacity: .85; }
.ecx-ph-text:focus { border-bottom-color: var(--ecx-ui); }
.ecx-ph-field .ecx-ph-text.ecx-input { border: 1px solid #c9d0d7; border-radius: 6px; padding: 6px 8px; height: auto; min-height: 36px; background: #fff; color: #1f2d38; font: 14px/1.4 var(--ecx-ui-font); }
.ecx-ph-field .ecx-ph-text::placeholder { color: #5b6873; opacity: 1; }
/* Nút "+ Thêm khối" giữa khối chứa trống, "+ Thêm …" cuối danh sách */
.ecx-appender { gap: 6px; min-height: 56px; border: 2px dashed color-mix(in srgb, currentColor 35%, transparent); border-radius: 8px; font: 600 14px/1 var(--ecx-ui-font); opacity: .85; }
.ecx-appender .ecx-icon { width: 18px; height: 18px; }
.ecx-add-item { display: inline-flex; align-items: center; gap: 4px; margin: 6px 0 0; padding: 6px 10px; border: 1px dashed color-mix(in srgb, currentColor 40%, transparent); border-radius: 6px; background: transparent; color: inherit; font: 600 13px/1.2 var(--ecx-ui-font); cursor: pointer; opacity: .85; }
.ecx-add-item:hover, .ecx-add-item:focus-visible { opacity: 1; border-color: var(--ecx-ui); color: var(--ecx-ui); }
.ecx-tabs-list .ecx-add-item { margin: 0 0 0 8px; align-self: center; }
/* Thanh chuyển slide của carousel (chỉ trên khung soạn) */
.ecx-carousel-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 6px 0 0; font: 600 12px/1 var(--ecx-ui-font); user-select: none; }
.ecx-carousel-nav:empty { display: none; }
.ecx-carousel-nav .ecx-add-item { margin: 0 0 0 8px; }
.ecx-carousel-nav button { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; padding: 0 6px; border: 1px solid #c9d0d7; border-radius: 6px; background: #fff; color: #1f2d38; font: inherit; cursor: pointer; }
.ecx-carousel-nav button[aria-current="true"] { border-color: var(--ecx-ui); background: var(--ecx-ui); color: #fff; }
.ecx-carousel-nav button:disabled { opacity: .4; cursor: default; }
.ecx-carousel-nav .ecx-icon { width: 16px; height: 16px; }
[data-ecx-preview] .ecx-add-item, [data-ecx-preview] .ecx-carousel-nav, [data-ecx-preview] .ecx-countdown-setup, [data-ecx-preview] .ph-list-add { display: none !important; }
.ecx-icon-list > li.is-item-active { outline: 2px solid var(--ecx-ui); outline-offset: 2px; border-radius: 4px; }
.ecx-countdown-setup { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 10px; padding: 8px 10px; border: 1px dashed color-mix(in srgb, currentColor 25%, transparent); border-radius: 8px; font: 12px/1.3 var(--ecx-ui-font); }
.ecx-countdown-setup .ecx-ph-row { display: flex; align-items: center; gap: 8px; margin: 0; }
.ecx-countdown-setup .ecx-input { height: 30px; }
.ecx-carousel-nav .ecx-carousel-del { margin-left: 4px; color: #b42318; }
.ecx-carousel-nav .ecx-carousel-count { margin-left: auto; opacity: .6; font-weight: 500; }
.ecx-carousel-nav { min-width: 0; padding-top: 4px; }
/* Mỗi slide hiện thành một khung riêng trên khung soạn (website không vẽ khung này). Slide nào cũng nằm thật trong track cuộn ngang */
.ecx-carousel { margin-top: 0; margin-bottom: 0; } /* chỉ trên / dưới: lề trái / phải tự động giữ Slider nằm giữa cột như website */
.ecx-carousel-track { scroll-snap-type: none; } /* khung soạn: không bám mép — bám mép giằng co với con trỏ khi gõ và với lệnh cuộn tới slide */
.ecx-carousel-track > [data-ecx-block][data-type="group"] { min-height: 140px; padding: 20px; border: 1px dashed color-mix(in srgb, currentColor 28%, transparent); border-radius: 8px; box-sizing: border-box; }
/* Popup khi soạn: nút mở ở trên, nội dung popup luôn mở trong khung nét đứt có nhãn */
.ecx-popup-frame { position: relative; margin-top: 10px; padding: 26px 16px 12px; border: 1px dashed color-mix(in srgb, currentColor 32%, transparent); border-radius: 10px; }
.ecx-popup-frame-label { position: absolute; top: 6px; left: 12px; font: 600 11px/1 system-ui, sans-serif; letter-spacing: .02em; text-transform: uppercase; opacity: .55; user-select: none; }
.ecx-countdown-setup [role="radio"] { font: 500 13px/1 system-ui, sans-serif; padding: 8px 12px; border-radius: 6px; border: 1px solid color-mix(in srgb, currentColor 25%, transparent); background: transparent; color: inherit; cursor: pointer; }
.ecx-countdown-setup [role="radio"][aria-checked="true"] { background: var(--ecx-color-primary, #1a597b); border-color: transparent; color: white; }
.ecx-countdown-setup .ecx-ph-inline-field { display: inline-flex; align-items: center; gap: 8px; margin-right: 12px; }
/* Tiêu đề có chữ gõ: khung soạn hiện từ đầu tiên (website gõ lần lượt các từ) — vẽ bằng ::after, không chen vào ô sửa chữ */
[data-ecx-typed]::after { content: " " attr(data-ecx-typed); color: var(--ecx-typed-color, inherit); border-right: .08em solid currentColor; padding-right: .04em; }
.ecx-popup-trigger-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ecx-popup-preview-btn { font: 500 12px/1 system-ui, sans-serif; padding: 6px 10px; border-radius: 6px; border: 1px solid color-mix(in srgb, currentColor 28%, transparent); background: transparent; color: inherit; cursor: pointer; opacity: .75; }
.ecx-popup-preview-btn:hover { opacity: 1; }
.ecx-popup-preview-close { position: sticky; float: right; top: 0; margin: -1.25rem -1.25rem 0 0; width: 28px; height: 28px; border: 0; border-radius: 999px; background: #111827; color: white; font: 400 18px/1 system-ui; cursor: pointer; }
/* Xem thử: khung nội dung thành hộp thoại giữa màn hình với nền tối như trên website (vẫn sửa được các khối bên trong) */
.ecx-popup.is-previewing .ecx-popup-frame { --_w: 40rem; position: fixed; z-index: 60; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(var(--_w), calc(100% - 2rem)); max-height: 80vh; overflow: auto; box-sizing: border-box; padding: 2rem; border: 0; border-radius: 12px; background: var(--ecx-color-background, white); box-shadow: 0 0 0 100vmax rgb(0 0 0 / var(--ecx-popup-dim, .6)), 0 24px 64px rgb(0 0 0 / .3); }
.ecx-popup.is-previewing.is-size-sm .ecx-popup-frame { --_w: 28rem; }
.ecx-popup.is-previewing.is-size-lg .ecx-popup-frame { --_w: 56rem; }
.ecx-popup.is-previewing.is-size-xl .ecx-popup-frame { --_w: 72rem; }
.ecx-popup.is-previewing .ecx-popup-frame-label { display: none; }
.ecx-popup.is-previewing .ecx-popup-preview-btn { display: none; }

/* Image Overlay chưa có ảnh: ô chọn ảnh ở trên, chữ nằm dưới (không phủ lên ô chọn ảnh) và dùng màu chữ của trang để đọc được */
.ecx-image-overlay:not(:has(img)) { aspect-ratio: auto; background: none; color: inherit; overflow: visible; border-radius: 0; }
.ecx-image-overlay:not(:has(img)) .ecx-image-overlay-media { position: static; }
.ecx-image-overlay:not(:has(img)) .ecx-image-overlay-tint { display: none; }
.ecx-image-overlay:not(:has(img)) .ecx-image-overlay-body { position: static; padding: 10px 4px 0; align-items: center; text-align: center; }
.ecx-image-overlay:not(:has(img)) .ecx-image-overlay-body::before { display: none; }

/* Ảnh phủ chữ khi soạn: chữ luôn hiện rõ và gõ được (website chỉ hiện khi rê); khối rỗng vẫn có khung cao để thấy */
[data-ecx-block][data-type="imageOverlay"] { min-height: 160px; }
[data-ecx-block][data-type="imageOverlay"] .ecx-image-overlay-body { pointer-events: auto; }
[data-ecx-block][data-type="imageOverlay"] :is(.ecx-image-overlay-title, .ecx-image-overlay-subtitle, .ecx-image-overlay-divider) { opacity: 1; transform: none; }
[data-ecx-block][data-type="imageOverlay"] .ecx-image-overlay-tint { opacity: max(var(--ecx-ov-rest, 0), .25); }
[data-ecx-block][data-type="imageOverlay"]:is(:hover, :focus-within) .ecx-image-overlay-tint { opacity: var(--ecx-ov-hover, .6); }
/* Slider có chiều cao riêng (tỉ lệ / tối thiểu): slide là nền đầy khung nên bỏ viền nét đứt và mức 140px dành cho thẻ trơn */
.ecx-carousel[data-height="min"] > .ecx-carousel-track > [data-ecx-block][data-type="group"] { min-height: var(--ecx-min-h, 24rem); border-style: none; border-radius: 0; }
.ecx-carousel[data-height="ratio"] > .ecx-carousel-track > [data-ecx-block][data-type="group"] { min-height: 0; aspect-ratio: var(--ecx-ratio, 16/9); border-style: none; border-radius: 0; }
.ecx-social .ecx-add-item, .ecx-social-add .ecx-add-item { margin: 0; }
.ecx-ph-list-add { list-style: none; }
.ecx-ph-list-add .ecx-add-item { margin-top: 2px; }
.ecx-gallery-add { grid-column: auto; min-height: 0; aspect-ratio: 1; }
.ecx-gallery-add .ecx-placeholder-hint { display: none; }
/* Ảnh giữ tỉ lệ (không cắt / masonry): ô "+" không còn là ô vuông khổng lồ, ảnh không bị kéo giãn theo hàng */
.ecx-gallery.is-natural { align-items: start; }
.ecx-gallery.is-natural .ecx-gallery-add { aspect-ratio: auto; min-height: 7rem; }
/* Mã nguồn: chọn ngôn ngữ trên khối; danh sách số: số bắt đầu */
.ecx-ph-corner { display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin: 0 0 6px; font: 12px var(--ecx-ui-font); white-space: normal; }
.ecx-ph-corner > label, .ecx-ph-corner > span { background: #fff; color: #33414d; border-radius: 4px; padding: 1px 6px; }
.ecx-ph-corner .ecx-input { width: auto; height: 28px; font-size: 12px; }
.ecx-ph-corner.is-list { list-style: none; justify-content: flex-start; margin: 6px 0 0; }
.ecx-ph-corner.is-list input { width: 72px; }
.ecx-ph-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.ecx-ph-digits { font: 600 28px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .05em; }
.ecx-ph-star { padding: 0 1px; border: 0; background: none; font: inherit; line-height: 1; cursor: pointer; }
.ecx-ph-star:hover { transform: scale(1.15); }
.ecx-ph-tabs { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; font: 600 12px var(--ecx-ui-font); }
.ecx-ph-tab { padding: 4px 10px; border: 1px solid #c9d0d7; border-radius: 6px; background: #fff; color: #33414d; font: 600 12px var(--ecx-ui-font); cursor: pointer; }
.ecx-ph-tab.is-active { background: var(--ecx-ui); border-color: var(--ecx-ui); color: #fff; }
.ecx-ph-tab:disabled { opacity: .5; cursor: default; }
.ecx-ph-inline-field { margin-top: 8px; justify-content: center; }
.ecx-ph-inline-field .ecx-input { width: 110px; flex: none; }
.ecx-ph-note { margin: .25rem 0; }
.ecx-ph-table .ecx-ph-field { flex: 0 1 110px; }
/* Khoảng trống: sọc mờ + kích thước; đường kẻ: vùng bấm cao ≥ 40px (không đổi bố cục) */
/* Chiều cao thật như website (không độn min-height); vùng bấm rộng thêm bằng ::before để spacer thấp vẫn chọn được */
.ecx-spacer[data-ecx-size] { position: relative; display: flex; align-items: center; justify-content: center; }
.ecx-spacer[data-ecx-size]::before { content: ""; position: absolute; inset: -8px 0; }
.ecx-spacer[data-ecx-size]::after { position: relative; z-index: 1; content: attr(data-ecx-size); padding: 2px 8px; border-radius: 4px; background: rgb(255 255 255 / .85); color: #33414d; font: 12px/1.4 var(--ecx-ui-font); opacity: 0; transition: opacity .15s; pointer-events: none; }
.ecx-spacer[data-ecx-size]:hover::after, .ecx-spacer.is-selected[data-ecx-size]::after { opacity: 1; }
hr.ecx-block { position: relative; overflow: visible; }
hr.ecx-block::before { content: ""; position: absolute; left: 0; right: 0; top: -20px; bottom: -20px; }
`;

export const CONTAINER_LABEL_CSS = `
/* Khối chứa mà con phủ kín (Danh sách bài, Khuôn mỗi bài, Phần mẫu, Tabs…): rê chuột hiện nhãn ở góc trên trái, bấm nhãn = chọn khối chứa */
.ecx-canvas-root :where([data-ecx-label]:hover) { position: relative; }
.ecx-canvas-root [data-ecx-label]:hover:not(:has([data-ecx-label]:hover))::before {
  content: attr(data-ecx-label); position: absolute; top: 0; left: 0; z-index: 30; padding: 2px 8px; border-radius: 0 0 6px 0; background: var(--ecx-ui, #1a597b); color: #fff;
  font: 600 11px/18px var(--ecx-ui-font, system-ui); letter-spacing: .02em; cursor: pointer; pointer-events: auto; white-space: nowrap; }
/* Cột / Nhóm (con không phủ kín, chữ nằm sát góc trên trái): nhãn đặt NGAY TRÊN mép khối — không che chữ, không chặn bấm vào chữ */
.ecx-canvas-root [data-ecx-label]:is([data-type="column"], [data-type="group"], [data-type="buttons"]):hover:not(:has([data-ecx-label]:hover))::before { transform: translateY(-100%); border-radius: 6px 6px 0 0; }
`;
