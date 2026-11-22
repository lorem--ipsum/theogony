import raw from './glossaire.json'
import type { Categorie, Terme } from './schema'

export const terms: Terme[] = (raw as Terme[]).slice().sort((a, b) => a.terme.localeCompare(b.terme, 'fr'))
export const termById = new Map(terms.map((t) => [t.id, t]))
export const termForCategory = new Map<Categorie, Terme>(
  terms.filter((t) => t.categorie).map((t) => [t.categorie!, t]),
)
