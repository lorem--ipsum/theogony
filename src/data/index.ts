import type { Entity } from './schema'
import { buildIndex } from './model'

const modules = import.meta.glob<Entity[]>('./entities/*.json', { eager: true, import: 'default' })

export const entities: Entity[] = Object.values(modules)
  .flat()
  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

export const index = buildIndex(entities)
