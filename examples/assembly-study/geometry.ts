import { createSceneFromGLTF, loadGLTFWithResourcesFromURL } from "poppygl"
import { mat4 } from "gl-matrix"
import type { DrawingScenePart } from "../../lib/assembly"

/** Exact published 1.0.31 GLB; node extras provide source identity. */
export async function loadParts(
  bytes: ArrayBuffer,
): Promise<DrawingScenePart[]> {
  const { gltf, resources } = await loadGLTFWithResourcesFromURL(
    "https://fixture.test/assembly.glb",
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => bytes,
      }),
    },
  )
  // This older exported GLB uses (-CAD.x, CAD.z, CAD.y).
  // Rotate the complete placed scene 180deg about Y to canonical (x,z,-y).
  const normalize = mat4.fromYRotation(mat4.create(), Math.PI)
  return gltf.nodes.map((node: any, index: number) => {
    const selected = { ...gltf, scene: 0, scenes: [{ nodes: [index] }] }
    const scene = createSceneFromGLTF(selected, resources)
    const source_component_id = node.extras?.tscircuit?.source_component_id
    if (!source_component_id && !["Box0", "Via Plating"].includes(node.name))
      throw Error(`Unmapped node: ${node.name}`)
    return {
      ...(source_component_id
        ? { source_component_id }
        : { pcb_board_id: "pcb_board_0" }),
      drawCalls: scene.drawCalls.map((dc) => ({
        ...dc,
        model: mat4.multiply(mat4.create(), normalize, dc.model),
      })),
    }
  })
}
