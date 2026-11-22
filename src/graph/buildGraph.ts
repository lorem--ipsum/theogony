import { siblingsOf, type Index } from '../data/model'
import type { Categorie } from '../data/categories'

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

export type GraphOptions = {
  /**
   * Vue compacte (arbre complet) : sans filiations alternatives ni couples sans enfant visible.
   * Ces liens relient des personnages éloignés et emmêlent l'arbre complet ; ils restent visibles
   * dans la vue focalisée et sur les fiches.
   */
  compact?: boolean
}

/** Construit le graphe généalogique pour l'ensemble d'entités visibles. */
export function buildGraph(index: Index, visible: Set<string>, opts: GraphOptions = {}): Graph {
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
    if (opts.compact) continue
    // filiations alternatives : arêtes directes en pointillés
    const primarySet = new Set(primary)
    for (const p of index.allParents.get(id) ?? []) {
      if (visible.has(p) && !primarySet.has(p) && p !== id) addEdge(p, id, 'alt')
    }
  }

  // unions sans enfant visible : on relie quand même les conjoints visibles (sauf en vue compacte)
  if (!opts.compact) for (const id of visible) {
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

/**
 * Lignée d'un personnage, mise en valeur dans l'arbre complet : tous ses ascendants et descendants
 * (filiation principale, celle que l'arbre complet dessine) et les autres parents de ses enfants.
 */
export function lineageOf(index: Index, id: string): Set<string> {
  const out = new Set<string>([id])
  const up = [id]
  while (up.length) {
    for (const p of index.parents.get(up.pop()!) ?? []) if (!out.has(p)) out.add(p), up.push(p)
  }
  const down = [id]
  const below = new Set<string>([id])
  while (down.length) {
    const x = down.pop()!
    for (const c of index.children.get(x) ?? []) {
      const ps = index.parents.get(c) ?? []
      if (!ps.includes(x) || below.has(c)) continue
      below.add(c)
      out.add(c)
      down.push(c)
      if (x === id) for (const p of ps) out.add(p) // l'autre parent des enfants
    }
  }
  return out
}
