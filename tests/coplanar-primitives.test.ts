import { expect, test } from "bun:test"
import "bun-match-svg"
import { mat4 } from "gl-matrix"
import type { DrawCall, GLTFScene } from "poppygl"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { page, twoViews } from "./fixtures/drawings"

test("drawing a triangulated part preserves the opening and crease across primitive splits", async () => {
  // A flat frame with an open centre and a bent flange along its right edge.
  const positions = new Float32Array([
    -10, 0, -8, 10, 0, -8, 10, 0, 8, -10, 0, 8, -4, 0, -3, 4, 0, -3, 4, 0, 3,
    -4, 0, 3, 10, 4, -8, 10, 4, 8,
  ])
  const faces = [
    [0, 1, 5],
    [0, 5, 4],
    [1, 2, 6],
    [1, 6, 5],
    [2, 3, 7],
    [2, 7, 6],
    [3, 0, 4],
    [3, 4, 7],
    [1, 8, 9],
    [1, 9, 2],
  ]
  const whole: DrawCall = {
    positions,
    indices: new Uint32Array(faces.flat()),
    normals: null,
    uvs: null,
    model: mat4.create(),
    material: { baseColorFactor: [1, 1, 1, 1], baseColorTexture: null },
  }
  const split = faces.map((face, i) =>
    i % 2 === 0
      ? { ...whole, indices: new Uint32Array(face) }
      : {
          ...whole,
          positions: new Float32Array(
            face.flatMap((v) =>
              Array.from(positions.subarray(v * 3, v * 3 + 3)),
            ),
          ),
          indices: null,
        },
  )
  const input = [page(), ...twoViews()]
  const scene = (drawCalls: DrawCall[]): GLTFScene => ({
    gltf: { asset: { version: "2.0" } },
    drawCalls,
  })
  const render = (calls: DrawCall[]) =>
    convertCircuitJsonToDrawingSvg(input, {
      resolveScene: () => scene(calls),
      pixelsPerMm: 2,
    })
  const reference = await render([whole])
  const svg = await render(split)
  expect(svg === reference).toBe(true)

  const byPart = (parts: DrawCall[][], sameIdentity = false) =>
    convertCircuitJsonToDrawingSvg(input, {
      resolveSceneParts: () =>
        parts.map((drawCalls, i) => ({
          source_component_id: sameIdentity ? "housing" : String(i),
          drawCalls,
        })),
      pixelsPerMm: 2,
    })
  // Assembly adapters can copy the node transform into each primitive.
  expect(
    (await byPart([
      split.map((dc) => ({ ...dc, model: mat4.clone(dc.model) })),
    ])) === reference,
  ).toBe(true)
  const entries = split.map((dc) => [dc])
  expect((await byPart(entries, true)) === reference).toBe(true)
  expect((await byPart(entries)) === reference).toBe(false)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
