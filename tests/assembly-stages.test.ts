import { expect, test } from "bun:test"
import "bun-match-svg"
import {
  convertCircuitJsonToDrawingPages,
  parseAssemblyDrawing,
  resolveAssemblyView,
} from "../lib"
import { cadScene } from "./fixtures/models"

test("nested stages explode as rigid groups without mutating source geometry", async () => {
  const scene = cadScene()
  const parts = [
    { source_component_id: "a", drawCalls: scene.drawCalls },
    { source_component_id: "b", drawCalls: scene.drawCalls },
  ]
  const input: any[] = [
    { type: "source_component", source_component_id: "a" },
    { type: "source_component", source_component_id: "b" },
    {
      type: "drawing_assembly_stage",
      drawing_assembly_stage_id: "inner",
      name: "Inner",
      source_component_ids: ["a"],
    },
    {
      type: "drawing_assembly_stage",
      drawing_assembly_stage_id: "outer",
      name: "Outer",
      includes_stage_ids: ["inner"],
      source_component_ids: ["b"],
    },
    {
      type: "drawing_explosion",
      drawing_explosion_id: "explode",
      factor: 0.5,
      show_trails: true,
      moves: [
        { includes_stage_ids: ["outer"], translation: { x: 20, y: 30, z: 40 } },
      ],
    },
    { type: "drawing_page", drawing_page_id: "p", width: 160, height: 100 },
    {
      type: "drawing_explosion_view",
      drawing_explosion_view_id: "v",
      drawing_page_id: "p",
      drawing_assembly_stage_id: "outer",
      drawing_explosion_id: "explode",
      direction: "isometric",
      center: { x: 0, y: 0 },
      width: 130,
      height: 80,
    },
  ]
  const config = parseAssemblyDrawing(input)
  const original = JSON.stringify(scene.drawCalls.map((d) => [...d.model]))
  const result = resolveAssemblyView("v", parts, config)
  expect(result.scene.drawCalls).toHaveLength(2)
  for (const dc of result.scene.drawCalls)
    expect([...dc.model].slice(12, 15)).toEqual([10, 20, -15])
  expect(JSON.stringify(scene.drawCalls.map((d) => [...d.model]))).toBe(
    original,
  )
  const zero = structuredClone(input)
  zero[4].factor = 0
  expect([
    ...resolveAssemblyView("v", parts, parseAssemblyDrawing(zero)).scene
      .drawCalls[0]!.model,
  ]).toEqual([...scene.drawCalls[0]!.model])
  const cycle = structuredClone(input)
  cycle[2].includes_stage_ids = ["outer"]
  expect(() => parseAssemblyDrawing(cycle)).toThrow("cycle")
  const overlap = structuredClone(input)
  overlap[4].moves.push({
    source_component_ids: ["a"],
    translation: { x: 1, y: 0, z: 0 },
  })
  expect(() => parseAssemblyDrawing(overlap)).toThrow("Overlapping")
  const missing = structuredClone(input)
  missing[2].source_component_ids = ["missing"]
  expect(() => parseAssemblyDrawing(missing)).toThrow("Unknown source")
  expect(() => resolveAssemblyView("v", parts.slice(0, 1), config)).toThrow(
    "missing selected geometry",
  )
  const badFactor = structuredClone(input)
  badFactor[4].factor = NaN
  expect(() => parseAssemblyDrawing(badFactor)).toThrow("factor")
  // Mixed callers must keep the legacy resolver for legacy selectors.
  let legacyCalls = 0
  const legacy = structuredClone(input)
  delete legacy[6].drawing_assembly_stage_id
  delete legacy[6].drawing_explosion_id
  legacy[6].type = "drawing_part_view"
  legacy[6].drawing_part_view_id = "v"
  delete legacy[6].drawing_explosion_view_id
  legacy[6].source_group_id = "legacy_group"
  await convertCircuitJsonToDrawingPages(legacy, {
    resolveScene: () => {
      legacyCalls++
      return scene
    },
    resolveSceneParts: () => {
      throw Error("Unexpected identity resolver for legacy view")
    },
    pixelsPerMm: 1,
  })
  expect(legacyCalls).toBe(1)
  expect(() =>
    resolveAssemblyView("v", [{ drawCalls: scene.drawCalls }], config),
  ).toThrow("exactly one")
  const hiddenLabel = [
    ...input,
    {
      type: "drawing_part_label",
      drawing_part_label_id: "hidden",
      drawing_explosion_view_id: "v",
      source_component_ids: ["a", "b"],
      text: "Group",
      anchor: { x: 0, y: 0, z: 0 },
      label_position: { x: 60, y: 20 },
    },
  ]
  const differentMoves = structuredClone(hiddenLabel)
  differentMoves[4].moves = [
    { source_component_ids: ["a"], translation: { x: 1, y: 0, z: 0 } },
  ]
  expect(() => parseAssemblyDrawing(differentMoves)).toThrow(
    "different explosion translations",
  )
  const badNote = [
    ...input,
    {
      type: "drawing_page_note",
      drawing_page_note_id: "outside",
      drawing_page_id: "p",
      text: "Note",
      position: { x: 999, y: 0 },
    },
  ]
  expect(() => parseAssemblyDrawing(badNote)).toThrow("outside its page")
  const markup = [
    ...input,
    {
      type: "drawing_page_note",
      drawing_page_note_id: "escape",
      drawing_page_id: "p",
      text: "<script>&",
      position: { x: 0, y: 42 },
    },
  ]
  const [safe] = await convertCircuitJsonToDrawingPages(markup, {
    resolveSceneParts: () => parts,
    pixelsPerMm: 1,
  })
  expect(safe!.svg).toContain("&lt;script&gt;&amp;")
  const noPose = structuredClone(input)
  delete noPose[6].drawing_explosion_id
  expect(() => parseAssemblyDrawing(noPose)).toThrow()
  const unknownPose = structuredClone(input)
  unknownPose[6].drawing_explosion_id = "missing"
  expect(() => parseAssemblyDrawing(unknownPose)).toThrow("Unknown explosion")
  const wrongLabel = structuredClone(hiddenLabel)
  wrongLabel[7].drawing_part_view_id = "v"
  delete wrongLabel[7].drawing_explosion_view_id
  expect(() => parseAssemblyDrawing(wrongLabel)).toThrow("Unknown label view")
  // Both view kinds share a page without sending explosions to the legacy resolver.
  const mixed = structuredClone(input)
  mixed[6].width = 60
  mixed[6].center.x = -35
  mixed.push({
    ...legacy[6],
    width: 60,
    center: { x: 35, y: 0 },
    drawing_part_view_id: "assembled",
  })
  mixed.push({
    type: "drawing_dimension_line",
    drawing_dimension_line_id: "dimension",
    drawing_explosion_view_id: "v",
    start: { x: -50, y: -30 },
    end: { x: -20, y: -30 },
    text: "30 mm",
  })
  let partCalls = 0
  let wholeCalls = 0
  const [mixedPage] = await convertCircuitJsonToDrawingPages(mixed, {
    resolveSceneParts: () => {
      partCalls++
      return parts
    },
    resolveScene: () => {
      wholeCalls++
      return scene
    },
    pixelsPerMm: 1,
  })
  expect(partCalls).toBe(1)
  expect(wholeCalls).toBe(1)
  expect(mixedPage!.svg).toContain('data-drawing-explosion-view-id="v"')
  expect(mixedPage!.svg).toContain('data-drawing-part-view-id="assembled"')
  expect(mixedPage!.svg).toContain("30 mm")
  const wrongDimension = structuredClone(mixed)
  wrongDimension[8].drawing_part_view_id = "v"
  delete wrongDimension[8].drawing_explosion_view_id
  await expect(
    convertCircuitJsonToDrawingPages(wrongDimension, {
      resolveSceneParts: () => parts,
    }),
  ).rejects.toThrow("missing drawing view")
  const duplicate = structuredClone(mixed)
  duplicate[7].drawing_part_view_id = "v"
  await expect(
    convertCircuitJsonToDrawingPages(duplicate, {
      resolveSceneParts: () => parts,
    }),
  ).rejects.toThrow("Duplicate")
  const [page] = await convertCircuitJsonToDrawingPages(input, {
    resolveSceneParts: () => parts,
    pixelsPerMm: 2,
  })
  await expect(page!.svg).toMatchSvgSnapshot(import.meta.path)
})
