import type { DrawingView } from "./types"
import { annotationTargetsView } from "./view"
import { drawing_dimension_line, type DrawingDimensionLine } from "circuit-json"
import type { DrawingDocument } from "./types"

/** Lines already carry resolved paper positions and text. Model interpretation
 * belongs to their producer; this parser validates only document associations.
 */
export function parseDrawingDimensionLines(
  input: DrawingDocument,
  views: DrawingView[],
) {
  const lines: DrawingDimensionLine[] = []
  const ids = new Set<string>()
  for (const record of input) {
    if (record.type !== "drawing_dimension_line") continue
    const line = drawing_dimension_line.parse(record)
    if (ids.has(line.drawing_dimension_line_id))
      throw new Error("Duplicate drawing dimension line")
    if (!views.some((view) => annotationTargetsView(line, view)))
      throw new Error(
        "Drawing dimension line references a missing drawing view",
      )
    ids.add(line.drawing_dimension_line_id)
    lines.push(line)
  }
  return lines
}
