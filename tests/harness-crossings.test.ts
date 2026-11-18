import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { measureWeave, permutations } from "./fixtures/weave-crossings"

test("crossed wires are drawn as separate, traceable crossings for any wiring", async () => {
  // Every wiring of up to six wires: a pair crosses exactly once when its
  // order differs between the ends and never otherwise, no two wires share a
  // line, and each crossing keeps clear of bends and of other crossings.
  let layouts = 0
  for (let count = 1; count <= 6; count++)
    for (const toLanes of permutations(count)) {
      const weave = measureWeave(toLanes)
      const label = toLanes.join(",")
      expect(weave.sharedLines, label).toBe(0)
      expect(weave.wrongCrossingCounts, label).toBe(0)
      if (weave.crossings) expect(weave.clearance, label).toBeGreaterThan(0.7)
      layouts++
    }
  expect(layouts).toBe(873)
  // Pin-for-pin cables reverse lane order: one crossing per pair of wires.
  for (const count of [4, 8, 16]) {
    const reversal = measureWeave(
      Array.from({ length: count }, (_, lane) => count - 1 - lane),
    )
    expect(reversal).toMatchObject({
      crossings: (count * (count - 1)) / 2,
      straightRuns: true,
      sharedLines: 0,
      wrongCrossingCounts: 0,
    })
  }
  // This wiring has no layout with one straight run per wire; neighbors are
  // exchanged instead, still with one crossing per reordered pair.
  expect(measureWeave([1, 4, 3, 0, 2])).toMatchObject({
    crossings: 6,
    straightRuns: false,
    wrongCrossingCounts: 0,
  })

  const cable = (id: string, pins: number, toPins: number[]) => [
    {
      type: "cad_cable" as const,
      cad_cable_id: id,
      name: id.toUpperCase(),
      from_source_component_id: "source_a",
      to_source_component_id: "source_b",
      cableprinter_string: `jst_ph_pins${pins}`,
      nominal_length: 100,
      path: [
        { x: 0, y: 0, z: 0 },
        { x: 100, y: 0, z: 0 },
      ],
    },
    ...toPins.map((to_pin_number, index) => ({
      type: "cad_cable_wire" as const,
      cad_cable_wire_id: `${id}_${index + 1}`,
      cad_cable_id: id,
      from_pin_number: index + 1,
      to_pin_number,
    })),
  ]
  const view = (cad_cable_id: string, y: number, height: number) => ({
    type: "drawing_harness_view" as const,
    drawing_harness_view_id: `view_${cad_cable_id}`,
    drawing_page_id: "page",
    cad_cable_id,
    center: { x: 0, y },
    width: 260,
    height,
  })
  const svg = await convertCircuitJsonToDrawingSvg([
    { type: "drawing_page", drawing_page_id: "page", width: 280, height: 250 },
    ...cable("straight_4", 4, [1, 2, 3, 4]),
    ...cable("straight_8", 8, [1, 2, 3, 4, 5, 6, 7, 8]),
    ...cable("mixed_5", 5, [4, 1, 2, 5, 3]),
    view("straight_4", 86, 62),
    view("straight_8", 6, 86),
    view("mixed_5", -82, 70),
  ])
  expect(svg.match(/data-drawing-harness-view-id/g)).toHaveLength(3)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
