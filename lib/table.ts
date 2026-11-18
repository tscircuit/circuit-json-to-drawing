import {
  type DrawingPage,
  type DrawingTable,
  type DrawingTableCell,
  drawing_page,
  drawing_table,
  drawing_table_cell,
} from "circuit-json"
import { drawingStyle } from "./drawing-style"
import { anchoredBoxOrigin, isOnPaper, paperToSvg, svgToPaper } from "./paper"
import { escapeXml } from "./svg"
import type { DrawingDocument } from "./types"

const defaultFontSize = 2.8
const cellPadding = 2
const sum = (values: number[]) => values.reduce((total, v) => total + v, 0)

/** Scalar validation belongs to circuit-json; page and table references, cell
 * ranges, overlaps and paper bounds are validated here. */
export function parseDrawingTables(input: DrawingDocument) {
  const tables = new Map<string, { table: DrawingTable; page: DrawingPage }>()
  const cells: DrawingTableCell[] = []
  for (const record of input) {
    if (record.type === "drawing_table") {
      const table = drawing_table.parse(record)
      if (tables.has(table.drawing_table_id))
        throw Error(`Duplicate drawing table ID: ${table.drawing_table_id}`)
      tables.set(table.drawing_table_id, { table, page: undefined! })
    } else if (record.type === "drawing_table_cell")
      cells.push(drawing_table_cell.parse(record))
  }
  if (!tables.size && !cells.length) return { tables: [], cells }
  const pages = new Map<string, DrawingPage>()
  for (const record of input)
    if (record.type === "drawing_page") {
      const page = drawing_page.parse(record)
      pages.set(page.drawing_page_id, page)
    }
  for (const entry of tables.values()) {
    const { table } = entry
    const page = pages.get(table.drawing_page_id)
    if (!page)
      throw Error(
        `Drawing table ${table.drawing_table_id} references missing drawing page ${table.drawing_page_id}`,
      )
    entry.page = page
    const width = sum(table.column_widths)
    const height = sum(table.row_heights)
    const origin = anchoredBoxOrigin(
      paperToSvg(table.anchor_position, page),
      table.anchor_alignment,
      width,
      height,
    )
    const corners = [origin, { x: origin.x + width, y: origin.y + height }]
    if (corners.some((corner) => !isOnPaper(svgToPaper(corner, page), page)))
      throw Error(
        `Drawing table ${table.drawing_table_id} extends outside its drawing page`,
      )
  }
  const cellIds = new Set<string>()
  const occupied = new Set<string>()
  for (const cell of cells) {
    const id = cell.drawing_table_cell_id
    if (cellIds.has(id)) throw Error(`Duplicate drawing table cell ID: ${id}`)
    cellIds.add(id)
    const table = tables.get(cell.drawing_table_id)?.table
    if (!table)
      throw Error(
        `Drawing table cell ${id} references missing drawing table ${cell.drawing_table_id}`,
      )
    if (
      cell.end_row_index >= table.row_heights.length ||
      cell.end_column_index >= table.column_widths.length
    )
      throw Error(`Drawing table cell ${id} lies outside its table`)
    for (let row = cell.start_row_index; row <= cell.end_row_index; row++)
      for (
        let column = cell.start_column_index;
        column <= cell.end_column_index;
        column++
      ) {
        const key = `${cell.drawing_table_id}:${row}:${column}`
        if (occupied.has(key))
          throw Error(`Drawing table cell ${id} overlaps another cell`)
        occupied.add(key)
      }
  }
  return { tables: [...tables.values()].map((entry) => entry.table), cells }
}
export type DrawingTables = ReturnType<typeof parseDrawingTables>

/** Draw every table of one page: an outer border, one box per cell, and the
 * cell's resolved text. Merged cells are single boxes. */
export function renderDrawingTables(
  { tables, cells }: DrawingTables,
  page: DrawingPage,
) {
  const stroke = `stroke="black" stroke-width="${drawingStyle.tableLineWidth}"`
  return tables
    .filter((table) => table.drawing_page_id === page.drawing_page_id)
    .map((table) => {
      const width = sum(table.column_widths)
      const height = sum(table.row_heights)
      const origin = anchoredBoxOrigin(
        paperToSvg(table.anchor_position, page),
        table.anchor_alignment,
        width,
        height,
      )
      const edge = (sizes: number[], start: number, index: number) =>
        start + sum(sizes.slice(0, index))
      let svg = `<rect x="${origin.x}" y="${origin.y}" width="${width}" height="${height}" fill="white" ${stroke}/>`
      for (const cell of cells) {
        if (cell.drawing_table_id !== table.drawing_table_id) continue
        const left = edge(
          table.column_widths,
          origin.x,
          cell.start_column_index,
        )
        const right = edge(
          table.column_widths,
          origin.x,
          cell.end_column_index + 1,
        )
        const top = edge(table.row_heights, origin.y, cell.start_row_index)
        const bottom = edge(table.row_heights, origin.y, cell.end_row_index + 1)
        const size = cell.font_size ?? defaultFontSize
        const align = cell.horizontal_align ?? "center"
        const available = right - left - 2 * cellPadding
        // Monospace advance is about 0.6 em; squeeze only text that overflows.
        const fit =
          [...cell.text].length * size * 0.6 > available
            ? ` textLength="${Math.max(available, 1)}" lengthAdjust="spacingAndGlyphs"`
            : ""
        const x =
          align === "left"
            ? left + cellPadding
            : align === "right"
              ? right - cellPadding
              : (left + right) / 2
        svg += `<g data-drawing-table-cell-id="${escapeXml(cell.drawing_table_cell_id)}"><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="none" ${stroke}/><text x="${x}" y="${(top + bottom) / 2 + size * 0.35}" font-size="${size}" text-anchor="${align === "left" ? "start" : align === "right" ? "end" : "middle"}" fill="${drawingStyle.textColor}"${fit}>${escapeXml(cell.text)}</text></g>`
      }
      return `<g data-drawing-table-id="${escapeXml(table.drawing_table_id)}">${svg}</g>`
    })
    .join("")
}
