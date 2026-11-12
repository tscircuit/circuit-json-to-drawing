import { mat4 } from "gl-matrix"
import {
  computeWorldAABB,
  type DrawCall,
  type Camera,
  type ExplosionLine,
} from "poppygl"
import {
  drawing_assembly_stage,
  drawing_explosion,
  drawing_part_label,
  drawing_page_note,
  drawing_part_view,
  drawing_page,
  type DrawingPartSelection,
  type DrawingAssemblyStage,
  type DrawingExplosion,
  type DrawingPartLabel,
  type DrawingPartView,
  type DrawingPage,
} from "circuit-json"
import type { DrawingDocument, DrawingPoint } from "./types"
import { cadToGltf } from "./coordinates"
import { projectDrawingPoint } from "./projection"
import { escapeXml } from "./svg"

export type {
  DrawingPartSelection,
  DrawingAssemblyStage,
  DrawingExplosion,
  DrawingPartLabel,
  DrawingPageNote,
} from "circuit-json"
/** Placed geometry with exactly one source identity, in canonical glTF +Y-up mm.
 * Multiple primitives or entries may share one identity and move as a unit. */
export interface DrawingScenePart {
  source_component_id?: string
  pcb_board_id?: string
  drawCalls: DrawCall[]
}
const key = (part: DrawingScenePart) => {
  if (Boolean(part.source_component_id) === Boolean(part.pcb_board_id))
    throw Error(
      "Scene part must have exactly one source component or PCB board identity",
    )
  return part.source_component_id
    ? `source:${part.source_component_id}`
    : `board:${part.pcb_board_id}`
}
export function renderAssemblyPageNotes(
  input: DrawingDocument,
  page: DrawingPage,
) {
  return input
    .filter((r) => r.type === "drawing_page_note")
    .map((r) => drawing_page_note.parse(r))
    .filter((n) => n.drawing_page_id === page.drawing_page_id)
    .map(
      (n) =>
        `<text x="${page.width / 2 + n.position.x}" y="${page.height / 2 - n.position.y}" font-size="${n.font_size ?? 2.7}" fill="#263641">${escapeXml(n.text)}</text>`,
    )
    .join("")
}

/** Scalar validation belongs to circuit-json; reference/selection validation belongs here. */
export function parseAssemblyDrawing(input: DrawingDocument) {
  const stages = new Map<string, DrawingAssemblyStage>(),
    explosions = new Map<string, DrawingExplosion>()
  const labels: DrawingPartLabel[] = [],
    labelIds = new Set<string>(),
    noteIds = new Set<string>()
  const pages = input
    .filter((r) => r.type === "drawing_page")
    .map((r) => drawing_page.parse(r))
  const views = new Map(
    input
      .filter((r) => r.type === "drawing_part_view")
      .map((r) => {
        const v = drawing_part_view.parse(r)
        return [v.drawing_part_view_id, v]
      }),
  )
  for (const r of input) {
    if (r.type === "drawing_page_note") {
      const n = drawing_page_note.parse(r),
        page = pages.find((p) => p.drawing_page_id === n.drawing_page_id)
      if (noteIds.has(n.drawing_page_note_id))
        throw Error("Duplicate page note ID")
      noteIds.add(n.drawing_page_note_id)
      if (
        !page ||
        Math.abs(n.position.x) > page.width / 2 ||
        Math.abs(n.position.y) > page.height / 2
      )
        throw Error(
          "Page note references a missing page or lies outside its page",
        )
    }
    if (r.type === "drawing_assembly_stage") {
      const s = drawing_assembly_stage.parse(r)
      if (stages.has(s.drawing_assembly_stage_id))
        throw Error("Duplicate assembly stage ID")
      stages.set(s.drawing_assembly_stage_id, s)
    }
    if (r.type === "drawing_explosion") {
      const e = drawing_explosion.parse(r)
      if (explosions.has(e.drawing_explosion_id))
        throw Error("Duplicate explosion ID")
      explosions.set(e.drawing_explosion_id, e)
    }
    if (r.type === "drawing_part_label") {
      const l = drawing_part_label.parse(r)
      if (labelIds.has(l.drawing_part_label_id))
        throw Error("Duplicate part label ID")
      labelIds.add(l.drawing_part_label_id)
      labels.push(l)
    }
  }
  const sourceIds = new Set(
    input.flatMap((r) =>
      r.type === "source_component" &&
      "source_component_id" in r &&
      typeof r.source_component_id === "string"
        ? [r.source_component_id]
        : [],
    ),
  )
  const boardIds = new Set(
    input.flatMap((r) =>
      r.type === "pcb_board" &&
      "pcb_board_id" in r &&
      typeof r.pcb_board_id === "string"
        ? [r.pcb_board_id]
        : [],
    ),
  )
  const members = new Map<string, Set<string>>()
  function select(s: DrawingPartSelection, path: string[] = []): Set<string> {
    const result = new Set<string>()
    for (const id of s.source_component_ids ?? []) {
      if (!sourceIds.has(id)) throw Error(`Unknown source component: ${id}`)
      result.add(`source:${id}`)
    }
    for (const id of s.pcb_board_ids ?? []) {
      if (!boardIds.has(id)) throw Error(`Unknown PCB board: ${id}`)
      result.add(`board:${id}`)
    }
    for (const id of s.includes_stage_ids ?? []) {
      if (path.includes(id))
        throw Error(`Assembly stage cycle: ${[...path, id].join(" -> ")}`)
      const stage = stages.get(id)
      if (!stage) throw Error(`Unknown assembly stage: ${id}`)
      const nested = members.get(id) ?? select(stage, [...path, id])
      members.set(id, nested)
      for (const member of nested) result.add(member)
    }
    if (!result.size) throw Error("Assembly selection is empty")
    return result
  }
  for (const s of stages.values())
    select({ includes_stage_ids: [s.drawing_assembly_stage_id] })
  for (const e of explosions.values()) {
    const moved = new Set<string>()
    for (const m of e.moves)
      for (const id of select(m)) {
        if (moved.has(id)) throw Error(`Overlapping explosion moves: ${id}`)
        moved.add(id)
      }
  }
  for (const v of views.values()) {
    if (v.drawing_assembly_stage_id)
      select({ includes_stage_ids: [v.drawing_assembly_stage_id] })
    if (v.drawing_explosion_id && !explosions.has(v.drawing_explosion_id))
      throw Error(`Unknown explosion: ${v.drawing_explosion_id}`)
  }
  for (const l of labels) {
    const v = views.get(l.drawing_part_view_id)
    if (!v) throw Error(`Unknown label view: ${l.drawing_part_view_id}`)
    const ids = select(l)
    const visible = v.drawing_assembly_stage_id
      ? select({ includes_stage_ids: [v.drawing_assembly_stage_id] })
      : v.source_component_ids
        ? select({ source_component_ids: v.source_component_ids })
        : undefined
    if (visible)
      for (const id of ids)
        if (!visible.has(id)) throw Error(`Label targets a hidden part: ${id}`)
    const e = v.drawing_explosion_id
      ? explosions.get(v.drawing_explosion_id)
      : undefined
    const translations = [...ids].map((id) => {
      const m = e?.moves.find((m) => select(m).has(id)),
        f = e?.factor ?? 1
      return JSON.stringify(
        m
          ? [m.translation.x * f, m.translation.y * f, m.translation.z * f]
          : [0, 0, 0],
      )
    })
    if (new Set(translations).size > 1)
      throw Error("Label targets parts with different explosion translations")
  }
  return { stages, explosions, labels, select, views }
}

export function resolveAssemblyView(
  viewId: string,
  parts: DrawingScenePart[],
  config: ReturnType<typeof parseAssemblyDrawing>,
) {
  const view = config.views.get(viewId)
  if (!view) throw Error(`Unknown assembly view: ${viewId}`)
  if (view.source_group_id)
    throw Error(
      "resolveSceneParts does not resolve legacy source_group_id; use an assembly stage",
    )
  const visible = view.drawing_assembly_stage_id
    ? config.select({ includes_stage_ids: [view.drawing_assembly_stage_id] })
    : view.source_component_ids
      ? config.select({ source_component_ids: view.source_component_ids })
      : new Set(parts.map(key))
  const explosion = view.drawing_explosion_id
    ? config.explosions.get(view.drawing_explosion_id)
    : undefined
  const shifts = new Map<string, DrawingPoint>()
  for (const move of explosion?.moves ?? []) {
    const f = explosion?.factor ?? 1
    for (const id of config.select(move))
      shifts.set(id, {
        x: move.translation.x * f,
        y: move.translation.y * f,
        z: move.translation.z * f,
      })
  }
  const available = new Set(parts.map(key))
  for (const id of visible)
    if (!available.has(id))
      throw Error(`Scene resolver missing selected geometry: ${id}`)
  for (const label of config.labels.filter(
    (l) => l.drawing_part_view_id === viewId,
  ))
    for (const id of config.select(label))
      if (!visible.has(id) || !available.has(id))
        throw Error(`Label targets unavailable geometry: ${id}`)
  const drawCalls = parts
    .filter((p) => visible.has(key(p)))
    .flatMap((part) => {
      const shift = shifts.get(key(part)) ?? { x: 0, y: 0, z: 0 }
      const translation = mat4.fromTranslation(
        mat4.create(),
        cadToGltf([shift.x, shift.y, shift.z]),
      )
      return part.drawCalls.map((dc) => ({
        ...dc,
        model: mat4.multiply(mat4.create(), translation, dc.model),
      }))
    })
  const explosionLines: ExplosionLine[] = []
  if (explosion?.show_trails)
    for (const move of explosion.moves) {
      const selected = config.select(move)
      const calls = parts
        .filter((p) => visible.has(key(p)) && selected.has(key(p)))
        .flatMap((p) => p.drawCalls)
      if (!calls.length || !(explosion.factor ?? 1)) continue
      const bounds = computeWorldAABB(calls)
      const origin = bounds.min.map((n, i) => (n + bounds.max[i]!) / 2) as [
        number,
        number,
        number,
      ]
      const shift = cadToGltf([
        move.translation.x,
        move.translation.y,
        move.translation.z,
      ])
      const tip = origin.map(
        (n, i) => n + shift[i]! * (explosion.factor ?? 1),
      ) as [number, number, number]
      explosionLines.push({
        points: [tip, origin],
        color: [0.38, 0.44, 0.48],
        dashed: true,
        arrow: true,
      })
    }
  return {
    scene: { gltf: { asset: { version: "2.0" } }, drawCalls },
    explosionLines,
    annotations: (
      page: DrawingPage,
      parsedView: DrawingPartView,
      camera: Camera,
    ) => {
      const px = (p: { x: number; y: number }) => ({
        x: page.width / 2 + p.x,
        y: page.height / 2 - p.y,
      })
      return config.labels
        .filter((l) => l.drawing_part_view_id === viewId)
        .map((l) => {
          const ids = [...config.select(l)]
          const shift = shifts.get(ids[0]!) ?? { x: 0, y: 0, z: 0 }
          if (
            ids.some(
              (id) =>
                JSON.stringify(shifts.get(id) ?? { x: 0, y: 0, z: 0 }) !==
                JSON.stringify(shift),
            )
          )
            throw Error(
              "Label targets parts with different explosion translations",
            )
          const p = px(
            projectDrawingPoint(
              {
                x: l.anchor.x + shift.x,
                y: l.anchor.y + shift.y,
                z: l.anchor.z + shift.z,
              },
              parsedView,
              camera,
            ),
          )
          const t = px(l.label_position)
          const left = t.x < p.x
          const end = t.x + (left ? 1 : -1)
          return `<g data-part-label="${escapeXml(l.drawing_part_label_id)}"><path d="M${p.x} ${p.y} L${end} ${t.y}" fill="none" stroke="#677780" stroke-width="0.22"/><circle cx="${p.x}" cy="${p.y}" r="0.55" fill="#253744"/><rect x="${left ? t.x - 36 : t.x}" y="${t.y - 3}" width="36" height="5" fill="white"/><text x="${t.x}" y="${t.y}" text-anchor="${left ? "end" : "start"}" font-size="2.6" fill="#253744">${escapeXml(l.text)}</text></g>`
        })
        .join("")
    },
  }
}
