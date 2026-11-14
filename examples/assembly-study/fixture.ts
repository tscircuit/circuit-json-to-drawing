import { gunzipSync } from "node:zlib"
import { readFile } from "node:fs/promises"
import { loadParts } from "./geometry"
import { createDrawingRecords } from "./drawings"
import type { DrawingDocument } from "../../lib"

export async function loadFidgetFixture(factor = 1) {
  const source: DrawingDocument = JSON.parse(
    gunzipSync(
      await readFile(
        new URL("./assets/source.circuit.json.gz", import.meta.url),
      ),
    ).toString(),
  )
  const bytes = gunzipSync(
    await readFile(new URL("./assets/assembly.glb.gz", import.meta.url)),
  )
  const parts = await loadParts(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  )
  return { source, parts, input: [...source, ...createDrawingRecords(factor)] }
}
