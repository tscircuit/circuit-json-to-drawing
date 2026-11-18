import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg } from "../lib"
import { drawingTable } from "./fixtures/drawing-table"

test("harness views cover jacketed cables, mixed-pitch adapters and straight-through leads", async () => {
  const path = [
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
  ]
  const cable = (id: string, cableprinter_string: string, extra = {}) => ({
    type: "cad_cable" as const,
    cad_cable_id: id,
    name: id.toUpperCase(),
    from_source_component_id: "source_a",
    to_source_component_id: "source_b",
    cableprinter_string,
    path,
    ...extra,
  })
  const wire = (
    cad_cable_id: string,
    from_pin_number: number,
    to_pin_number: number,
    extra = {},
  ) => ({
    type: "cad_cable_wire" as const,
    cad_cable_wire_id: `${cad_cable_id}_${from_pin_number}`,
    cad_cable_id,
    from_pin_number,
    to_pin_number,
    ...extra,
  })
  const view = (cad_cable_id: string, y: number) => ({
    type: "drawing_wiring_harness_view" as const,
    drawing_wiring_harness_view_id: `view_${cad_cable_id}`,
    drawing_page_id: "page",
    cad_cable_id,
    center: { x: -38, y },
    width: 190,
    height: 58,
  })
  const svg = await convertCircuitJsonToDrawingSvg([
    { type: "drawing_page", drawing_page_id: "page", width: 280, height: 200 },
    cable("usb", "usb_c", { nominal_length: 1000 }),
    cable("sensor", "adaptercable_a(jst_sh_pins4)_b(jst_ph_pins4)", {
      nominal_length: 150,
      length_tolerance: 5,
      from_connector_name: "J1",
      to_connector_name: "J2",
    }),
    wire("sensor", 1, 1, { color: "red", name: "3V3" }),
    wire("sensor", 2, 4, { color: "black", name: "GND" }),
    wire("sensor", 3, 2, { color: "yellow", name: "SDA" }),
    wire("sensor", 4, 3, { color: "blue", name: "SCL" }),
    cable("battery", "jst_ph_pins2"),
    wire("battery", 1, 2, { color: "red" }),
    wire("battery", 2, 1, { color: "black" }),
    view("usb", 64),
    view("sensor", 2),
    view("battery", -62),
    ...drawingTable(
      {
        drawing_table_id: "sensor_wiring",
        drawing_page_id: "page",
        anchor_position: { x: 68, y: 28 },
        anchor_alignment: "top_left",
        column_widths: [12, 22, 22, 12],
      },
      6,
      [
        ["J1", "SIGNAL", "COLOR", "J2"],
        ["1", "3V3", "Red", "1"],
        ["2", "GND", "Black", "4"],
        ["3", "SDA", "Yellow", "2"],
        ["4", "SCL", "Blue", "3"],
      ],
    ),
    ...drawingTable(
      {
        drawing_table_id: "battery_wiring",
        drawing_page_id: "page",
        anchor_position: { x: 102, y: -62 },
        anchor_alignment: "center",
        column_widths: [12, 44, 12],
      },
      6,
      [
        [{ text: "BATTERY LEAD", columns: 3, size: 2.2 }],
        ["A", "COLOR", "B"],
        ["1", "Red", "2"],
        ["2", "Black", "1"],
      ],
    ),
  ])
  // Unstated lengths and connector names fall back to nothing and A/B.
  expect(svg).toContain("1000mm")
  expect(svg).toContain("150±5mm")
  expect(svg.match(/:length"/g)).toHaveLength(2)
  expect(svg).toContain(">3V3<")
  expect(svg).toContain(">J2<")
  expect(svg).toContain(">B<")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
