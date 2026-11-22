// Pas d'import de valeur depuis ./schema : zod ne doit pas entrer dans le bundle de l'appli.
import type { Entity } from './schema'

export type Index = {
  entities: Entity[]
  byId: Map<string, Entity>
  /** parents de la filiation principale */
  parents: Map<string, string[]>
  /** tous les parents connus (toutes filiations) */
  allParents: Map<string, Set<string>>
  /** enfants dérivés (toutes filiations) */
  children: Map<string, Set<string>>
  /** unions symétriques */
  spouses: Map<string, Set<string>>
  /** histoires d'autres entités qui mentionnent celle-ci */
  mentions: Map<string, { from: string; titre: string }[]>
}

function push<K, V>(map: Map<K, Set<V>>, k: K, v: V) {
  let s = map.get(k)
  if (!s) map.set(k, (s = new Set()))
  s.add(v)
}

export function primaryFiliation(e: Entity) {
  return e.filiations.find((f) => f.principale) ?? e.filiations[0]
}

/** Frères et sœurs partageant les mêmes parents principaux (germains). */
export function siblingsOf(index: Index, id: string): string[] {
  const mine = index.parents.get(id) ?? []
  if (mine.length === 0) return []
  const key = [...mine].sort().join('+')
  const out: string[] = []
  for (const s of index.children.get(mine[0]) ?? []) {
    if (s !== id && [...(index.parents.get(s) ?? [])].sort().join('+') === key) out.push(s)
  }
  return out
}

export function buildIndex(entities: Entity[]): Index {
  const byId = new Map(entities.map((e) => [e.id, e]))
  const parents = new Map<string, string[]>()
  const allParents = new Map<string, Set<string>>()
  const children = new Map<string, Set<string>>()
  const spouses = new Map<string, Set<string>>()
  const mentions = new Map<string, { from: string; titre: string }[]>()

  for (const e of entities) {
    const p = primaryFiliation(e)
    parents.set(e.id, (p?.parents ?? []).filter((x) => byId.has(x)))
    for (const f of e.filiations)
      for (const pid of f.parents) {
        if (!byId.has(pid)) continue
        push(allParents, e.id, pid)
        push(children, pid, e.id)
      }
    for (const u of e.unions ?? []) {
      if (!byId.has(u.avec)) continue
      push(spouses, e.id, u.avec)
      push(spouses, u.avec, e.id)
    }
    for (const h of e.histoires)
      for (const pid of h.personnages ?? []) {
        if (pid === e.id || !byId.has(pid)) continue
        const arr = mentions.get(pid) ?? []
        arr.push({ from: e.id, titre: h.titre })
        mentions.set(pid, arr)
      }
  }
  return { entities, byId, parents, allParents, children, spouses, mentions }
}
