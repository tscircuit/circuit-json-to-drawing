import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingSvg } from "../lib"

test("long connector designators stay clear of the pin numbers", async () => {
  const cable = (id: string, from: string, to: string) => ({
    type: "cad_cable" as const,
    cad_cable_id: id,
    name: id.toUpperCase(),
    from_source_component_id: "source_a",
    to_source_component_id: "source_b",
    cableprinter_string: "adaptercable_a(jst_sh_pins4)_b(jst_ph_pins4)",
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
    ],
    nominal_length: 100,
    from_connector_name: from,
    to_connector_name: to,
  })
  const wires = (cad_cable_id: string) =>
    [1, 2, 3, 4].map((pin) => ({
      type: "cad_cable_wire" as const,
      cad_cable_wire_id: `${cad_cable_id}_${pin}`,
      cad_cable_id,
      from_pin_number: pin,
      to_pin_number: 5 - pin,
    }))
  const view = (cad_cable_id: string, y: number) => ({
    type: "drawing_wiring_harness_view" as const,
    drawing_wiring_harness_view_id: `view_${cad_cable_id}`,
    drawing_page_id: "page",
    cad_cable_id,
    center: { x: 0, y },
    width: 170,
    height: 50,
  })
  const svg = await convertCircuitJsonToDrawingSvg([
    { type: "drawing_page", drawing_page_id: "page", width: 240, height: 180 },
    cable("short", "H1", "MCU"),
    ...wires("short"),
    view("short", 56),
    cable("fitted", "SENSOR", "DISPLAY"),
    ...wires("fitted"),
    view("fitted", 0),
    cable("outward", "TEMPERATURE", "CONTROLLER"),
    ...wires("outward"),
    view("outward", -56),
  ])
  // Names of three characters or fewer keep the full designator size.
  expect(svg).toMatch(/font-size="5"[^>]*>H1</)
  expect(svg).toMatch(/font-size="5"[^>]*>MCU</)
  // Longer names shrink to the gutter; the longest grow away from the cable.
  expect(svg).not.toMatch(/font-size="5"[^>]*>SENSOR</)
  expect(svg).toMatch(/text-anchor="end"[^>]*>TEMPERATURE</)
  expect(svg).toMatch(/text-anchor="start"[^>]*>CONTROLLER</)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
