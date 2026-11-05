/**
 * Chữ giao diện tiếng Việt, mỗi nhóm (namespace) một file. Thêm ngôn ngữ mới:
 *   1. sao chép thư mục `vi/` thành `xx/`, dịch giá trị trong từng file (khoá thiếu tự dùng tiếng Anh; nhóm nào chưa dịch thì bỏ file);
 *   2. `registerLocale("xx", xx)` ở ứng dụng hoặc plugin — không cần sửa mã của trình soạn.
 * Thêm chữ mới: thêm vào CẢ vi/ và en/ (en/ bị kiểm đủ khoá lúc biên dịch, test/i18n.test.ts kiểm vi khớp en).
 */
import { v2 } from "./v2";
import { legacy } from "./legacy";
import { attrs } from "./attrs";
import { bindings } from "./bindings";
import { blockDesc } from "./block-desc";
import { blockTitles } from "./block-titles";
import { blocks } from "./blocks";
import { controls } from "./controls";
import { hints } from "./hints";
import { layout } from "./layout";
import { legacyBasic } from "./legacy-basic";
import { legacyDynamic } from "./legacy-dynamic";
import { motion } from "./motion";
import { patternLib } from "./pattern-lib";
import { patterns } from "./patterns";
import { shortcuts } from "./shortcuts";

export const vi = { v2, legacy, attrs, bindings, blockDesc, blockTitles, blocks, controls, hints, layout, legacyBasic, legacyDynamic, motion, patternLib, patterns, shortcuts };
