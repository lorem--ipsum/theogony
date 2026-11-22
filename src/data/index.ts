// Données générées par `npm run generate` (scripts/generate.ts) à partir de src/data/entities.
import core from '../generated/core.json'
import { buildIndex, type CoreEntity } from './model'

/** Personnages triés par nom, sans leurs histoires (voir ./stories). */
export const entities: CoreEntity[] = core as unknown as CoreEntity[]

/** Index de parenté ; `mentions` reste vide ici, il est déduit des histoires (voir ./stories). */
export const index = buildIndex(entities)
