import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingPages } from "../lib"
import { loadFidgetFixture } from "../examples/assembly-study/fixture"
test("fidget counter rotor subassembly drawing", async () => {
  const { input, parts } = await loadFidgetFixture()
  const [page] = await convertCircuitJsonToDrawingPages(input, {
    drawingPageId: "03-cap",
    pixelsPerMm: 2,
    resolveSceneParts: () => parts,
  })
  expect(page!.svg).toContain("B2 / SEAT BEARING IN CAP")
  await expect(page!.svg).toMatchSvgSnapshot(import.meta.path)
})
