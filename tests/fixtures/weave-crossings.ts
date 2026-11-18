import { layoutWeave } from "../../lib/harness-weave"

type Point = { x: number; y: number }

/** Where two segments meet: a point, "shared" when they run along the same
 * line, or undefined. */
function meet(a: Point, b: Point, c: Point, d: Point) {
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (Math.abs(denominator) < 1e-9) {
    const offset = (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)
    const overlap =
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
      Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))
    return Math.abs(offset) < 1e-9 && overlap > -1e-9 ? "shared" : undefined
  }
  const t =
    ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator
  const u =
    ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return undefined
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
}

/** Measure a crossing layout for wires going from lane i to lane toLanes[i],
 * independently of the code that produced it. */
export function measureWeave(toLanes: number[]) {
  const wires = toLanes.map((toLane, fromLane) => ({ fromLane, toLane }))
  const weave = layoutWeave(wires)
  const lines = wires.map((wire, index) => [
    { x: -1e4, y: wire.fromLane },
    ...weave.paths[index]!,
    { x: 1e4, y: wire.toLane },
  ])
  const crossings: Point[] = []
  let sharedLines = 0
  let wrongCrossingCounts = 0
  let clearance = Number.POSITIVE_INFINITY
  for (let i = 0; i < wires.length; i++)
    for (let j = i + 1; j < wires.length; j++) {
      const between: Point[] = []
      for (let a = 1; a < lines[i]!.length; a++)
        for (let b = 1; b < lines[j]!.length; b++) {
          const point = meet(
            lines[i]![a - 1]!,
            lines[i]![a]!,
            lines[j]![b - 1]!,
            lines[j]![b]!,
          )
          if (point === "shared") sharedLines++
          else if (point) between.push(point)
        }
      const reordered =
        (wires[i]!.fromLane - wires[j]!.fromLane) *
          (wires[i]!.toLane - wires[j]!.toLane) <
        0
      if (between.length !== (reordered ? 1 : 0)) wrongCrossingCounts++
      for (const point of between)
        for (const bend of [...weave.paths[i]!, ...weave.paths[j]!])
          clearance = Math.min(
            clearance,
            Math.hypot(point.x - bend.x, point.y - bend.y),
          )
      crossings.push(...between)
    }
  for (const [a, first] of crossings.entries())
    for (const second of crossings.slice(a + 1))
      clearance = Math.min(
        clearance,
        Math.hypot(first.x - second.x, first.y - second.y),
      )
  return {
    crossings: crossings.length,
    sharedLines,
    wrongCrossingCounts,
    clearance,
    width: weave.width,
    straightRuns: weave.paths.every((path) => path.length <= 2),
  }
}

export function* permutations(
  count: number,
  prefix: number[] = [],
): Generator<number[]> {
  if (prefix.length === count) yield prefix
  else
    for (let lane = 0; lane < count; lane++)
      if (!prefix.includes(lane)) yield* permutations(count, [...prefix, lane])
}
