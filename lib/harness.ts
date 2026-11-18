import type { DrawingPage } from "circuit-json"
import type { HarnessDrawing } from "./harness-document"
import { renderHarnessView } from "./harness-view"

export { parseHarnessDrawing } from "./harness-document"
export type { HarnessCable, HarnessDrawing } from "./harness-document"
export { resolveCableEnds } from "./cable-ends"
export type { CableEnds } from "./cable-ends"

/** Vector harness views for one page. They need no scene resolver: connector
 * outlines come from cableprinter dimensions, wiring from Circuit JSON. */
export function renderHarnessPage(harness: HarnessDrawing, page: DrawingPage) {
  return harness.views
    .filter((view) => view.drawing_page_id === page.drawing_page_id)
    .map((view) =>
      renderHarnessView(
        view,
        page,
        harness.cables.get(view.cad_cable_id)!,
        harness.balloons.filter(
          (b) =>
            b.drawing_wiring_harness_view_id ===
            view.drawing_wiring_harness_view_id,
        ),
      ),
    )
    .join("")
}
