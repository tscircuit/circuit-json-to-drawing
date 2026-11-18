import {
  type CableConnector,
  parseCableString,
  parseConnectorString,
} from "@tscircuit/cableprinter"

export interface CableEnds {
  from: CableConnector
  to: CableConnector
  /** Outside diameter of a single round jacket, mm, when the definition has one. */
  jacketDiameter?: number
}

/** Resolve both mating interfaces of a cableprinter string; connector A is the
 * cable's from end. Adapter ends are parsed independently: a cable with explicit
 * wires may join connectors with different contact counts, which the combined
 * adapter definition rejects.
 */
export function resolveCableEnds(cableprinterString: string): CableEnds {
  const name = cableprinterString.trim().toLowerCase()
  const adapter = /^adaptercable_(a|b)\(([^()]+)\)_(a|b)\(([^()]+)\)$/.exec(
    name,
  )
  if (adapter && adapter[1] !== adapter[3]) {
    const first = parseConnectorString(adapter[2]!)
    const second = parseConnectorString(adapter[4]!)
    return adapter[1] === "a"
      ? { from: first, to: second }
      : { from: second, to: first }
  }
  const definition = parseCableString(name)
  return {
    from: definition.connectorA,
    to: definition.connectorB,
    jacketDiameter:
      definition.crossSection.kind === "round_jacket"
        ? definition.crossSection.diameter
        : undefined,
  }
}

/** Numbered contact positions of a connector; undefined when it has no pin row. */
export function contactCount(connector: CableConnector): number | undefined {
  return "pinCount" in connector ? connector.pinCount : undefined
}
