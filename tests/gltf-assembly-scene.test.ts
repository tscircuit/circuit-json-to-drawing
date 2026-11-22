import { expect, test } from "bun:test"
import "bun-match-svg"
import { type AnyCircuitElement, cad_component, pcb_board } from "circuit-json"
import {
  convertCircuitJsonTo3D,
  convertSceneToGLTF,
} from "circuit-json-to-gltf"
import { computeWorldAABB } from "poppygl"
import {
  convertCircuitJsonToDrawingPages,
  createDrawingScenePartsResolver,
} from "../lib"

test("resolves PCB and CAD geometry for an exploded drawing", async () => {
  const coverPosition = { x: 4, y: 2, z: 3 }
  const carrier = pcb_board.parse({
    type: "pcb_board",
    pcb_board_id: "carrier",
    center: { x: 0, y: 0 },
    width: 30,
    height: 14,
    thickness: 1,
  })
  const circuitJson: AnyCircuitElement[] = [
    carrier,
    {
      ...carrier,
      pcb_board_id: "other",
      center: { x: 60, y: 0 },
      width: 10,
      height: 8,
    },
    {
      type: "source_component",
      ftype: "subassembly",
      source_component_id: "cover",
      name: "Cover",
    },
    cad_component.parse({
      type: "cad_component",
      cad_component_id: "cover-model",
      source_component_id: "cover",
      model_jscad: { type: "cuboid", size: [14, 8, 3] },
      position: coverPosition,
      rotation: { x: 0, y: 0, z: 0 },
      layer: "top",
    }),
  ]
  const resolveSceneParts = createDrawingScenePartsResolver({
    circuitJson,
    converter: { convertCircuitJsonTo3D, convertSceneToGLTF },
  })
  const firstLoad = resolveSceneParts()
  expect(resolveSceneParts()).toBe(firstLoad)
  const parts = await firstLoad
  expect(
    parts.map((part) => part.pcb_board_id ?? part.source_component_id),
  ).toEqual(["cover", "carrier", "other"])
  const cover = parts.find((part) => part.source_component_id === "cover")!
  const { min, max } = computeWorldAABB(cover.drawCalls)
  expect((min[0]! + max[0]!) / 2).toBeCloseTo(coverPosition.x)
  expect((min[1]! + max[1]!) / 2).toBeCloseTo(coverPosition.z)
  expect((min[2]! + max[2]!) / 2).toBeCloseTo(-coverPosition.y)

  const [page] = await convertCircuitJsonToDrawingPages(
    [
      ...circuitJson,
      {
        type: "drawing_assembly_stage",
        drawing_assembly_stage_id: "assembly",
        name: "Cover and carrier",
        source_component_ids: ["cover"],
        pcb_board_ids: ["carrier"],
      },
      {
        type: "drawing_page",
        drawing_page_id: "sheet",
        width: 100,
        height: 80,
      },
      {
        type: "drawing_explosion_view",
        drawing_explosion_view_id: "exploded",
        drawing_page_id: "sheet",
        drawing_assembly_stage_id: "assembly",
        direction: "isometric",
        center: { x: 0, y: 0 },
        width: 80,
        height: 60,
        show_trails: true,
        moves: [
          {
            source_component_ids: ["cover"],
            translation: { x: 0, y: 0, z: 12 },
          },
        ],
      },
    ],
    { resolveSceneParts },
  )
  expect(page!.svg).toContain('data-drawing-explosion-view-id="exploded"')
  await expect(page!.svg).toMatchSvgSnapshot(import.meta.path)
})
