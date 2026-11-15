import { AlignCenter, AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalSpaceBetween, AlignLeft, AlignRight, AlignStartHorizontal, Link2, StretchHorizontal, Columns2, Minus, Plus, Table2, ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, Trash2, Heading, TableCellsMerge, TableCellsSplit } from "lucide-react";
import { useEditor } from "../context";
import { makeBlock, type BNode } from "../core/model";
import { addColumn, addRow, canMerge, canSplit, deleteColumn, deleteRow, hasHeaderRow, mergeCells, splitCell, tableContext, toggleHeaderRow } from "../core/tables";
import { Dropdown, MenuItem, ToolButton } from "../ui/toolbar";
import { useState } from "react";
import { useMsgs } from "../i18n";
import { isSafeUrl } from "@ecomcx/ecomweb-content";
import type { BlockEditProps } from "../core/registry";

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

/** Thêm một cột cuối (tối đa 6), chia lại độ rộng đều nếu đang đặt độ rộng. */
export function addColumnTo(store: ReturnType<typeof useEditor>["store"], columns: BNode) {
  const cols = columns.content ?? [];
  if (cols.length >= 6) return;
  const n = cols.length + 1;
  const even = cols.some((c) => Number(c.attrs.width) > 0) ? Math.round(100 / n) : undefined;
  const col = makeBlock("column", even ? { width: even } : {}, [makeBlock("paragraph")]);
  store.replace(columns.id, [{ ...columns, content: [...cols.map((c) => ({ ...c, attrs: { ...c.attrs, width: even } })), col] }], { select: { ids: [], editing: col.content![0].id }, caret: { id: col.content![0].id, offset: 0 } });
}

/** Thêm / bớt cột (chia lại độ rộng đều). */
export function ColumnsTools({ ancestor }: { ancestor: BNode; currentId: string }) {
  const { store, labels } = useEditor();
  const cols = ancestor.content ?? [];
  const even = (n: number) => (cols.some((c) => Number(c.attrs.width) > 0) ? Math.round(100 / n) : undefined);
  const add = () => addColumnTo(store, ancestor);
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
      <VAlignTool row={ancestor} />
    </>
  );
}

/** Căn dọc các cột ngay trên thanh (cùng thuộc tính verticalAlign với bảng bên phải). */
function VAlignTool({ row }: { row: BNode }) {
  const { store } = useEditor();
  const t = useMsgs("columns");
  const cur = (row.attrs.verticalAlign as string | undefined) ?? "top";
  const opts = [["top", AlignStartHorizontal, t.top], ["center", AlignCenterHorizontal, t.middle], ["bottom", AlignEndHorizontal, t.bottom], ["stretch", StretchHorizontal, t.stretch]] as const;
  const Cur = opts.find(([v]) => v === cur)?.[1] ?? AlignStartHorizontal;
  return (
    <Dropdown label={t.valign} trigger={<Cur className="ecx-icon" />}>
      {(close) => opts.map(([v, I, l]) => <MenuItem key={v} icon={I} label={(v === cur ? "✓ " : "") + l} onClick={() => { close(); store.setAttrs([row.id], { verticalAlign: v === "top" ? undefined : v }); }} />)}
    </Dropdown>
  );
}

/** Thêm nút vào nhóm nút. */
export function ButtonsTools({ ancestor }: { ancestor: BNode; currentId: string }) {
  const { store, labels } = useEditor();
  const cur = (ancestor.attrs.align as string | undefined) ?? "left";
  const opts = [["left", AlignLeft, labels.alignLeft], ["center", AlignCenter, labels.alignCenter], ["right", AlignRight, labels.alignRight], ["space-between", AlignHorizontalSpaceBetween, labels.spaceBetween]] as const;
  const Cur = opts.find(([v]) => v === cur)?.[1] ?? AlignLeft;
  return (
    <>
      <Dropdown label={labels.buttonsAlign} trigger={<Cur className="ecx-icon" />}>
        {(close) => opts.map(([v, I, l]) => <MenuItem key={v} icon={I} label={(v === cur ? "✓ " : "") + l} onClick={() => { close(); store.setAttrs([ancestor.id], { align: v === "left" ? undefined : v }); }} />)}
      </Dropdown>
      <ToolButton label={labels.addButton} onClick={() => {
        const btn = makeBlock("button", { variant: "primary" });
        store.insert(store.locate(ancestor.id)!.docId, ancestor.id, ancestor.content?.length ?? 0, [btn], { focus: false });
      }}><Plus className="ecx-icon" /></ToolButton>
    </>
  );
}

/** Liên kết của nút ngay trên thanh: ô địa chỉ + mở tab mới (cùng thuộc tính href / target với bảng bên phải). */
export function ButtonLinkTool({ block, setAttrs }: BlockEditProps) {
  const { labels } = useEditor();
  const [url, setUrl] = useState((block.attrs.href as string | undefined) ?? "");
  const ok = !url.trim() || isSafeUrl(url.trim());
  return (
    <Dropdown label={labels.buttonLink} trigger={<Link2 className="ecx-icon" />}>
      {(close) => (
        <form className="ecx-tool-form" onSubmit={(e) => { e.preventDefault(); if (!ok) return; setAttrs({ href: url.trim() || undefined }); close(); }}>
          <input className="ecx-input" type="text" inputMode="url" autoFocus aria-label={labels.buttonLink} placeholder="https://…" aria-invalid={!ok} value={url} onChange={(e) => setUrl(e.target.value)} />
          <label className="ecx-check"><input type="checkbox" checked={block.attrs.target === "_blank"} onChange={(e) => setAttrs({ target: e.target.checked ? "_blank" : undefined })} />{labels.openNewTab}</label>
          <button type="submit" className="ecx-btn" disabled={!ok}>{labels.apply}</button>
        </form>
      )}
    </Dropdown>
  );
}
