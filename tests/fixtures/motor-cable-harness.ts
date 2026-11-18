import type {
  CadCable,
  CadCableWire,
  DrawingBalloon,
  DrawingWiringHarnessView,
  DrawingPage,
  DrawingPageNote,
  DrawingPageTitleBlock,
} from "circuit-json"
import { drawingTable } from "./drawing-table"

/** A stepper motor lead: 6-position PH housing with four populated cavities,
 * to a 4-position PH housing. Laid out on A4 from the bottom-left corner. */
export function motorCableHarness() {
  const page: DrawingPage = {
    type: "drawing_page",
    drawing_page_id: "page",
    name: "Motor cable",
    page_size: "iso_a4",
    width: 297,
    height: 210,
    anchor_alignment: "bottom_left",
  }
  const titleBlock: DrawingPageTitleBlock = {
    type: "drawing_page_title_block",
    drawing_page_title_block_id: "title_block",
    drawing_page_id: "page",
    title: "PH-6P to PH-4P, UL1007 22AWG, L=50mm",
    identification_number: "MOTOR-CABLE",
    revision_index: "A",
    legal_owner: "tscircuit",
    date_of_issue: "2026-11-16",
    creator: "tscircuit",
    sheet_number: 1,
    number_of_sheets: 1,
  }
  const cable: CadCable = {
    type: "cad_cable",
    cad_cable_id: "cad_cable_motor",
    name: "MOTOR_CABLE",
    from_source_component_id: "source_motor",
    to_source_component_id: "source_j_motor",
    cableprinter_string: "adaptercable_a(jst_ph_pins6)_b(jst_ph_pins4)",
    nominal_length: 50,
    length_tolerance: 3,
    from_connector_name: "H1",
    to_connector_name: "H2",
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 50, y: 0, z: 0 },
    ],
  }
  const wires: CadCableWire[] = [
    [1, 1],
    [3, 3],
    [4, 2],
    [6, 4],
  ].map(([from_pin_number, to_pin_number]) => ({
    type: "cad_cable_wire",
    cad_cable_wire_id: `wire_${from_pin_number}`,
    cad_cable_id: "cad_cable_motor",
    from_pin_number: from_pin_number!,
    to_pin_number: to_pin_number!,
    color: "black",
    wire_awg: 22,
    wire_style: "UL1007",
  }))
  const view: DrawingWiringHarnessView = {
    type: "drawing_wiring_harness_view",
    drawing_wiring_harness_view_id: "harness",
    drawing_page_id: "page",
    cad_cable_id: "cad_cable_motor",
    center: { x: 148.5, y: 148 },
    width: 230,
    height: 76,
  }
  // Tables carry resolved text. Core derives these rows from the wires and
  // the cable's BOM; here they are written out.
  const wiringTable = drawingTable(
    {
      drawing_table_id: "wiring",
      drawing_page_id: "page",
      name: "Wiring",
      anchor_position: { x: 212, y: 98 },
      anchor_alignment: "top_left",
      column_widths: [16, 40, 16],
    },
    6,
    [
      [{ text: "WIRING", columns: 3, size: 2.2 }],
      ["H1", "WIRE", "H2"],
      ...wires.map((wire) => [
        String(wire.from_pin_number),
        "Black",
        String(wire.to_pin_number),
      ]),
    ],
  )
  // A parts list reads upward from its heading, so it hangs from its
  // bottom-left corner and lists item 1 last.
  const bomTable = drawingTable(
    {
      drawing_table_id: "bom",
      drawing_page_id: "page",
      name: "Parts list",
      anchor_position: { x: 5, y: 5 },
      anchor_alignment: "bottom_left",
      column_widths: [10, 76, 14],
    },
    6,
    [
      ["4", { text: "Housing: PH-4P, 2.0mm pitch, white", align: "left" }, "1"],
      ["3", { text: "PH terminal", align: "left" }, "8"],
      ["2", { text: "Housing: PH-6P, 2.0mm pitch, white", align: "left" }, "1"],
      ["1", { text: "UL1007 22AWG wire, black, 50mm", align: "left" }, "4"],
      [
        { text: "NO.", size: 2.2 },
        { text: "DESCRIPTION", size: 2.2 },
        { text: "QTY", size: 2.2 },
      ],
    ],
  )
  const balloons: DrawingBalloon[] = [
    {
      type: "drawing_balloon",
      drawing_balloon_id: "balloon_from",
      drawing_wiring_harness_view_id: "harness",
      texts: ["3", "2"],
      harness_target: "from_connector",
      anchor_position: { x: 54, y: 175 },
      anchor_alignment: "bottom_right",
    },
    {
      type: "drawing_balloon",
      drawing_balloon_id: "balloon_wires",
      drawing_wiring_harness_view_id: "harness",
      texts: ["1"],
      harness_target: "wires",
      anchor_position: { x: 110, y: 173 },
      anchor_alignment: "bottom_center",
    },
    {
      type: "drawing_balloon",
      drawing_balloon_id: "balloon_to",
      drawing_wiring_harness_view_id: "harness",
      texts: ["3", "4"],
      harness_target: "to_connector",
      anchor_position: { x: 243, y: 169 },
      anchor_alignment: "bottom_left",
    },
  ]
  const notes: DrawingPageNote[] = [
    "Note:",
    "1. 100% electrical testing: no shorts, no opens.",
    "2. All materials meet environmental requirements.",
  ].map((text, index) => ({
    type: "drawing_page_note",
    drawing_page_note_id: `note_${index}`,
    drawing_page_id: "page",
    position: { x: index ? 14 : 10, y: 60 - index * 5 },
    text,
    font_size: index ? 2.7 : 3.2,
  }))
  return {
    page,
    titleBlock,
    cable,
    wires,
    view,
    wiringTable,
    bomTable,
    balloons,
    notes,
    document: [
      page,
      titleBlock,
      cable,
      ...wires,
      view,
      ...wiringTable,
      ...bomTable,
      ...balloons,
      ...notes,
    ],
  }
}
