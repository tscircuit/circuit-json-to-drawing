import type { DrawingTable, DrawingTableCell } from "circuit-json"

type Cell =
  | string
  | { text: string; columns?: number; align?: "left" | "right"; size?: number }

/** Build a drawing_table and its cells from rows listed top to bottom. A cell
 * may span several columns; the cells after it shift right accordingly. */
export function drawingTable(
  table: Omit<DrawingTable, "type" | "row_heights">,
  rowHeight: number,
  rows: Cell[][],
): [DrawingTable, ...DrawingTableCell[]] {
  const cells = rows.flatMap((row, rowIndex) => {
    let column = 0
    return row.map((cell): DrawingTableCell => {
      const spec = typeof cell === "string" ? { text: cell } : cell
      const start = column
      column += spec.columns ?? 1
      return {
        type: "drawing_table_cell",
        drawing_table_cell_id: `${table.drawing_table_id}_${rowIndex}_${start}`,
        drawing_table_id: table.drawing_table_id,
        start_row_index: rowIndex,
        end_row_index: rowIndex,
        start_column_index: start,
        end_column_index: column - 1,
        text: spec.text,
        ...(spec.align && { horizontal_align: spec.align }),
        ...(spec.size && { font_size: spec.size }),
      }
    })
  })
  return [
    {
      type: "drawing_table",
      ...table,
      row_heights: rows.map(() => rowHeight),
    },
    ...cells,
  ]
}
