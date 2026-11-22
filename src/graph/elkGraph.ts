import type { Graph } from './buildGraph'

/** Positions des nœuds (coin supérieur gauche), en pixels du graphe. */
export type Positions = Map<string, { x: number; y: number }>

/** Options ELK partagées par le précalcul (scripts/generate.ts) et le calcul à la volée. */
export const ELK_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '46',
  'elk.spacing.nodeNode': '18',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  'elk.separateConnectedComponents': 'true',
  'elk.spacing.componentComponent': '60',
}

export function toElk(graph: Graph) {
  return {
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: graph.nodes.map((n) => ({ id: n.id, width: n.width, height: n.height })),
    edges: graph.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  }
}

export function fromElk(res: { children?: { id: string; x?: number; y?: number }[] }): Positions {
  const pos: Positions = new Map()
  for (const c of res.children ?? []) pos.set(c.id, { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0) })
  return pos
}

/** Clé de mise en page précalculée : vue complète, ou vue focalisée sur un personnage (toutes catégories). */
export const layoutKey = (mode: 'focus' | 'full', id: string) => (mode === 'full' ? 'full' : `f:${id}`)
