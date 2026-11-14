import { drawing_part_view, drawing_explosion_view } from "circuit-json"
import type { DrawingView } from "./types"

export const isDrawingView = (r: { type: string }) =>
  r.type === "drawing_part_view" || r.type === "drawing_explosion_view"
export function parseDrawingView(record: { type: string }): DrawingView {
  return record.type === "drawing_explosion_view"
    ? drawing_explosion_view.parse(record)
    : drawing_part_view.parse(record)
}
export function drawingViewId(view: DrawingView): string {
  return view.type === "drawing_explosion_view"
    ? view.drawing_explosion_view_id
    : view.drawing_part_view_id
}
export function annotationViewId(annotation: {
  drawing_part_view_id?: string
  drawing_explosion_view_id?: string
}): string {
  return (annotation.drawing_explosion_view_id ??
    annotation.drawing_part_view_id)!
}
export function annotationTargetsView(
  annotation: {
    drawing_part_view_id?: string
    drawing_explosion_view_id?: string
  },
  view: DrawingView,
): boolean {
  return view.type === "drawing_explosion_view"
    ? annotation.drawing_explosion_view_id === view.drawing_explosion_view_id
    : annotation.drawing_part_view_id === view.drawing_part_view_id
}
