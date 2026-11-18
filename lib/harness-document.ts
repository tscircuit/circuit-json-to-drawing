import {
  type CadCable,
  type CadCableWire,
  cad_cable,
  cad_cable_wire,
  type DrawingBalloon,
  type DrawingHarnessView,
  type DrawingPage,
  drawing_balloon,
  drawing_harness_view,
  drawing_page,
} from "circuit-json"
import { type CableEnds, contactCount, resolveCableEnds } from "./cable-ends"
import { paperToSvg } from "./paper"
import type { DrawingDocument } from "./types"

/** A cable with its resolved mating interfaces and conductors in from-pin order. */
export interface HarnessCable {
  cable: CadCable
  ends: CableEnds
  wires: CadCableWire[]
}

/** Scalar validation belongs to circuit-json; references, pin ranges and paper
 * bounds are validated here, before any geometry is resolved. */
export function parseHarnessDrawing(input: DrawingDocument) {
  const views: DrawingHarnessView[] = []
  const balloons: DrawingBalloon[] = []
  const ids = new Set<string>()
  const unique = (kind: string, id: string) => {
    if (ids.has(`${kind}:${id}`)) throw Error(`Duplicate ${kind} ID: ${id}`)
    ids.add(`${kind}:${id}`)
  }
  for (const record of input) {
    if (record.type === "drawing_harness_view") {
      const view = drawing_harness_view.parse(record)
      unique("drawing harness view", view.drawing_harness_view_id)
      views.push(view)
    } else if (record.type === "drawing_balloon") {
      const balloon = drawing_balloon.parse(record)
      unique("drawing balloon", balloon.drawing_balloon_id)
      balloons.push(balloon)
    }
  }
  const cables = new Map<string, HarnessCable>()
  if (!views.length && !balloons.length) return { views, balloons, cables }

  const pages = new Map<string, DrawingPage>()
  for (const record of input)
    if (record.type === "drawing_page") {
      const page = drawing_page.parse(record)
      pages.set(page.drawing_page_id, page)
    }
  const pageOf = (kind: string, id: string, pageId: string) => {
    const page = pages.get(pageId)
    if (!page)
      throw Error(`${kind} ${id} references missing drawing page ${pageId}`)
    return page
  }

  const cableIds = new Set(views.map((view) => view.cad_cable_id))
  for (const record of input) {
    if (record.type !== "cad_cable") continue
    const id = (record as { cad_cable_id?: unknown }).cad_cable_id
    if (typeof id !== "string" || !cableIds.has(id)) continue
    if (cables.has(id)) throw Error(`Duplicate cable ID: ${id}`)
    const cable = cad_cable.parse(record)
    cables.set(id, {
      cable,
      ends: resolveCableEnds(cable.cableprinter_string),
      wires: [],
    })
  }
  for (const id of cableIds)
    if (!cables.has(id))
      throw Error(`Harness drawing references missing cable: ${id}`)
  const wireIds = new Set<string>()
  for (const record of input) {
    if (record.type !== "cad_cable_wire") continue
    const target = cables.get(
      (record as { cad_cable_id?: string }).cad_cable_id ?? "",
    )
    if (!target) continue
    const wire = cad_cable_wire.parse(record)
    if (wireIds.has(wire.cad_cable_wire_id))
      throw Error(`Duplicate cable wire ID: ${wire.cad_cable_wire_id}`)
    wireIds.add(wire.cad_cable_wire_id)
    target.wires.push(wire)
  }
  for (const { cable, ends, wires } of cables.values()) {
    const counts = {
      from: contactCount(ends.from),
      to: contactCount(ends.to),
    }
    if (!wires.length) {
      // A multi-contact cable has no drawable wiring until it is stated.
      if ((counts.from ?? 1) > 1 || (counts.to ?? 1) > 1)
        throw Error(
          `Cable ${cable.cad_cable_id} needs cad_cable_wire records to be drawn as a harness`,
        )
      continue
    }
    for (const end of ["from", "to"] as const) {
      const count = counts[end]
      if (count === undefined)
        throw Error(
          `Cable ${cable.cad_cable_id} has wires but its ${end} connector has no numbered contacts`,
        )
      const used = new Set<number>()
      for (const wire of wires) {
        const pin = wire[`${end}_pin_number`]
        if (pin > count)
          throw Error(
            `Wire ${wire.cad_cable_wire_id} uses ${end} pin ${pin} of a ${count}-contact connector`,
          )
        if (used.has(pin))
          throw Error(
            `Cable ${cable.cad_cable_id} lands two wires on ${end} pin ${pin}`,
          )
        used.add(pin)
      }
    }
    wires.sort((a, b) => a.from_pin_number - b.from_pin_number)
  }

  for (const view of views) {
    const page = pageOf(
      "Harness view",
      view.drawing_harness_view_id,
      view.drawing_page_id,
    )
    const center = paperToSvg(view.center, page)
    if (
      center.x - view.width / 2 < -1e-9 ||
      center.x + view.width / 2 > page.width + 1e-9 ||
      center.y - view.height / 2 < -1e-9 ||
      center.y + view.height / 2 > page.height + 1e-9
    )
      throw Error(
        `Harness view ${view.drawing_harness_view_id} extends outside its page`,
      )
  }
  for (const balloon of balloons)
    if (
      !views.some(
        (v) => v.drawing_harness_view_id === balloon.drawing_harness_view_id,
      )
    )
      throw Error(
        `Balloon ${balloon.drawing_balloon_id} references missing harness view ${balloon.drawing_harness_view_id}`,
      )
  return { views, balloons, cables }
}
export type HarnessDrawing = ReturnType<typeof parseHarnessDrawing>
