import type { Graph } from './buildGraph'
import type { Layout } from './elkGraph'

/** Format de src/generated/layouts.json : positions [x, y] par nœud, et tracés des arêtes si présents. */
type Stored = { n: Record<string, [number, number]>; e?: Record<string, [number, number][]> }
type Precomputed = Record<string, Stored>

let precomputed: Promise<Precomputed> | null = null
/** Positions précalculées au build (src/generated/layouts.json), chargées une seule fois. */
export function loadPrecomputed() {
  return (precomputed ??= import('../generated/layouts.json').then((m) => m.default as unknown as Precomputed))
}

const cache = new Map<string, Layout>()

/**
 * Mise en page du graphe : d'abord celle précalculée pour `key` (si elle couvre exactement
 * les nœuds du graphe), sinon ELK à la volée. `full` : options de l'arbre complet.
 */
export async function layoutGraph(graph: Graph, key: string | null, full: boolean): Promise<Layout> {
  const sig = graph.nodes.map((n) => n.id).sort().join('|') + '#' + graph.edges.map((e) => e.id).sort().join('|')
  const hit = cache.get(sig)
  if (hit) return hit

  let layout: Layout | null = null
  if (key) {
    const entry = (await loadPrecomputed())[key]
    const n = entry?.n
    if (n && graph.nodes.length === Object.keys(n).length && graph.nodes.every((x) => n[x.id])) {
      layout = {
        pos: new Map(graph.nodes.map((x) => [x.id, { x: n[x.id][0], y: n[x.id][1] }])),
        routes: entry.e ? new Map(Object.entries(entry.e)) : null,
      }
    }
  }
  if (!layout) {
    const { elkLayout } = await import('./elkLayout')
    layout = await elkLayout(graph, full)
  }
  if (cache.size > 200) cache.clear()
  cache.set(sig, layout)
  return layout
}
