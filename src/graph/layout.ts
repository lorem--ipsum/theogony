import type { Graph } from './buildGraph'
import type { Positions } from './elkGraph'

type Precomputed = Record<string, Record<string, [number, number]>>

let precomputed: Promise<Precomputed> | null = null
/** Positions précalculées au build (src/generated/layouts.json), chargées une seule fois. */
export function loadPrecomputed() {
  return (precomputed ??= import('../generated/layouts.json').then((m) => m.default as unknown as Precomputed))
}

const cache = new Map<string, Positions>()

/**
 * Positions des nœuds : d'abord la mise en page précalculée correspondant à `key`
 * (si elle couvre exactement les nœuds du graphe), sinon ELK à la volée.
 */
export async function layoutGraph(graph: Graph, key: string | null): Promise<Positions> {
  const sig = graph.nodes.map((n) => n.id).sort().join('|') + '#' + graph.edges.length
  const hit = cache.get(sig)
  if (hit) return hit

  let pos: Positions | null = null
  if (key) {
    const entry = (await loadPrecomputed())[key]
    if (entry && graph.nodes.length === Object.keys(entry).length && graph.nodes.every((n) => entry[n.id])) {
      pos = new Map(graph.nodes.map((n) => [n.id, { x: entry[n.id][0], y: entry[n.id][1] }]))
    }
  }
  if (!pos) {
    const { elkLayout } = await import('./elkLayout')
    pos = await elkLayout(graph)
  }
  if (cache.size > 200) cache.clear()
  cache.set(sig, pos)
  return pos
}
