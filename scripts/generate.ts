/**
 * npm run generate — prépare les données pour l'appli (src/generated/, non versionné) :
 *  - core.json    : personnages sans leurs histoires (chargé au démarrage)
 *  - stories.json : histoires par personnage (chargées en différé ; « apparaît aussi dans » en est déduit)
 *  - layouts.json : positions du graphe précalculées avec ELK pour chaque vue focalisée et la vue complète,
 *                   pour ne pas faire tourner ELK sur l'appareil (très lent sur un vieil iPad).
 * À relancer après toute modification de src/data/entities (fait automatiquement par dev et build).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ELK from 'elkjs/lib/elk.bundled.js'
import { buildIndex } from '../src/data/model'
import type { Entity } from '../src/data/schema'
import { buildGraph, focusSet } from '../src/graph/buildGraph'
import { fromElk, layoutKey, toElk } from '../src/graph/elkGraph'

const root = join(import.meta.dirname, '..')
const dir = join(root, 'src/data/entities')
const out = join(root, 'src/generated')
mkdirSync(out, { recursive: true })

const entities: Entity[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Entity[])
  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

const index = buildIndex(entities)

const core = entities.map(({ histoires: _h, ...rest }) => rest)
const stories = Object.fromEntries(entities.map((e) => [e.id, e.histoires]))

const elk = new ELK()
const layouts: Record<string, Record<string, [number, number]>> = {}
const t0 = Date.now()
const views: [string, Set<string>][] = [
  [layoutKey('full', ''), new Set(entities.map((e) => e.id))],
  ...entities.map((e): [string, Set<string>] => [layoutKey('focus', e.id), focusSet(index, e.id)]),
]
for (const [key, visible] of views) {
  const pos = fromElk(await elk.layout(toElk(buildGraph(index, visible))))
  layouts[key] = Object.fromEntries([...pos].map(([id, p]) => [id, [p.x, p.y]]))
}

const write = (name: string, data: unknown) => {
  const s = JSON.stringify(data)
  writeFileSync(join(out, name), s)
  return `${name} ${(s.length / 1024).toFixed(0)} Ko`
}
console.log(
  [write('core.json', core), write('stories.json', stories), write('layouts.json', layouts)].join(' · '),
  `· ${views.length} mises en page en ${((Date.now() - t0) / 1000).toFixed(1)} s`,
)
