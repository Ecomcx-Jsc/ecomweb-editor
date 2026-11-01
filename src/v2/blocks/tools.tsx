import { Columns2, Minus, Plus, Table2, ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, Trash2, Heading, TableCellsMerge, TableCellsSplit } from "lucide-react";
import { useEditor } from "../context";
import { makeBlock, type BNode } from "../model";
import { addColumn, addRow, canMerge, canSplit, deleteColumn, deleteRow, hasHeaderRow, mergeCells, splitCell, tableContext, toggleHeaderRow } from "../tables";
import { Dropdown, MenuItem, ToolButton } from "../toolbar";

/** Công cụ bảng khi đang gõ trong ô (hoặc chọn cả bảng). */
export function TableTools({ ancestor, currentId }: { ancestor: BNode; currentId: string }) {
  const { store, labels } = useEditor();
  const ctx = tableContext(store, currentId);
  if (!ctx || ctx.table.id !== ancestor.id) return null;
  return (
    <Dropdown label={labels.tableTools} trigger={<Table2 className="ecx-icon" />}>
      {(close) => (
        <>
          <MenuItem icon={ArrowUpToLine} label={labels.rowBefore} onClick={() => { close(); addRow(store, ctx, false); }} />
          <MenuItem icon={ArrowDownToLine} label={labels.rowAfter} onClick={() => { close(); addRow(store, ctx, true); }} />
          <MenuItem icon={ArrowLeftToLine} label={labels.colBefore} onClick={() => { close(); addColumn(store, ctx, false); }} />
          <MenuItem icon={ArrowRightToLine} label={labels.colAfter} onClick={() => { close(); addColumn(store, ctx, true); }} />
          {ancestor.id !== currentId && canMerge(ctx, "right") && <MenuItem icon={TableCellsMerge} label={labels.mergeRight} onClick={() => { close(); mergeCells(store, ctx, "right"); }} />}
          {ancestor.id !== currentId && canMerge(ctx, "down") && <MenuItem icon={TableCellsMerge} label={labels.mergeDown} onClick={() => { close(); mergeCells(store, ctx, "down"); }} />}
          {ancestor.id !== currentId && canSplit(ctx) && <MenuItem icon={TableCellsSplit} label={labels.splitCell} onClick={() => { close(); splitCell(store, ctx); }} />}
          <MenuItem icon={Heading} label={`${labels.headerRow}${hasHeaderRow(ctx.table) ? " ✓" : ""}`} onClick={() => { close(); toggleHeaderRow(store, ctx); }} />
          <MenuItem icon={Trash2} label={labels.deleteRow} danger onClick={() => { close(); deleteRow(store, ctx); }} />
          <MenuItem icon={Trash2} label={labels.deleteColumn} danger onClick={() => { close(); deleteColumn(store, ctx); }} />
        </>
      )}
    </Dropdown>
  );
}

/** Thêm / bớt cột (chia lại độ rộng đều). */
export function ColumnsTools({ ancestor }: { ancestor: BNode; currentId: string }) {
  const { store, labels } = useEditor();
  const cols = ancestor.content ?? [];
  const even = (n: number) => (cols.some((c) => Number(c.attrs.width) > 0) ? Math.round(100 / n) : undefined);
  const add = () => {
    if (cols.length >= 6) return;
    const n = cols.length + 1;
    const next: BNode = { ...ancestor, content: [...cols.map((c) => ({ ...c, attrs: { ...c.attrs, width: even(n) } })), makeBlock("column", even(n) ? { width: even(n) } : {}, [makeBlock("paragraph")])] };
    store.replace(ancestor.id, [next]);
  };
  const remove = () => {
    if (cols.length <= 1) return;
    const n = cols.length - 1;
    const next: BNode = { ...ancestor, content: cols.slice(0, -1).map((c) => ({ ...c, attrs: { ...c.attrs, width: even(n) } })) };
    store.replace(ancestor.id, [next]);
  };
  return (
    <>
      <span className="ecx-tool is-static" title={`${cols.length} ${labels.columns}`}><Columns2 className="ecx-icon" /></span>
      <ToolButton label={labels.removeColumn} disabled={cols.length <= 1} onClick={remove}><Minus className="ecx-icon" /></ToolButton>
      <ToolButton label={labels.addColumn} disabled={cols.length >= 6} onClick={add}><Plus className="ecx-icon" /></ToolButton>
    </>
  );
}

/** Thêm nút vào nhóm nút. */
export function ButtonsTools({ ancestor }: { ancestor: BNode; currentId: string }) {
  const { store, labels } = useEditor();
  return (
    <ToolButton label={labels.addButton} onClick={() => {
      const btn = makeBlock("button", { variant: "primary" });
      store.insert(store.locate(ancestor.id)!.docId, ancestor.id, ancestor.content?.length ?? 0, [btn], { focus: false });
    }}><Plus className="ecx-icon" /></ToolButton>
  );
}
