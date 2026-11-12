import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { paperToSvg, resolvePaperPosition } from "../lib/paper"
import { cadScene } from "./fixtures/models"

test("drawing origins position views, annotations and dimensions while view offsets follow their viewport", async () => {
  const scene = cadScene()
  const input: any[] = [
    { type: "source_component", source_component_id: "part" },
    {
      type: "drawing_assembly_stage",
      drawing_assembly_stage_id: "stage",
      name: "part",
      source_component_ids: ["part"],
    },
    {
      type: "drawing_explosion",
      drawing_explosion_id: "pose",
      moves: [
        { source_component_ids: ["part"], translation: { x: 0, y: 0, z: 10 } },
      ],
    },
    {
      type: "drawing_page",
      drawing_page_id: "p",
      width: 200,
      height: 140,
      name: "Configurable origin",
    },
    {
      type: "drawing_explosion_view",
      drawing_explosion_view_id: "v",
      drawing_page_id: "p",
      drawing_assembly_stage_id: "stage",
      drawing_explosion_id: "pose",
      direction: "isometric",
      center: { x: 0, y: 0 },
      width: 110,
      height: 80,
      name: "Exploded view",
    },
    {
      type: "drawing_part_label",
      drawing_part_label_id: "l",
      drawing_explosion_view_id: "v",
      source_component_ids: ["part"],
      anchor: { x: 0, y: 0, z: 0 },
      label_position: { x: -65, y: 20 },
      text: "Part",
    },
    {
      type: "drawing_page_note",
      drawing_page_note_id: "note",
      drawing_page_id: "p",
      position: { x: -85, y: 57 },
      text: "Origin: lower-left (0, 0)",
    },
    {
      type: "drawing_page_note",
      drawing_page_note_id: "view-note",
      drawing_page_id: "p",
      drawing_explosion_view_id: "v",
      position: { x: -30 },
      y_offset_from_view_center: -61,
      text: "Relative to view center",
    },
    {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: "d",
      drawing_explosion_view_id: "v",
      start: { x: -30, y: -52 },
      end: { x: 30, y: -52 },
      text: "60 mm",
      edge_ref_start: { x: -30, y: -35 },
      edge_ref_end: { x: 30, y: -35 },
      edge_ref_name: "Width",
    },
  ]
  const options = {
    pixelsPerMm: 2,
    resolveSceneParts: () => [
      { source_component_id: "part", drawCalls: scene.drawCalls },
    ],
    showEdgeNames: true,
  }
  const baseline = await convertCircuitJsonToDrawingSvg(input, options)
  const shifted = structuredClone(input)
  shifted[3].origin = { x: 0, y: 0 }
  shifted[4].center = { x: 100, y: 70 }
  // The same drawing uses view-relative labels and mixed per-axis note positioning.
  delete shifted[5].label_position
  shifted[5].x_offset_from_view_center = -65
  shifted[5].y_offset_from_view_center = 20
  shifted[6].position = { x: 15, y: 127 }
  shifted[7].position = { x: 70 }
  for (const key of ["start", "end", "edge_ref_start", "edge_ref_end"]) {
    shifted[8][key].x += 100
    shifted[8][key].y += 70
  }
  const svg = await convertCircuitJsonToDrawingSvg(shifted, options)
  const normalize = (s: string) =>
    s.replace(/-?\d+\.\d+/g, (n) => String(Number(Number(n).toFixed(8))))
  expect(normalize(svg)).toBe(normalize(baseline))
  expect(svg).toContain('<text x="15" y="13"')
  expect(svg).toContain('<text x="70" y="131"')
  expect(paperToSvg({ x: 0, y: 0 }, shifted[3])).toEqual({ x: 0, y: 140 })
  expect(resolvePaperPosition(undefined, shifted[5], shifted[4])).toEqual({
    x: 35,
    y: 90,
  })
  const moved = structuredClone(shifted)
  moved[4].center.x += 10
  moved[4].center.y += 5
  expect(resolvePaperPosition(undefined, moved[5], moved[4])).toEqual({
    x: 45,
    y: 95,
  })
  expect(resolvePaperPosition(moved[7].position, moved[7], moved[4])).toEqual({
    x: 70,
    y: 14,
  })
  const movedSvg = await convertCircuitJsonToDrawingSvg(moved, options)
  expect(movedSvg).toContain('<text x="45" y="45"')
  expect(movedSvg).toContain('<text x="70" y="126"')
  expect(movedSvg).toContain('<text x="15" y="13"')
  const arbitrary = structuredClone(shifted)
  arbitrary[3].origin = { x: 12, y: 9 }
  arbitrary[4].center = { x: 88, y: 61 }
  arbitrary[6].position = { x: 3, y: 118 }
  arbitrary[7].position.x -= 12
  for (const key of ["start", "end", "edge_ref_start", "edge_ref_end"]) {
    arbitrary[8][key].x -= 12
    arbitrary[8][key].y -= 9
  }
  expect(
    normalize(await convertCircuitJsonToDrawingSvg(arbitrary, options)),
  ).toBe(normalize(svg))
  for (const mutate of [
    (r: any[]) => {
      r[4].center.x = 0
    },
    (r: any[]) => {
      r[6].position.x = -1
    },
    (r: any[]) => {
      r[7].drawing_explosion_view_id = "missing"
    },
    (r: any[]) => {
      r[7].drawing_part_view_id = "v"
      delete r[7].drawing_explosion_view_id
    },
    (r: any[]) => {
      r[7].drawing_page_id = "other"
      r.push({ ...r[3], drawing_page_id: "other" })
    },
    (r: any[]) => {
      r[8].start.x = -20
    },
  ]) {
    const invalid = structuredClone(shifted)
    mutate(invalid)
    await expect(
      convertCircuitJsonToDrawingSvg(invalid, {
        ...options,
        drawingPageId: "p",
      }),
    ).rejects.toThrow()
  }
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
