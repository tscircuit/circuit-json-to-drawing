import type { DrawingPage } from "circuit-json"
import type { DrawingView } from "./types"
type Point = { x: number; y: number }

/** Resolve the named page anchor from the physical lower-left, +Y up. */
export function drawingAnchor(page: DrawingPage): Point {
  const anchor = page.anchor_alignment ?? "center"
  return {
    x: anchor.endsWith("_left")
      ? 0
      : anchor.endsWith("_right")
        ? page.width
        : page.width / 2,
    y: anchor.startsWith("top_")
      ? page.height
      : anchor.startsWith("bottom_")
        ? 0
        : page.height / 2,
  }
}
export function paperBounds(page: DrawingPage) {
  const anchor = drawingAnchor(page)
  return {
    left: -anchor.x,
    right: page.width - anchor.x,
    bottom: -anchor.y,
    top: page.height - anchor.y,
  }
}
export function paperToSvg(point: Point, page: DrawingPage): Point {
  const anchor = drawingAnchor(page)
  return { x: anchor.x + point.x, y: page.height - (anchor.y + point.y) }
}
export function isOnPaper(point: Point, page: DrawingPage, margin = 0) {
  const p = paperToSvg(point, page)
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= margin &&
    p.y >= margin &&
    p.x <= page.width - margin &&
    p.y <= page.height - margin
  )
}
/** Resolve each annotation axis independently into page-anchor coordinates. */
export function resolvePaperPosition(
  position: Partial<Point> | undefined,
  offsets: {
    x_offset_from_view_center?: number
    y_offset_from_view_center?: number
  },
  view?: DrawingView,
): Point {
  const result = {} as Point
  for (const [axis, key] of [
    ["x", "x_offset_from_view_center"],
    ["y", "y_offset_from_view_center"],
  ] as const) {
    const absolute = position?.[axis],
      offset = offsets[key]
    if ((absolute !== undefined) === (offset !== undefined))
      throw Error(`Provide exactly one position for paper ${axis}`)
    if (offset !== undefined && !view)
      throw Error("View-center offsets require a view")
    result[axis] = absolute ?? view!.center[axis] + offset!
    if (!Number.isFinite(result[axis]))
      throw Error("Annotation position must be finite")
  }
  return result
}
