import { makeBlock, type BNode } from "./model";

/**
 * Luật cấu trúc: khối nào chứa được khối nào, khối nào phải có con. Sau mỗi thao tác store chạy `fixTree`
 * để cây luôn hợp lệ (giống "schema fitting" của ProseMirror) — thao tác (ops) nhờ vậy viết đơn giản.
 */
export interface StructureRule {
  /** Chỉ chứa các loại này; khối khác được bọc (wrapWith) hoặc bỏ ra ngoài. */
  allowedChildren?: readonly string[];
  /** Bọc khối con không hợp lệ bằng loại này (vd đoạn văn trong danh sách → listItem). */
  wrapChildrenWith?: string;
  /** Chỉ được nằm trong các loại này (vd column trong columns). */
  parents?: readonly string[];
  /** Khi nằm sai chỗ: bọc bằng loại này (vd listItem lạc ra ngoài → bulletList). */
  wrapSelfWith?: string;
  /** Phải có ít nhất một con: tạo con mặc định. */
  required?: () => BNode;
  /** Con đầu tiên phải là loại này (listItem bắt đầu bằng đoạn văn). */
  firstChild?: string;
  /** Không còn con → bỏ luôn khối (danh sách rỗng, nhóm nút rỗng). */
  removeWhenEmpty?: boolean;
}

const p = () => makeBlock("paragraph");
const RULES: Record<string, StructureRule> = {
  bulletList: { allowedChildren: ["listItem"], wrapChildrenWith: "listItem", removeWhenEmpty: true },
  orderedList: { allowedChildren: ["listItem"], wrapChildrenWith: "listItem", removeWhenEmpty: true },
  listItem: { parents: ["bulletList", "orderedList"], wrapSelfWith: "bulletList", required: p, firstChild: "paragraph" },
  taskList: { allowedChildren: ["taskItem"], wrapChildrenWith: "taskItem", removeWhenEmpty: true },
  taskItem: { parents: ["taskList"], wrapSelfWith: "taskList", required: p, firstChild: "paragraph" },
  columns: { allowedChildren: ["column"], wrapChildrenWith: "column", removeWhenEmpty: true },
  column: { parents: ["columns"], wrapSelfWith: "columns" },
  buttons: { allowedChildren: ["button"], removeWhenEmpty: true },
  button: { parents: ["buttons"], wrapSelfWith: "buttons" },
  // Bảng rỗng (vừa chèn, chưa chọn kích thước) giữ lại: trình soạn hỏi số cột / hàng, website không vẽ bảng không có hàng
  table: { allowedChildren: ["tableRow"], wrapChildrenWith: "tableRow" },
  tableRow: { parents: ["table"], allowedChildren: ["tableCell", "tableHeader"], wrapChildrenWith: "tableCell", removeWhenEmpty: true },
  tableCell: { parents: ["tableRow"], required: p },
  tableHeader: { parents: ["tableRow"], required: p },
};

/** Mục danh sách / việc chỉ nhận chữ và danh sách lồng: khối lớn (bảng, ảnh, nhóm…) chèn mới thì phải ra ngoài danh sách. */
export const leavesItem = (parentType: string | null | undefined, child: string) => (parentType === "listItem" || parentType === "taskItem") && !/^(paragraph|bulletList|orderedList|taskList)$/.test(child);

const extra = new Map<string, StructureRule>();
export function setStructureRule(type: string, rule: StructureRule | null) {
  if (rule) extra.set(type, rule);
  else extra.delete(type);
}
export const ruleOf = (type: string): StructureRule | undefined => extra.get(type) ?? RULES[type];

/** Khối `type` có được đặt trong `parentType` (null = cấp cao nhất) không. */
export function canContain(parentType: string | null, type: string): boolean {
  const self = ruleOf(type);
  if (self?.parents && (parentType == null || !self.parents.includes(parentType))) return false;
  if (parentType == null) return true;
  const rule = ruleOf(parentType);
  return !rule?.allowedChildren || rule.allowedChildren.includes(type);
}

function fixList(list: BNode[], parentType: string | null): BNode[] {
  let changed = false;
  const out: BNode[] = [];
  const parentRule = parentType ? ruleOf(parentType) : undefined;
  // Vỏ vừa tạo cho khối lạc chỗ trước đó — khối lạc chỗ liền sau vào chung vỏ
  let lastWrap: BNode | null = null;
  for (const b0 of list) {
    let b = b0;
    if (b.content) {
      const kids = fixChildren(b);
      if (kids !== b.content) { b = { ...b, content: kids }; changed = true; }
      if (!b.content!.length && ruleOf(b.type)?.removeWhenEmpty) { changed = true; continue; }
    }
    if (!canContain(parentType, b.type)) {
      changed = true;
      const self = ruleOf(b.type);
      if (parentRule?.wrapChildrenWith && canContain(parentType, parentRule.wrapChildrenWith)) {
        out.push(...fixList([makeBlock(parentRule.wrapChildrenWith, {}, [b])], parentType));
      } else if (self?.wrapSelfWith && canContain(parentType, self.wrapSelfWith)) {
        // Gộp các khối lạc chỗ liên tiếp vào cùng một vỏ (ba listItem → một bulletList)
        if (lastWrap && lastWrap.type === self.wrapSelfWith) { lastWrap.content = [...lastWrap.content!, b]; continue; }
        lastWrap = makeBlock(self.wrapSelfWith, {}, [b]);
        out.push(lastWrap);
        continue;
      } else if (b.content?.length) {
        // Không bọc được: đưa con ra ngoài (column lạc ra cấp cao nhất không có columns bọc)
        out.push(...fixList(b.content, parentType));
      }
      // Khối nguyên không đặt được ở đây: bỏ
      lastWrap = null;
      continue;
    }
    lastWrap = null;
    out.push(b);
  }
  return changed ? out : list;
}

function fixChildren(b: BNode): BNode[] {
  const rule = ruleOf(b.type);
  let kids = fixList(b.content!, b.type);
  if (rule?.firstChild && kids.length && kids[0].type !== rule.firstChild) kids = [makeBlock(rule.firstChild), ...kids];
  if (rule?.required && !kids.length) kids = [rule.required()];
  return kids;
}

/** Sửa cây cho hợp lệ (giữ nguyên tham chiếu nếu không có gì sai). */
export function fixTree(blocks: BNode[]): BNode[] {
  return fixList(blocks, null);
}
