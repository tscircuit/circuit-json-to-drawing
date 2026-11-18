import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg, resolveCableEnds } from "../lib"
import { motorCableHarness } from "./fixtures/motor-cable-harness"

test("a cable manufacturing sheet renders from cable, wire, table and balloon records without a scene resolver", async () => {
  const harness = motorCableHarness()
  const svg = await convertCircuitJsonToDrawingSvg(harness.document)
  expect(svg).toContain('data-drawing-harness-view-id="harness"')
  expect(svg.match(/data-drawing-table-id/g)).toHaveLength(2)
  expect(svg.match(/data-drawing-table-cell-id/g)).toHaveLength(31)
  expect(svg.match(/data-drawing-balloon-id/g)).toHaveLength(3)
  expect(svg).toContain("50±3mm")
  // Harness sheets are vector output: no rasterized geometry is embedded.
  expect(svg).not.toContain("<image")
  const ends = resolveCableEnds(harness.cable.cableprinter_string)
  expect([ends.from.kind, ends.to.kind]).toEqual([
    "jst_ph_housing",
    "jst_ph_housing",
  ])
  expect(ends.from).toMatchObject({ pinCount: 6, bodyWidth: 13.8 })
  expect(ends.to).toMatchObject({ pinCount: 4, bodyWidth: 9.8 })

  // Anchors locate the named point of the box: the parts list hangs from its
  // bottom-left corner at (5, 5) on a 210 mm tall sheet, 100 x 30 mm.
  const bom = harness.bomTable[0]
  const wiring = harness.wiringTable[0]
  expect(svg).toContain('<rect x="5" y="175" width="100" height="30"')
  expect(svg).toContain('<rect x="212" y="112" width="72" height="36"')
  const replace = (record: object, change: object) =>
    harness.document.map((r) => (r === record ? { ...r, ...change } : r))
  const centered = await convertCircuitJsonToDrawingSvg(
    replace(bom, {
      anchor_alignment: "center",
      anchor_position: { x: 55, y: 20 },
    }),
  )
  expect(centered).toContain('<rect x="5" y="175" width="100" height="30"')
  // The balloon's circles end at x = 54 with their bottom edge at y = 175.
  const circles = [
    ...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="2.8"/g),
  ]
  expect(Number(circles[1]![1])).toBeCloseTo(54 - 2.8)
  expect(Number(circles[1]![2])).toBeCloseTo(210 - 175 - 2.8)
  const untoleranced = await convertCircuitJsonToDrawingSvg(
    replace(harness.cable, { length_tolerance: undefined }),
  )
  expect(untoleranced).toContain(">50mm<")
  const literal = await convertCircuitJsonToDrawingSvg(
    replace(harness.bomTable[2]!, { text: "Terminal <$&>" }),
  )
  expect(literal).toContain("Terminal &lt;$&amp;&gt;")

  for (const [reason, document] of Object.entries({
    "missing cable": harness.document.filter((r) => r !== harness.cable),
    "pin beyond the housing": replace(harness.wires[3]!, { to_pin_number: 5 }),
    "two wires on one pin": replace(harness.wires[1]!, { to_pin_number: 1 }),
    "multi-contact cable without wires": harness.document.filter(
      (r) => !harness.wires.includes(r as never),
    ),
    "unsupported cable string": replace(harness.cable, {
      cableprinter_string: "adaptercable_a(jst_ph_pins6)_b(ribbon)",
    }),
    "view outside its page": replace(harness.view, {
      center: { x: 250, y: 148 },
    }),
    "scale too large for the viewport": replace(harness.view, { scale: 8 }),
    "table off the sheet": replace(wiring, {
      anchor_position: { x: 260, y: 98 },
    }),
    "table without an anchor alignment": replace(bom, {
      anchor_alignment: undefined,
    }),
    "table on a missing page": replace(bom, { drawing_page_id: "missing" }),
    "cell outside its table": replace(harness.bomTable[1]!, {
      end_column_index: 3,
    }),
    "overlapping cells": replace(harness.bomTable[2]!, {
      start_column_index: 0,
    }),
    "cell without its table": replace(harness.bomTable[1]!, {
      drawing_table_id: "missing",
    }),
    "duplicate table ID": [...harness.document, bom],
    "balloon off the sheet": replace(harness.balloons[2]!, {
      anchor_position: { x: 293, y: 180 },
    }),
    "balloon without its view": replace(harness.balloons[0]!, {
      drawing_harness_view_id: "missing",
    }),
    "balloon without an anchor": replace(harness.balloons[0]!, {
      anchor_position: undefined,
    }),
    "duplicate view ID": [...harness.document, harness.view],
    "page without views": [harness.page, harness.titleBlock],
  }))
    await expect(
      convertCircuitJsonToDrawingSvg(document),
      reason,
    ).rejects.toThrow()
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
