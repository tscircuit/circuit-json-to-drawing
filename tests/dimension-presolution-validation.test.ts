import { expect, test } from "bun:test"
import "bun-match-svg"
import type { DrawingDimensionLine } from "circuit-json"
import { convertCircuitJsonToDrawingPages } from "../lib"
import { page, view } from "./fixtures/drawings"
import { cadScene } from "./fixtures/models"

test("dimension and empty-page validation finish before scene resolution", async () => {
  let resolutions = 0
  const resolveScene = () => {
    resolutions++
    return cadScene()
  }
  const dimension = (id: string, endX: number): DrawingDimensionLine => ({
    type: "drawing_dimension_line",
    drawing_dimension_line_id: id,
    drawing_part_view_id: "view_1",
    start: { x: -40, y: -60 },
    end: { x: endX, y: -60 },
    text: "80.0",
    edge_ref_start: { x: -40, y: -45 },
    edge_ref_end: { x: endX, y: -45 },
  })

  await expect(
    convertCircuitJsonToDrawingPages(
      [page(), view(), dimension("outside", 200)],
      { resolveScene },
    ),
  ).rejects.toThrow("extends outside its drawing page")
  expect(resolutions).toBe(0)

  await expect(
    convertCircuitJsonToDrawingPages([page(), view(), page("empty")], {
      resolveScene,
    }),
  ).rejects.toThrow("has no drawing views")
  expect(resolutions).toBe(0)

  const pages = await convertCircuitJsonToDrawingPages(
    [page(), view(), dimension("valid", 40)],
    { resolveScene, pixelsPerMm: 1, supersampling: 1 },
  )
  expect(resolutions).toBe(1)
  expect(pages).toHaveLength(1)
  await expect(pages[0]!.svg).toMatchSvgSnapshot(import.meta.path)
})
