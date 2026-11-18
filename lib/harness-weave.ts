/** Crossing layout for a bundle of wires, in lane units: lanes are 1 apart
 * and a wire changes lanes on 45 degree runs. */
export interface WeaveWire {
  fromLane: number
  toLane: number
}
export interface Weave {
  /** Per wire, the points between its from lane and its to lane, with x
   * starting at 0. Empty for a wire that keeps its lane throughout. */
  paths: { x: number; y: number }[][]
  /** Extent of all lane changes along x. */
  width: number
}

type Point = { x: number; y: number }
type Segment = [Point, Point]

/** Closest approach allowed between two wires that do not cross there. */
const minSeparation = 0.6
/** Closest a crossing may come to a bend or to another crossing. */
const minCrossingClearance = 0.6
const far = 1e4

function wirePath(wire: WeaveWire, start: number | undefined): Point[] {
  if (start === undefined || wire.fromLane === wire.toLane)
    return [
      { x: -far, y: wire.fromLane },
      { x: far, y: wire.fromLane },
    ]
  return [
    { x: -far, y: wire.fromLane },
    { x: start, y: wire.fromLane },
    { x: start + Math.abs(wire.toLane - wire.fromLane), y: wire.toLane },
    { x: far, y: wire.toLane },
  ]
}
const segmentsOf = (path: Point[]): Segment[] =>
  path.slice(1).map((point, index) => [path[index]!, point])
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
function pointToSegment(point: Point, [a, b]: Segment) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy),
    ),
  )
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy })
}
/** The single point where two non-parallel segments meet, if they do. */
function crossingOf([a, b]: Segment, [c, d]: Segment): Point | undefined {
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (Math.abs(denominator) < 1e-9) return undefined
  const t =
    ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator
  const u =
    ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return undefined
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
}

/** Crossings of two wires, or undefined when they run too close, cross more
 * often than their pin order requires, or cross too near a bend. */
function crossingsBetween(
  wireA: WeaveWire,
  pathA: Point[],
  wireB: WeaveWire,
  pathB: Point[],
): Point[] | undefined {
  const crossings: Point[] = []
  for (const a of segmentsOf(pathA))
    for (const b of segmentsOf(pathB)) {
      const crossing = crossingOf(a, b)
      if (crossing) {
        crossings.push(crossing)
        continue
      }
      const gap = Math.min(
        pointToSegment(a[0], b),
        pointToSegment(a[1], b),
        pointToSegment(b[0], a),
        pointToSegment(b[1], a),
      )
      if (gap < minSeparation - 1e-9) return undefined
    }
  const mustCross =
    (wireA.fromLane - wireB.fromLane) * (wireA.toLane - wireB.toLane) < 0
  if (crossings.length !== (mustCross ? 1 : 0)) return undefined
  const bends = [...pathA.slice(1, -1), ...pathB.slice(1, -1)]
  if (
    crossings.some((crossing) =>
      bends.some(
        (bend) => distance(crossing, bend) < minCrossingClearance - 1e-9,
      ),
    )
  )
    return undefined
  return crossings
}

type Mover = { index: number; length: number }

/** Place one diagonal per moving wire, in the given order, each as near the
 * middle as the wires already placed allow. */
function placeInOrder(wires: WeaveWire[], movers: Mover[]): Weave | undefined {
  const starts: (number | undefined)[] = wires.map(() => undefined)
  const placed = wires.flatMap((wire, index) =>
    wire.fromLane === wire.toLane ? [index] : [],
  )
  const crossings: Point[] = []
  const reach = 4 * wires.length + 8
  for (const mover of movers) {
    const wire = wires[mover.index]!
    let found = false
    for (let step = 0; step <= reach && !found; step++)
      for (const center of step ? [-step / 2, step / 2] : [0]) {
        const start = center - mover.length / 2
        const path = wirePath(wire, start)
        const added: Point[] = []
        const valid = placed.every((other) => {
          const between = crossingsBetween(
            wire,
            path,
            wires[other]!,
            wirePath(wires[other]!, starts[other]),
          )
          if (between) added.push(...between)
          return between !== undefined
        })
        const crowded = added.some((point, index) =>
          [...crossings, ...added.slice(0, index)].some(
            (existing) =>
              distance(point, existing) < minCrossingClearance - 1e-9,
          ),
        )
        if (!valid || crowded) continue
        starts[mover.index] = start
        placed.push(mover.index)
        crossings.push(...added)
        found = true
        break
      }
    if (!found) return undefined
  }
  const first = Math.min(...movers.map((m) => starts[m.index]!))
  const last = Math.max(...movers.map((m) => starts[m.index]! + m.length))
  return {
    paths: wires.map((wire, index) => {
      const start = starts[index]
      if (start === undefined) return []
      return [
        { x: start - first, y: wire.fromLane },
        {
          x: start - first + Math.abs(wire.toLane - wire.fromLane),
          y: wire.toLane,
        },
      ]
    }),
    width: last - first,
  }
}

/** Exchange neighboring wires that are out of order, one column of exchanges
 * at a time, until every wire is in its to lane. Always succeeds, with one
 * crossing per out-of-order pair; wires being passed step aside by one lane. */
function exchangeNeighbors(wires: WeaveWire[]): Weave {
  const lanes = wires
    .map((_, index) => index)
    .sort((a, b) => wires[a]!.fromLane - wires[b]!.fromLane)
  const positions = wires.map((wire) => [wire.fromLane])
  const lastMove = wires.map(() => 0)
  for (;;) {
    const outOfOrder = (lane: number) =>
      wires[lanes[lane]!]!.toLane > wires[lanes[lane + 1]!]!.toLane
    const candidates = lanes.flatMap((_, lane) =>
      lane + 1 < lanes.length && outOfOrder(lane) ? [lane] : [],
    )
    if (!candidates.length) break
    // A wire already travelling keeps going, which keeps its run straight.
    const continuing = (lane: number) =>
      lastMove[lanes[lane]!] === 1 || lastMove[lanes[lane + 1]!] === -1
    const taken = new Set<number>()
    const chosen: number[] = []
    for (const lane of [
      ...candidates.filter(continuing),
      ...candidates.filter((lane) => !continuing(lane)),
    ]) {
      if (taken.has(lane) || taken.has(lane + 1)) continue
      taken.add(lane).add(lane + 1)
      chosen.push(lane)
    }
    lastMove.fill(0)
    for (const lane of chosen) {
      const upper = lanes[lane]!
      const lower = lanes[lane + 1]!
      lanes[lane] = lower
      lanes[lane + 1] = upper
      lastMove[upper] = 1
      lastMove[lower] = -1
    }
    for (const [lane, wire] of lanes.entries()) positions[wire]!.push(lane)
  }
  const width = positions[0]!.length - 1
  return {
    paths: positions.map((lanesByColumn) => {
      const points = lanesByColumn.map((y, x) => ({ x, y }))
      // Keep only the points where the wire changes direction.
      const corners = points.filter((point, at) => {
        const before = points[at - 1]
        const after = points[at + 1]
        if (!before) return after !== undefined && after.y !== point.y
        if (!after) return before.y !== point.y
        return after.y - point.y !== point.y - before.y
      })
      return corners
    }),
    width,
  }
}

/** Lay out the crossings of a bundle so that two wires cross exactly when
 * their order differs between the ends, every crossing is a separate point
 * away from any bend, and no two wires share a line. One straight run per
 * moving wire is preferred, trying several placement orders and keeping the
 * narrowest; when none fits, neighboring wires are exchanged step by step.
 */
export function layoutWeave(wires: WeaveWire[]): Weave {
  const movers: Mover[] = wires
    .map((wire, index) => ({
      index,
      length: Math.abs(wire.toLane - wire.fromLane),
    }))
    .filter((mover) => mover.length > 0)
  if (!movers.length) return { paths: wires.map(() => []), width: 0 }
  const from = (mover: Mover) => wires[mover.index]!.fromLane
  const orders: ((a: Mover, b: Mover) => number)[] = [
    (a, b) => b.length - a.length || from(a) - from(b),
    (a, b) => a.length - b.length || from(a) - from(b),
    (a, b) => from(a) - from(b),
    (a, b) => from(b) - from(a),
  ]
  let best: Weave | undefined
  for (const order of orders) {
    const weave = placeInOrder(wires, [...movers].sort(order))
    if (weave && (!best || weave.width < best.width)) best = weave
  }
  return best ?? exchangeNeighbors(wires)
}
