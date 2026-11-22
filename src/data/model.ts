import { CATEGORIES, EntitySchema, TermeSchema, type Entity, type Terme } from './schema'
import tagGroups from './tags.json'

export const TAG_GROUPS = tagGroups as Record<string, string[]>
export const ALL_TAGS: string[] = Object.values(TAG_GROUPS).flat()

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

/** Vérifie la structure et l'intégrité référentielle ; renvoie la liste des erreurs. */
export function validate(
  raw: unknown[],
  opts: { tags?: string[]; knownIds?: Set<string> } = {},
): string[] {
  const errors: string[] = []
  const tagSet = new Set(opts.tags ?? ALL_TAGS)
  const entities: Entity[] = []
  raw.forEach((r, i) => {
    const res = EntitySchema.safeParse(r)
    if (!res.success) {
      const label = (r as { id?: string })?.id ?? `#${i}`
      for (const iss of res.error.issues) errors.push(`${label}: ${iss.path.join('.')} ${iss.message}`)
    } else entities.push(res.data)
  })

  const ids = new Set<string>()
  for (const e of entities) {
    if (ids.has(e.id)) errors.push(`${e.id}: id dupliqué`)
    ids.add(e.id)
  }
  const known = opts.knownIds ?? ids
  const ref = (owner: string, where: string, target: string) => {
    if (!known.has(target)) errors.push(`${owner}: ${where} référence inconnue "${target}"`)
  }
  for (const e of entities) {
    for (const t of e.tags) if (!tagSet.has(t)) errors.push(`${e.id}: tag inconnu "${t}"`)
    if (e.filiations.filter((f) => f.principale).length > 1)
      errors.push(`${e.id}: plusieurs filiations principales`)
    e.filiations.forEach((f) => f.parents.forEach((p) => {
      ref(e.id, 'filiation', p)
      if (p === e.id) errors.push(`${e.id}: est son propre parent`)
    }))
    e.unions?.forEach((u) => ref(e.id, 'union', u.avec))
    e.histoires.forEach((h) => h.personnages?.forEach((p) => ref(e.id, `histoire "${h.titre}"`, p)))
  }

  // cycles sur la filiation principale
  const idx = buildIndex(entities)
  const state = new Map<string, 1 | 2>()
  const visit = (id: string, path: string[]): void => {
    const s = state.get(id)
    if (s === 2) return
    if (s === 1) {
      errors.push(`cycle de filiation : ${[...path, id].join(' → ')}`)
      return
    }
    state.set(id, 1)
    for (const p of idx.parents.get(id) ?? []) visit(p, [...path, id])
    state.set(id, 2)
  }
  for (const e of entities) visit(e.id, [])
  return errors
}

/** Vérifie le glossaire : schéma, ids uniques, renvois et exemples existants, une entrée par catégorie. */
export function validateGlossary(raw: unknown[], entityIds: Set<string>): string[] {
  const errors: string[] = []
  const terms: Terme[] = []
  raw.forEach((r, i) => {
    const res = TermeSchema.safeParse(r)
    if (!res.success) {
      const label = (r as { id?: string })?.id ?? `#${i}`
      for (const iss of res.error.issues) errors.push(`glossaire ${label}: ${iss.path.join('.')} ${iss.message}`)
    } else terms.push(res.data)
  })
  const ids = new Set<string>()
  for (const t of terms) {
    if (ids.has(t.id)) errors.push(`glossaire ${t.id}: id dupliqué`)
    ids.add(t.id)
  }
  for (const t of terms) {
    t.voir?.forEach((v) => !ids.has(v) && errors.push(`glossaire ${t.id}: renvoi inconnu "${v}"`))
    t.exemples?.forEach((x) => !entityIds.has(x) && errors.push(`glossaire ${t.id}: exemple inconnu "${x}"`))
  }
  for (const c of CATEGORIES)
    if (!terms.some((t) => t.categorie === c)) errors.push(`glossaire : aucune entrée pour la catégorie "${c}"`)
  return errors
}
