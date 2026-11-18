import type { CableConnector } from "@tscircuit/cableprinter"
import type {
  DrawingBalloon,
  DrawingDimensionLine,
  DrawingHarnessView,
  DrawingPage,
} from "circuit-json"
import { contactCount } from "./cable-ends"
import { renderDrawingDimensionLine } from "./dimensions"
import { drawingStyle } from "./drawing-style"
import type { HarnessCable } from "./harness-document"
import { layoutWeave } from "./harness-weave"
import { anchoredBoxOrigin, isOnPaper, paperToSvg, svgToPaper } from "./paper"
import { escapeXml } from "./svg"

type Point = { x: number; y: number }

/** Paper mm reserved inside the viewport around the connectors. */
const sideGutter = 18
const balloonBand = 17
const dimensionBand = 15
const balloonRadius = 2.8

const formatMm = (value: number) => String(Number(value.toFixed(2)))
const outline = `fill="white" stroke="black" stroke-width="${drawingStyle.harnessOutlineWidth}"`
const rect = (xa: number, xb: number, ya: number, yb: number) =>
  `<rect x="${Math.min(xa, xb)}" y="${Math.min(ya, yb)}" width="${Math.abs(xb - xa)}" height="${Math.abs(yb - ya)}" ${outline}/>`
/** Vertically centered text without relying on renderer baseline support. */
const text = (
  point: Point,
  size: number,
  anchor: "start" | "middle" | "end",
  content: string,
) =>
  `<text x="${point.x}" y="${point.y + size * 0.35}" font-size="${size}" text-anchor="${anchor}" fill="${drawingStyle.textColor}">${escapeXml(content)}</text>`

interface PlacedConnector {
  connector: CableConnector
  /** Wire-exit face; the body extends from it toward outward. */
  rearX: number
  matingX: number
  outward: -1 | 1
  top: number
  bottom: number
  pinY: (pin: number) => number
}

function placeConnector(
  connector: CableConnector,
  rearX: number,
  centerY: number,
  scale: number,
  outward: -1 | 1,
): PlacedConnector {
  const count = contactCount(connector) ?? 1
  const pitch = "pitch" in connector ? connector.pitch : 0
  return {
    connector,
    rearX,
    matingX: rearX + outward * connector.bodyDepth * scale,
    outward,
    top: centerY - (connector.bodyWidth * scale) / 2,
    bottom: centerY + (connector.bodyWidth * scale) / 2,
    // A flat, untwisted cable shows the same face of both housings, which
    // puts from-end pin 1 at paper top and to-end pin 1 at paper bottom.
    pinY: (pin) =>
      centerY - outward * (pin - 1 - (count - 1) / 2) * pitch * scale,
  }
}

/** Plan view of a housing from cableprinter body dimensions. Crimp housings
 * show a rear lip and one lance window per cavity, populated or not. */
function connectorSvg(placed: PlacedConnector, scale: number) {
  const { connector, rearX, matingX, outward, top, bottom } = placed
  const depth = Math.abs(matingX - rearX)
  let svg = rect(rearX, matingX, top, bottom)
  if (
    connector.kind === "jst_sh_housing" ||
    connector.kind === "jst_ph_housing"
  ) {
    const lip = 0.25 * scale
    svg += rect(rearX, rearX + outward * 0.14 * depth, top - lip, bottom + lip)
    const half = 0.25 * connector.pitch * scale
    for (let pin = 1; pin <= connector.pinCount; pin++)
      svg += rect(
        rearX + outward * 0.46 * depth,
        rearX + outward * 0.76 * depth,
        placed.pinY(pin) - half,
        placed.pinY(pin) + half,
      )
  } else if (connector.kind === "usb_c_plug") {
    const centerY = (top + bottom) / 2
    const half = (connector.shellWidth * scale) / 2
    svg += rect(
      matingX,
      matingX + outward * connector.shellDepth * scale,
      centerY - half,
      centerY + half,
    )
  }
  return svg
}

function balloonSvg(balloon: DrawingBalloon, target: Point, page: DrawingPage) {
  const diameter = 2 * balloonRadius
  const origin = anchoredBoxOrigin(
    paperToSvg(balloon.anchor_position, page),
    balloon.anchor_alignment,
    diameter * balloon.texts.length,
    diameter,
  )
  const centers = balloon.texts.map((_, index) => ({
    x: origin.x + balloonRadius + index * diameter,
    y: origin.y + balloonRadius,
  }))
  if (
    centers.some(
      (c) => !isOnPaper(svgToPaper(c, page), page, balloonRadius + 0.5),
    )
  )
    throw Error(
      `Balloon ${balloon.drawing_balloon_id} extends outside its drawing page`,
    )
  // The leader leaves the circle nearest its target.
  const distance = (p: Point) => Math.hypot(target.x - p.x, target.y - p.y)
  const anchor = centers.reduce((a, b) => (distance(b) < distance(a) ? b : a))
  const length = distance(anchor)
  if (!(length > balloonRadius))
    throw Error(
      `Balloon ${balloon.drawing_balloon_id} overlaps the part it points at`,
    )
  const unit = {
    x: (target.x - anchor.x) / length,
    y: (target.y - anchor.y) / length,
  }
  const start = {
    x: anchor.x + unit.x * balloonRadius,
    y: anchor.y + unit.y * balloonRadius,
  }
  const base = { x: target.x - unit.x * 2.4, y: target.y - unit.y * 2.4 }
  const arrow = [
    target,
    { x: base.x - unit.y * 0.7, y: base.y + unit.x * 0.7 },
    { x: base.x + unit.y * 0.7, y: base.y - unit.x * 0.7 },
  ]
  const stroke = `stroke="${drawingStyle.dimensionColor}" stroke-width="${drawingStyle.dimensionWidth}"`
  return `<g data-drawing-balloon-id="${escapeXml(balloon.drawing_balloon_id)}"><path d="M ${start.x} ${start.y} L ${base.x} ${base.y}" fill="none" ${stroke}/><polygon points="${arrow.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${drawingStyle.dimensionColor}"/>${centers
    .map(
      (center, index) =>
        `<circle cx="${center.x}" cy="${center.y}" r="${balloonRadius}" fill="white" ${stroke}/>${text(center, 3.2, "middle", balloon.texts[index]!)}`,
    )
    .join("")}</g>`
}

/** Draw one cable flattened: from end at left, to end at right, one ribbon per
 * wire. Connectors use view scale; the span between them is schematic. */
export function renderHarnessView(
  view: DrawingHarnessView,
  page: DrawingPage,
  { cable, ends, wires }: HarnessCable,
  balloons: DrawingBalloon[],
) {
  const id = view.drawing_harness_view_id
  const center = paperToSvg(view.center, page)
  const left = center.x - view.width / 2
  const top = center.y - view.height / 2
  const bodyBand = view.height - balloonBand - dimensionBand
  const span = view.width - 2 * sideGutter
  const maxBodyWidth = Math.max(ends.from.bodyWidth, ends.to.bodyWidth)
  const maxBodyDepth = Math.max(ends.from.bodyDepth, ends.to.bodyDepth)
  const scale =
    view.scale ??
    Math.min(bodyBand / (maxBodyWidth + 1), (0.1 * span) / maxBodyDepth)
  if (
    !(scale > 0) ||
    maxBodyWidth * scale > bodyBand + 1e-9 ||
    (ends.from.bodyDepth + ends.to.bodyDepth) * scale > 0.5 * span + 1e-9
  )
    throw Error(`Harness view ${id} is too small for its connectors`)
  const centerY = top + balloonBand + bodyBand / 2
  const from = placeConnector(
    ends.from,
    left + sideGutter + ends.from.bodyDepth * scale,
    centerY,
    scale,
    -1,
  )
  const to = placeConnector(
    ends.to,
    left + view.width - sideGutter - ends.to.bodyDepth * scale,
    centerY,
    scale,
    1,
  )

  const pitches = [ends.from, ends.to].flatMap((c) =>
    "pitch" in c ? [c.pitch] : [],
  )
  const runs = wires.length
    ? wires.map((wire) => ({
        fromY: from.pinY(wire.from_pin_number),
        toY: to.pinY(wire.to_pin_number),
      }))
    : [{ fromY: centerY, toY: centerY }]
  // Between the connectors the wires run in evenly spaced lanes, change
  // order in the middle, and close in on their pins at each end. Lane order
  // follows pin order at each end, so only the middle section has crossings.
  // Lanes span the wider end's populated cavities, which keeps them as far
  // apart as the connectors allow.
  const extent = (key: "fromY" | "toY") =>
    Math.max(...runs.map((run) => run[key])) -
    Math.min(...runs.map((run) => run[key]))
  const lanePitch =
    runs.length > 1
      ? Math.max(extent("fromY"), extent("toY")) / (runs.length - 1)
      : 0
  const rank = (key: "fromY" | "toY") => {
    const order = runs.map((_, index) => index)
    order.sort((a, b) => runs[a]![key] - runs[b]![key])
    return runs.map((_, index) => order.indexOf(index))
  }
  const fromRank = rank("fromY")
  const toRank = rank("toY")
  const laneY = (lane: number) =>
    centerY + (lane - (runs.length - 1) / 2) * lanePitch
  // Insulated diameter per cableprinter's adapter default, thinned so that a
  // wire passing over another hides only a short length of it.
  const wireWidth = !wires.length
    ? (ends.jacketDiameter ?? 3) * scale
    : Math.min(
        Math.min(2, ...pitches.map((pitch) => pitch * 0.6)) * scale,
        runs.length > 1 ? 0.26 * lanePitch : 1e9,
        1.8,
      )
  const halo =
    runs.length > 1 ? Math.min(0.4, 0.25 * (lanePitch - wireWidth)) : 0

  const rearSpan = to.rearX - from.rearX
  const stub = Math.min(3, 0.04 * rearSpan)
  const fanWidth = (key: "fromY" | "toY", lanes: number[]) => {
    const shift = Math.max(
      ...runs.map((run, index) => Math.abs(run[key] - laneY(lanes[index]!))),
    )
    return shift < 1e-6 ? 0 : Math.min(Math.max(2 * shift, 4), 0.2 * rearSpan)
  }
  const gatherStartX = from.rearX + stub
  const gatherEndX = gatherStartX + fanWidth("fromY", fromRank)
  const spreadEndX = to.rearX - stub
  const spreadStartX = spreadEndX - fanWidth("toY", toRank)
  const middleX = (gatherEndX + spreadStartX) / 2
  const weave = layoutWeave(
    runs.map((_, index) => ({
      fromLane: fromRank[index]!,
      toLane: toRank[index]!,
    })),
  )
  // A lane change takes two lane pitches of run per lane, which spaces the
  // crossings along each wire; it steepens only when the span is short.
  const bundleLength = spreadStartX - gatherEndX
  const weaveUnit = weave.width
    ? Math.min(
        2 * Math.min(lanePitch, 8),
        Math.max(bundleLength - 24, 0.5 * bundleLength) / weave.width,
      )
    : 0
  const weaveLeftX = middleX - (weave.width * weaveUnit) / 2
  const paths = runs.map((run, index) => {
    const points: Point[] = [
      { x: from.rearX - 1, y: run.fromY },
      { x: gatherStartX, y: run.fromY },
      { x: gatherEndX, y: laneY(fromRank[index]!) },
      ...weave.paths[index]!.map((point) => ({
        x: weaveLeftX + point.x * weaveUnit,
        y: laneY(point.y),
      })),
    ]
    points.push(
      { x: spreadStartX, y: laneY(toRank[index]!) },
      { x: spreadEndX, y: run.toY },
      { x: to.rearX + 1, y: run.toY },
    )
    return points
      .filter(
        (point, at) =>
          !at ||
          Math.hypot(point.x - points[at - 1]!.x, point.y - points[at - 1]!.y) >
            1e-6,
      )
      .map((point, at) => `${at ? "L" : "M"} ${point.x} ${point.y}`)
      .join(" ")
  })
  // Longer lane changes are drawn last, so they read as unbroken lines over
  // the wires they cross. Each wire clears a margin around itself, which
  // leaves a visible gap in every wire that passes under it.
  const drawOrder = runs
    .map((_, index) => index)
    .sort(
      (a, b) =>
        Math.abs(toRank[a]! - fromRank[a]!) -
          Math.abs(toRank[b]! - fromRank[b]!) || a - b,
    )
  const strokePath = (index: number, width: number, color: string) =>
    `<path d="${paths[index]}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`
  const wireSvg = drawOrder
    .map(
      (index) =>
        (halo ? strokePath(index, wireWidth + 2 * halo, "white") : "") +
        strokePath(index, wireWidth, "black") +
        strokePath(
          index,
          wireWidth - 2 * drawingStyle.harnessWireOutlineWidth,
          "white",
        ),
    )
    .join("")

  let labels = ""
  for (const [placed, name, pinKey] of [
    [from, cable.from_connector_name ?? "A", "from_pin_number"],
    [to, cable.to_connector_name ?? "B", "to_pin_number"],
  ] as const) {
    const { connector, outward } = placed
    const outerX =
      placed.matingX +
      (connector.kind === "usb_c_plug"
        ? outward * connector.shellDepth * scale
        : 0)
    labels += text({ x: outerX + outward * 13, y: centerY }, 5, "middle", name)
    const count = contactCount(connector)
    if (!count) continue
    // Every populated cavity is numbered when the pitch leaves room; the
    // first and last positions always are.
    const pinPitch = "pitch" in connector ? connector.pitch * scale : 0
    const numbered = new Set([1, count])
    if (pinPitch >= 3) for (const wire of wires) numbered.add(wire[pinKey])
    for (const pin of numbered)
      labels += text(
        { x: outerX + outward * 2.5, y: placed.pinY(pin) },
        Math.min(3.4, Math.max(2.6, 0.7 * pinPitch)),
        outward < 0 ? "end" : "start",
        String(pin),
      )
  }

  let dimension = ""
  if (cable.nominal_length !== undefined) {
    const y = Math.max(from.bottom, to.bottom) + 9
    const line: DrawingDimensionLine = {
      type: "drawing_dimension_line",
      drawing_dimension_line_id: `${id}:length`,
      name: `${cable.name} length`,
      start: svgToPaper({ x: from.rearX, y }, page),
      end: svgToPaper({ x: to.rearX, y }, page),
      edge_ref_start: svgToPaper({ x: from.rearX, y: from.bottom }, page),
      edge_ref_end: svgToPaper({ x: to.rearX, y: to.bottom }, page),
      text: `${formatMm(cable.nominal_length)}${
        cable.length_tolerance ? `±${formatMm(cable.length_tolerance)}` : ""
      }mm`,
    }
    dimension = renderDrawingDimensionLine(line, page).svg
  }

  // The wire callout rings the gathered bundle beside the crossings.
  const bundle = {
    x: weaveUnit ? (gatherEndX + weaveLeftX) / 2 : middleX,
    y: centerY,
    rx: 3,
    ry: Math.abs(laneY(runs.length - 1) - laneY(0)) / 2 + wireWidth / 2 + 1.6,
  }
  const connectorTarget = (placed: PlacedConnector): Point => ({
    x:
      placed.rearX +
      placed.outward * 0.3 * Math.abs(placed.matingX - placed.rearX),
    y: placed.top + Math.min(3, 0.25 * (placed.bottom - placed.top)),
  })
  // Balloon positions are stated; only the leader tip is resolved here.
  const callouts = balloons
    .map((balloon) =>
      balloonSvg(
        balloon,
        balloon.harness_target === "from_connector"
          ? connectorTarget(from)
          : balloon.harness_target === "to_connector"
            ? connectorTarget(to)
            : {
                x: bundle.x + bundle.rx * Math.SQRT1_2,
                y: bundle.y - bundle.ry * Math.SQRT1_2,
              },
        page,
      ),
    )
    .join("")
  // The bundle ring is the wire callout's target, so it appears only with one.
  const ring = balloons.some((b) => b.harness_target === "wires")
    ? `<ellipse cx="${bundle.x}" cy="${bundle.y}" rx="${bundle.rx}" ry="${bundle.ry}" fill="none" stroke="${drawingStyle.dimensionColor}" stroke-width="${drawingStyle.dimensionWidth}"/>`
    : ""

  const name = escapeXml(view.display_name ?? view.name ?? cable.name)
  return `<g data-drawing-harness-view-id="${escapeXml(id)}"><title>${name}</title>${wireSvg}${connectorSvg(from, scale)}${connectorSvg(to, scale)}${ring}${labels}${dimension}${callouts}<text x="${center.x}" y="${top + view.height + 3.5}" text-anchor="middle" font-size="2.8">${name} · LENGTH NOT TO SCALE</text></g>`
}
