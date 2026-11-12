import { expect, test } from "bun:test"
import "bun-match-svg"
import {
  convertCircuitJsonToDrawingPages,
  parseAssemblyDrawing,
  resolveAssemblyView,
} from "../lib"
import { loadFidgetFixture } from "../examples/assembly-study/fixture"

test("published fidget fixture retains a complete PCBA and joins the rotor as one subassembly", async () => {
  const { input, parts } = await loadFidgetFixture()
  const before = JSON.stringify(input)
  const config = parseAssemblyDrawing(input)
  expect(config.select({ includes_stage_ids: ["pcba"] }).size).toBe(28)
  expect(config.select({ includes_stage_ids: ["complete"] }).size).toBe(35)
  expect(
    [...config.select({ includes_stage_ids: ["cap_complete"] })].sort(),
  ).toEqual([
    "source:source_component_36",
    "source:source_component_37",
    "source:source_component_38",
  ])
  const joined = resolveAssemblyView("join", parts, config).scene.drawCalls
  let index = 0
  for (const part of parts)
    for (const dc of part.drawCalls) {
      const moved = joined[index++]!
      const rotor = [
        "source_component_36",
        "source_component_37",
        "source_component_38",
      ].includes(part.source_component_id ?? "")
      expect(moved.model[13]! - dc.model[13]!).toBeCloseTo(rotor ? 40 : 0, 5)
      expect(moved.model[12]).toBe(dc.model[12])
      expect(moved.model[14]).toBe(dc.model[14])
    }
  const [page] = await convertCircuitJsonToDrawingPages(input, {
    drawingPageId: "01-overview",
    pixelsPerMm: 2,
    resolveSceneParts: () => parts,
  })
  expect(JSON.stringify(input)).toBe(before)
  expect(page!.svg).toContain("ENCODER MAGNET")
  await expect(page!.svg).toMatchSvgSnapshot(import.meta.path)
})
