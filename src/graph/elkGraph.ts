import type { Graph } from './buildGraph'

type Point = { x: number; y: number }

/** Positions des nœuds (coin supérieur gauche), en pixels du graphe. */
export type Positions = Map<string, Point>

/** Tracés des arêtes calculés par ELK (points successifs, coudes compris). */
export type Routes = Map<string, [number, number][]>

export type Layout = { pos: Positions; routes: Routes | null }

/** Options ELK partagées par le précalcul (scripts/generate.ts) et le calcul à la volée. */
export const ELK_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.spacing.nodeNodeBetweenLayers': '46',
  'elk.spacing.nodeNode': '18',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  // les arêtes issues d'un même nœud partagent leur tronc (éventail parents → enfants)
  'elk.layered.mergeEdges': 'true',
  'elk.separateConnectedComponents': 'true',
  'elk.spacing.componentComponent': '60',
}

/** Arbre complet : espacements resserrés (mesuré : −10 % de largeur, −12 % de longueur d'arêtes). */
export const ELK_OPTIONS_FULL: Record<string, string> = {
  ...ELK_OPTIONS,
  'elk.spacing.nodeNode': '12',
  'elk.layered.spacing.edgeNodeBetweenLayers': '10',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '6',
}

export function toElk(graph: Graph, full = false) {
  return {
    id: 'root',
    layoutOptions: full ? ELK_OPTIONS_FULL : ELK_OPTIONS,
    children: graph.nodes.map((n) => ({ id: n.id, width: n.width, height: n.height })),
    edges: graph.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  }
}

type ElkResult = {
  children?: { id: string; x?: number; y?: number }[]
  edges?: { id: string; sections?: { startPoint: Point; endPoint: Point; bendPoints?: Point[] }[] }[]
}

export function fromElk(res: ElkResult, withRoutes: boolean): Layout {
  const pos: Positions = new Map()
  for (const c of res.children ?? []) pos.set(c.id, { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0) })
  let routes: Routes | null = null
  if (withRoutes) {
    routes = new Map()
    for (const e of res.edges ?? []) {
      const s = e.sections?.[0]
      if (!s) continue
      routes.set(
        e.id,
        [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map((p) => [Math.round(p.x), Math.round(p.y)] as [number, number]),
      )
    }
  }
  return { pos, routes }
}

/** Clé de mise en page précalculée : vue complète, ou vue focalisée sur un personnage (toutes catégories). */
export const layoutKey = (mode: 'focus' | 'full', id: string) => (mode === 'full' ? 'full' : `f:${id}`)
