/**
 * Validation des données (zod). Utilisée par scripts/validate.ts et les tests,
 * jamais par l'appli : zod appelle BigInt au chargement, absent des vieux Safari.
 */
import { CATEGORIES } from './categories'
import { buildIndex } from './model'
import { EntitySchema, TermeSchema, type Entity, type Terme } from './schema'
import tagGroups from './tags.json'

export const ALL_TAGS: string[] = Object.values(tagGroups as Record<string, string[]>).flat()

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
