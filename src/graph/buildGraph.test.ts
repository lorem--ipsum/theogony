import { describe, expect, it } from 'vitest'
import { buildIndex } from '../data/model'
import { validate } from '../data/validation'
import type { Entity } from '../data/schema'
import { buildGraph, focusSet } from './buildGraph'

const e = (id: string, parents: string[] = [], extra: Partial<Entity> = {}): Entity => ({
  id,
  nom: id[0].toUpperCase() + id.slice(1),
  categorie: 'dieu',
  tags: ['ciel'],
  filiations: parents.length ? [{ parents, principale: true }] : [],
  histoires: [],
  ...extra,
})

const data: Entity[] = [
  e('ouranos'),
  e('gaia'),
  e('cronos', ['ouranos', 'gaia']),
  e('rhea', ['ouranos', 'gaia']),
  e('zeus', ['cronos', 'rhea'], { unions: [{ avec: 'hera' }, { avec: 'metis' }] }),
  e('hera', ['cronos', 'rhea']),
  e('metis'),
  e('ares', ['zeus', 'hera']),
  e('athena', ['zeus'], { filiations: [{ parents: ['zeus'], principale: true }, { parents: ['zeus', 'metis'], source: 'Hésiode' }] }),
]
const idx = buildIndex(data)

describe('buildIndex', () => {
  it('dérive les enfants depuis toutes les filiations', () => {
    expect([...idx.children.get('zeus')!].sort()).toEqual(['ares', 'athena'])
    expect([...idx.children.get('metis')!]).toEqual(['athena'])
  })
  it('rend les unions symétriques', () => {
    expect(idx.spouses.get('hera')!.has('zeus')).toBe(true)
  })
})

describe('buildGraph', () => {
  const g = buildGraph(idx, new Set(data.map((d) => d.id)))
  it('crée un nœud union par couple de parents', () => {
    const unions = g.nodes.filter((n) => n.kind === 'union').map((n) => n.id).sort()
    expect(unions).toEqual(['u:cronos+rhea', 'u:gaia+ouranos', 'u:hera+zeus', 'u:metis+zeus'])
    expect(g.edges.find((x) => x.source === 'u:hera+zeus' && x.target === 'ares')).toBeTruthy()
  })
  it('trace les filiations alternatives en arêtes "alt"', () => {
    expect(g.edges.find((x) => x.kind === 'alt' && x.source === 'metis' && x.target === 'athena')).toBeTruthy()
    expect(g.edges.find((x) => x.kind === 'parent' && x.source === 'zeus' && x.target === 'athena')).toBeTruthy()
  })
  it("n'inclut que les entités visibles", () => {
    const small = buildGraph(idx, new Set(['zeus', 'ares']))
    expect(small.nodes.map((n) => n.id).sort()).toEqual(['ares', 'zeus'])
    expect(small.edges).toEqual([{ id: 'parent:zeus->ares', source: 'zeus', target: 'ares', kind: 'parent' }])
  })
})

describe('focusSet', () => {
  it('contient parents, grands-parents, fratrie, conjoints et enfants', () => {
    const s = focusSet(idx, 'zeus')
    for (const id of ['cronos', 'rhea', 'ouranos', 'gaia', 'hera', 'metis', 'ares', 'athena']) expect(s.has(id)).toBe(true)
  })
})

describe('validate', () => {
  it('signale références inconnues, tags inconnus et cycles', () => {
    const errs = validate([
      e('a', ['b'], { tags: ['inexistant'] }),
      e('b', ['a']),
      e('c', ['zzz']),
    ])
    expect(errs.some((x) => x.includes('tag inconnu'))).toBe(true)
    expect(errs.some((x) => x.includes('"zzz"'))).toBe(true)
    expect(errs.some((x) => x.includes('cycle'))).toBe(true)
  })
})
