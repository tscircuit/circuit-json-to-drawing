import { mat4 } from "gl-matrix"
import type { DrawCall } from "poppygl"

// Triangle lists ignore an incomplete trailing triangle in each primitive.
function triangleIndexCount(call: DrawCall) {
  const count = call.indices?.length ?? call.positions.length / 3
  return count - (count % 3)
}

function joinTriangles(primitives: DrawCall[]): DrawCall {
  const offsets = new Map<Float32Array, number>()
  let vertexCount = 0
  let indexCount = 0
  for (const primitive of primitives) {
    const { positions } = primitive
    if (!offsets.has(positions)) {
      offsets.set(positions, vertexCount)
      vertexCount += positions.length / 3
    }
    indexCount += triangleIndexCount(primitive)
  }

  const positions = new Float32Array(vertexCount * 3)
  for (const [buffer, offset] of offsets) positions.set(buffer, offset * 3)
  const indices = new Uint32Array(indexCount)
  let cursor = 0
  for (const primitive of primitives) {
    const base = offsets.get(primitive.positions)!
    const count = triangleIndexCount(primitive)
    for (let i = 0; i < count; i++)
      indices[cursor++] = base + (primitive.indices?.[i] ?? i)
  }
  return {
    positions,
    indices,
    normals: null,
    uvs: null,
    model: primitives[0]!.model,
    material: primitives[0]!.material,
  }
}

/** PoppyGL finds adjacent triangles within one draw call. A glTF mesh may
 * split a continuous surface into multiple material primitives on one node.
 * Its loader shares the node's model matrix between those primitives. */
export function joinOutlinePrimitives(calls: DrawCall[], withinPart: boolean) {
  if (calls.length < 2) return calls
  const output: DrawCall[] = []
  let start = 0
  while (start < calls.length) {
    const first = calls[start]!
    let end = start + 1
    if (isTriangleMesh(first)) {
      while (end < calls.length) {
        const next = calls[end]!
        if (!isTriangleMesh(next)) break
        // Part resolvers can return copies of the same placement matrix.
        if (
          next.model !== first.model &&
          !(withinPart && mat4.exactEquals(next.model, first.model))
        )
          break
        end++
      }
    }
    output.push(
      end === start + 1 ? first : joinTriangles(calls.slice(start, end)),
    )
    start = end
  }
  return output
}

function isTriangleMesh(call: DrawCall) {
  return (call.mode == null || call.mode === 4) && !call.outlineSectionCap
}
