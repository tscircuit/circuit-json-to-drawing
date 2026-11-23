import { expect, test } from "bun:test"
import "bun-match-svg"
import { createSceneFromGLTF } from "poppygl"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { page, view } from "./fixtures/drawings"

// Three triangles form a square with a corner cut away.
const triangles = [
  [-2, 0, -2, 2, 0, -2, 2, 0, 0],
  [-2, 0, -2, 2, 0, 0, 0, 0, 2],
  [-2, 0, -2, 0, 0, 2, -2, 0, 2],
]

function render(
  layout: "single_primitive" | "split_primitives" | "separate_nodes",
) {
  const groups = layout === "single_primitive" ? [triangles.flat()] : triangles
  const buffers = groups.map(
    (positions) => new Uint8Array(new Float32Array(positions).buffer),
  )
  const primitives = groups.map((_, i) => ({ attributes: { POSITION: i } }))
  const meshes =
    layout === "separate_nodes"
      ? primitives.map((primitive) => ({ primitives: [primitive] }))
      : [{ primitives }]
  const scene = createSceneFromGLTF(
    {
      asset: { version: "2.0" },
      buffers: buffers.map(({ byteLength }) => ({ byteLength })),
      bufferViews: buffers.map(({ byteLength }, buffer) => ({
        buffer,
        byteLength,
      })),
      accessors: groups.map((positions, bufferView) => ({
        bufferView,
        componentType: 5126,
        type: "VEC3",
        count: positions.length / 3,
      })),
      meshes,
      nodes: meshes.map((_, mesh) => ({ mesh })),
      scenes: [{ nodes: meshes.map((_, i) => i) }],
    },
    { buffers, images: [] },
  )
  return convertCircuitJsonToDrawingSvg(
    [page(), view("plan", "drawing_1", "z_positive")],
    {
      pixelsPerMm: 2,
      resolveSceneParts: () => [
        { source_component_id: "plate", drawCalls: scene.drawCalls },
      ],
    },
  )
}

test("a flat face split into glTF primitives keeps only its perimeter in a drawing", async () => {
  const sheet = await render("split_primitives")
  expect(sheet === (await render("single_primitive"))).toBe(true)
  expect(sheet === (await render("separate_nodes"))).toBe(false)
  await expect(sheet).toMatchSvgSnapshot(import.meta.path)
})
