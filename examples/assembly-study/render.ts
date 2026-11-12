import { convertCircuitJsonToDrawingPages } from "../../lib"
import { loadFidgetFixture } from "./fixture"
import { mkdir } from "node:fs/promises"
const output = process.argv[2] ?? "examples/assembly-study/rendered"
const { input, parts } = await loadFidgetFixture(Number(process.argv[3] ?? 1))
await mkdir(output, { recursive: true })
await Bun.write(
  `${output}/fidget-counter.drawing.circuit.json`,
  JSON.stringify(input, null, 2),
)
for (const page of await convertCircuitJsonToDrawingPages(input, {
  pixelsPerMm: 4,
  supersampling: 2,
  resolveSceneParts: () => parts,
})) {
  await Bun.write(`${output}/${page.drawingPageId}.svg`, page.svg)
  console.log(`Rendered ${page.drawingPageId}`)
}
