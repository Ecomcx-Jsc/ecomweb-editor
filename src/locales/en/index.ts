import type { vi } from "../vi";
import { v2 } from "./v2";
import { legacy } from "./legacy";
import { attrs } from "./attrs";
import { bindings } from "./bindings";
import { blockDesc } from "./block-desc";
import { blockTitles } from "./block-titles";
import { blocks } from "./blocks";
import { controls } from "./controls";
import { parts } from "./parts";
import { columns } from "./columns";
import { presets } from "./presets";
import { hints } from "./hints";
import { layout } from "./layout";
import { legacyBasic } from "./legacy-basic";
import { legacyDynamic } from "./legacy-dynamic";
import { motion } from "./motion";
import { background } from "./background";
import { blockStyle } from "./block-style";
import { patternLib } from "./pattern-lib";
import { patterns } from "./patterns";
import { shortcuts } from "./shortcuts";
import { placeholders } from "./placeholders";
import { library } from "./library";

/** Tiếng Anh: đủ khoá như vi/ (thiếu khoá là lỗi biên dịch) và là ngôn ngữ dự phòng của mọi ngôn ngữ khác. */
export const en: typeof vi = { v2, legacy, attrs, background, bindings, blockStyle, blockDesc, blockTitles, blocks, controls, columns, hints, parts, presets, layout, legacyBasic, legacyDynamic, motion, library, patternLib, patterns, placeholders, shortcuts };
