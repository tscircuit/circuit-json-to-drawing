import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingPages } from "../lib"
import { loadFidgetFixture } from "../examples/assembly-study/fixture"
test("fidget counter base subassembly drawing", async () => {
  const { input, parts } = await loadFidgetFixture()
  const [page] = await convertCircuitJsonToDrawingPages(input, {
    drawingPageId: "02-base",
    pixelsPerMm: 2,
    resolveSceneParts: () => parts,
  })
  expect(page!.svg).toContain("A3 / LOWER PCBA; FIT TWO SCREWS")
  await expect(page!.svg).toMatchSvgSnapshot(import.meta.path)
})
