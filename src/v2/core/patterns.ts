import { onPatternsChange, patternNodes, registeredPatterns, type Pattern } from "../../shared/patterns";
import { fromRich, makeBlock, type BNode } from "./model";

/** Khối của một mẫu: mẫu đồng bộ → tham chiếu; mẫu thường → chép khối. */
export function patternBlocks(p: Pattern): BNode[] {
  if (p.synced && p.ref) return [makeBlock("syncedPattern", { ref: p.ref })];
  return patternNodes(p).map((n) => fromRich(n as never));
}

export { registeredPatterns, onPatternsChange, type Pattern };
