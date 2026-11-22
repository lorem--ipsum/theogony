import { z } from 'zod'
import { CATEGORIES } from './categories'

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id en kebab-case ascii')

export const FiliationSchema = z.object({
  parents: z.array(id).max(2),
  source: z.string().optional(),
  principale: z.boolean().optional(),
})

export const UnionSchema = z.object({
  avec: id,
  note: z.string().optional(),
})

export const HistoireSchema = z.object({
  titre: z.string().min(1),
  resume: z.string().min(40),
  personnages: z.array(id).optional(),
  sources: z.array(z.string()).optional(),
})

export const EntitySchema = z.object({
  id,
  nom: z.string().min(1),
  grec: z.string().optional(),
  romain: z.string().optional(),
  categorie: z.enum(CATEGORIES),
  epithete: z.string().optional(),
  domaines: z.array(z.string()).optional(),
  symboles: z.array(z.string()).optional(),
  tags: z.array(z.string()).min(1),
  filiations: z.array(FiliationSchema),
  unions: z.array(UnionSchema).optional(),
  histoires: z.array(HistoireSchema),
})

export const TermeSchema = z.object({
  id,
  terme: z.string().min(1),
  /** catégorie de personnage que ce terme définit, le cas échéant */
  categorie: z.enum(CATEGORIES).optional(),
  definition: z.string().min(40),
  voir: z.array(id).optional(),
  exemples: z.array(id).optional(),
})

export type Entity = z.infer<typeof EntitySchema>
export type Terme = z.infer<typeof TermeSchema>
export type Filiation = z.infer<typeof FiliationSchema>
export type Histoire = z.infer<typeof HistoireSchema>
