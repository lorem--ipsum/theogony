/**
 * npm run validate            → valide toutes les données + cohérence avec ids.md
 * npm run validate -- <file>  → valide un seul fichier (références vérifiées contre ids.md)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validate, validateGlossary } from '../src/data/model'

const dataDir = join(import.meta.dirname, '../src/data')
const dir = join(dataDir, 'entities')

// ids.md → { fichier: [ids] }
const sections = new Map<string, string[]>()
let current = ''
for (const line of readFileSync(join(dataDir, 'ids.md'), 'utf8').split('\n')) {
  const h = line.match(/^## (\S+\.json)/)
  if (h) sections.set((current = h[1]), [])
  else if (current && line.includes('|')) sections.get(current)!.push(line.split('|')[0].trim())
}
const masterIds = new Set([...sections.values()].flat())

const only = process.argv[2]?.replace(/^.*\//, '')
const files = only ? [only] : readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
const all: unknown[] = []
const errors: string[] = []

for (const f of files) {
  const path = join(dir, f)
  if (!existsSync(path)) {
    errors.push(`${f}: fichier absent`)
    continue
  }
  const data = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(data)) throw new Error(`${f} doit contenir un tableau`)
  console.log(`${f.padEnd(34)} ${data.length} entités`)
  all.push(...data)
  const expected = sections.get(f)
  if (!expected) errors.push(`${f}: absent de ids.md`)
  else {
    const got = new Set(data.map((d: { id?: string }) => d.id))
    for (const id of expected) if (!got.has(id)) errors.push(`${f}: entité manquante "${id}"`)
    for (const id of got) if (!expected.includes(id as string)) errors.push(`${f}: "${id}" n'est pas listé dans cette section de ids.md`)
  }
}

errors.push(...validate(all, only ? { knownIds: masterIds } : {}))
if (!only) {
  for (const f of sections.keys()) if (!files.includes(f)) errors.push(`${f}: fichier absent`)
  const glossary = JSON.parse(readFileSync(join(dataDir, 'glossaire.json'), 'utf8'))
  console.log(`${'glossaire.json'.padEnd(34)} ${glossary.length} termes`)
  errors.push(...validateGlossary(glossary, masterIds))
}

console.log(`\nTotal : ${all.length} entités`)
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) :`)
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
console.log('Données valides.')
