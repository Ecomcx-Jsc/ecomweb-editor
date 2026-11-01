import type { BNode } from "./model";

/**
 * Thao tác thuần trên cây khối: không sửa cây cũ, chỉ chép những nhánh bị đổi (chia sẻ phần còn lại) —
 * nên lịch sử hoàn tác giữ được nhiều bản chụp rẻ, React so sánh tham chiếu để vẽ lại đúng khối đổi.
 */
export interface Location {
  block: BNode;
  /** null = cấp cao nhất của tài liệu. */
  parent: BNode | null;
  index: number;
  /** Định danh các khối tổ tiên, từ ngoài vào trong. */
  ancestors: string[];
}

export function findBlock(blocks: readonly BNode[], id: string, parent: BNode | null = null, ancestors: string[] = []): Location | null {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.id === id) return { block: b, parent, index: i, ancestors };
    if (b.content) {
      const hit = findBlock(b.content, id, b, [...ancestors, b.id]);
      if (hit) return hit;
    }
  }
  return null;
}

export const childrenOf = (blocks: BNode[], parentId: string | null): BNode[] | null =>
  parentId == null ? blocks : findBlock(blocks, parentId)?.block.content ?? null;

/** Thay một khối (fn trả về khối mới, mảng khối, hoặc null = xoá). */
export function mapBlock(blocks: BNode[], id: string, fn: (b: BNode) => BNode | BNode[] | null): BNode[] {
  let changed = false;
  const walk = (list: BNode[]): BNode[] => {
    const out: BNode[] = [];
    for (const b of list) {
      if (!changed && b.id === id) {
        changed = true;
        const r = fn(b);
        if (Array.isArray(r)) out.push(...r);
        else if (r) out.push(r);
        continue;
      }
      if (!changed && b.content) {
        const kids = walk(b.content);
        out.push(kids === b.content ? b : { ...b, content: kids });
      } else out.push(b);
    }
    return changed ? out : list;
  };
  const res = walk(blocks);
  return changed ? res : blocks;
}

/** Thay danh sách con của `parentId` (null = cấp cao nhất). */
export function mapChildren(blocks: BNode[], parentId: string | null, fn: (kids: BNode[]) => BNode[]): BNode[] {
  if (parentId == null) return fn(blocks);
  return mapBlock(blocks, parentId, (p) => ({ ...p, content: fn(p.content ?? []) }));
}

export function updateBlock(blocks: BNode[], id: string, patch: Partial<Omit<BNode, "id">>): BNode[] {
  return mapBlock(blocks, id, (b) => ({ ...b, ...patch }));
}

export function setAttrs(blocks: BNode[], id: string, attrs: Record<string, unknown>): BNode[] {
  return mapBlock(blocks, id, (b) => {
    const next = { ...b.attrs };
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === "") delete next[k];
      else next[k] = v;
    }
    return { ...b, attrs: next };
  });
}

export function insertBlocks(blocks: BNode[], parentId: string | null, index: number, nodes: BNode[]): BNode[] {
  return mapChildren(blocks, parentId, (kids) => {
    const i = Math.max(0, Math.min(index, kids.length));
    return [...kids.slice(0, i), ...nodes, ...kids.slice(i)];
  });
}

/** Xoá nhiều khối (xoá cha thì con đi theo). */
export function removeBlocks(blocks: BNode[], ids: readonly string[]): BNode[] {
  const set = new Set(ids);
  const walk = (list: BNode[]): BNode[] => {
    let changed = false;
    const out: BNode[] = [];
    for (const b of list) {
      if (set.has(b.id)) { changed = true; continue; }
      if (b.content) {
        const kids = walk(b.content);
        if (kids !== b.content) { changed = true; out.push({ ...b, content: kids }); continue; }
      }
      out.push(b);
    }
    return changed ? out : list;
  };
  return walk(blocks);
}

/** Thứ tự xuất hiện trong tài liệu (duyệt sâu trước). */
export function flatten(blocks: readonly BNode[], out: BNode[] = []): BNode[] {
  for (const b of blocks) {
    out.push(b);
    if (b.content) flatten(b.content, out);
  }
  return out;
}

/** Sắp xếp định danh theo thứ tự tài liệu, bỏ khối con khi đã có cha trong danh sách. */
export function topLevelOrdered(blocks: BNode[], ids: readonly string[]): string[] {
  const set = new Set(ids);
  const out: string[] = [];
  const walk = (list: BNode[]) => {
    for (const b of list) {
      if (set.has(b.id)) out.push(b.id);
      else if (b.content) walk(b.content);
    }
  };
  walk(blocks);
  return out;
}

/**
 * Di chuyển các khối tới (parentId, index) — index tính trên danh sách con trước khi bỏ các khối đang di chuyển.
 * Không cho thả một khối vào chính nó / con cháu của nó.
 */
export function moveBlocks(blocks: BNode[], ids: readonly string[], parentId: string | null, index: number): BNode[] {
  const ordered = topLevelOrdered(blocks, ids);
  if (!ordered.length) return blocks;
  if (parentId != null) {
    const target = findBlock(blocks, parentId);
    if (!target) return blocks;
    if (ordered.includes(parentId) || target.ancestors.some((a) => ordered.includes(a))) return blocks;
  }
  const nodes = ordered.map((id) => findBlock(blocks, id)!.block);
  // Vị trí đích sau khi bỏ: trừ các khối đang di chuyển đứng trước index trong cùng danh sách cha
  const siblings = childrenOf(blocks, parentId) ?? [];
  const shift = siblings.slice(0, index).filter((s) => ordered.includes(s.id)).length;
  const without = removeBlocks(blocks, ordered);
  return insertBlocks(without, parentId, index - shift, nodes);
}

/** Khối kề trước / sau trong cùng cha. */
export function sibling(blocks: BNode[], id: string, dir: -1 | 1): BNode | null {
  const loc = findBlock(blocks, id);
  if (!loc) return null;
  const list = loc.parent ? loc.parent.content! : blocks;
  return list[loc.index + dir] ?? null;
}
