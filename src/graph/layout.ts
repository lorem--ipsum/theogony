import ELK from 'elkjs/lib/elk-api.js'
import workerUrl from 'elkjs/lib/elk-worker.min.js?url'
import type { Graph } from './buildGraph'

const elk = new ELK({ workerFactory: () => new Worker(workerUrl) })

export type Positions = Map<string, { x: number; y: number }>

const cache = new Map<string, Positions>()

/** Mise en page généalogique (haut → bas) calculée par ELK dans un Web Worker. */
export async function layoutGraph(graph: Graph): Promise<Positions> {
  const key = graph.nodes.map((n) => n.id).sort().join('|') + '#' + graph.edges.length
  const hit = cache.get(key)
  if (hit) return hit

  const res = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '46',
      'elk.spacing.nodeNode': '18',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '60',
    },
    children: graph.nodes.map((n) => ({ id: n.id, width: n.width, height: n.height })),
    edges: graph.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  })

  const pos: Positions = new Map()
  for (const c of res.children ?? []) pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 })
  if (cache.size > 200) cache.clear()
  cache.set(key, pos)
  return pos
}
