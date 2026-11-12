import { any_circuit_element, type AnyCircuitElement } from "circuit-json"
import records from "./drawing-records.json"

/** Authored configuration from the reviewed fidget-counter study. Geometry is resolved separately. */
export function createDrawingRecords(factor = 1): AnyCircuitElement[] {
  return records.map((record) =>
    any_circuit_element.parse(
      record.type === "drawing_explosion" ? { ...record, factor } : record,
    ),
  )
}
