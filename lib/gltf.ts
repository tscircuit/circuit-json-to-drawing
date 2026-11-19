import type { AnyCircuitElement, CadComponent } from "circuit-json"
import { mat4 } from "gl-matrix"
import { createSceneFromGLTF, loadGLTFWithResourcesFromURL } from "poppygl"
import type { DrawingScenePart } from "./assembly"
import { toBase64 } from "./svg"

interface DrawingSceneBox {
  componentMetadata?: Partial<Pick<CadComponent, "source_component_id">>
}

interface ModelOptions {
  projectBaseUrl?: string
  authHeaders?: { Authorization: string; [name: string]: string }
}

interface GltfConverter<Box> {
  convertCircuitJsonTo3D(
    circuitJson: AnyCircuitElement[],
    options: ModelOptions & {
      foldPcbs: boolean
      renderBoardTextures?: boolean
    },
  ): Promise<{ boxes: Box[] }>
  convertSceneToGLTF(
    scene: { boxes: Box[] },
    options: { binary: true },
  ): Promise<object>
}

interface DrawingScenePartsInput<Box> {
  circuitJson: AnyCircuitElement[]
  converter: GltfConverter<Box>
  modelOptions?: ModelOptions
}

// GLB geometry uses (-x, z, y), while drawing offsets use (x, z, -y).
const glbToDrawingFrame = mat4.fromYRotation(mat4.create(), Math.PI)

async function boxesToDrawingDrawCalls<Box>(
  boxes: Box[],
  convertSceneToGLTF: GltfConverter<Box>["convertSceneToGLTF"],
) {
  const glb = await convertSceneToGLTF({ boxes }, { binary: true })
  if (!(glb instanceof ArrayBuffer)) {
    throw new Error("Expected binary glTF for drawing geometry")
  }
  const { gltf, resources } = await loadGLTFWithResourcesFromURL(
    `data:model/gltf-binary;base64,${toBase64(new Uint8Array(glb))}`,
  )
  return createSceneFromGLTF(gltf, resources).drawCalls.map((call) => ({
    ...call,
    model: mat4.multiply(mat4.create(), glbToDrawingFrame, call.model),
  }))
}

async function loadBoardOwnership(circuitJson: AnyCircuitElement[]) {
  const { createBoardOwnerMap, getElementId } = await import(
    "@tscircuit/circuit-json-util"
  )
  return { boardOwners: createBoardOwnerMap(circuitJson), getElementId }
}

async function loadDrawingSceneParts<Box extends DrawingSceneBox>({
  circuitJson,
  converter: { convertCircuitJsonTo3D, convertSceneToGLTF },
  modelOptions,
}: DrawingScenePartsInput<Box>): Promise<DrawingScenePart[]> {
  const cadComponents = circuitJson.filter(
    (element) => element.type === "cad_component",
  )
  const sceneOptions = {
    ...modelOptions,
    foldPcbs: cadComponents.some((component) => component.is_on_folded_board),
  }
  const parts: DrawingScenePart[] = []
  if (cadComponents.length) {
    const { boxes } = await convertCircuitJsonTo3D(circuitJson, {
      ...sceneOptions,
      renderBoardTextures: false,
    })
    for (const box of boxes) {
      const source_component_id = box.componentMetadata?.source_component_id
      if (!source_component_id) continue
      const drawCalls = await boxesToDrawingDrawCalls([box], convertSceneToGLTF)
      if (drawCalls.length) parts.push({ source_component_id, drawCalls })
    }
  }

  // Board meshes lack component metadata. Render each board with its own PCB elements.
  const boards = circuitJson.filter((element) => element.type === "pcb_board")
  const ownership = boards.length > 1 && (await loadBoardOwnership(circuitJson))
  for (const board of boards) {
    const pcbElements = circuitJson.filter((element) => {
      if (!element.type.startsWith("pcb_") || element.type === "pcb_panel")
        return false
      if ("pcb_board_id" in element && element.pcb_board_id) {
        return element.pcb_board_id === board.pcb_board_id
      }
      if (!ownership) return true
      const { boardOwners, getElementId } = ownership
      let owner = boardOwners.get(getElementId(element))
      if (!owner && "pcb_component_id" in element && element.pcb_component_id) {
        owner = boardOwners.get(element.pcb_component_id)
      }
      if (!owner && "pcb_group_id" in element && element.pcb_group_id) {
        owner = boardOwners.get(element.pcb_group_id)
      }
      if (!owner && "subcircuit_id" in element && element.subcircuit_id) {
        owner = boardOwners.get(element.subcircuit_id)
      }
      return owner?.pcb_board_id === board.pcb_board_id
    })
    const { boxes } = await convertCircuitJsonTo3D(pcbElements, sceneOptions)
    const drawCalls = await boxesToDrawingDrawCalls(boxes, convertSceneToGLTF)
    if (drawCalls.length)
      parts.push({ pcb_board_id: board.pcb_board_id, drawCalls })
  }
  return parts
}

/** Create a lazy, cached assembly resolver for drawing pages from the same circuit. */
export function createDrawingScenePartsResolver<Box extends DrawingSceneBox>(
  input: DrawingScenePartsInput<Box>,
): () => Promise<DrawingScenePart[]> {
  let sceneParts: Promise<DrawingScenePart[]> | undefined
  return () => (sceneParts ??= loadDrawingSceneParts(input))
}
