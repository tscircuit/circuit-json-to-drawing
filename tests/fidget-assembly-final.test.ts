import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingPages } from "../lib"
import { loadFidgetFixture } from "../examples/assembly-study/fixture"
test("fidget counter final subassembly drawing", async () => {
  const { input, parts } = await loadFidgetFixture()
  const [page] = await convertCircuitJsonToDrawingPages(input, {
    drawingPageId: "04-final",
    pixelsPerMm: 2,
    resolveSceneParts: () => parts,
  })
  expect(page!.svg).toContain("C1 / LOWER COMPLETE ROTOR")
  await expect(page!.svg).toMatchSvgSnapshot(import.meta.path)
})
