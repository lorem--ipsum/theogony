import { siblingsOf, type Index } from '../data/model'
import type { Categorie } from '../data/schema'

export type GNode =
  | { id: string; kind: 'entity'; entityId: string; label: string; categorie: Categorie; width: number; height: number }
  | { id: string; kind: 'union'; width: number; height: number }

export type GEdge = { id: string; source: string; target: string; kind: 'parent' | 'child' | 'alt' | 'spouse' }

export type Graph = { nodes: GNode[]; edges: GEdge[] }

export const NODE_HEIGHT = 34
export const UNION_SIZE = 8

export function nodeWidth(label: string) {
  return Math.max(72, Math.round(label.length * 7.4 + 34))
}

const unionId = (a: string, b: string) => `u:${[a, b].sort().join('+')}`

/** Construit le graphe généalogique pour l'ensemble d'entités visibles. */
export function buildGraph(index: Index, visible: Set<string>): Graph {
  const nodes: GNode[] = []
  const edges: GEdge[] = []
  const unions = new Set<string>()
  const edgeIds = new Set<string>()

  const addEdge = (source: string, target: string, kind: GEdge['kind']) => {
    const id = `${kind}:${source}->${target}`
    if (edgeIds.has(id)) return
    edgeIds.add(id)
    edges.push({ id, source, target, kind })
  }
  const ensureUnion = (a: string, b: string) => {
    const uid = unionId(a, b)
    if (!unions.has(uid)) {
      unions.add(uid)
      nodes.push({ id: uid, kind: 'union', width: UNION_SIZE, height: UNION_SIZE })
      const [x, y] = [a, b].sort()
      addEdge(x, uid, 'spouse')
      addEdge(y, uid, 'spouse')
    }
    return uid
  }

  for (const id of visible) {
    const e = index.byId.get(id)
    if (!e) continue
    nodes.push({
      id,
      kind: 'entity',
      entityId: id,
      label: e.nom,
      categorie: e.categorie,
      width: nodeWidth(e.nom),
      height: NODE_HEIGHT,
    })
  }

  for (const id of visible) {
    const e = index.byId.get(id)
    if (!e) continue
    const primary = (index.parents.get(id) ?? []).filter((p) => visible.has(p) && p !== id)
    if (primary.length === 2) {
      addEdge(ensureUnion(primary[0], primary[1]), id, 'child')
    } else if (primary.length === 1) {
      addEdge(primary[0], id, 'parent')
    }
    // filiations alternatives : arêtes directes en pointillés
    const primarySet = new Set(primary)
    for (const p of index.allParents.get(id) ?? []) {
      if (visible.has(p) && !primarySet.has(p) && p !== id) addEdge(p, id, 'alt')
    }
  }

  // unions sans enfant visible : on relie quand même les conjoints visibles
  for (const id of visible) {
    for (const s of index.spouses.get(id) ?? []) {
      if (visible.has(s) && id < s) ensureUnion(id, s)
    }
  }

  return { nodes, edges }
}

/**
 * Voisinage d'un personnage pour la vue focalisée :
 * lui-même, 2 générations d'ascendants, enfants, conjoints, frères et sœurs.
 */
export function focusSet(index: Index, id: string): Set<string> {
  const out = new Set<string>([id])
  const parents = index.parents.get(id) ?? []
  for (const p of parents) {
    out.add(p)
    for (const gp of index.parents.get(p) ?? []) out.add(gp)
  }
  for (const s of siblingsOf(index, id)) out.add(s)
  for (const c of index.children.get(id) ?? []) out.add(c)
  for (const s of index.spouses.get(id) ?? []) out.add(s)
  // l'autre parent des enfants (pour rattacher les unions)
  for (const c of index.children.get(id) ?? []) for (const p of index.parents.get(c) ?? []) out.add(p)
  return out
}
